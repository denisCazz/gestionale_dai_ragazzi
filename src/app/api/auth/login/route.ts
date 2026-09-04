import { NextResponse } from "next/server";
import { z } from "zod";
import {
  SESSION_COOKIE,
  credentialsMatch,
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/auth";

const schema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Inserisci utente e password" }, { status: 400 });
  }
  if (!credentialsMatch(parsed.data.username, parsed.data.password)) {
    return NextResponse.json({ error: "Credenziali non valide" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, createSessionToken(), sessionCookieOptions());
  return res;
}
