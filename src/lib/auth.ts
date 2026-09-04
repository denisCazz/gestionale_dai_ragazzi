import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "gestionale_session";
const SESSION_DAYS = 7;

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

export function createSessionToken() {
  const payload = Buffer.from(
    JSON.stringify({
      u: authUser(),
      exp: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
    })
  ).toString("base64url");
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySession(token: string | undefined) {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  if (!safeEqual(sig, expected)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      exp?: number;
    };
    return typeof data.exp === "number" && data.exp > Date.now();
  } catch {
    return false;
  }
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
