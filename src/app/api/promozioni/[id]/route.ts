import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ensureExtendedSchema } from "@/lib/schema-ensure";

const schema = z.object({
  titolo: z.string().trim().min(1).optional(),
  titoloEn: z.string().trim().optional().nullable(),
  quando: z.string().trim().min(1).optional(),
  quandoEn: z.string().trim().optional().nullable(),
  orario: z.string().trim().optional().nullable(),
  prezzo: z.coerce.number().min(0).optional(),
  nota: z.string().trim().optional().nullable(),
  notaEn: z.string().trim().optional().nullable(),
  evidenza: z.boolean().optional(),
  attiva: z.boolean().optional(),
  ordine: z.coerce.number().int().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureExtendedSchema();
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati promozione non validi" }, { status: 400 });
  }
  const d = parsed.data;
  const promozione = await prisma.promozione.update({
    where: { id },
    data: {
      ...d,
      titoloEn: d.titoloEn === undefined ? undefined : d.titoloEn || null,
      quandoEn: d.quandoEn === undefined ? undefined : d.quandoEn || null,
      orario: d.orario === undefined ? undefined : d.orario || null,
      nota: d.nota === undefined ? undefined : d.nota || null,
      notaEn: d.notaEn === undefined ? undefined : d.notaEn || null,
    },
  });
  return NextResponse.json({ promozione });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureExtendedSchema();
  const { id } = await params;
  await prisma.promozione.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
