import { spawn } from "node:child_process";

import {
  createScheduleV2TestDatabase,
  destroyScheduleV2TestDatabase,
  qaAdministrator,
} from "../info/testing/schedule-v2-test-database.mjs";

const baseConnectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!baseConnectionString) throw new Error("DATABASE_URL_UNPOOLED або DATABASE_URL не налаштовано.");

const requested = process.argv.slice(2);
const command = requested[0] ?? "pnpm";
const commandArgs = requested.length > 0 ? requested.slice(1) : ["start", "--port", "3013"];
const testDatabase = await createScheduleV2TestDatabase(baseConnectionString);

console.log(`QA schema: ${testDatabase.schemaName}`);
console.log(`QA administrator: ${qaAdministrator.email} / ${qaAdministrator.password}`);

let child;
let stopChild;
let exitCode = 1;
try {
  child = spawn(command, commandArgs, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: testDatabase.connectionString,
      DATABASE_URL_UNPOOLED: testDatabase.connectionString,
      QA_TEST_SCHEMA: testDatabase.schemaName,
    },
    shell: process.platform === "win32",
    stdio: "inherit",
  });
  stopChild = () => {
    if (child && !child.killed) child.kill("SIGINT");
  };
  process.once("SIGINT", stopChild);
  process.once("SIGTERM", stopChild);
  exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
} finally {
  if (stopChild) {
    process.removeListener("SIGINT", stopChild);
    process.removeListener("SIGTERM", stopChild);
  }
  await destroyScheduleV2TestDatabase(baseConnectionString, testDatabase.schemaName);
  console.log(`QA schema removed: ${testDatabase.schemaName}`);
}
process.exitCode = exitCode;
