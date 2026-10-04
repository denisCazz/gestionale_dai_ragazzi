const GIORNO = 24 * 60;

export type OrariPresenza = {
  oraIngresso: string | null;
  oraUscita: string | null;
  oraIngresso2: string | null;
  oraUscita2: string | null;
};

function pulisci(value: string | null | undefined) {
  const ora = value?.trim() ?? "";
  return ora.length ? ora.slice(0, 5) : null;
}

function minutiDaOra(ora: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(ora);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function intervallo(ingresso: string, uscita: string) {
  const start = minutiDaOra(ingresso);
  const end = minutiDaOra(uscita);
  if (start === null || end === null || start === end) return null;
  return { start, end: end > start ? end : end + GIORNO };
}

function sovrapposti(
  a: { start: number; end: number },
  b: { start: number; end: number }
) {
  for (const shift of [0, GIORNO, -GIORNO]) {
    const bStart = b.start + shift;
    const bEnd = b.end + shift;
    if (a.start < bEnd && bStart < a.end) return true;
  }
  return false;
}

export function durataTurno(ingresso: string, uscita: string) {
  const fascia = intervallo(ingresso, uscita);
  return fascia ? fascia.end - fascia.start : null;
}

export function formatDurata(minuti: number) {
  const ore = Math.floor(minuti / 60);
  const resto = minuti % 60;
  return resto ? `${ore}h ${resto}m` : `${ore}h`;
}

export function oreLavorateLabel(orari: OrariPresenza) {
  const prima =
    orari.oraIngresso && orari.oraUscita ? durataTurno(orari.oraIngresso, orari.oraUscita) : null;
  const seconda =
    orari.oraIngresso2 && orari.oraUscita2
      ? durataTurno(orari.oraIngresso2, orari.oraUscita2)
      : null;
  if (prima === null && seconda === null) return null;
  const totale = (prima ?? 0) + (seconda ?? 0);
  if (prima !== null && seconda !== null) {
    return `${formatDurata(totale)} (${formatDurata(prima)} + ${formatDurata(seconda)})`;
  }
  return formatDurata(totale);
}

export function normalizzaOrari(input: {
  oraIngresso?: string | null;
  oraUscita?: string | null;
  oraIngresso2?: string | null;
  oraUscita2?: string | null;
  doppio?: boolean;
}): { orari: OrariPresenza } | { error: string } {
  const oraIngresso = pulisci(input.oraIngresso);
  const oraUscita = pulisci(input.oraUscita);
  const oraIngresso2 = pulisci(input.oraIngresso2);
  const oraUscita2 = pulisci(input.oraUscita2);
  const secondoAttivo = input.doppio === true || Boolean(oraIngresso2 || oraUscita2);

  if (oraIngresso && oraUscita && oraIngresso === oraUscita) {
    return { error: "Ingresso e uscita non possono coincidere" };
  }
  if (secondoAttivo && (!oraIngresso || !oraUscita)) {
    return { error: "Compila ingresso e uscita del primo turno" };
  }
  if (secondoAttivo && (!oraIngresso2 || !oraUscita2)) {
    return { error: "Compila ingresso e uscita del secondo turno" };
  }
  if (oraIngresso2 && oraUscita2 && oraIngresso2 === oraUscita2) {
    return { error: "Ingresso e uscita del secondo turno non possono coincidere" };
  }
  if (oraIngresso && oraUscita && oraIngresso2 && oraUscita2) {
    const primo = intervallo(oraIngresso, oraUscita);
    const secondo = intervallo(oraIngresso2, oraUscita2);
    if (!primo || !secondo) return { error: "Orari non validi" };
    if (sovrapposti(primo, secondo)) return { error: "I due turni si sovrappongono" };
  }

  return { orari: { oraIngresso, oraUscita, oraIngresso2, oraUscita2 } };
}

export function fasciaBreve(ingresso: string | null | undefined, uscita: string | null | undefined) {
  if (ingresso && uscita) return `${ingresso.slice(0, 2)}–${uscita.slice(0, 2)}`;
  const sola = ingresso || uscita;
  return sola ? sola.slice(0, 2) : null;
}
