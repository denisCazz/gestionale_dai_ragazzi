import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

export async function GET() {
  const rows = await prisma.categoriaCassa.findMany({
    orderBy: [{ tipo: "asc" }, { ordine: "asc" }, { nome: "asc" }],
  });
  return NextResponse.json({
    categorie: {
      ENTRATA: rows.filter((c) => c.tipo === "ENTRATA"),
      USCITA: rows.filter((c) => c.tipo === "USCITA"),
    },
  });
}

export async function POST(req: Request) {
  const parsed = z
    .object({
      nome: z.string().trim().min(1).max(80),
      tipo: z.enum(["ENTRATA", "USCITA"]),
    })
    .safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const count = await prisma.categoriaCassa.count({ where: { tipo: parsed.data.tipo } });
  try {
    const categoria = await prisma.categoriaCassa.create({
      data: {
        nome: parsed.data.nome,
        tipo: parsed.data.tipo,
        ordine: count + 1,
      },
    });
    return NextResponse.json(categoria, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("Unique constraint") || message.includes("unique")) {
      return NextResponse.json({ error: "Categoria già presente" }, { status: 409 });
    }
    throw err;
  }
}
