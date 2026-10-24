"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Clock, Coffee, LogIn, LogOut, CheckCircle2, Play } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchJson } from "@/lib/http";
import { oreLavorateLabel, type OrariPresenza } from "@/lib/turni";
import { cn } from "@/lib/utils";

type Azione = "ENTRATA" | "INIZIO_PAUSA" | "FINE_PAUSA" | "USCITA";

type TimbraturaStato = {
  dipendente: {
    id: string;
    nome: string;
    cognome: string;
    ruolo: string;
  };
  oggi: string;
  oraCorrente: string;
  presenza: OrariPresenza;
};

function getBrowserCoords(timeoutMs = 3500): Promise<{ lat: number; lng: number } | null> {
  if (typeof window === "undefined" || !("geolocation" in navigator)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, timeoutMs);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        }
      },
      () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(null);
        }
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30000 }
    );
  });
}

export default function TimbraturaPage() {
  const [stato, setStato] = useState<TimbraturaStato | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<Azione | null>(null);
  const [nowTime, setNowTime] = useState<string>("");

  const load = useCallback(async () => {
    try {
      const data = await fetchJson<TimbraturaStato>("/api/timbratura");
      setStato(data);
      setNowTime(data.oraCorrente);
    } catch {
      toast.error("Impossibile caricare la scheda di timbratura");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const tick = () => {
      const parts = new Intl.DateTimeFormat("it-IT", {
        timeZone: "Europe/Rome",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date());
      setNowTime(parts);
    };
    tick();
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, []);

  async function timbra(azione: Azione) {
    if (!stato) return;
    setSubmitting(azione);
    try {
      const coords = await getBrowserCoords(3000);
      const res = await fetch("/api/timbratura", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          azione,
          dipendenteId: stato.dipendente.id,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Errore durante la registrazione");
        return;
      }
      setStato((prev) =>
        prev
          ? {
              ...prev,
              oraCorrente: data.ora ?? prev.oraCorrente,
              presenza: data.presenza ?? prev.presenza,
            }
          : prev
      );
      toast.success(`Timbratura registrata alle ${data.ora ?? nowTime}`);
    } finally {
      setSubmitting(null);
    }
  }

  if (loading) {
    return <p className="p-10 text-center text-sm text-stone-500">Caricamento registro giornaliero…</p>;
  }

  if (!stato) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-[var(--line)] bg-white p-6 text-center">
        <p className="text-sm text-stone-600">Nessun profilo dipendente associato a questa sessione.</p>
      </div>
    );
  }

  const p = stato.presenza;
  const haEntrata = Boolean(p.oraIngresso);
  const inPausaOSenzaSecondoTurno = Boolean(p.oraIngresso && p.oraUscita && !p.oraIngresso2);
  const inSecondoTurno = Boolean(p.oraIngresso2 && !p.oraUscita2);
  const giornataConclusa = Boolean(p.oraIngresso2 && p.oraUscita2);

  const canEntrata = !haEntrata;
  const canInizioPausa = Boolean(p.oraIngresso && !p.oraUscita);
  const canFinePausa = inPausaOSenzaSecondoTurno;
  const canUscita = Boolean((p.oraIngresso && !p.oraUscita) || inSecondoTurno);

  const oreOggi = oreLavorateLabel(p);
  const dataEstesa = format(new Date(`${stato.oggi}T12:00:00`), "EEEE d MMMM yyyy", { locale: it });

  let badgeStato = { label: "Non ancora entrato", className: "bg-stone-100 text-stone-700" };
  if (giornataConclusa) {
    badgeStato = { label: "Turno concluso", className: "bg-emerald-100 text-emerald-800" };
  } else if (inSecondoTurno) {
    badgeStato = { label: "In servizio (2° turno)", className: "bg-emerald-100 text-emerald-800" };
  } else if (inPausaOSenzaSecondoTurno) {
    badgeStato = { label: "In pausa / Uscito 1° turno", className: "bg-amber-100 text-amber-800" };
  } else if (haEntrata) {
    badgeStato = { label: "In servizio", className: "bg-emerald-100 text-emerald-800" };
  }

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--espresso)] p-6 text-[var(--cream)] shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--gold)]">
              Garavella 7 · Registro Presenze
            </p>
            <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl">
              {stato.dipendente.nome} {stato.dipendente.cognome}
            </h1>
            <p className="text-xs text-[var(--cream-muted)]">{stato.dipendente.ruolo}</p>
          </div>
          <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", badgeStato.className)}>
            {badgeStato.label}
          </span>
        </div>

        <div className="mt-5 flex items-baseline justify-between border-t border-white/10 pt-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-[var(--cream-muted)]">Data odierna</p>
            <p className="mt-0.5 text-sm font-medium capitalize">{dataEstesa}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-[var(--cream-muted)]">Ora attuale</p>
            <p className="mt-0.5 flex items-center justify-end gap-1.5 font-mono text-2xl font-bold text-[var(--gold)]">
              <Clock className="h-5 w-5" />
              {nowTime}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--line)] bg-white p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-display)] text-2xl">Registra presenza di oggi</h2>
          <Badge>Solo data odierna</Badge>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={!canEntrata || submitting !== null}
            onClick={() => void timbra("ENTRATA")}
            className={cn(
              "flex items-center gap-3 rounded-2xl border p-4 text-left transition",
              canEntrata
                ? "border-emerald-300 bg-emerald-50 text-emerald-950 hover:bg-emerald-100"
                : "cursor-not-allowed border-stone-200 bg-stone-50 text-stone-400"
            )}
          >
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                canEntrata ? "bg-emerald-600 text-white" : "bg-stone-200 text-stone-400"
              )}
            >
              <LogIn className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">
                {submitting === "ENTRATA" ? "Registrazione…" : "Entrata"}
              </p>
              <p className="text-xs opacity-75">
                {p.oraIngresso ? `Registrata alle ${p.oraIngresso}` : "Inizia il turno di oggi"}
              </p>
            </div>
          </button>

          {!canFinePausa ? (
            <button
              type="button"
              disabled={!canInizioPausa || submitting !== null}
              onClick={() => void timbra("INIZIO_PAUSA")}
              className={cn(
                "flex items-center gap-3 rounded-2xl border p-4 text-left transition",
                canInizioPausa
                  ? "border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100"
                  : "cursor-not-allowed border-stone-200 bg-stone-50 text-stone-400"
              )}
            >
              <div
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                  canInizioPausa ? "bg-amber-500 text-white" : "bg-stone-200 text-stone-400"
                )}
              >
                <Coffee className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">
                  {submitting === "INIZIO_PAUSA" ? "Registrazione…" : "Inizio Pausa"}
                </p>
                <p className="text-xs opacity-75">Sospendi il turno per pausa</p>
              </div>
            </button>
          ) : (
            <button
              type="button"
              disabled={!canFinePausa || submitting !== null}
              onClick={() => void timbra("FINE_PAUSA")}
              className="flex items-center gap-3 rounded-2xl border border-sky-300 bg-sky-50 p-4 text-left text-sky-950 transition hover:bg-sky-100"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white">
                <Play className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">
                  {submitting === "FINE_PAUSA" ? "Registrazione…" : "Fine Pausa (Rientro)"}
                </p>
                <p className="text-xs opacity-75">Riprendi il servizio (2° turno)</p>
              </div>
            </button>
          )}

          <Button
            type="button"
            disabled={!canUscita || submitting !== null}
            onClick={() => void timbra("USCITA")}
            className="sm:col-span-2 h-14 rounded-2xl text-base"
          >
            <LogOut className="h-5 w-5" />
            {submitting === "USCITA" ? "Registrazione uscita…" : "Registra Uscita Fine Turno"}
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--line)] bg-white p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-stone-800">Riepilogo timbrature di oggi</h3>
          {oreOggi && (
            <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
              Totale oggi: {oreOggi}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-3">
            <p className="text-xs text-stone-500">1° Turno — Entrata</p>
            <p className="mt-1 font-mono text-lg font-bold text-stone-800">
              {p.oraIngresso ?? "— : —"}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-3">
            <p className="text-xs text-stone-500">
              {p.oraIngresso2 ? "Inizio Pausa (Fine 1° turno)" : "Uscita / Inizio Pausa"}
            </p>
            <p className="mt-1 font-mono text-lg font-bold text-stone-800">
              {p.oraUscita ?? "— : —"}
            </p>
          </div>

          {(p.oraIngresso2 || p.oraUscita2) && (
            <>
              <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-3">
                <p className="text-xs text-stone-500">2° Turno — Rientro Pausa</p>
                <p className="mt-1 font-mono text-lg font-bold text-stone-800">
                  {p.oraIngresso2 ?? "— : —"}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-3">
                <p className="text-xs text-stone-500">2° Turno — Uscita Finale</p>
                <p className="mt-1 font-mono text-lg font-bold text-stone-800">
                  {p.oraUscita2 ?? "— : —"}
                </p>
              </div>
            </>
          )}
        </div>

        <p className="flex items-center gap-1.5 text-xs text-stone-500 pt-1">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
          La registrazione è consentita esclusivamente per la data odierna. Per rettifiche su giorni precedenti rivolgersi alla direzione.
        </p>
      </div>
    </div>
  );
}
