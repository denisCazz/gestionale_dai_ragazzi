import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { parseRange } from "@/lib/dates";
import {
  RIGHE_GIORNATA,
  accumula,
  conNota,
  noteGiornata,
  roundEuro,
  type ImportiGiornata,
} from "@/lib/cassa-giornata";

const amount = z.coerce.number().min(0).max(1_000_000).transform(roundEuro);

const nota = z.string().trim().max(2000);

const schema = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  entrate: z.object({
    carte: amount,
    satispay: amount,
    contanti: amount,
  }),
  uscite: z.object({
    contanti: amount,
  }),
  note: z.object({
    entrate: nota,
    uscite: nota,
  }),
});

function giornataOf(
  data: string,
  movimenti: { tipo: "ENTRATA" | "USCITA"; categoria: string; importo: number; descrizione: string }[]
) {
  const totali = accumula(movimenti);
  return {
    data,
    entrate: totali.entrate,
    uscite: totali.uscite,
    note: {
      entrate: noteGiornata(movimenti, "ENTRATA"),
      uscite: noteGiornata(movimenti, "USCITA"),
    },
  };
}

export async function GET(req: Request) {
  const data = new URL(req.url).searchParams.get("data");
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return NextResponse.json({ error: "Data non valida" }, { status: 400 });
  }
  const { from, to } = parseRange(data, data);
  const movimenti = await prisma.movimentoCassa.findMany({
    where: { data: { gte: from, lte: to } },
  });
  return NextResponse.json(giornataOf(data, movimenti));
}

export async function PUT(req: Request) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Controlla data e importi" }, { status: 400 });
  }
  const { data, entrate, uscite, note } = parsed.data;
  const importi: ImportiGiornata = { entrate, uscite };
  const giorno = new Date(`${data}T12:00:00`);
  if (Number.isNaN(giorno.getTime())) {
    return NextResponse.json({ error: "Data non valida" }, { status: 400 });
  }

  const { from, to } = parseRange(data, data);
  const esistenti = await prisma.movimentoCassa.findMany({
    where: { data: { gte: from, lte: to } },
  });
  await prisma.$transaction(async (tx) => {
    if (esistenti.length > 0) {
      await tx.movimentoCassa.deleteMany({ where: { id: { in: esistenti.map((movimento) => movimento.id) } } });
    }
    const righe = RIGHE_GIORNATA.flatMap((riga) => {
      const importo = riga.amount(importi);
      if (importo <= 0) return [];
      return [
        {
          tipo: riga.tipo,
          categoria: riga.categoria,
          descrizione: riga.descrizione,
          importo,
          data: giorno,
        },
      ];
    });
    attaccaNota(righe, "ENTRATA", note.entrate, giorno);
    attaccaNota(righe, "USCITA", note.uscite, giorno);
    if (righe.length > 0) {
      await tx.movimentoCassa.createMany({ data: righe });
    }
  });

  const salvati = await prisma.movimentoCassa.findMany({
    where: { data: { gte: from, lte: to } },
  });
  return NextResponse.json(giornataOf(data, salvati));
}

function attaccaNota(
  righe: { tipo: "ENTRATA" | "USCITA"; categoria: string; descrizione: string; importo: number; data: Date }[],
  tipo: "ENTRATA" | "USCITA",
  nota: string,
  giorno: Date
) {
  const clean = nota.trim();
  if (!clean) return;
  const destinazione =
    tipo === "USCITA"
      ? righe.find((riga) => riga.tipo === "USCITA")
      : (righe.find((riga) => riga.tipo === "ENTRATA" && riga.categoria === "Contanti") ??
        righe.find((riga) => riga.tipo === "ENTRATA"));
  if (destinazione) {
    destinazione.descrizione = conNota(destinazione.descrizione, clean);
    return;
  }
  righe.push({
    tipo,
    categoria: "Contanti",
    descrizione: conNota(tipo === "USCITA" ? "Uscita contanti" : "Incasso contanti", clean),
    importo: 0,
    data: giorno,
  });
}
