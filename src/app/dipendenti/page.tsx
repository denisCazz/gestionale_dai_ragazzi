"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isWeekend,
  startOfMonth,
  subMonths,
} from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, IdCard, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, Textarea } from "@/components/ui/select";
import { formatEuro } from "@/lib/format";
import { RUOLI_DIPENDENTE } from "@/lib/menu";
import { fetchJson } from "@/lib/http";
import { cn } from "@/lib/utils";

type TipoPresenza = "PRESENTE" | "FERIE" | "MALATTIA" | "RIPOSO";
type Dipendente = {
  id: string;
  nome: string;
  cognome: string;
  ruolo: string;
  telefono: string | null;
  email: string | null;
  retribuzione: number;
  attivo: boolean;
  dataAssunzione: string | null;
};
type Presenza = { id: string; dipendenteId: string; data: string; tipo: TipoPresenza };

const TIPI: { tipo: TipoPresenza; label: string; short: string; className: string }[] = [
  { tipo: "PRESENTE", label: "Presente", short: "P", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { tipo: "FERIE", label: "Ferie", short: "F", className: "bg-sky-100 text-sky-800 border-sky-200" },
  { tipo: "MALATTIA", label: "Malattia", short: "M", className: "bg-amber-100 text-amber-800 border-amber-200" },
  { tipo: "RIPOSO", label: "Riposo", short: "R", className: "bg-stone-100 text-stone-600 border-stone-200" },
];

const EMPTY = {
  nome: "",
  cognome: "",
  ruolo: "Sala",
  telefono: "",
  email: "",
  retribuzione: "",
  dataAssunzione: "",
  note: "",
};

export default function DipendentiPage() {
  const [mese, setMese] = useState(() => startOfMonth(new Date()));
  const [dipendenti, setDipendenti] = useState<Dipendente[]>([]);
  const [presenze, setPresenze] = useState<Presenza[]>([]);
  const [loading, setLoading] = useState(true);
  const [cell, setCell] = useState<{ dipendente: Dipendente; data: string; tipo: TipoPresenza | null } | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Dipendente | null>(null);
  const [form, setForm] = useState(EMPTY);

  const days = useMemo(
    () => eachDayOfInterval({ start: startOfMonth(mese), end: endOfMonth(mese) }),
    [mese]
  );

  const load = useCallback(async (monthDate: Date) => {
    setLoading(true);
    try {
      const data = await fetchJson<{ dipendenti?: Dipendente[]; presenze?: Presenza[] }>(
        `/api/presenze?mese=${format(monthDate, "yyyy-MM")}`
      );
      setDipendenti(data.dipendenti ?? []);
      setPresenze(data.presenze ?? []);
    } catch {
      toast.error("Errore caricamento dipendenti");
      setDipendenti([]);
      setPresenze([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(mese);
  }, [mese, load]);

  const presenzaMap = useMemo(() => {
    const map = new Map<string, TipoPresenza>();
    for (const p of presenze) map.set(`${p.dipendenteId}:${p.data}`, p.tipo);
    return map;
  }, [presenze]);

  async function setPresenza(tipo: TipoPresenza | null) {
    if (!cell) return;
    const res = await fetch("/api/presenze", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dipendenteId: cell.dipendente.id, data: cell.data, tipo }),
    });
    if (!res.ok) {
      toast.error("Errore salvataggio presenza");
      return;
    }
    const data = await res.json();
    setPresenze((prev) => {
      const filtered = prev.filter(
        (p) => !(p.dipendenteId === cell.dipendente.id && p.data === cell.data)
      );
      if (!data.presenza) return filtered;
      return [...filtered, data.presenza];
    });
    setCell(null);
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setFormOpen(true);
  }

  function openEdit(d: Dipendente) {
    setEditing(d);
    setForm({
      nome: d.nome,
      cognome: d.cognome,
      ruolo: d.ruolo,
      telefono: d.telefono ?? "",
      email: d.email ?? "",
      retribuzione: String(d.retribuzione || ""),
      dataAssunzione: d.dataAssunzione ? d.dataAssunzione.slice(0, 10) : "",
      note: "",
    });
    setFormOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      ...form,
      retribuzione: Number(form.retribuzione) || 0,
      dataAssunzione: form.dataAssunzione || null,
    };
    const res = await fetch(editing ? `/api/dipendenti/${editing.id}` : "/api/dipendenti", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      toast.error("Errore salvataggio dipendente");
      return;
    }
    toast.success(editing ? "Dipendente aggiornato" : "Dipendente creato");
    setFormOpen(false);
    await load(mese);
  }

  async function removeDipendente(d: Dipendente) {
    if (!confirm(`Eliminare ${d.cognome} ${d.nome}? Verranno cancellate anche le presenze.`)) {
      return;
    }
    const res = await fetch(`/api/dipendenti/${d.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Errore eliminazione dipendente");
      return;
    }
    toast.success("Dipendente eliminato");
    setFormOpen(false);
    setEditing(null);
    await load(mese);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-[family-name:var(--font-display)] text-4xl">
            <IdCard className="h-7 w-7" /> Dipendenti
          </h1>
          <p className="text-sm text-stone-500">Anagrafica e calendario presenze del mese.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-[var(--line)] bg-white p-1">
            <Button variant="ghost" size="icon" onClick={() => setMese((m) => startOfMonth(subMonths(m, 1)))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[9.5rem] text-center text-sm font-medium capitalize">
              {format(mese, "MMMM yyyy", { locale: it })}
            </span>
            <Button variant="ghost" size="icon" onClick={() => setMese((m) => startOfMonth(addMonths(m, 1)))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nuovo dipendente
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {TIPI.map((t) => (
          <span key={t.tipo} className={cn("rounded-md border px-2 py-1 text-xs font-medium", t.className)}>
            {t.short} {t.label}
          </span>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
        {loading ? (
          <p className="p-10 text-center text-sm text-stone-400">Caricamento…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--paper)]">
                  <th className="sticky left-0 z-10 min-w-[11rem] border-r border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-left">
                    Dipendente
                  </th>
                  {days.map((day) => (
                    <th
                      key={format(day, "yyyy-MM-dd")}
                      className={cn(
                        "min-w-[2rem] px-0.5 py-1.5 text-center",
                        isWeekend(day) ? "text-stone-400" : "text-stone-600"
                      )}
                    >
                      <div className="text-[10px] uppercase">
                        {["D", "L", "M", "M", "G", "V", "S"][getDay(day)]}
                      </div>
                      <div className="text-xs">{format(day, "d")}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dipendenti.map((d) => (
                  <tr key={d.id} className="border-b border-[var(--line)]">
                    <td className="sticky left-0 z-10 border-r border-[var(--line)] bg-white px-3 py-2">
                      <button type="button" className="text-left" onClick={() => openEdit(d)}>
                        <div className="font-medium">
                          {d.cognome} {d.nome}
                        </div>
                        <div className="text-[11px] text-stone-400">
                          {d.ruolo}
                          {d.retribuzione ? ` · ${formatEuro(d.retribuzione)}` : ""}
                        </div>
                      </button>
                    </td>
                    {days.map((day) => {
                      const data = format(day, "yyyy-MM-dd");
                      const tipo = presenzaMap.get(`${d.id}:${data}`) ?? null;
                      const meta = TIPI.find((t) => t.tipo === tipo);
                      return (
                        <td key={data} className="p-0.5 text-center">
                          <button
                            type="button"
                            onClick={() => setCell({ dipendente: d, data, tipo })}
                            className={cn(
                              "mx-auto flex h-7 w-7 items-center justify-center rounded border text-[10px] font-bold",
                              meta?.className ?? (isWeekend(day) ? "border-transparent text-transparent" : "border-transparent text-transparent hover:border-stone-300")
                            )}
                          >
                            {meta?.short ?? "·"}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {dipendenti.map((d) => (
          <div key={d.id} className="rounded-2xl border border-[var(--line)] bg-white p-4 text-left">
            <button type="button" className="w-full text-left" onClick={() => openEdit(d)}>
              <p className="font-semibold">
                {d.cognome} {d.nome}
              </p>
              <Badge className="mt-2">{d.ruolo}</Badge>
              {d.telefono && <p className="mt-2 text-xs text-stone-500">{d.telefono}</p>}
            </button>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(d)}>
                Modifica
              </Button>
              <Button size="sm" variant="danger" onClick={() => void removeDipendente(d)}>
                <Trash2 className="h-4 w-4" />
                Elimina
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={Boolean(cell)} onClose={() => setCell(null)} title={cell ? `${cell.dipendente.cognome} ${cell.dipendente.nome}` : "Presenza"}>
        {cell && (
          <div className="space-y-3">
            <p className="text-sm text-stone-500">
              {format(new Date(`${cell.data}T12:00:00`), "EEEE d MMMM yyyy", { locale: it })}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {TIPI.map((t) => (
                <button
                  key={t.tipo}
                  type="button"
                  onClick={() => void setPresenza(t.tipo)}
                  className={cn("rounded-xl border px-3 py-3 text-left", t.className)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <Button variant="outline" className="w-full" onClick={() => void setPresenza(null)}>
              Rimuovi
            </Button>
          </div>
        )}
      </Dialog>

      <Dialog open={formOpen} onClose={() => setFormOpen(false)} title={editing ? "Modifica dipendente" : "Nuovo dipendente"}>
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Cognome</Label>
              <Input required value={form.cognome} onChange={(e) => setForm({ ...form, cognome: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Ruolo</Label>
              <Select value={form.ruolo} onChange={(e) => setForm({ ...form, ruolo: e.target.value })}>
                {RUOLI_DIPENDENTE.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Retribuzione</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.retribuzione}
                onChange={(e) => setForm({ ...form, retribuzione: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Telefono</Label>
              <Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Data assunzione</Label>
            <Input
              type="date"
              value={form.dataAssunzione}
              onChange={(e) => setForm({ ...form, dataAssunzione: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Note</Label>
            <Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            {editing && (
              <Button type="button" variant="danger" className="mr-auto" onClick={() => void removeDipendente(editing)}>
                <Trash2 className="h-4 w-4" />
                Elimina
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
              Annulla
            </Button>
            <Button type="submit">Salva</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
