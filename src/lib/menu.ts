import { isOutOfStock } from "./magazzino";

export function slugify(value: string) {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "e")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return slug || "categoria";
}

export function formatPrezzoPubblico(prezzo: number) {
  if (Number.isInteger(prezzo)) return String(prezzo);
  return prezzo.toFixed(2);
}

export type IngredienteConArticolo = {
  quantitaNecessaria: number;
  articolo: {
    id: string;
    nome: string;
    quantita: number;
    attivo: boolean;
    unitaMisura: string;
  };
};

export function disponibilitàVoce(ingredienti: IngredienteConArticolo[]) {
  const mancanti = ingredienti.filter(
    (ing) =>
      !ing.articolo.attivo ||
      isOutOfStock(ing.articolo.quantita) ||
      ing.articolo.quantita < ing.quantitaNecessaria
  );

  return {
    disponibile: mancanti.length === 0,
    mancanti: mancanti.map((ing) => ({
      id: ing.articolo.id,
      nome: ing.articolo.nome,
      quantita: ing.articolo.quantita,
      necessaria: ing.quantitaNecessaria,
      unitaMisura: ing.articolo.unitaMisura,
    })),
  };
}

export const COMING_SOON_COPY =
  "Il dettaglio dei piatti lo trovi al banco. Presto anche qui.";

export const CATEGORIE_CASSA_ENTRATA = [
  "Vendite banco",
  "Aperitivo",
  "Pausa pranzo",
  "Colazione",
  "Altro",
] as const;

export const CATEGORIE_CASSA_USCITA = [
  "Fornitori",
  "Stipendi",
  "Utenze",
  "Affitto",
  "Manutenzione",
  "Altro",
] as const;

export const RUOLI_DIPENDENTE = [
  "Gestione",
  "Barista",
  "Cucina",
  "Sala",
] as const;
