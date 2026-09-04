"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDownToLine, ArrowLeft, ArrowUpFromLine, PackagePlus } from "lucide-react";
import { BarcodeScanner } from "@/components/magazzino/barcode-scanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isLowStock, looksLikeEan } from "@/lib/magazzino";
import { formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Articolo {
  id: string;
  codice: string;
  ean: string | null;
  nome: string;
  unitaMisura: string;
  quantita: number;
  sogliaMinima: number;
  ubicazione: string | null;
}

type Phase =
  | { kind: "scanning" }
  | { kind: "found"; articolo: Articolo; code: string }
  | { kind: "unknown"; code: string };

export default function ScansionePage() {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "scanning" });
  const [qty, setQty] = useState("1");
  const [busy, setBusy] = useState(false);
  const [createForm, setCreateForm] = useState({
    nome: "",
    codice: "",
    ean: "",
    quantita: "1",
    ubicazione: "",
  });

  useEffect(() => {
    if (phase.kind !== "scanning") {
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [phase.kind]);

  async function handleScan(code: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/magazzino/lookup?code=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (!res.ok) {
        toast.error("Errore lookup");
        return;
      }
      if (data.found) {
        setPhase({ kind: "found", articolo: data.articolo, code: data.code });
        setQty("1");
        toast.success("Articolo riconosciuto");
      } else {
        const scanned = String(data.code ?? code);
        setPhase({ kind: "unknown", code: scanned });
        setCreateForm({
          nome: "",
          codice: scanned,
          ean: looksLikeEan(scanned) ? scanned : "",
          quantita: "1",
          ubicazione: "",
        });
        toast.message("Codice non in magazzino", {
          description: "Compila il nome e crea l'articolo.",
        });
      }
    } finally {
      setBusy(false);
    }
  }

  async function doMovimento(tipo: "ENTRATA" | "USCITA") {
    if (phase.kind !== "found") return;
    const quantita = Number(qty);
    if (!Number.isFinite(quantita) || quantita <= 0) {
      toast.error("Quantità non valida");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/magazzino/movimenti", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articoloId: phase.articolo.id,
          tipo,
          quantita,
          note: `Scan ${phase.code}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Errore movimento");
        return;
      }
      toast.success(
        tipo === "ENTRATA"
          ? `+${quantita} ${data.articolo.unitaMisura}`
          : `−${quantita} ${data.articolo.unitaMisura}`
      );
      setPhase({ kind: "found", articolo: data.articolo, code: phase.code });
      setQty("1");
    } finally {
      setBusy(false);
    }
  }

  async function createFromScan(e: React.FormEvent) {
    e.preventDefault();
    if (phase.kind !== "unknown") return;
    const nome = createForm.nome.trim();
    const codice = (createForm.codice || phase.code).trim();
    if (!nome || !codice) {
      toast.error("Nome e codice obbligatori");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/articoli", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codice,
          ean: createForm.ean.trim() || null,
          nome,
          quantita: Number(createForm.quantita) || 0,
          ubicazione: createForm.ubicazione.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Errore creazione");
        return;
      }
      toast.success("Articolo creato — puoi fare entrata/uscita");
      setPhase({ kind: "found", articolo: data, code: phase.code });
      setQty("1");
    } finally {
      setBusy(false);
    }
  }

  const paused = phase.kind !== "scanning";

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/magazzino">
          <Button variant="ghost" size="icon" aria-label="Torna al magazzino">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl">Scansione</h1>
          <p className="text-sm text-stone-500">QR / EAN · entrata e uscita sul campo</p>
        </div>
      </div>

      <BarcodeScanner
        onScan={(code) => void handleScan(code)}
        paused={paused || busy}
        className={cn(
          "w-full transition-all",
          paused ? "aspect-video max-h-56" : "aspect-[3/4] sm:aspect-video"
        )}
      />

      {phase.kind === "scanning" && (
        <p className="text-center text-sm text-stone-500">
          Inquadra un codice. Se è nuovo, apparirà il form di creazione.
        </p>
      )}

      {phase.kind === "found" && (
        <div ref={panelRef} className="space-y-4 rounded-2xl border border-sky-200 bg-sky-50 p-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-sky-700">
              Articolo trovato
            </p>
            <h2 className="mt-1 text-lg font-bold">{phase.articolo.nome}</h2>
            <p className="mt-0.5 font-mono text-xs text-stone-500">
              {phase.articolo.codice}
              {phase.articolo.ean ? ` · EAN ${phase.articolo.ean}` : ""}
            </p>
            <p className="mt-2 text-2xl font-bold tabular-nums">
              {formatQty(phase.articolo.quantita, phase.articolo.unitaMisura)}
              {isLowStock(phase.articolo.quantita, phase.articolo.sogliaMinima) && (
                <span className="ml-2 text-sm font-medium text-amber-700">sotto scorta</span>
              )}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qty">Quantità</Label>
            <Input
              id="qty"
              type="number"
              min="0.001"
              step="any"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="bg-white text-lg"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button disabled={busy} variant="success" className="h-12" onClick={() => void doMovimento("ENTRATA")}>
              <ArrowDownToLine className="h-4 w-4" />
              Entrata
            </Button>
            <Button disabled={busy} variant="warning" className="h-12" onClick={() => void doMovimento("USCITA")}>
              <ArrowUpFromLine className="h-4 w-4" />
              Uscita
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setPhase({ kind: "scanning" })}>
              Continua a scansionare
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => router.push(`/magazzino/${phase.articolo.id}`)}
            >
              Dettaglio
            </Button>
          </div>
        </div>
      )}

      {phase.kind === "unknown" && (
        <div
          ref={panelRef}
          className="space-y-4 rounded-2xl border-2 border-amber-400 bg-amber-50 p-4"
        >
          <div className="flex items-start gap-2">
            <PackagePlus className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
            <div>
              <h2 className="font-semibold">Nuovo articolo</h2>
              <p className="mt-0.5 text-sm text-stone-600">
                Codice <span className="font-mono font-medium">{phase.code}</span> non riconosciuto.
              </p>
            </div>
          </div>
          <form onSubmit={createFromScan} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome articolo *</Label>
              <Input
                required
                autoFocus
                className="bg-white"
                value={createForm.nome}
                onChange={(e) => setCreateForm({ ...createForm, nome: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Codice *</Label>
                <Input
                  required
                  className="bg-white font-mono"
                  value={createForm.codice}
                  onChange={(e) => setCreateForm({ ...createForm, codice: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>EAN</Label>
                <Input
                  className="bg-white font-mono"
                  value={createForm.ean}
                  onChange={(e) => setCreateForm({ ...createForm, ean: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Giacenza iniziale</Label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  className="bg-white"
                  value={createForm.quantita}
                  onChange={(e) => setCreateForm({ ...createForm, quantita: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Ubicazione</Label>
                <Input
                  className="bg-white"
                  value={createForm.ubicazione}
                  onChange={(e) => setCreateForm({ ...createForm, ubicazione: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setPhase({ kind: "scanning" })}>
                Annulla
              </Button>
              <Button type="submit" disabled={busy} className="h-11 flex-1">
                {busy ? "Creazione…" : "Crea articolo"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
