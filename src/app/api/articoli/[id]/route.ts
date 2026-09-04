import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializeArticolo } from "@/lib/magazzino";
import { z } from "zod";

const updateSchema = z.object({
  codice: z.string().trim().min(1).max(64).optional(),
  ean: z.string().trim().optional().nullable(),
  nome: z.string().trim().min(1).max(200).optional(),
  descrizione: z.string().trim().max(2000).optional().nullable(),
  unitaMisura: z.string().trim().min(1).max(20).optional(),
  sogliaMinima: z.coerce.number().min(0).optional(),
  ubicazione: z.string().trim().max(120).optional().nullable(),
  attivo: z.boolean().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const articolo = await prisma.articolo.findUnique({
    where: { id },
    include: {
      movimenti: { orderBy: { createdAt: "desc" }, take: 30 },
      ingredienti: { include: { voce: { select: { id: true, nome: true } } } },
    },
  });
  if (!articolo) return NextResponse.json({ error: "Non trovato" }, { status: 404 });
  return NextResponse.json({
    ...serializeArticolo(articolo),
    movimenti: articolo.movimenti,
    vociMenu: articolo.ingredienti.map((i) => i.voce),
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const articolo = await prisma.articolo.update({
    where: { id },
    data: {
      ...parsed.data,
      ean: parsed.data.ean === undefined ? undefined : parsed.data.ean?.trim() || null,
    },
  });
  return NextResponse.json(serializeArticolo(articolo));
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.articolo.update({ where: { id }, data: { attivo: false } });
  return NextResponse.json({ ok: true });
}
