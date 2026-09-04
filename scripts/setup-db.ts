import { spawnSync } from "node:child_process";
import mysql from "mysql2/promise";
import { applyDatabaseUrl, dbName, mysqlConnection } from "../src/lib/db-url";

async function createDatabase() {
  const name = dbName();
  const conn = await mysql.createConnection(mysqlConnection());
  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    console.log(`Database ${name} pronto`);
  } finally {
    await conn.end();
  }
}

function run(command: string, args: string[]) {
  applyDatabaseUrl();
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function main() {
  await createDatabase();
  applyDatabaseUrl();
  run("npx", ["prisma", "generate"]);
  run("npx", ["prisma", "db", "push"]);
  run("npx", ["tsx", "prisma/seed.ts"]);
  console.log("Database pronto: schema applicato e seed completato.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
