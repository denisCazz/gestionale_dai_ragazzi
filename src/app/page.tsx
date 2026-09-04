"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Package,
  ScanLine,
  UtensilsCrossed,
  Users,
} from "lucide-react";
import { DateRangeFilter } from "@/components/date-range-filter";
import { Badge } from "@/components/ui/badge";
import { formatEuro } from "@/lib/format";
import { parseRange, toInputDate, type DateRange } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { fetchJson } from "@/lib/http";

type Dashboard = {
  cassa: {
    entrate: number;
    uscite: number;
    saldo: number;
    movimenti: {
      id: string;
      tipo: "ENTRATA" | "USCITA";
      importo: number;
      categoria: string;
      descrizione: string;
      data: string;
    }[];
    series: { date: string; entrate: number; uscite: number }[];
  };
  magazzino: {
    articoli: number;
    sottoScorta: {
      id: string;
      nome: string;
      quantita: number;
      sogliaMinima: number;
      unitaMisura: string;
    }[];
  };
  menu: {
    disponibili: number;
    nascosti: { id: string; nome: string; categoria: string; mancanti: { nome: string }[] }[];
  };
  dipendenti: { attivi: number };
};

export default function DashboardPage() {
  const [range, setRange] = useState<DateRange>(() => parseRange(null, null));
  const [data, setData] = useState<Dashboard | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({
      from: toInputDate(range.from),
      to: toInputDate(range.to),
    });
    fetchJson<Dashboard>(`/api/dashboard?${params}`)
      .then(setData)
      .catch(() => setData(null));
  }, [range]);

  const maxBar = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, ...data.cassa.series.map((s) => s.entrate + s.uscite));
  }, [data]);

  if (!data) {
    return <p className="text-sm text-stone-500">Caricamento dashboard…</p>;
  }

  const kpis = [
    {
      label: "Saldo periodo",
      value: formatEuro(data.cassa.saldo),
      hint: `${formatEuro(data.cassa.entrate)} entrate`,
      href: "/cassa",
      icon: Banknote,
      tone: data.cassa.saldo >= 0 ? "text-emerald-700" : "text-red-700",
    },
    {
      label: "Uscite",
      value: formatEuro(data.cassa.uscite),
      hint: "Movimenti di cassa",
      href: "/cassa",
      icon: ArrowDownRight,
      tone: "text-[var(--ink)]",
    },
    {
      label: "Sottoscorta",
      value: String(data.magazzino.sottoScorta.length),
      hint: `${data.magazzino.articoli} articoli in magazzino`,
      href: "/magazzino?lowStock=1",
      icon: Package,
      tone: data.magazzino.sottoScorta.length ? "text-amber-700" : "text-[var(--ink)]",
    },
    {
      label: "Menu visibile",
      value: String(data.menu.disponibili),
      hint: `${data.menu.nascosti.length} nascosti per scorta`,
      href: "/menu",
      icon: UtensilsCrossed,
      tone: "text-[var(--ink)]",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--gold-dim)]">Bar Dai Ragazzi</p>
          <h1 className="font-[family-name:var(--font-display)] text-4xl text-[var(--espresso)]">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Cassa, magazzino e menu collegati in un colpo d&apos;occhio.
          </p>
        </div>
        <Link
          href="/magazzino/scansione"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--espresso)] px-4 text-sm font-medium text-[var(--cream)]"
        >
          <ScanLine className="h-4 w-4" />
          Scansiona articolo
        </Link>
      </div>

      <DateRangeFilter range={range} onChange={setRange} />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <Link
            key={kpi.label}
            href={kpi.href}
            className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm transition hover:border-[var(--gold)]"
          >
            <div className="flex items-start justify-between">
              <p className="text-sm text-stone-500">{kpi.label}</p>
              <kpi.icon className="h-4 w-4 text-[var(--gold-dim)]" />
            </div>
            <p className={cn("mt-3 text-3xl font-semibold tracking-tight", kpi.tone)}>
              {kpi.value}
            </p>
            <p className="mt-1 text-xs text-stone-400">{kpi.hint}</p>
          </Link>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-[var(--line)] bg-white p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-[family-name:var(--font-display)] text-2xl">Flusso di cassa</h2>
            <div className="flex gap-3 text-xs text-stone-500">
              <span className="inline-flex items-center gap-1">
                <i className="h-2 w-2 rounded-full bg-emerald-500" /> Entrate
              </span>
              <span className="inline-flex items-center gap-1">
                <i className="h-2 w-2 rounded-full bg-red-400" /> Uscite
              </span>
            </div>
          </div>
          <div className="flex h-40 items-end gap-1">
            {data.cassa.series.map((s) => (
              <div key={s.date} className="flex flex-1 flex-col justify-end gap-0.5" title={s.date}>
                <div
                  className="w-full rounded-t bg-emerald-500/80"
                  style={{ height: `${(s.entrate / maxBar) * 100}%`, minHeight: s.entrate ? 4 : 0 }}
                />
                <div
                  className="w-full rounded-t bg-red-400/80"
                  style={{ height: `${(s.uscite / maxBar) * 100}%`, minHeight: s.uscite ? 4 : 0 }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--line)] bg-white p-5">
          <h2 className="mb-3 flex items-center gap-2 font-[family-name:var(--font-display)] text-2xl">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Avvisi
          </h2>
          <div className="space-y-3 text-sm">
            {data.magazzino.sottoScorta.length === 0 && data.menu.nascosti.length === 0 ? (
              <p className="text-stone-500">Nessun avviso. Magazzino e menu ok.</p>
            ) : null}
            {data.magazzino.sottoScorta.slice(0, 4).map((a) => (
              <Link key={a.id} href={`/magazzino/${a.id}`} className="block rounded-xl bg-amber-50 p-3">
                <p className="font-medium text-amber-900">{a.nome}</p>
                <p className="text-xs text-amber-700">
                  {a.quantita} {a.unitaMisura} · soglia {a.sogliaMinima}
                </p>
              </Link>
            ))}
            {data.menu.nascosti.slice(0, 4).map((v) => (
              <div key={v.id} className="rounded-xl bg-red-50 p-3">
                <p className="font-medium text-red-900">{v.nome}</p>
                <p className="text-xs text-red-700">
                  Nascosto dal menu · manca {v.mancanti.map((m) => m.nome).join(", ")}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--line)] bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-[family-name:var(--font-display)] text-2xl">Ultimi movimenti</h2>
            <Link href="/cassa" className="text-sm text-[var(--gold-dim)]">
              Vedi cassa
            </Link>
          </div>
          <ul className="divide-y divide-[var(--line)]">
            {data.cassa.movimenti.map((m) => (
              <li key={m.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium">{m.descrizione}</p>
                  <p className="text-xs text-stone-400">{m.categoria}</p>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 font-semibold tabular-nums",
                    m.tipo === "ENTRATA" ? "text-emerald-700" : "text-red-700"
                  )}
                >
                  {m.tipo === "ENTRATA" ? (
                    <ArrowUpRight className="h-4 w-4" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4" />
                  )}
                  {formatEuro(m.importo)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-[var(--line)] bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-[family-name:var(--font-display)] text-2xl">Team</h2>
            <Link href="/dipendenti" className="text-sm text-[var(--gold-dim)]">
              Dipendenti
            </Link>
          </div>
          <div className="flex items-center gap-4 rounded-xl bg-[var(--espresso)] p-5 text-[var(--cream)]">
            <Users className="h-8 w-8 text-[var(--gold)]" />
            <div>
              <p className="text-3xl font-semibold">{data.dipendenti.attivi}</p>
              <p className="text-sm text-[var(--cream-muted)]">dipendenti attivi</p>
            </div>
            <Badge tone="gold" className="ml-auto">
              Presenze nel calendario
            </Badge>
          </div>
          <p className="mt-4 text-sm text-stone-500">
            Se un prodotto finisce, le voci di menu che lo usano spariscono automaticamente dal
            menu operativo.
          </p>
        </div>
      </section>
    </div>
  );
}
