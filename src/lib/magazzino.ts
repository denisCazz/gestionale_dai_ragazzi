export function isLowStock(quantita: number, sogliaMinima: number): boolean {
  return sogliaMinima > 0 && quantita <= sogliaMinima;
}

export function isOutOfStock(quantita: number): boolean {
  return quantita <= 0;
}

export function normalizeScanCode(raw: string): string {
  return raw.trim();
}

export function looksLikeEan(code: string): boolean {
  return /^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(code);
}

export function serializeArticolo<
  T extends { quantita: number; sogliaMinima: number },
>(articolo: T) {
  return {
    ...articolo,
    quantita: Number(articolo.quantita),
    sogliaMinima: Number(articolo.sogliaMinima),
    sottoScorta: isLowStock(Number(articolo.quantita), Number(articolo.sogliaMinima)),
    esaurito: isOutOfStock(Number(articolo.quantita)),
  };
}
