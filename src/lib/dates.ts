import { endOfDay, format, startOfDay, startOfMonth, startOfWeek, startOfYear, subDays } from "date-fns";

export type DateRange = {
  from: Date;
  to: Date;
};

export function parseRange(from?: string | null, to?: string | null): DateRange {
  const now = new Date();
  const start = from ? startOfDay(new Date(`${from}T00:00:00`)) : startOfMonth(now);
  const end = to ? endOfDay(new Date(`${to}T00:00:00`)) : endOfDay(now);
  return { from: start, to: end };
}

export function toInputDate(date: Date) {
  return format(date, "yyyy-MM-dd");
}

export const RANGE_PRESETS = [
  { id: "oggi", label: "Oggi", get: () => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }) },
  {
    id: "settimana",
    label: "Settimana",
    get: () => ({ from: startOfWeek(new Date(), { weekStartsOn: 1 }), to: endOfDay(new Date()) }),
  },
  { id: "mese", label: "Mese", get: () => ({ from: startOfMonth(new Date()), to: endOfDay(new Date()) }) },
  { id: "anno", label: "Anno", get: () => ({ from: startOfYear(new Date()), to: endOfDay(new Date()) }) },
  {
    id: "30g",
    label: "30 giorni",
    get: () => ({ from: startOfDay(subDays(new Date(), 29)), to: endOfDay(new Date()) }),
  },
] as const;
