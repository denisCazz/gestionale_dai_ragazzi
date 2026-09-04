import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  categoriaId: z.string().min(1).optional(),
  nome: z.string().trim().min(1).max(200).optional(),
  descrizione: z.string().trim().max(2000).optional().nullable(),
  prezzo: z.coerce.number().min(0).optional(),
  attivo: z.boolean().optional(),
  ingredienti: z
    .array(
      z.object({
        articoloId: z.string().min(1),
        quantitaNecessaria: z.coerce.number().positive(),
      })
    )
    .optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { ingredienti, ...rest } = parsed.data;

  const voce = await prisma.$transaction(async (tx) => {
    if (ingredienti) {
      await tx.ingredienteMenu.deleteMany({ where: { voceMenuId: id } });
      if (ingredienti.length) {
        await tx.ingredienteMenu.createMany({
          data: ingredienti.map((ing) => ({ ...ing, voceMenuId: id })),
        });
      }
    }
    return tx.voceMenu.update({
      where: { id },
      data: rest,
      include: {
        categoria: true,
        ingredienti: { include: { articolo: true } },
      },
    });
  });

  return NextResponse.json(voce);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.voceMenu.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
