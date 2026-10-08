"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDownRight, ArrowUpRight, Trash2 } from "lucide-react";
import { DateRangeFilter } from "@/components/date-range-filter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/select";
import { formatDate, formatEuro, dayKey } from "@/lib/format";
import { parseRange, toInputDate, type DateRange } from "@/lib/dates";
import { fetchJson } from "@/lib/http";
import {
  accumula,
  noteGiornata,
  ripartisci,
  roundEuro,
  saldoGiornata,
  type ImportiGiornata,
  type TotaliGiornata,
} from "@/lib/cassa-giornata";
import { cn } from "@/lib/utils";

type Movimento = {
  id: string;
  tipo: "ENTRATA" | "USCITA";
  importo: number;
  categoria: string;
  descrizione: string;
  data: string;
};

type FormImporti = {
  carte: string;
  satispay: string;
  contanti: string;
  usciteContanti: string;
  noteEntrate: string;
  noteUscite: string;
};

type Giornata = ImportiGiornata & {
  data: string;
  note?: { entrate?: string; uscite?: string };
};

const ZERO_FORM: FormImporti = {
  carte: "0",
  satispay: "0",
  contanti: "0",
  usciteContanti: "0",
  noteEntrate: "",
  noteUscite: "",
};

function toAmountInput(value: number) {
  const rounded = roundEuro(value);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function parseAmount(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return 0;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return roundEuro(amount);
}

function formFromImporti(importi: Giornata): FormImporti {
  return {
    carte: toAmountInput(importi.entrate.carte),
    satispay: toAmountInput(importi.entrate.satispay),
    contanti: toAmountInput(importi.entrate.contanti),
    usciteContanti: toAmountInput(importi.uscite.contanti),
    noteEntrate: importi.note?.entrate ?? "",
    noteUscite: importi.note?.uscite ?? "",
  };
}

export default function CassaPage() {
  const [range, setRange] = useState<DateRange>(() => parseRange(null, null));
  const [movimenti, setMovimenti] = useState<Movimento[]>([]);
  const [totale, setTotale] = useState({ entrate: 0, uscite: 0, saldo: 0 });
  const [giorno, setGiorno] = useState(() => toInputDate(new Date()));
  const [form, setForm] = useState<FormImporti>(ZERO_FORM);
  const [saving, setSaving] = useState(false);

  async function load() {
    const params = new URLSearchParams({
      from: toInputDate(range.from),
      to: toInputDate(range.to),
    });
    const data = await fetchJson<{
      movimenti?: Movimento[];
      totale?: { entrate: number; uscite: number; saldo: number };
    }>(`/api/cassa?${params}`);
    setMovimenti(data.movimenti ?? []);
    setTotale(data.totale ?? { entrate: 0, uscite: 0, saldo: 0 });
  }

  useEffect(() => {
    void load().catch(() => {
      toast.error("Errore caricamento cassa");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  useEffect(() => {
    let cancelled = false;
    void fetchJson<Giornata>(`/api/cassa/giornata?data=${giorno}`)
      .then((data) => {
        if (!cancelled) setForm(formFromImporti(data));
      })
      .catch(() => {
        if (!cancelled) toast.error("Errore caricamento giornata");
      });
    return () => {
      cancelled = true;
    };
  }, [giorno]);

  const giorni = useMemo(() => {
    const byDay = new Map<string, { data: string; movimenti: Movimento[]; totali: TotaliGiornata }>();
    for (const movimento of movimenti) {
      const data = dayKey(new Date(movimento.data));
      const row = byDay.get(data) ?? { data, movimenti: [], totali: accumula([]) };
      row.movimenti.push(movimento);
      byDay.set(data, row);
    }
    return [...byDay.values()]
      .map((row) => ({ ...row, totali: accumula(row.movimenti) }))
      .sort((a, b) => b.data.localeCompare(a.data));
  }, [movimenti]);

  const hasAltre = giorni.some((row) => row.totali.altreEntrate > 0 || row.totali.altreUscite > 0);
  const hasNoteEntrate = giorni.some((row) => noteGiornata(row.movimenti, "ENTRATA").length > 0);
  const hasNoteUscite = giorni.some((row) => noteGiornata(row.movimenti, "USCITA").length > 0);
  const altri = movimenti.filter((movimento) => {
    const quote = ripartisci(movimento);
    const classificati = quote.carte + quote.satispay + quote.contanti + quote.uscite;
    return classificati === 0 && (quote.altreEntrate > 0 || quote.altreUscite > 0);
  });

  const bozza = {
    entrate: {
      carte: parseAmount(form.carte) ?? 0,
      satispay: parseAmount(form.satispay) ?? 0,
      contanti: parseAmount(form.contanti) ?? 0,
    },
    uscite: { contanti: parseAmount(form.usciteContanti) ?? 0 },
    altreEntrate: 0,
    altreUscite: 0,
  };
  const bozzaEntrate = roundEuro(bozza.entrate.carte + bozza.entrate.satispay + bozza.entrate.contanti);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const carte = parseAmount(form.carte);
    const satispay = parseAmount(form.satispay);
    const contanti = parseAmount(form.contanti);
    const usciteContanti = parseAmount(form.usciteContanti);
    if (carte === null || satispay === null || contanti === null || usciteContanti === null) {
      toast.error("Gli importi devono essere numeri maggiori o uguali a zero");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/cassa/giornata", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: giorno,
          entrate: { carte, satispay, contanti },
          uscite: { contanti: usciteContanti },
          note: {
            entrate: form.noteEntrate.trim(),
            uscite: form.noteUscite.trim(),
          },
        }),
      });
      if (!res.ok) {
        toast.error("Controlla data e importi");
        return;
      }
      const saved = (await res.json()) as Giornata;
      setForm(formFromImporti(saved));
      toast.success("Giornata registrata");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Eliminare questo movimento?")) return;
    await fetch(`/api/cassa/${id}`, { method: "DELETE" });
    toast.success("Eliminato");
    await load();
    const data = await fetchJson<Giornata>(`/api/cassa/giornata?data=${giorno}`);
    setForm(formFromImporti(data));
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-4xl">Cassa</h1>
        <p className="text-sm text-stone-500">
          Entrate divise per carte, Satispay e contanti. Uscite solo in contanti.
        </p>
      </div>

      <form onSubmit={save} className="space-y-4 rounded-2xl border border-[var(--line)] bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1.5">
            <Label htmlFor="giorno">Giorno</Label>
            <Input
              id="giorno"
              type="date"
              required
              value={giorno}
              onChange={(e) => setGiorno(e.target.value)}
              className="w-full sm:w-48"
            />
            <p className="text-xs text-stone-400">Predefinito: oggi. Puoi scegliere qualsiasi giorno.</p>
          </div>
          <div className="text-sm text-stone-500">
            <p>
              Entrate <span className="font-semibold text-emerald-700 tabular-nums">{formatEuro(bozzaEntrate)}</span>
            </p>
            <p>
              Uscite{" "}
              <span className="font-semibold text-red-700 tabular-nums">{formatEuro(bozza.uscite.contanti)}</span>
            </p>
            <p>
              Saldo{" "}
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  saldoGiornata(bozza) >= 0 ? "text-emerald-700" : "text-red-700"
                )}
              >
                {formatEuro(saldoGiornata(bozza))}
              </span>
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="space-y-3 rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
            <h2 className="text-sm font-medium text-emerald-800">Entrate</h2>
            <AmountField
              id="carte"
              label="Carte - Bancomat"
              value={form.carte}
              onChange={(carte) => setForm((current) => ({ ...current, carte }))}
            />
            <AmountField
              id="satispay"
              label="Satispay"
              value={form.satispay}
              onChange={(satispay) => setForm((current) => ({ ...current, satispay }))}
            />
            <AmountField
              id="contanti-entrate"
              label="Contanti"
              value={form.contanti}
              onChange={(contanti) => setForm((current) => ({ ...current, contanti }))}
            />
            <NoteField
              id="note-entrate"
              value={form.noteEntrate}
              onChange={(noteEntrate) => setForm((current) => ({ ...current, noteEntrate }))}
            />
          </section>

          <section className="space-y-3 rounded-xl border border-red-100 bg-red-50/40 p-4">
            <h2 className="text-sm font-medium text-red-800">Uscite</h2>
            <AmountField
              id="contanti-uscite"
              label="Contanti"
              value={form.usciteContanti}
              onChange={(usciteContanti) => setForm((current) => ({ ...current, usciteContanti }))}
            />
            <NoteField
              id="note-uscite"
              value={form.noteUscite}
              onChange={(noteUscite) => setForm((current) => ({ ...current, noteUscite }))}
            />
          </section>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving || !giorno}>
            {saving ? "Salvataggio…" : "Registra giornata"}
          </Button>
        </div>
      </form>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[var(--line)] bg-white p-5">
          <p className="text-sm text-stone-500">Entrate</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-700">{formatEuro(totale.entrate)}</p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-white p-5">
          <p className="text-sm text-stone-500">Uscite</p>
          <p className="mt-2 text-3xl font-semibold text-red-700">{formatEuro(totale.uscite)}</p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-white p-5">
          <p className="text-sm text-stone-500">Saldo</p>
          <p className={cn("mt-2 text-3xl font-semibold", totale.saldo >= 0 ? "text-emerald-700" : "text-red-700")}>
            {formatEuro(totale.saldo)}
          </p>
        </div>
      </section>

      <div className="space-y-3">
        <h2 className="font-[family-name:var(--font-display)] text-2xl">Pregresso</h2>
        <DateRangeFilter range={range} onChange={setRange} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
        {giorni.length === 0 ? (
          <p className="p-10 text-center text-sm text-stone-400">Nessun movimento nel periodo.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--paper)] text-left text-xs uppercase tracking-wide text-stone-500">
                  <th rowSpan={2} className="px-3 py-2 align-bottom">
                    Giorno
                  </th>
                  <th colSpan={hasNoteEntrate ? 4 : 3} className="px-3 py-2 text-center text-emerald-700">
                    Entrate
                  </th>
                  <th colSpan={hasNoteUscite ? 2 : 1} className="px-3 py-2 text-center text-red-700">
                    Uscite
                  </th>
                  {hasAltre ? (
                    <th colSpan={2} className="px-3 py-2 text-center">
                      Altri movimenti
                    </th>
                  ) : null}
                  <th rowSpan={2} className="px-3 py-2 text-right align-bottom">
                    Saldo
                  </th>
                </tr>
                <tr className="border-b border-[var(--line)] bg-[var(--paper)] text-left text-xs text-stone-500">
                  <th className="px-3 py-2 text-right font-medium">Carte - Bancomat</th>
                  <th className="px-3 py-2 text-right font-medium">Satispay</th>
                  <th className="px-3 py-2 text-right font-medium">Contanti</th>
                  {hasNoteEntrate ? <th className="px-3 py-2 text-left font-medium">Note</th> : null}
                  <th className="px-3 py-2 text-right font-medium">Contanti</th>
                  {hasNoteUscite ? <th className="px-3 py-2 text-left font-medium">Note</th> : null}
                  {hasAltre ? (
                    <>
                      <th className="px-3 py-2 text-right font-medium">Entrate</th>
                      <th className="px-3 py-2 text-right font-medium">Uscite</th>
                    </>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {giorni.map((row) => {
                  const saldo = saldoGiornata(row.totali);
                  return (
                    <tr
                      key={row.data}
                      className={cn(
                        "cursor-pointer border-b border-[var(--line)] hover:bg-[var(--paper)]",
                        row.data === giorno && "bg-amber-50/70"
                      )}
                      onClick={() => setGiorno(row.data)}
                    >
                      <td className="px-3 py-2 font-medium whitespace-nowrap">{formatDate(`${row.data}T12:00:00`)}</td>
                      <MoneyCell value={row.totali.entrate.carte} tone="in" />
                      <MoneyCell value={row.totali.entrate.satispay} tone="in" />
                      <MoneyCell value={row.totali.entrate.contanti} tone="in" />
                      {hasNoteEntrate ? <NoteCell value={noteGiornata(row.movimenti, "ENTRATA")} /> : null}
                      <MoneyCell value={row.totali.uscite.contanti} tone="out" />
                      {hasNoteUscite ? <NoteCell value={noteGiornata(row.movimenti, "USCITA")} /> : null}
                      {hasAltre ? (
                        <>
                          <MoneyCell value={row.totali.altreEntrate} tone="in" />
                          <MoneyCell value={row.totali.altreUscite} tone="out" />
                        </>
                      ) : null}
                      <td
                        className={cn(
                          "px-3 py-2 text-right font-semibold tabular-nums",
                          saldo >= 0 ? "text-emerald-700" : "text-red-700"
                        )}
                      >
                        {formatEuro(saldo)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {altri.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
          <div className="border-b border-[var(--line)] px-4 py-3">
            <h2 className="font-[family-name:var(--font-display)] text-2xl">Altri movimenti</h2>
            <p className="text-xs text-stone-400">
              Voci già registrate con categorie diverse. Restano nel saldo e si aprono scegliendo il giorno.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--paper)] text-left text-xs uppercase tracking-wide text-stone-500">
                  <th className="px-3 py-2">Giorno</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">Categoria</th>
                  <th className="px-3 py-2">Dettaglio</th>
                  <th className="px-3 py-2 text-right">Importo</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {altri.map((movimento) => (
                  <tr key={movimento.id} className="border-b border-[var(--line)]">
                    <td className="px-3 py-2 whitespace-nowrap">{formatDate(movimento.data)}</td>
                    <td className="px-3 py-2">
                      <Badge tone={movimento.tipo === "ENTRATA" ? "ok" : "danger"}>
                        <span className="inline-flex items-center gap-1">
                          {movimento.tipo === "ENTRATA" ? (
                            <ArrowUpRight className="h-3 w-3" />
                          ) : (
                            <ArrowDownRight className="h-3 w-3" />
                          )}
                          {movimento.tipo === "ENTRATA" ? "Entrata" : "Uscita"}
                        </span>
                      </Badge>
                    </td>
                    <td className="px-3 py-2">{movimento.categoria}</td>
                    <td className="px-3 py-2">{movimento.descrizione}</td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right font-semibold tabular-nums",
                        movimento.tipo === "ENTRATA" ? "text-emerald-700" : "text-red-700"
                      )}
                    >
                      {movimento.tipo === "ENTRATA" ? "+" : "−"}
                      {formatEuro(movimento.importo)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button variant="ghost" size="icon" onClick={() => void remove(movimento.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AmountField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="text-sm text-stone-700">
        {label}
      </label>
      <Input
        id={id}
        type="number"
        min="0"
        step="0.01"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-36 text-right tabular-nums"
      />
    </div>
  );
}

function NoteField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm text-stone-700">
        Note
      </label>
      <Textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} className="min-h-[72px] bg-white" />
    </div>
  );
}

function NoteCell({ value }: { value: string }) {
  return <td className="max-w-xs px-3 py-2 text-xs whitespace-pre-line text-stone-500">{value || "—"}</td>;
}

function MoneyCell({ value, tone }: { value: number; tone: "in" | "out" }) {
  return (
    <td
      className={cn(
        "px-3 py-2 text-right tabular-nums",
        value === 0 ? "text-stone-300" : tone === "in" ? "text-emerald-700" : "text-red-700"
      )}
    >
      {formatEuro(value)}
    </td>
  );
}
