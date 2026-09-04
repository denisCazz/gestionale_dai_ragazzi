"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowDownRight, ArrowUpRight, Plus, Tags, Trash2 } from "lucide-react";
import { DateRangeFilter } from "@/components/date-range-filter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, Textarea } from "@/components/ui/select";
import { formatDateTime, formatEuro } from "@/lib/format";
import { parseRange, toInputDate, type DateRange } from "@/lib/dates";
import { fetchJson } from "@/lib/http";
import { cn } from "@/lib/utils";

type Movimento = {
  id: string;
  tipo: "ENTRATA" | "USCITA";
  importo: number;
  categoria: string;
  descrizione: string;
  data: string;
};

type CategoriaCassa = { id: string; nome: string; tipo: "ENTRATA" | "USCITA"; ordine: number };
type CategorieByTipo = { ENTRATA: CategoriaCassa[]; USCITA: CategoriaCassa[] };

const EMPTY_CATEGORIE: CategorieByTipo = { ENTRATA: [], USCITA: [] };

export default function CassaPage() {
  const [range, setRange] = useState<DateRange>(() => parseRange(null, null));
  const [movimenti, setMovimenti] = useState<Movimento[]>([]);
  const [totale, setTotale] = useState({ entrate: 0, uscite: 0, saldo: 0 });
  const [categorieByTipo, setCategorieByTipo] = useState<CategorieByTipo>(EMPTY_CATEGORIE);
  const [open, setOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [nuovaCat, setNuovaCat] = useState({ nome: "", tipo: "ENTRATA" as "ENTRATA" | "USCITA" });
  const [form, setForm] = useState({
    tipo: "ENTRATA" as "ENTRATA" | "USCITA",
    importo: "",
    categoria: "",
    descrizione: "",
    data: toInputDate(new Date()),
  });

  async function loadCategorie() {
    const data = await fetchJson<{ categorie?: CategorieByTipo }>("/api/cassa/categorie");
    const next: CategorieByTipo = data.categorie ?? EMPTY_CATEGORIE;
    setCategorieByTipo(next);
    return next;
  }

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
    void loadCategorie().catch(() => {
      toast.error("Errore caricamento categorie");
    });
  }, []);

  useEffect(() => {
    void load().catch(() => {
      toast.error("Errore caricamento cassa");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const categorie = categorieByTipo[form.tipo];

  function firstCategoria(tipo: "ENTRATA" | "USCITA", list?: CategorieByTipo) {
    return (list ?? categorieByTipo)[tipo][0]?.nome ?? "";
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.categoria) {
      toast.error("Aggiungi prima una categoria");
      return;
    }
    const res = await fetch("/api/cassa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: form.tipo,
        importo: Number(form.importo),
        categoria: form.categoria,
        descrizione: form.descrizione,
        data: `${form.data}T12:00:00`,
      }),
    });
    if (!res.ok) {
      toast.error("Controlla importo e descrizione");
      return;
    }
    toast.success("Movimento registrato");
    setOpen(false);
    setForm({
      tipo: "ENTRATA",
      importo: "",
      categoria: firstCategoria("ENTRATA"),
      descrizione: "",
      data: toInputDate(new Date()),
    });
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Eliminare questo movimento?")) return;
    await fetch(`/api/cassa/${id}`, { method: "DELETE" });
    toast.success("Eliminato");
    await load();
  }

  async function addCategoria(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/cassa/categorie", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nuovaCat),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(typeof data.error === "string" ? data.error : "Errore categoria");
      return;
    }
    toast.success("Categoria aggiunta");
    setNuovaCat({ nome: "", tipo: nuovaCat.tipo });
    const next = await loadCategorie();
    if (!form.categoria || form.tipo === nuovaCat.tipo) {
      setForm((f) => ({
        ...f,
        categoria: f.categoria || firstCategoria(f.tipo, next),
      }));
    }
  }

  async function removeCategoria(c: CategoriaCassa) {
    if (
      !confirm(
        `Eliminare la categoria «${c.nome}»? I movimenti già registrati restano con questa etichetta.`
      )
    ) {
      return;
    }
    const res = await fetch(`/api/cassa/categorie/${c.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Errore eliminazione categoria");
      return;
    }
    toast.success("Categoria eliminata");
    const next = await loadCategorie();
    setForm((f) => {
      if (f.tipo !== c.tipo || f.categoria !== c.nome) return f;
      return { ...f, categoria: firstCategoria(f.tipo, next) };
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-4xl">Cassa</h1>
          <p className="text-sm text-stone-500">Entrate e uscite inserite a mano, con dettaglio.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setCatOpen(true)}>
            <Tags className="h-4 w-4" />
            Categorie
          </Button>
          <Button
            onClick={() => {
              setForm((f) => ({
                ...f,
                data: toInputDate(new Date()),
                categoria: f.categoria || firstCategoria(f.tipo),
              }));
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Nuovo movimento
          </Button>
        </div>
      </div>

      <DateRangeFilter range={range} onChange={setRange} />

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

      <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
        {movimenti.length === 0 ? (
          <p className="p-10 text-center text-sm text-stone-400">Nessun movimento nel periodo.</p>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {movimenti.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full",
                    m.tipo === "ENTRATA" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                  )}
                >
                  {m.tipo === "ENTRATA" ? (
                    <ArrowUpRight className="h-4 w-4" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{m.descrizione}</p>
                  <p className="text-xs text-stone-400">
                    {formatDateTime(m.data)} · {m.categoria}
                  </p>
                </div>
                <Badge tone={m.tipo === "ENTRATA" ? "ok" : "danger"}>{m.tipo}</Badge>
                <span
                  className={cn(
                    "w-28 text-right font-semibold tabular-nums",
                    m.tipo === "ENTRATA" ? "text-emerald-700" : "text-red-700"
                  )}
                >
                  {m.tipo === "ENTRATA" ? "+" : "−"}
                  {formatEuro(m.importo)}
                </span>
                <Button variant="ghost" size="icon" onClick={() => void remove(m.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={open} onClose={() => setOpen(false)} title="Movimento di cassa">
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {(["ENTRATA", "USCITA"] as const).map((tipo) => (
              <button
                key={tipo}
                type="button"
                onClick={() =>
                  setForm({
                    ...form,
                    tipo,
                    categoria: firstCategoria(tipo),
                  })
                }
                className={cn(
                  "rounded-xl border px-3 py-3 text-sm font-medium",
                  form.tipo === tipo
                    ? tipo === "ENTRATA"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                      : "border-red-500 bg-red-50 text-red-800"
                    : "border-[var(--line)] bg-white"
                )}
              >
                {tipo === "ENTRATA" ? "Entrata" : "Uscita"}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Importo</Label>
              <Input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={form.importo}
                onChange={(e) => setForm({ ...form, importo: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input
                type="date"
                required
                value={form.data}
                onChange={(e) => setForm({ ...form, data: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            {categorie.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--line)] px-3 py-3 text-sm text-stone-500">
                Nessuna categoria. Apri «Categorie» per aggiungerne una.
              </p>
            ) : (
              <Select
                value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
              >
                {categorie.map((c) => (
                  <option key={c.id} value={c.nome}>
                    {c.nome}
                  </option>
                ))}
              </Select>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Dettaglio</Label>
            <Textarea
              required
              placeholder="Es. Incasso aperitivo, bolletta luce, fornitore bevande…"
              value={form.descrizione}
              onChange={(e) => setForm({ ...form, descrizione: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annulla
            </Button>
            <Button type="submit" disabled={!form.categoria}>
              Registra
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={catOpen} onClose={() => setCatOpen(false)} title="Categorie di cassa">
        <div className="space-y-5">
          <form onSubmit={addCategoria} className="space-y-3 rounded-xl border border-[var(--line)] bg-white p-3">
            <div className="grid grid-cols-2 gap-2">
              {(["ENTRATA", "USCITA"] as const).map((tipo) => (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => setNuovaCat((c) => ({ ...c, tipo }))}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-sm font-medium",
                    nuovaCat.tipo === tipo
                      ? tipo === "ENTRATA"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                        : "border-red-500 bg-red-50 text-red-800"
                      : "border-[var(--line)] bg-white"
                  )}
                >
                  {tipo === "ENTRATA" ? "Entrata" : "Uscita"}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                required
                placeholder="Nome categoria"
                value={nuovaCat.nome}
                onChange={(e) => setNuovaCat((c) => ({ ...c, nome: e.target.value }))}
              />
              <Button type="submit">
                <Plus className="h-4 w-4" />
                Aggiungi
              </Button>
            </div>
          </form>

          {(["ENTRATA", "USCITA"] as const).map((tipo) => (
            <section key={tipo}>
              <h3 className="mb-2 text-sm font-medium text-stone-500">
                {tipo === "ENTRATA" ? "Entrate" : "Uscite"}
              </h3>
              {categorieByTipo[tipo].length === 0 ? (
                <p className="text-sm text-stone-400">Nessuna categoria.</p>
              ) : (
                <ul className="divide-y divide-[var(--line)] overflow-hidden rounded-xl border border-[var(--line)] bg-white">
                  {categorieByTipo[tipo].map((c) => (
                    <li key={c.id} className="flex items-center gap-2 px-3 py-2">
                      <span className="flex-1 text-sm">{c.nome}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => void removeCategoria(c)}
                        aria-label={`Elimina ${c.nome}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </Dialog>
    </div>
  );
}
