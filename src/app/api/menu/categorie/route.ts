import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { uniqueCategoriaSlug } from "@/lib/public-menu";
import { z } from "zod";

export async function GET() {
  const categorie = await prisma.categoriaMenu.findMany({
    orderBy: { ordine: "asc" },
  });
  return NextResponse.json({ categorie });
}

export async function POST(req: Request) {
  const parsed = z
    .object({
      nome: z.string().trim().min(1).max(120),
      sottotitolo: z.string().trim().max(300).optional().nullable(),
      slug: z.string().trim().min(1).max(64).optional(),
      pubblicata: z.boolean().optional().default(true),
    })
    .safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const count = await prisma.categoriaMenu.count();
  const slug = parsed.data.slug?.trim() || (await uniqueCategoriaSlug(parsed.data.nome));
  try {
    const categoria = await prisma.categoriaMenu.create({
      data: {
        nome: parsed.data.nome,
        sottotitolo: parsed.data.sottotitolo || null,
        slug,
        pubblicata: parsed.data.pubblicata ?? true,
        ordine: count + 1,
      },
    });
    return NextResponse.json(categoria, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("Unique constraint") || message.includes("unique")) {
      return NextResponse.json({ error: "Nome o slug già presente" }, { status: 409 });
    }
    throw err;
  }
}
