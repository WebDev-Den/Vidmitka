import "server-only";

import { revalidatePath } from "next/cache";
import { parseSnapshot } from "@/lib/schedule-transfer/schema";
import { commitSnapshot, previewSnapshot, StaleTransferError } from "@/lib/schedule-transfer/repository";
import type { AdminImportState } from "./form-state";

export async function processSnapshot(input: {
  value: unknown; previous: AdminImportState; formData: FormData;
  administratorId: string; file: File; fileHash: string;
}): Promise<AdminImportState> {
  const snapshot = parseSnapshot(input.value);
  const preview = await previewSnapshot(snapshot);
  const { counts, errors, warnings } = preview.plan;
  const base: AdminImportState = {
    status: errors.length ? "error" : "preview", message: errors.length
      ? "Dry-run: імпорт заблоковано. Жодних змін не внесено."
      : "Dry-run завершено. Жодних змін не внесено. Перевірте підсумок перед імпортом.",
    fileName: input.file.name, fileHash: input.fileHash, fingerprint: preview.fingerprint,
    transfer: { counts, errors, warnings },
    errors: errors.map((message) => ({ code: "SNAPSHOT_VALIDATION", message })),
    warnings: warnings.map((message) => ({ code: "SCHEDULE_CONFLICT", message })),
  };
  if (input.formData.get("operation") !== "commit" || errors.length) return base;
  if (input.previous.status !== "preview" || input.previous.fileHash !== input.fileHash || input.previous.fingerprint !== preview.fingerprint) {
    return { ...base, message: "Файл або розклад змінився. Dry-run оновлено без запису; перевірте новий підсумок і підтвердьте ще раз." };
  }
  const confirmWarnings = input.formData.get("confirmWarnings") === "on";
  if (warnings.length && !confirmWarnings) return { ...base, message: "Підтвердьте, що перевірили попередження." };
  try {
    const result = await commitSnapshot({ snapshot, expectedFingerprint: preview.fingerprint,
      administratorId: input.administratorId, fileName: input.file.name, fileHash: input.fileHash,
      fileSize: input.file.size, confirmWarnings });
    revalidatePath("/", "layout");
    return { ...base, status: "committed", runId: result.runId,
      message: "Імпорт завершено. Застосовано перевірені зміни; записи поза файлом збережено." };
  } catch (error) {
    if (error instanceof StaleTransferError) return { ...base, status: "error", message: error.message };
    console.error("schedule_snapshot_commit_failed", { code: (error as { code?: string }).code ?? "unknown" });
    return { ...base, status: "error", message: "Імпорт відхилено без часткового запису. Оновіть dry-run; перевірте дублікати та зв’язки записів." };
  }
}
