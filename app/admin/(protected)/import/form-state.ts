import type { ImportIssue } from "@/lib/schedule-import-v2/parser";
import type { ImportDatabasePreview } from "@/lib/schedule-import-v2/repository";
import type { TransferPreview } from "@/lib/schedule-transfer/plan";

export type ImportSummary = Readonly<{
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  teachers: number;
  disciplines: number;
  rooms: number;
  groups: number;
  lessonTypes: number;
  warnings: number;
}>;

export type AdminImportState = Readonly<{
  status: "idle" | "preview" | "error" | "committed";
  message: string;
  summary?: ImportSummary;
  database?: ImportDatabasePreview;
  errors: readonly ImportIssue[];
  warnings: readonly ImportIssue[];
  fileName?: string;
  runId?: string;
  fileHash?: string;
  fingerprint?: string;
  transfer?: TransferPreview;
}>;

export const initialAdminImportState: AdminImportState = {
  status: "idle",
  message: "",
  errors: [],
  warnings: [],
};
