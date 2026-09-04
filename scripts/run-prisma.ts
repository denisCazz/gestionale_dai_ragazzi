import { spawnSync } from "node:child_process";
import { applyDatabaseUrl } from "../src/lib/db-url";

applyDatabaseUrl();
const args = process.argv.slice(2);
const result = spawnSync("npx", ["prisma", ...args], {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});
process.exit(result.status ?? 1);
