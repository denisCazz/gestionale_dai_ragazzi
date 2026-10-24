import { NextResponse } from "next/server";
import { z } from "zod";
import {
  SESSION_COOKIE,
  credentialsMatch,
  createSessionToken,
  sessionCookieOptions,
  verifyPassword,
} from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureExtendedSchema } from "@/lib/schema-ensure";
import {
  adessoRoma,
  registraAnomaliaEInviaEmail,
  verificaPerimetro,
} from "@/lib/perimetro";

const schema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Inserisci utente e password" }, { status: 400 });
  }

  const { username, password, lat, lng } = parsed.data;

  // 1. Accesso Admin
  if (credentialsMatch(username, password)) {
    const res = NextResponse.json({ ok: true, role: "ADMIN", redirectTo: "/" });
    res.cookies.set(
      SESSION_COOKIE,
      createSessionToken({ u: username.trim(), role: "ADMIN", nome: "Amministratore" }),
      sessionCookieOptions()
    );
    return res;
  }

  // 2. Accesso Dipendente
  await ensureExtendedSchema();
  const normalizedUser = username.trim().toLowerCase();
  const dipendenti = await prisma.dipendente.findMany({
    where: { attivo: true, username: { not: null } },
  });
  const dipendente = dipendenti.find(
    (d) => d.username?.trim().toLowerCase() === normalizedUser
  );

  if (!dipendente || !verifyPassword(password, dipendente.passwordHash)) {
    return NextResponse.json({ error: "Credenziali non valide" }, { status: 401 });
  }

  // Controllo silenzioso sul login da posizione non conforme (IP negozio + fallback GPS)
  try {
    const verifica = await verificaPerimetro(req, { lat, lng });
    if (!verifica.conforme) {
      const { data, ora } = adessoRoma();
      await registraAnomaliaEInviaEmail({
        dipendente,
        azione: "LOGIN",
        data,
        ora,
        verifica,
        req,
      });
    }
  } catch (err) {
    console.error("Errore verifica perimetro al login:", err);
  }

  const res = NextResponse.json({
    ok: true,
    role: "DIPENDENTE",
    redirectTo: "/timbratura",
  });
  res.cookies.set(
    SESSION_COOKIE,
    createSessionToken({
      u: dipendente.username ?? dipendente.id,
      role: "DIPENDENTE",
      dipendenteId: dipendente.id,
      nome: `${dipendente.nome} ${dipendente.cognome}`,
    }),
    sessionCookieOptions()
  );
  return res;
}
