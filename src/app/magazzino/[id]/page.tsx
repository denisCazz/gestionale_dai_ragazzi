"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime, formatQty } from "@/lib/format";

type Articolo = {
  id: string;
  codice: string;
  ean: string | null;
  nome: string;
  descrizione: string | null;
  unitaMisura: string;
  quantita: number;
  sogliaMinima: number;
  ubicazione: string | null;
  sottoScorta: boolean;
  esaurito: boolean;
  movimenti: { id: string; tipo: string; quantita: number; note: string | null; createdAt: string }[];
  vociMenu: { id: string; nome: string }[];
};

export default function ArticoloPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [articolo, setArticolo] = useState<Articolo | null>(null);
  const [qty, setQty] = useState("1");
  const [soglia, setSoglia] = useState("");

  async function load() {
    const res = await fetch(`/api/articoli/${id}`);
    if (res.ok) {
      const data = await res.json();
      setArticolo(data);
      setSoglia(String(data.sogliaMinima));
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function movimento(tipo: "ENTRATA" | "USCITA" | "RETTIFICA") {
    const quantita = Number(qty);
    if (!Number.isFinite(quantita) || quantita <= 0) return;
    const res = await fetch("/api/magazzino/movimenti", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articoloId: id, tipo, quantita }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Errore");
      return;
    }
    toast.success("Movimento registrato");
    setQty("1");
    await load();
  }

  async function saveSoglia() {
    const res = await fetch(`/api/articoli/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sogliaMinima: Number(soglia) || 0 }),
    });
    if (res.ok) {
      toast.success("Soglia aggiornata");
      await load();
    }
  }

  if (!articolo) return <p className="text-sm text-stone-500">Caricamento…</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/magazzino" className="inline-flex items-center gap-1 text-sm text-stone-500">
        <ArrowLeft className="h-4 w-4" /> Magazzino
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-4xl">{articolo.nome}</h1>
          <p className="font-mono text-sm text-stone-400">
            {articolo.codice}
            {articolo.ean ? ` · ${articolo.ean}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-semibold tabular-nums">
            {formatQty(articolo.quantita, articolo.unitaMisura)}
          </p>
          {articolo.esaurito ? (
            <Badge tone="danger">Esaurito</Badge>
          ) : articolo.sottoScorta ? (
            <Badge tone="warn">Sottoscorta</Badge>
          ) : (
            <Badge tone="ok">OK</Badge>
          )}
        </div>
      </div>

      {articolo.vociMenu.length > 0 && (
        <div className="rounded-2xl border border-[var(--line)] bg-white p-4 text-sm">
          <p className="mb-2 font-medium">Usato nel menu</p>
          <div className="flex flex-wrap gap-2">
            {articolo.vociMenu.map((v) => (
              <Badge key={v.id} tone={articolo.esaurito ? "danger" : "gold"}>
                {v.nome}
                {articolo.esaurito ? " · nascosto" : ""}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-[var(--line)] bg-white p-4 space-y-3">
          <Label>Quantità movimento</Label>
          <Input type="number" min="0.001" step="any" value={qty} onChange={(e) => setQty(e.target.value)} />
          <div className="grid grid-cols-3 gap-2">
            <Button variant="success" onClick={() => void movimento("ENTRATA")}>
              Entrata
            </Button>
            <Button variant="warning" onClick={() => void movimento("USCITA")}>
              Uscita
            </Button>
            <Button variant="outline" onClick={() => void movimento("RETTIFICA")}>
              Imposta
            </Button>
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-white p-4 space-y-3">
          <Label>Soglia minima (avviso sottoscorta)</Label>
          <Input type="number" min="0" step="any" value={soglia} onChange={(e) => setSoglia(e.target.value)} />
          <Button variant="outline" onClick={() => void saveSoglia()}>
            Salva soglia
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
        <h2 className="mb-3 font-[family-name:var(--font-display)] text-2xl">Movimenti</h2>
        <ul className="divide-y divide-[var(--line)] text-sm">
          {articolo.movimenti.map((m) => (
            <li key={m.id} className="flex justify-between py-2">
              <span>
                {m.tipo} {m.note ? `· ${m.note}` : ""}
              </span>
              <span className="tabular-nums text-stone-500">
                {m.quantita} · {formatDateTime(m.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
