"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, Sparkles, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/select";
import { fetchJson } from "@/lib/http";
import { cn } from "@/lib/utils";

type Promozione = {
  id: string;
  titolo: string;
  titoloEn: string | null;
  quando: string;
  quandoEn: string | null;
  orario: string | null;
  prezzo: number;
  nota: string | null;
  notaEn: string | null;
  evidenza: boolean;
  attiva: boolean;
  ordine: number;
};

const EMPTY_FORM = {
  titolo: "",
  titoloEn: "",
  quando: "",
  quandoEn: "",
  orario: "17:30 – 20:30",
  prezzo: "",
  nota: "",
  notaEn: "",
  evidenza: false,
  attiva: true,
};

function formatPrezzo(n: number) {
  if (Number.isInteger(n)) return `${n}`;
  return n.toFixed(2).replace(/\.00$/, "");
}

export default function PromozioniPage() {
  const [promozioni, setPromozioni] = useState<Promozione[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Promozione | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchJson<{ promozioni?: Promozione[] }>("/api/promozioni");
      setPromozioni(data.promozioni ?? []);
    } catch {
      toast.error("Errore caricamento promozioni");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(p: Promozione) {
    setEditing(p);
    setForm({
      titolo: p.titolo,
      titoloEn: p.titoloEn ?? "",
      quando: p.quando,
      quandoEn: p.quandoEn ?? "",
      orario: p.orario ?? "",
      prezzo: String(p.prezzo ?? ""),
      nota: p.nota ?? "",
      notaEn: p.notaEn ?? "",
      evidenza: p.evidenza,
      attiva: p.attiva,
    });
    setDialogOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        prezzo: Number(form.prezzo.replace(",", ".")) || 0,
      };
      const res = await fetch(editing ? `/api/promozioni/${editing.id}` : "/api/promozioni", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        toast.error("Errore salvataggio promozione");
        return;
      }
      toast.success(editing ? "Promozione aggiornata sul sito" : "Promozione creata");
      setDialogOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function toggleField(p: Promozione, field: "attiva" | "evidenza") {
    const res = await fetch(`/api/promozioni/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: !p[field] }),
    });
    if (!res.ok) {
      toast.error("Errore aggiornamento");
      return;
    }
    await load();
  }

  async function move(index: number, dir: -1 | 1) {
    const target = promozioni[index];
    const swap = promozioni[index + dir];
    if (!target || !swap) return;
    await Promise.all([
      fetch(`/api/promozioni/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ordine: index + dir + 1 }),
      }),
      fetch(`/api/promozioni/${swap.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ordine: index + 1 }),
      }),
    ]);
    await load();
  }

  async function remove(p: Promozione) {
    if (!confirm(`Eliminare la promozione «${p.titolo}»?`)) return;
    const res = await fetch(`/api/promozioni/${p.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Errore eliminazione promozione");
      return;
    }
    toast.success("Promozione eliminata");
    setDialogOpen(false);
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-[family-name:var(--font-display)] text-4xl">
            <Sparkles className="h-7 w-7 text-[var(--gold-dim)]" /> Promozioni & Aperitivi
          </h1>
          <p className="text-sm text-stone-500">
            Gestisci le promozioni mostrate in tempo reale nella sezione Aperitivi della Home sul sito web.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nuova promozione
        </Button>
      </div>

      {loading ? (
        <p className="p-10 text-center text-sm text-stone-400">Caricamento promozioni…</p>
      ) : promozioni.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white p-10 text-center">
          <p className="text-sm text-stone-500">Nessuna promozione attiva.</p>
          <Button className="mt-4" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Crea la prima promozione
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {promozioni.map((p, idx) => (
            <div
              key={p.id}
              className={cn(
                "flex flex-col justify-between rounded-2xl border p-6 transition",
                p.evidenza
                  ? "border-[var(--gold)] bg-[var(--espresso)] text-[var(--cream)] shadow-md"
                  : "border-[var(--line)] bg-white text-[var(--ink)]",
                !p.attiva && "opacity-55"
              )}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <p
                    className={cn(
                      "text-xs font-bold uppercase tracking-[0.18em]",
                      p.evidenza ? "text-[var(--gold)]" : "text-[var(--gold-dim)]"
                    )}
                  >
                    {p.quando}
                  </p>
                  <div className="flex items-center gap-1.5">
                    {p.evidenza && <Badge tone="gold">In evidenza</Badge>}
                    {!p.attiva && <Badge>Nascosta</Badge>}
                  </div>
                </div>

                <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl">
                  {p.titolo}
                </h2>
                {p.orario && (
                  <p
                    className={cn(
                      "mt-1 text-sm",
                      p.evidenza ? "text-[var(--cream-muted)]" : "text-stone-500"
                    )}
                  >
                    {p.orario}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap items-baseline gap-3">
                  <span
                    className={cn(
                      "font-[family-name:var(--font-display)] text-4xl font-bold leading-none",
                      p.evidenza ? "text-[var(--gold)]" : "text-[var(--gold-dim)]"
                    )}
                  >
                    {formatPrezzo(p.prezzo)}€
                  </span>
                  {p.nota && (
                    <span
                      className={cn(
                        "text-xs leading-relaxed",
                        p.evidenza ? "text-[var(--cream-muted)]" : "text-stone-500"
                      )}
                    >
                      {p.nota}
                    </span>
                  )}
                </div>
              </div>

              <div
                className={cn(
                  "mt-6 flex flex-wrap items-center justify-between gap-2 border-t pt-4",
                  p.evidenza ? "border-white/15" : "border-[var(--line)]"
                )}
              >
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={idx === 0}
                    onClick={() => void move(idx, -1)}
                    className={p.evidenza ? "text-[var(--cream)] hover:bg-white/10" : ""}
                    title="Sposta su"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={idx === promozioni.length - 1}
                    onClick={() => void move(idx, 1)}
                    className={p.evidenza ? "text-[var(--cream)] hover:bg-white/10" : ""}
                    title="Sposta giù"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void toggleField(p, "evidenza")}
                    className={p.evidenza ? "text-[var(--gold)] hover:bg-white/10" : ""}
                    title="Metti in evidenza"
                  >
                    <Star className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void toggleField(p, "attiva")}
                    className={p.evidenza ? "text-[var(--cream)] hover:bg-white/10" : ""}
                    title={p.attiva ? "Nascondi dal sito" : "Pubblica sul sito"}
                  >
                    {p.attiva ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={p.evidenza ? "secondary" : "outline"}
                    onClick={() => openEdit(p)}
                  >
                    Modifica
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => void remove(p)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editing ? "Modifica promozione" : "Nuova promozione"}
      >
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Titolo promozione (IT)</Label>
              <Input
                required
                placeholder="es. Aperitivo a buffet"
                value={form.titolo}
                onChange={(e) => setForm({ ...form, titolo: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Titolo (EN opzionale)</Label>
              <Input
                placeholder="es. Buffet aperitivo"
                value={form.titoloEn}
                onChange={(e) => setForm({ ...form, titoloEn: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Quando / Giorni (IT)</Label>
              <Input
                required
                placeholder="es. Tutti i venerdì"
                value={form.quando}
                onChange={(e) => setForm({ ...form, quando: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Quando (EN opzionale)</Label>
              <Input
                placeholder="es. Every Friday"
                value={form.quandoEn}
                onChange={(e) => setForm({ ...form, quandoEn: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Fascia oraria</Label>
              <Input
                placeholder="es. 17:30 – 20:30"
                value={form.orario}
                onChange={(e) => setForm({ ...form, orario: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Prezzo (€)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="es. 13 o 8.50"
                value={form.prezzo}
                onChange={(e) => setForm({ ...form, prezzo: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Nota / Dettagli inclusi (IT)</Label>
            <Textarea
              placeholder="es. Compresa la prima consumazione"
              value={form.nota}
              onChange={(e) => setForm({ ...form, nota: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Nota / Dettagli (EN opzionale)</Label>
            <Textarea
              placeholder="es. First drink included"
              value={form.notaEn}
              onChange={(e) => setForm({ ...form, notaEn: e.target.value })}
            />
          </div>

          <div className="flex flex-wrap gap-4 pt-1 text-sm">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.evidenza}
                onChange={(e) => setForm({ ...form, evidenza: e.target.checked })}
              />
              <span>Card in evidenza (bordo oro)</span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.attiva}
                onChange={(e) => setForm({ ...form, attiva: e.target.checked })}
              />
              <span>Visibile sul sito pubblico</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Annulla
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvataggio…" : "Salva promozione"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
