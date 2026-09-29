import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mese = searchParams.get("mese") ?? "";
  const dipendenti = await prisma.dipendente.findMany({
    where: { attivo: true },
    orderBy: [{ cognome: "asc" }, { nome: "asc" }],
  });
  const presenze = await prisma.presenza.findMany({
    where: mese ? { data: { startsWith: mese } } : undefined,
  });
  return NextResponse.json({ dipendenti, presenze });
}

const oraSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
  .nullable()
  .optional();

export async function PUT(req: Request) {
  const parsed = z
    .object({
      dipendenteId: z.string().min(1),
      data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      tipo: z.enum(["PRESENTE", "FERIE", "MALATTIA", "RIPOSO"]).nullable(),
      oraIngresso: oraSchema,
      oraUscita: oraSchema,
    })
    .safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { dipendenteId, data, tipo } = parsed.data;
  if (!tipo) {
    await prisma.presenza.deleteMany({ where: { dipendenteId, data } });
    return NextResponse.json({ presenza: null });
  }
  const orari =
    tipo === "PRESENTE"
      ? {
          oraIngresso: parsed.data.oraIngresso || null,
          oraUscita: parsed.data.oraUscita || null,
        }
      : { oraIngresso: null, oraUscita: null };
  const presenza = await prisma.presenza.upsert({
    where: { dipendenteId_data: { dipendenteId, data } },
    create: { dipendenteId, data, tipo, ...orari },
    update: { tipo, ...orari },
  });
  return NextResponse.json({ presenza });
}
