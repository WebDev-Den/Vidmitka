import { randomBytes, randomUUID, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";

import { neon } from "@neondatabase/serverless";

const scrypt = promisify(scryptCallback);
const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
const email = process.env.ADMIN_EMAIL?.trim().toLocaleLowerCase("en-US");
const fullName = process.env.ADMIN_NAME?.trim();
const password = process.env.ADMIN_PASSWORD;

if (!connectionString || !email || !fullName || !password) {
  console.error("Заповніть DATABASE_URL, ADMIN_EMAIL, ADMIN_NAME та ADMIN_PASSWORD у .env.local.");
  process.exit(1);
}
if (!/^\S+@\S+\.\S+$/u.test(email) || fullName.length < 3 || password.length < 10 ||
    !/[A-ZА-ЯІЇЄ]/u.test(password) || !/[a-zа-яіїє]/u.test(password) || !/\d/u.test(password) || !/[^\p{L}\p{N}]/u.test(password)) {
  console.error("Пароль має містити щонайменше 10 символів, великі й малі літери, цифру та спеціальний символ.");
  process.exit(1);
}

const salt = randomBytes(16);
const hash = await scrypt(password, salt, 64, { N: 16_384, r: 8, p: 5, maxmem: 32 * 1024 * 1024 });
const passwordHash = ["scrypt", "16384", "8", "5", salt.toString("base64url"), hash.toString("base64url")].join("$");
const sql = neon(connectionString);
const rows = await sql`
  INSERT INTO app_users (id, email, email_normalized, full_name, password_hash, role, approval_status,
    approved_at, is_bootstrap_administrator)
  VALUES (${randomUUID()}, ${email}, ${email}, ${fullName}, ${passwordHash}, 'administrator', 'approved', NOW(), TRUE)
  ON CONFLICT (email_normalized) DO UPDATE SET email=EXCLUDED.email, full_name=EXCLUDED.full_name,
    password_hash=EXCLUDED.password_hash, role='administrator', approval_status='approved', approved_at=NOW(),
    is_bootstrap_administrator=TRUE, failed_login_attempts=0, locked_until=NULL, updated_at=NOW()
  RETURNING email
`;
console.log(`Адміністратора ${rows[0].email} створено або оновлено. Пароль у лог не виводиться.`);
