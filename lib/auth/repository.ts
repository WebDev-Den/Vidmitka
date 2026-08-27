import "server-only";

import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

import { getDb } from "@/lib/db";

import { hashPassword, verifyPassword } from "./password";
import { resolveAccountAccess, type AccountApproval, type AppRole } from "./roles";
import type { LoginInput, RegistrationInput } from "./validation";

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;

export type AuthUser = Readonly<{
  id: string;
  email: string;
  fullName: string;
  role: AppRole;
  approval: AccountApproval;
}>;

export type TeacherAccount = AuthUser &
  Readonly<{
    createdAt: string;
  }>;

export type RegisterAccountResult =
  | Readonly<{ success: true; user: AuthUser }>
  | Readonly<{ success: false; message: string }>;

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
  };
}

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

function hasAdministratorRegistrationCode(value: string): boolean {
  const expected = process.env.ADMIN_REGISTRATION_TOKEN;
  if (!expected || !value) return false;

  return timingSafeEqual(
    createHash("sha256").update(expected).digest(),
    createHash("sha256").update(value).digest(),
  );
}

export async function registerAccount(
  input: RegistrationInput,
): Promise<RegisterAccountResult> {
  const sql = getDb();
  const access = resolveAccountAccess(input.email, false);
  if (
    access.role === "administrator" &&
    !hasAdministratorRegistrationCode(input.administratorCode)
  ) {
    return {
      success: false,
      message: "Для реєстрації адміністратора введіть правильний код адміністратора.",
    };
  }
  const id = randomUUID();
  const passwordHash = await hashPassword(input.password);

  try {
    const [row] = (await sql`
      INSERT INTO app_users (
        id,
        email,
        email_normalized,
        full_name,
        password_hash,
        role,
        approval_status,
        approved_at
      )
      VALUES (
        ${id},
        ${input.email},
        ${input.email},
        ${input.fullName},
        ${passwordHash},
        ${access.role},
        ${access.approval},
        ${access.approval === "approved" ? new Date().toISOString() : null}
      )
      RETURNING *
    `) as unknown as UserRow[];

    if (!row) throw new Error("Обліковий запис не створено.");
    return { success: true, user: toAuthUser(row) };
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      return {
        success: false,
        message: "Обліковий запис із цією електронною адресою вже існує.",
      };
    }
    throw error;
  }
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

export async function listTeacherAccounts(): Promise<TeacherAccount[]> {
  const sql = getDb();
  const rows = (await sql`
    SELECT *
    FROM app_users
    WHERE role = 'teacher'
    ORDER BY created_at DESC
  `) as unknown as UserRow[];

  return rows.map((row) => ({
    ...toAuthUser(row),
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

export async function approveTeacherAccount(
  userId: string,
  administratorId: string,
): Promise<boolean> {
  const sql = getDb();
  const rows = (await sql`
    UPDATE app_users
    SET
      approval_status = 'approved',
      approved_at = NOW(),
      approved_by_user_id = ${administratorId},
      updated_at = NOW()
    WHERE id = ${userId} AND role = 'teacher'
    RETURNING id
  `) as unknown as Array<{ id: string }>;

  return rows.length === 1;
}
