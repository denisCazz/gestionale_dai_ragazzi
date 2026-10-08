export const VOCE_CARTE = "Carte - Bancomat";
export const VOCE_SATISPAY = "Satispay";
export const VOCE_CONTANTI = "Contanti";

const CARTE = new Set(["carte - bancomat", "carte-bancomat", "carte", "bancomat"]);

export type TipoCassa = "ENTRATA" | "USCITA";

export type ImportiGiornata = {
  entrate: { carte: number; satispay: number; contanti: number };
  uscite: { contanti: number };
};

export type TotaliGiornata = ImportiGiornata & {
  altreEntrate: number;
  altreUscite: number;
};

type MovimentoBase = {
  tipo: TipoCassa;
  categoria: string;
  importo: number;
};

export function roundEuro(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function emptyImporti(): ImportiGiornata {
  return {
    entrate: { carte: 0, satispay: 0, contanti: 0 },
    uscite: { contanti: 0 },
  };
}

const PAGAMENTO =
  /\b(contanti|pos|carte|bancomat|satispay|satospay)\s*€\s*([0-9]+(?:[.,][0-9]+)?)/gi;
const RIGA_PAGAMENTO =
  /^(contanti|pos|carte|bancomat|satispay|satospay)\s*€\s*[0-9]+(?:[.,][0-9]+)?$/i;
const ETICHETTA_STANDARD =
  /^(incasso carte e bancomat|incasso satispay|incasso contanti|uscita contanti)$/i;

export function voceStrutturata(tipo: TipoCassa, categoria: string) {
  const nome = categoria.trim().toLowerCase();
  if (tipo === "ENTRATA") {
    if (CARTE.has(nome)) return "carte" as const;
    if (nome === "satispay") return "satispay" as const;
    if (nome === "contanti") return "contantiEntrata" as const;
    return null;
  }
  if (nome === "contanti") return "contantiUscita" as const;
  return null;
}

function parseNumero(raw: string) {
  const text = raw.trim();
  const value = text.includes(",") ? Number(text.replace(/\./g, "").replace(",", ".")) : Number(text);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

export function parsePagamenti(descrizione: string) {
  const found = { carte: 0, satispay: 0, contanti: 0 };
  let count = 0;
  for (const match of descrizione.matchAll(PAGAMENTO)) {
    const amount = parseNumero(match[2]);
    if (amount === null) continue;
    count += 1;
    const label = match[1].toLowerCase();
    if (label === "contanti") found.contanti += amount;
    else if (label === "satispay" || label === "satospay") found.satispay += amount;
    else found.carte += amount;
  }
  if (count === 0) return null;
  return {
    carte: roundEuro(found.carte),
    satispay: roundEuro(found.satispay),
    contanti: roundEuro(found.contanti),
  };
}

const NOTA_MARK = "\n—\n";

export function noteMovimento(descrizione: string) {
  const esplicita = estraiNota(descrizione);
  if (esplicita) return esplicita;
  const notes = descrizione
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !RIGA_PAGAMENTO.test(line))
    .filter((line) => !ETICHETTA_STANDARD.test(line));
  return [...new Set(notes)].join("\n");
}

export function estraiNota(descrizione: string) {
  const index = descrizione.indexOf(NOTA_MARK);
  if (index === -1) return "";
  return descrizione.slice(index + NOTA_MARK.length).trim();
}

export function noteGiornata(movimenti: (MovimentoBase & { descrizione: string })[], tipo?: TipoCassa) {
  const notes = movimenti
    .filter((movimento) => !tipo || movimento.tipo === tipo)
    .map((movimento) => noteMovimento(movimento.descrizione))
    .map((note) => note.trim())
    .filter(Boolean);
  return [...new Set(notes)].join("\n");
}

export function conNota(descrizione: string, nota: string) {
  const clean = nota.trim();
  return clean ? `${descrizione}${NOTA_MARK}${clean}` : descrizione;
}

export function ripartisci(movimento: MovimentoBase) {
  const quote = { carte: 0, satispay: 0, contanti: 0, uscite: 0, altreEntrate: 0, altreUscite: 0 };
  const voce = voceStrutturata(movimento.tipo, movimento.categoria);
  if (voce === "carte") quote.carte = movimento.importo;
  else if (voce === "satispay") quote.satispay = movimento.importo;
  else if (voce === "contantiEntrata") quote.contanti = movimento.importo;
  else if (voce === "contantiUscita") quote.uscite = movimento.importo;
  else if (movimento.tipo === "USCITA") quote.uscite = movimento.importo;
  else {
    const parsed = parsePagamenti(movimento.descrizione);
    if (!parsed) {
      quote.altreEntrate = movimento.importo;
    } else {
      const somma = roundEuro(parsed.carte + parsed.satispay + parsed.contanti);
      const differenza = roundEuro(movimento.importo - somma);
      quote.carte = parsed.carte;
      quote.satispay = parsed.satispay;
      quote.contanti = parsed.contanti;
      if (Math.abs(differenza) <= 1) quote.contanti = roundEuro(parsed.contanti + differenza);
      else if (differenza > 0) quote.altreEntrate = differenza;
    }
  }
  return quote;
}

export function accumula(movimenti: MovimentoBase[]): TotaliGiornata {
  const totali: TotaliGiornata = {
    ...emptyImporti(),
    altreEntrate: 0,
    altreUscite: 0,
  };
  for (const movimento of movimenti) {
    const quote = ripartisci(movimento);
    totali.entrate.carte += quote.carte;
    totali.entrate.satispay += quote.satispay;
    totali.entrate.contanti += quote.contanti;
    totali.uscite.contanti += quote.uscite;
    totali.altreEntrate += quote.altreEntrate;
    totali.altreUscite += quote.altreUscite;
  }
  totali.entrate.carte = roundEuro(totali.entrate.carte);
  totali.entrate.satispay = roundEuro(totali.entrate.satispay);
  totali.entrate.contanti = roundEuro(totali.entrate.contanti);
  totali.uscite.contanti = roundEuro(totali.uscite.contanti);
  totali.altreEntrate = roundEuro(totali.altreEntrate);
  totali.altreUscite = roundEuro(totali.altreUscite);
  return totali;
}

export function saldoGiornata(totali: TotaliGiornata) {
  const entrate =
    totali.entrate.carte + totali.entrate.satispay + totali.entrate.contanti + totali.altreEntrate;
  const uscite = totali.uscite.contanti + totali.altreUscite;
  return roundEuro(entrate - uscite);
}

export const RIGHE_GIORNATA = [
  {
    tipo: "ENTRATA" as const,
    categoria: VOCE_CARTE,
    descrizione: "Incasso carte e bancomat",
    amount: (importi: ImportiGiornata) => importi.entrate.carte,
  },
  {
    tipo: "ENTRATA" as const,
    categoria: VOCE_SATISPAY,
    descrizione: "Incasso Satispay",
    amount: (importi: ImportiGiornata) => importi.entrate.satispay,
  },
  {
    tipo: "ENTRATA" as const,
    categoria: VOCE_CONTANTI,
    descrizione: "Incasso contanti",
    amount: (importi: ImportiGiornata) => importi.entrate.contanti,
  },
  {
    tipo: "USCITA" as const,
    categoria: VOCE_CONTANTI,
    descrizione: "Uscita contanti",
    amount: (importi: ImportiGiornata) => importi.uscite.contanti,
  },
];
