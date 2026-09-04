"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";

import { requireAdminPanelUser } from "@/lib/auth/session";
import { analyzeTeacherScheduleJson } from "@/lib/schedule-import-v2/parser";
import {
  commitTeacherScheduleImport,
  previewTeacherScheduleImport,
} from "@/lib/schedule-import-v2/repository";
import type { ImportCommitResult, ImportDatabasePreview } from "@/lib/schedule-import-v2/repository";

import type { AdminImportState } from "./form-state";
import { processSnapshot } from "./snapshot-action";
import { MAX_TRANSFER_BYTES, SnapshotFormatError } from "@/lib/schedule-transfer/schema";

const MAX_VISIBLE_ISSUES = 100;

function failed(message: string, errors: AdminImportState["errors"] = []): AdminImportState {
  return { status: "error", message, errors: errors.slice(0, MAX_VISIBLE_ISSUES), warnings: [] };
}

export async function processScheduleImportAction(
  previousState: AdminImportState,
  formData: FormData,
): Promise<AdminImportState> {
  const administrator = await requireAdminPanelUser();
  const file = formData.get("scheduleFile");
  const operation = formData.get("operation");

  if (!(file instanceof File) || file.size === 0) return failed("Оберіть непорожній JSON-файл.");
  if (file.size > MAX_TRANSFER_BYTES) return failed("Файл завеликий. Максимальний розмір — 3 МБ.");
  if (!file.name.toLocaleLowerCase("en-US").endsWith(".json")) return failed("Підтримуються лише файли з розширенням .json.");
  if (file.type && !["application/json", "text/json"].includes(file.type)) {
    return failed("Тип файла не відповідає JSON.");
  }

  const content = await file.text();
  const fileHash = createHash("sha256").update(content).digest("hex");
  let value: unknown;
  try { value = JSON.parse(content); } catch { return failed("Файл містить некоректний JSON. Жодних змін не внесено."); }
  if (!Array.isArray(value)) {
    try {
      return await processSnapshot({ value, previous: previousState, formData, administratorId: administrator.id, file, fileHash });
    } catch (error) {
      // Parser errors are safe local messages; provider errors must not leak SQL or credentials.
      if (error instanceof SnapshotFormatError) return failed(error.message);
      return failed("Не вдалося звірити файл із базою. Жодних змін не внесено; спробуйте ще раз.");
    }
  }
  const analysis = analyzeTeacherScheduleJson(content);
  if (!analysis.ok) return failed("Не вдалося проаналізувати JSON.", analysis.errors);

  let database: ImportDatabasePreview;
  try {
    database = await previewTeacherScheduleImport(analysis.rows);
  } catch (error) {
    console.error("schedule_import_preview_failed", {
      administratorId: administrator.id,
      fileHash: createHash("sha256").update(content).digest("hex"),
      reason: error instanceof Error ? error.message : "unknown",
    });
    return failed("Не вдалося звірити файл із базою даних. Жодних змін не внесено.");
  }
  const baseState = {
    summary: analysis.summary,
    database,
    errors: analysis.errors.slice(0, MAX_VISIBLE_ISSUES),
    warnings: analysis.warnings.slice(0, MAX_VISIBLE_ISSUES),
    fileName: file.name,
    fileHash,
  } as const;
  const hasBlockingErrors = analysis.errors.length > 0 || database.missingPeriods.length > 0;

  if (operation !== "commit") {
    return {
      status: hasBlockingErrors ? "error" : "preview",
      message: hasBlockingErrors
        ? "Dry-run завершено: виправте помилки перед імпортом. Жодних змін не внесено."
        : "Dry-run завершено. Жодних змін не внесено. Перевірте підсумок і підтвердьте імпорт.",
      ...baseState,
    };
  }

  if (hasBlockingErrors) {
    return { status: "error", message: "Імпорт заблоковано помилками preview.", ...baseState };
  }
  if (previousState.status !== "preview" || previousState.fileHash !== fileHash) {
    return { status: "preview", message: "Dry-run оновлено для цього файлу. Перевірте підсумок і підтвердьте імпорт ще раз.", ...baseState };
  }
  if (analysis.warnings.length > 0 && formData.get("confirmWarnings") !== "on") {
    return {
      status: "preview",
      message: "Підтвердьте, що перевірили попередження про можливі конфлікти.",
      ...baseState,
    };
  }

  let result: ImportCommitResult;
  try {
    result = await commitTeacherScheduleImport({
      administratorId: administrator.id,
      fileName: file.name,
      fileHash: createHash("sha256").update(content).digest("hex"),
      fileSizeBytes: file.size,
      warningCount: analysis.warnings.length,
      rows: analysis.rows,
    });
  } catch (error) {
    console.error("schedule_import_commit_failed", {
      administratorId: administrator.id,
      fileHash: createHash("sha256").update(content).digest("hex"),
      reason: error instanceof Error ? error.message : "unknown",
    });
    return { status: "error", message: "Імпорт не виконано: транзакцію відхилено без часткового запису.", ...baseState };
  }

  revalidatePath("/");
  revalidatePath("/schedule");
  revalidatePath("/admin");
  revalidatePath("/admin/schedule");
  revalidatePath("/admin/exceptions");
  revalidatePath("/admin/import");
  revalidatePath("/transfers");

  return {
    status: "committed",
    message: `Імпорт завершено: створено ${result.createdCount}, оновлено ${result.updatedCount}, пропущено ${result.skippedCount}.`,
    ...baseState,
    runId: result.runId,
  };
}
