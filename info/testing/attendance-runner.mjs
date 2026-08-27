// node --env-file=.env.local info/testing/attendance-runner.mjs [--browser]
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createAttendanceTestDatabase } from "./attendance-database.mjs";

const db = await createAttendanceTestDatabase();
let child;
const env = { ...process.env, DATABASE_URL: db.url, DATABASE_URL_UNPOOLED: db.url,
  VIDMITKA_ATTENDANCE_TEST_SCHEMA: db.schema, ADMIN_EMAILS: "codex.attendance.administrator@example.test" };
async function run(args) {
  child = spawn(process.execPath, args, { cwd: fileURLToPath(new URL("../../", import.meta.url)), env, stdio: "inherit", windowsHide: true });
  return await new Promise((resolve, reject) => {
    child.once("error", reject); child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`Test process exited: ${code}`)));
  });
}
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => {
  child?.kill(); void db.cleanup().then(() => process.exit(0));
});
try {
  await run(["node_modules/vitest/vitest.mjs", "run", process.argv.includes("--groups")
    ? "info/testing/groups-rosters.integration.test.ts" : "info/testing/attendance.integration.test.ts"]);
  if (process.argv.includes("--browser")) {
    console.log("Browser test login: codex.attendance.teacher@example.test / Codex Attendance Test 2026!");
    console.log("Type stop and press Enter for a clean shutdown.");
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (data) => {
      if (String(data).trim() === "stop") {
        child?.kill(); void db.cleanup().then(() => process.exit(0));
      }
    });
    await run(["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3000"]);
  }
} finally { await db.cleanup(); }
