import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseRange } from "@/lib/dates";
import { z } from "zod";

const schema = z.object({
  tipo: z.enum(["ENTRATA", "USCITA"]),
  importo: z.coerce.number().positive(),
  categoria: z.string().trim().min(1),
  descrizione: z.string().trim().min(1).max(500),
  data: z.string().min(1),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const { from, to } = parseRange(searchParams.get("from"), searchParams.get("to"));
  const movimenti = await prisma.movimentoCassa.findMany({
    where: { data: { gte: from, lte: to } },
    orderBy: { data: "desc" },
  });
  const entrate = movimenti.filter((m) => m.tipo === "ENTRATA").reduce((s, m) => s + m.importo, 0);
  const uscite = movimenti.filter((m) => m.tipo === "USCITA").reduce((s, m) => s + m.importo, 0);
  return NextResponse.json({
    movimenti,
    totale: { entrate, uscite, saldo: entrate - uscite },
  });
}

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const movimento = await prisma.movimentoCassa.create({
    data: {
      tipo: parsed.data.tipo,
      importo: parsed.data.importo,
      categoria: parsed.data.categoria,
      descrizione: parsed.data.descrizione,
      data: new Date(parsed.data.data),
    },
  });
  return NextResponse.json(movimento, { status: 201 });
}
