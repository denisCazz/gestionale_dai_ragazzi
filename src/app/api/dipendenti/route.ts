import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { ensureExtendedSchema } from "@/lib/schema-ensure";
import { z } from "zod";

const schema = z.object({
  nome: z.string().trim().min(1),
  cognome: z.string().trim().min(1),
  ruolo: z.string().trim().min(1).optional().default("Sala"),
  telefono: z.string().trim().optional().nullable(),
  email: z.string().trim().optional().nullable(),
  username: z.string().trim().optional().nullable(),
  password: z.string().optional().nullable(),
  dataAssunzione: z.string().optional().nullable(),
  retribuzione: z.coerce.number().min(0).optional().default(0),
  note: z.string().trim().optional().nullable(),
  attivo: z.boolean().optional().default(true),
});

export async function GET() {
  await ensureExtendedSchema();
  const list = await prisma.dipendente.findMany({
    orderBy: [{ cognome: "asc" }, { nome: "asc" }],
  });
  const dipendenti = list.map(({ passwordHash, ...rest }) => ({
    ...rest,
    hasPassword: Boolean(passwordHash),
  }));
  return NextResponse.json({ dipendenti });
}

export async function POST(req: Request) {
  await ensureExtendedSchema();
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  const cleanUser = d.username?.trim().toLowerCase() || null;

  if (cleanUser) {
    const exists = await prisma.dipendente.findFirst({
      where: { username: cleanUser },
    });
    if (exists) {
      return NextResponse.json(
        { error: "Username già in uso per un altro dipendente" },
        { status: 400 }
      );
    }
  }

  const created = await prisma.dipendente.create({
    data: {
      nome: d.nome,
      cognome: d.cognome,
      ruolo: d.ruolo,
      telefono: d.telefono || null,
      email: d.email || null,
      username: cleanUser,
      passwordHash: d.password?.trim() ? hashPassword(d.password.trim()) : null,
      dataAssunzione: d.dataAssunzione ? new Date(d.dataAssunzione) : null,
      retribuzione: d.retribuzione,
      note: d.note || null,
      attivo: d.attivo,
    },
  });
  const { passwordHash, ...dipendente } = created;
  return NextResponse.json(
    { dipendente: { ...dipendente, hasPassword: Boolean(passwordHash) } },
    { status: 201 }
  );
}
