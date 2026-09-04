import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseRange, toInputDate } from "@/lib/dates";
import { isLowStock } from "@/lib/magazzino";
import { disponibilitàVoce } from "@/lib/menu";
import { eachDayOfInterval, format } from "date-fns";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const { from, to } = parseRange(searchParams.get("from"), searchParams.get("to"));

  const [movimentiCassa, articoli, voci, dipendenti] = await Promise.all([
    prisma.movimentoCassa.findMany({
      where: { data: { gte: from, lte: to } },
      orderBy: { data: "desc" },
    }),
    prisma.articolo.findMany({ where: { attivo: true }, include: { ingredienti: true } }),
    prisma.voceMenu.findMany({
      where: { attivo: true },
      include: {
        categoria: true,
        ingredienti: { include: { articolo: true } },
      },
      orderBy: [{ categoria: { ordine: "asc" } }, { ordine: "asc" }],
    }),
    prisma.dipendente.findMany({ where: { attivo: true } }),
  ]);

  const entrate = movimentiCassa
    .filter((m) => m.tipo === "ENTRATA")
    .reduce((s, m) => s + m.importo, 0);
  const uscite = movimentiCassa
    .filter((m) => m.tipo === "USCITA")
    .reduce((s, m) => s + m.importo, 0);

  const days = eachDayOfInterval({ start: from, end: to });
  const series = days.map((day) => {
    const key = format(day, "yyyy-MM-dd");
    const ofDay = movimentiCassa.filter((m) => format(m.data, "yyyy-MM-dd") === key);
    return {
      date: key,
      entrate: ofDay.filter((m) => m.tipo === "ENTRATA").reduce((s, m) => s + m.importo, 0),
      uscite: ofDay.filter((m) => m.tipo === "USCITA").reduce((s, m) => s + m.importo, 0),
    };
  });

  const sottoScorta = articoli
    .filter((a) => isLowStock(a.quantita, a.sogliaMinima))
    .map((a) => ({
      id: a.id,
      nome: a.nome,
      quantita: a.quantita,
      sogliaMinima: a.sogliaMinima,
      unitaMisura: a.unitaMisura,
    }));

  const menu = voci.map((v) => {
    const disp = disponibilitàVoce(v.ingredienti);
    return {
      id: v.id,
      nome: v.nome,
      categoria: v.categoria.nome,
      prezzo: v.prezzo,
      disponibile: disp.disponibile,
      mancanti: disp.mancanti,
    };
  });

  return NextResponse.json({
    range: { from: toInputDate(from), to: toInputDate(to) },
    cassa: {
      entrate,
      uscite,
      saldo: entrate - uscite,
      movimenti: movimentiCassa.slice(0, 8),
      series,
    },
    magazzino: {
      articoli: articoli.length,
      sottoScorta,
    },
    menu: {
      disponibili: menu.filter((m) => m.disponibile).length,
      nascosti: menu.filter((m) => !m.disponibile),
    },
    dipendenti: {
      attivi: dipendenti.length,
    },
  });
}
