import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export function loadEnvFile() {
  const path = resolve(process.cwd(), ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export function dbName() {
  const name = process.env.DB_NAME?.trim() || "gestionale_dai_ragazzi";
  if (!/^[A-Za-z0-9_]+$/.test(name)) {
    throw new Error("DB_NAME può contenere solo lettere, numeri e underscore");
  }
  return name;
}

export function mysqlConnection(database?: string) {
  loadEnvFile();
  const host = process.env.DB_HOST?.trim();
  const user = process.env.DB_USER?.trim();
  const password = process.env.DB_PASSWORD;
  if (!host || !user || password === undefined || password === "") {
    throw new Error("Compila DB_HOST, DB_USER e DB_PASSWORD nel file .env");
  }
  return {
    host,
    port: Number(process.env.DB_PORT || 3306),
    user,
    password,
    database,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  };
}

export function applyDatabaseUrl() {
  loadEnvFile();
  if (process.env.DATABASE_URL?.startsWith("mysql://")) {
    return process.env.DATABASE_URL;
  }
  const { host, port, user, password } = mysqlConnection();
  const database = dbName();
  const ssl = process.env.DB_SSL === "true";
  const params = new URLSearchParams();
  if (ssl) params.set("sslaccept", "accept_invalid_certs");
  params.set("connect_timeout", process.env.DB_CONNECT_TIMEOUT || "20");
  params.set("pool_timeout", "20");
  const url = `mysql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}?${params.toString()}`;
  process.env.DATABASE_URL = url;
  return url;
}
