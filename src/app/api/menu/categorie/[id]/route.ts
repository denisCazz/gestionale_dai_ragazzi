import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { uniqueCategoriaSlug } from "@/lib/public-menu";
import { z } from "zod";

const schema = z.object({
  nome: z.string().trim().min(1).max(120).optional(),
  sottotitolo: z.string().trim().max(300).optional().nullable(),
  slug: z.string().trim().min(1).max(64).optional(),
  ordine: z.coerce.number().int().optional(),
  pubblicata: z.boolean().optional(),
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
  const data = parsed.data;
  const slug =
    data.slug?.trim() ||
    (data.nome ? await uniqueCategoriaSlug(data.nome, id) : undefined);

  try {
    const categoria = await prisma.categoriaMenu.update({
      where: { id },
      data: {
        nome: data.nome,
        sottotitolo:
          data.sottotitolo === undefined ? undefined : data.sottotitolo || null,
        slug,
        ordine: data.ordine,
        pubblicata: data.pubblicata,
      },
    });
    return NextResponse.json(categoria);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("Unique constraint") || message.includes("unique")) {
      return NextResponse.json({ error: "Slug già in uso" }, { status: 409 });
    }
    throw err;
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.voceMenu.deleteMany({ where: { categoriaId: id } });
  await prisma.categoriaMenu.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
