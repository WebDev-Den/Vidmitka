import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";

import { getDb } from "@/lib/db";

import { hashPassword, verifyPassword } from "./password";
import type { AccountApproval, AppRole } from "./roles";
import type { LoginInput } from "./validation";

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;
const MAX_WINDOW_ATTEMPTS = 20;

export type AuthUser = Readonly<{
  id: string;
  email: string;
  fullName: string;
  role: AppRole;
  approval: AccountApproval;
  isBootstrapAdministrator: boolean;
}>;

export type AuthenticateAccountResult =
  | Readonly<{ success: true; user: AuthUser }>
  | Readonly<{ success: false; message: string }>;

type UserRow = {
  id: string;
  email: string;
  full_name: string;
  password_hash: string;
  role: AppRole;
  approval_status: AccountApproval;
  is_bootstrap_administrator: boolean;
  failed_login_attempts: number;
  locked_until: string | Date | null;
  created_at: string | Date;
};

function toAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    approval: row.approval_status,
    isBootstrapAdministrator: row.is_bootstrap_administrator,
  };
}

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

export async function authenticateAccount(
  input: LoginInput,
): Promise<AuthenticateAccountResult> {
  const sql = getDb();
  const [row] = (await sql`
    SELECT *
    FROM app_users
    WHERE email_normalized = ${input.email}
    LIMIT 1
  `) as unknown as UserRow[];

  if (!row) {
    await hashPassword(input.password);
    return { success: false, message: "Невірна електронна адреса або пароль." };
  }

  const lockedUntil = row.locked_until ? new Date(row.locked_until) : null;
  if (lockedUntil && lockedUntil.getTime() > Date.now()) {
    return {
      success: false,
      message: "Забагато невдалих спроб. Спробуйте увійти через 15 хвилин.",
    };
  }

  const passwordMatches = await verifyPassword(input.password, row.password_hash);
  if (!passwordMatches) {
    await sql`
      UPDATE app_users
      SET
        failed_login_attempts = CASE
          WHEN locked_until IS NOT NULL AND locked_until <= NOW() THEN 1
          ELSE failed_login_attempts + 1
        END,
        locked_until = CASE
          WHEN (
            CASE
              WHEN locked_until IS NOT NULL AND locked_until <= NOW() THEN 1
              ELSE failed_login_attempts + 1
            END
          ) >= ${MAX_FAILED_ATTEMPTS}
          THEN NOW() + INTERVAL '15 minutes'
          ELSE NULL
        END,
        updated_at = NOW()
      WHERE id = ${row.id}
    `;

    return { success: false, message: "Невірна електронна адреса або пароль." };
  }

  await sql`
    UPDATE app_users
    SET failed_login_attempts = 0, locked_until = NULL, updated_at = NOW()
    WHERE id = ${row.id}
  `;

  return { success: true, user: toAuthUser(row) };
}

export async function consumeAdminLoginPermit(key: string): Promise<boolean> {
  const sql = getDb();
  const keyHash = createHash("sha256").update(key).digest("hex");
  const [row] = await sql`
    INSERT INTO admin_login_throttle (key_hash, window_started_at, attempts)
    VALUES (${keyHash}, NOW(), 1)
    ON CONFLICT (key_hash) DO UPDATE SET
      attempts = CASE WHEN admin_login_throttle.window_started_at < NOW() - INTERVAL '15 minutes'
        THEN 1 ELSE LEAST(admin_login_throttle.attempts + 1, 1000) END,
      window_started_at = CASE WHEN admin_login_throttle.window_started_at < NOW() - INTERVAL '15 minutes'
        THEN NOW() ELSE admin_login_throttle.window_started_at END,
      updated_at = NOW()
    RETURNING attempts
  ` as unknown as Array<{ attempts: number }>;
  return Number(row?.attempts ?? MAX_WINDOW_ATTEMPTS + 1) <= MAX_WINDOW_ATTEMPTS;
}

export async function clearAdminLoginThrottle(key: string): Promise<void> {
  const keyHash = createHash("sha256").update(key).digest("hex");
  const sql = getDb();
  await sql`DELETE FROM admin_login_throttle WHERE key_hash=${keyHash}`;
}

export async function createAuthSession(
  userId: string,
): Promise<Readonly<{ token: string; expiresAt: Date }>> {
  const sql = getDb();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await sql`
    DELETE FROM auth_sessions
    WHERE expires_at <= NOW() OR last_seen_at <= NOW() - INTERVAL '12 hours'
  `;
  await sql`
    INSERT INTO auth_sessions (id, user_id, token_hash, expires_at)
    VALUES (
      ${randomUUID()},
      ${userId},
      ${hashSessionToken(token)},
      ${expiresAt.toISOString()}
    )
  `;

  return { token, expiresAt };
}

export async function findUserBySessionToken(
  token: string,
): Promise<AuthUser | null> {
  if (!/^[A-Za-z0-9_-]{43}$/u.test(token)) return null;

  const sql = getDb();
  const [row] = (await sql`
    WITH active_session AS (
      UPDATE auth_sessions
      SET last_seen_at = NOW()
      WHERE
        token_hash = ${hashSessionToken(token)}
        AND expires_at > NOW()
        AND last_seen_at > NOW() - INTERVAL '12 hours'
      RETURNING user_id
    )
    SELECT app_user.*
    FROM active_session
    JOIN app_users AS app_user ON app_user.id = active_session.user_id
    LIMIT 1
  `) as unknown as UserRow[];

  return row ? toAuthUser(row) : null;
}

export async function revokeAuthSession(token: string): Promise<void> {
  const sql = getDb();
  await sql`
    DELETE FROM auth_sessions
    WHERE token_hash = ${hashSessionToken(token)}
  `;
}
