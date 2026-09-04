import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializeArticolo } from "@/lib/magazzino";
import { z } from "zod";

const createSchema = z.object({
  codice: z.string().trim().min(1).max(64),
  ean: z.string().trim().optional().nullable(),
  nome: z.string().trim().min(1).max(200),
  descrizione: z.string().trim().max(2000).optional().nullable(),
  unitaMisura: z.string().trim().min(1).max(20).optional().default("pz"),
  quantita: z.coerce.number().min(0).optional().default(0),
  sogliaMinima: z.coerce.number().min(0).optional().default(0),
  ubicazione: z.string().trim().max(120).optional().nullable(),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const lowStock = searchParams.get("lowStock") === "true";

  const articoli = await prisma.articolo.findMany({
    where: {
      attivo: true,
      ...(search
        ? {
            OR: [
              { codice: { contains: search } },
              { ean: { contains: search } },
              { nome: { contains: search } },
              { ubicazione: { contains: search } },
            ],
          }
        : {}),
    },
    orderBy: { nome: "asc" },
  });

  const filtered = lowStock
    ? articoli.filter((a) => a.sogliaMinima > 0 && a.quantita <= a.sogliaMinima)
    : articoli;

  return NextResponse.json({
    articoli: filtered.map(serializeArticolo),
    total: filtered.length,
  });
}

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const ean = data.ean?.trim() || null;

  try {
    const articolo = await prisma.$transaction(async (tx) => {
      const created = await tx.articolo.create({
        data: {
          codice: data.codice.trim(),
          ean,
          nome: data.nome.trim(),
          descrizione: data.descrizione?.trim() || null,
          unitaMisura: data.unitaMisura || "pz",
          quantita: data.quantita,
          sogliaMinima: data.sogliaMinima,
          ubicazione: data.ubicazione?.trim() || null,
        },
      });

      if (data.quantita > 0) {
        await tx.movimentoMagazzino.create({
          data: {
            articoloId: created.id,
            tipo: "RETTIFICA",
            quantita: data.quantita,
            note: "Giacenza iniziale",
          },
        });
      }

      return created;
    });

    return NextResponse.json(serializeArticolo(articolo), { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("Unique constraint") || message.includes("unique")) {
      return NextResponse.json(
        { error: "Codice o EAN già presente in magazzino" },
        { status: 409 }
      );
    }
    throw err;
  }
}
