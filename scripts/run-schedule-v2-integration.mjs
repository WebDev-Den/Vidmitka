import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const vitest = fileURLToPath(new URL("../node_modules/vitest/vitest.mjs", import.meta.url));
const child = spawn(process.execPath, [vitest, "run", "info/testing/schedule-v2.integration.test.ts", "--reporter=verbose"], {
  cwd: process.cwd(),
  env: { ...process.env, RUN_SCHEDULE_V2_DB_INTEGRATION: "1" },
  stdio: "inherit",
});

child.once("error", (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
child.once("exit", (code) => {
  process.exitCode = code ?? 1;
});
