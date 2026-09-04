import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { getDb } from "@/lib/db";
import { ApiError } from "./http";

export function verifyBearer(header: string | null, configuredKey: string | undefined): boolean {
  if (!configuredKey || configuredKey.length < 32 || configuredKey.length > 512) return false;
  const match = /^Bearer ([A-Za-z0-9_-]{32,512})$/iu.exec(header ?? "");
  if (!match) return false;
  const hash = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(hash(match[1]), hash(configuredKey));
}

/** Cookie login and client-supplied user IDs never grant integration privileges. */
export async function requireApiAdministrator(request: Request): Promise<string> {
  const key = process.env.SCHEDULE_API_KEY;
  const administratorId = process.env.SCHEDULE_API_ADMIN_ID;
  if (!key || !/^[A-Za-z0-9_-]{32,512}$/u.test(key) || !administratorId || !/^[A-Za-z0-9_-]{1,128}$/u.test(administratorId)) {
    throw new ApiError(503, "API_NOT_CONFIGURED", "Інтеграційний API ще не налаштовано.");
  }
  if (!verifyBearer(request.headers.get("authorization"), key)) {
    throw new ApiError(401, "UNAUTHORIZED", "Потрібен коректний Bearer API-ключ.");
  }
  const sql = getDb();
  const rows = await sql`SELECT id FROM app_users WHERE id=${administratorId} AND role='administrator' AND approval_status='approved'`;
  if (!rows.length) throw new ApiError(403, "FORBIDDEN", "Адміністратору інтеграції більше не дозволено керування.");
  return administratorId;
}
