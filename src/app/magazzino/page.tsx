"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Package, Plus, ScanLine, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatQty } from "@/lib/format";
import { fetchJson } from "@/lib/http";
import { cn } from "@/lib/utils";
import { Suspense } from "react";

type Articolo = {
  id: string;
  codice: string;
  ean: string | null;
  nome: string;
  unitaMisura: string;
  quantita: number;
  sogliaMinima: number;
  ubicazione: string | null;
  sottoScorta: boolean;
  esaurito: boolean;
};

const EMPTY = {
  codice: "",
  ean: "",
  nome: "",
  unitaMisura: "pz",
  quantita: "0",
  sogliaMinima: "0",
  ubicazione: "",
};

export default function MagazzinoPage() {
  return (
    <Suspense fallback={<p className="text-sm text-stone-500">Caricamento magazzino…</p>}>
      <MagazzinoContent />
    </Suspense>
  );
}

function MagazzinoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [articoli, setArticoli] = useState<Articolo[]>([]);
  const [searchInput, setSearchInput] = useState(searchParams.get("search") ?? "");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const lowStock = searchParams.get("lowStock") === "1";
  const search = searchParams.get("search") ?? "";

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (lowStock) params.set("lowStock", "true");
    fetchJson<{ articoli?: Articolo[] }>(`/api/articoli?${params}`)
      .then((d) => setArticoli(d.articoli ?? []))
      .catch(() => setArticoli([]));
  }, [search, lowStock]);

  function applyFilters(nextSearch = searchInput, nextLow = lowStock) {
    const p = new URLSearchParams();
    if (nextSearch.trim()) p.set("search", nextSearch.trim());
    if (nextLow) p.set("lowStock", "1");
    router.push(`/magazzino?${p}`);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const created = await fetchJson<Articolo>("/api/articoli", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          ean: form.ean || null,
          quantita: Number(form.quantita) || 0,
          sogliaMinima: Number(form.sogliaMinima) || 0,
        }),
      });
      toast.success("Articolo creato");
      setOpen(false);
      setForm(EMPTY);
      router.push(`/magazzino/${created.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore creazione");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-4xl">Magazzino</h1>
          <p className="text-sm text-stone-500">{articoli.length} articoli</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/magazzino/scansione">
            <Button variant="secondary">
              <ScanLine className="h-4 w-4" />
              Scansiona
            </Button>
          </Link>
          <Button
            onClick={() => {
              setForm(EMPTY);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Nuovo articolo
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <Input
            className="pl-9"
            placeholder="Cerca codice, EAN, nome…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
          />
        </div>
        <Button variant="outline" onClick={() => applyFilters()}>
          Cerca
        </Button>
        <Button
          variant={lowStock ? "warning" : "outline"}
          onClick={() => applyFilters(searchInput, !lowStock)}
        >
          <AlertTriangle className="h-4 w-4" />
          Sottoscorta
        </Button>
      </div>

      {articoli.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white py-16 text-center text-sm text-stone-500">
          <Package className="mx-auto mb-3 h-10 w-10 text-stone-300" />
          Nessun articolo. Scansiona un codice per aggiungerlo.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {articoli.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => router.push(`/magazzino/${a.id}`)}
              className="rounded-2xl border border-[var(--line)] bg-white p-4 text-left transition hover:border-[var(--gold)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{a.nome}</p>
                  <p className="mt-0.5 font-mono text-xs text-stone-400">
                    {a.codice}
                    {a.ean ? ` · EAN ${a.ean}` : ""}
                  </p>
                </div>
                <p
                  className={cn(
                    "text-lg font-bold tabular-nums",
                    a.esaurito ? "text-red-700" : a.sottoScorta ? "text-amber-700" : ""
                  )}
                >
                  {formatQty(a.quantita, a.unitaMisura)}
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {a.esaurito && <Badge tone="danger">Esaurito · menu nascosto</Badge>}
                {!a.esaurito && a.sottoScorta && <Badge tone="warn">Sottoscorta</Badge>}
                {a.ubicazione && <Badge>{a.ubicazione}</Badge>}
              </div>
            </button>
          ))}
        </div>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title="Nuovo articolo">
        <form onSubmit={save} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Codice interno *</Label>
              <Input
                required
                value={form.codice}
                onChange={(e) => setForm({ ...form, codice: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>EAN</Label>
              <Input
                value={form.ean}
                onChange={(e) => setForm({ ...form, ean: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input
              required
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Giacenza</Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={form.quantita}
                onChange={(e) => setForm({ ...form, quantita: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>U.M.</Label>
              <Input
                value={form.unitaMisura}
                onChange={(e) => setForm({ ...form, unitaMisura: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Soglia min.</Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={form.sogliaMinima}
                onChange={(e) => setForm({ ...form, sogliaMinima: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Ubicazione</Label>
            <Input
              value={form.ubicazione}
              onChange={(e) => setForm({ ...form, ubicazione: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annulla
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvataggio…" : "Crea"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
