import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ensureExtendedSchema } from "@/lib/schema-ensure";

const schema = z.object({
  titolo: z.string().trim().min(1),
  titoloEn: z.string().trim().optional().nullable(),
  quando: z.string().trim().min(1),
  quandoEn: z.string().trim().optional().nullable(),
  orario: z.string().trim().optional().nullable(),
  prezzo: z.coerce.number().min(0),
  nota: z.string().trim().optional().nullable(),
  notaEn: z.string().trim().optional().nullable(),
  evidenza: z.boolean().optional().default(false),
  attiva: z.boolean().optional().default(true),
  ordine: z.coerce.number().int().optional().default(0),
});

export async function GET() {
  await ensureExtendedSchema();
  const promozioni = await prisma.promozione.findMany({
    orderBy: [{ ordine: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ promozioni });
}

export async function POST(req: Request) {
  await ensureExtendedSchema();
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati promozione non validi" }, { status: 400 });
  }
  const d = parsed.data;
  const count = await prisma.promozione.count();
  const promozione = await prisma.promozione.create({
    data: {
      titolo: d.titolo,
      titoloEn: d.titoloEn || null,
      quando: d.quando,
      quandoEn: d.quandoEn || null,
      orario: d.orario || null,
      prezzo: d.prezzo,
      nota: d.nota || null,
      notaEn: d.notaEn || null,
      evidenza: d.evidenza,
      attiva: d.attiva,
      ordine: d.ordine || count + 1,
    },
  });
  return NextResponse.json({ promozione }, { status: 201 });
}
