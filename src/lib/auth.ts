import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "gestionale_session";
const SESSION_DAYS = 7;

export type SessionRole = "ADMIN" | "DIPENDENTE";

export type SessionPayload = {
  u: string;
  role: SessionRole;
  dipendenteId?: string;
  nome?: string;
  exp: number;
};

export function authUser() {
  return process.env.AUTH_USER?.trim() || "admin";
}

export function authPassword() {
  return process.env.AUTH_PASSWORD || "dairagazzi";
}

function secret() {
  return process.env.AUTH_SECRET?.trim() || "gestionale-dai-ragazzi-dev-secret";
}

export function credentialsMatch(username: string, password: string) {
  return safeEqual(username.trim(), authUser()) && safeEqual(password, authPassword());
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, storedHash: string | null | undefined): boolean {
  if (!storedHash) return false;
  const parts = storedHash.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") {
    return safeEqual(password, storedHash);
  }
  const [, salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  try {
    const derived = scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHex, "hex");
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function createSessionToken(opts?: {
  u?: string;
  role?: SessionRole;
  dipendenteId?: string;
  nome?: string;
}) {
  const payloadObj: SessionPayload = {
    u: opts?.u ?? authUser(),
    role: opts?.role ?? "ADMIN",
    dipendenteId: opts?.dipendenteId,
    nome: opts?.nome,
    exp: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
  };
  const payload = Buffer.from(JSON.stringify(payloadObj)).toString("base64url");
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function parseSession(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  if (!safeEqual(sig, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<SessionPayload>;
    if (typeof data.exp !== "number" || data.exp <= Date.now()) return null;
    const role: SessionRole = data.role === "DIPENDENTE" ? "DIPENDENTE" : "ADMIN";
    if (role === "DIPENDENTE" && !data.dipendenteId) return null;
    return {
      u: typeof data.u === "string" ? data.u : authUser(),
      role,
      dipendenteId: data.dipendenteId,
      nome: data.nome,
      exp: data.exp,
    };
  } catch {
    return null;
  }
}

export function verifySession(token: string | undefined) {
  return parseSession(token) !== null;
}

export function getSessionFromRequest(req: Request): SessionPayload | null {
  const cookieHeader = req.headers.get("cookie") ?? "";
  for (const part of cookieHeader.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === SESSION_COOKIE) {
      return parseSession(decodeURIComponent(rest.join("=")));
    }
  }
  return null;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    secure: process.env.NODE_ENV === "production",
  };
}

export function newAuthSecret() {
  return randomBytes(32).toString("hex");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
