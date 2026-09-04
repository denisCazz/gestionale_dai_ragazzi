import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializeArticolo } from "@/lib/magazzino";
import { z } from "zod";

const movimentoSchema = z.object({
  articoloId: z.string().min(1),
  tipo: z.enum(["ENTRATA", "USCITA", "RETTIFICA"]),
  quantita: z.coerce.number().positive("Quantità deve essere > 0"),
  note: z.string().trim().max(500).optional().nullable(),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const articoloId = searchParams.get("articoloId");
  const movimenti = await prisma.movimentoMagazzino.findMany({
    where: articoloId ? { articoloId } : undefined,
    include: { articolo: { select: { nome: true, unitaMisura: true } } },
    orderBy: { createdAt: "desc" },
    take: 80,
  });
  return NextResponse.json({ movimenti });
}

export async function POST(req: Request) {
  const parsed = movimentoSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { articoloId, tipo, quantita, note } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const articolo = await tx.articolo.findUnique({ where: { id: articoloId } });
      if (!articolo || !articolo.attivo) throw new Error("ARTICOLO_NOT_FOUND");

      let nuova = articolo.quantita;
      if (tipo === "ENTRATA") nuova = articolo.quantita + quantita;
      else if (tipo === "USCITA") {
        if (quantita > articolo.quantita) throw new Error("STOCK_INSUFFICIENTE");
        nuova = articolo.quantita - quantita;
      } else {
        nuova = quantita;
      }

      const updated = await tx.articolo.update({
        where: { id: articoloId },
        data: { quantita: nuova },
      });

      const movimento = await tx.movimentoMagazzino.create({
        data: {
          articoloId,
          tipo,
          quantita: tipo === "RETTIFICA" ? nuova : quantita,
          note: note?.trim() || null,
        },
      });

      return { articolo: updated, movimento };
    });

    return NextResponse.json({
      articolo: serializeArticolo(result.articolo),
      movimento: result.movimento,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "ARTICOLO_NOT_FOUND") {
      return NextResponse.json({ error: "Articolo non trovato" }, { status: 404 });
    }
    if (message === "STOCK_INSUFFICIENTE") {
      return NextResponse.json(
        { error: "Giacenza insufficiente per l'uscita" },
        { status: 409 }
      );
    }
    throw err;
  }
}
