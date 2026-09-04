import "server-only";

import { createHash } from "node:crypto";
import { analyzeTeacherScheduleJson } from "@/lib/schedule-import-v2/parser";
import { previewTeacherScheduleImport, commitTeacherScheduleImport } from "@/lib/schedule-import-v2/repository";
import { ApiError, isRecord, queryParams, readJson } from "./http";
import type { ApiResult } from "./collections";

export async function handleImport(request: Request, operation: string | undefined, administratorId: string): Promise<ApiResult> {
  if (request.method !== "POST" || (operation !== "preview" && operation !== "commit")) throw new ApiError(405, "METHOD_NOT_ALLOWED", "Використовуйте POST /imports/preview або /imports/commit.");
  queryParams(new URL(request.url), []);
  const value = await readJson(request, 4 * 1024 * 1024);
  if (!isRecord(value) || !Array.isArray(value.records) || Object.keys(value).some((key) => !["records", "confirmWarnings"].includes(key))
    || (value.confirmWarnings !== undefined && typeof value.confirmWarnings !== "boolean")) {
    throw new ApiError(422, "INVALID_FIELDS", "Потрібні records: масив і необов’язкове confirmWarnings: boolean.");
  }
  const content = JSON.stringify(value.records);
  const analysis = analyzeTeacherScheduleJson(content);
  if (!analysis.ok) throw new ApiError(422, "IMPORT_INVALID", "JSON імпорту некоректний.", { errors: analysis.errors.slice(0, 100) });
  const database = await previewTeacherScheduleImport(analysis.rows);
  const preview = { summary: analysis.summary, database, errors: analysis.errors.slice(0, 100), warnings: analysis.warnings.slice(0, 100) };
  const blocked = analysis.errors.length > 0 || database.missingPeriods.length > 0;
  if (operation === "preview") return { data: { ...preview, canCommit: !blocked } };
  if (blocked) throw new ApiError(422, "IMPORT_INVALID", "Виправте помилки перед імпортом.", preview);
  if (analysis.warnings.length && value.confirmWarnings !== true) throw new ApiError(409, "WARNINGS_REQUIRE_CONFIRMATION", "Перевірте попередження й передайте confirmWarnings: true.", preview);
  const result = await commitTeacherScheduleImport({
    administratorId, fileName: "rest-api-import.json", fileHash: createHash("sha256").update(content).digest("hex"),
    fileSizeBytes: Buffer.byteLength(content), warningCount: analysis.warnings.length, rows: analysis.rows,
  });
  return { data: { ...result, ...preview }, status: 200 };
}
