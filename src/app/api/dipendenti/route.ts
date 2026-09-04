import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  nome: z.string().trim().min(1),
  cognome: z.string().trim().min(1),
  ruolo: z.string().trim().min(1).optional().default("Sala"),
  telefono: z.string().trim().optional().nullable(),
  email: z.string().trim().optional().nullable(),
  dataAssunzione: z.string().optional().nullable(),
  retribuzione: z.coerce.number().min(0).optional().default(0),
  note: z.string().trim().optional().nullable(),
  attivo: z.boolean().optional().default(true),
});

export async function GET() {
  const dipendenti = await prisma.dipendente.findMany({
    orderBy: [{ cognome: "asc" }, { nome: "asc" }],
  });
  return NextResponse.json({ dipendenti });
}

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  const dipendente = await prisma.dipendente.create({
    data: {
      nome: d.nome,
      cognome: d.cognome,
      ruolo: d.ruolo,
      telefono: d.telefono || null,
      email: d.email || null,
      dataAssunzione: d.dataAssunzione ? new Date(d.dataAssunzione) : null,
      retribuzione: d.retribuzione,
      note: d.note || null,
      attivo: d.attivo,
    },
  });
  return NextResponse.json({ dipendente }, { status: 201 });
}
