import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";

export function formatEuro(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

export function formatQty(value: number, unita = "pz") {
  const n = Number.isInteger(value) ? value.toString() : value.toFixed(2).replace(/\.?0+$/, "");
  return `${n} ${unita}`;
}

export function formatDate(value: Date | string) {
  const d = value instanceof Date ? value : parseISO(value);
  return format(d, "d MMM yyyy", { locale: it });
}

export function formatDateTime(value: Date | string) {
  const d = value instanceof Date ? value : parseISO(value);
  return format(d, "d MMM yyyy HH:mm", { locale: it });
}

export function dayKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}
