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
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  IdCard,
  KeyRound,
  MapPin,
  Plus,
  Settings,
  ShieldAlert,
  Trash2,
  Wifi,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, Textarea } from "@/components/ui/select";
import { formatEuro } from "@/lib/format";
import { RUOLI_DIPENDENTE } from "@/lib/menu";
import { fetchJson } from "@/lib/http";
import {
  fasciaBreve,
  formatDurata,
  minutiLavorati,
  normalizzaOrari,
  oreLavorateLabel,
} from "@/lib/turni";
import { cn } from "@/lib/utils";

type TipoPresenza = "PRESENTE" | "FERIE" | "MALATTIA" | "RIPOSO";
type Dipendente = {
  id: string;
  nome: string;
  cognome: string;
  ruolo: string;
  telefono: string | null;
  email: string | null;
  username?: string | null;
  hasPassword?: boolean;
  retribuzione: number;
  attivo: boolean;
  dataAssunzione: string | null;
};
type Presenza = {
  id: string;
  dipendenteId: string;
  data: string;
  tipo: TipoPresenza;
  oraIngresso: string | null;
  oraUscita: string | null;
  oraIngresso2?: string | null;
  oraUscita2?: string | null;
  fuoriPerimetro?: boolean;
  metodoVerifica?: string | null;
  ipRegistrazione?: string | null;
  latRegistrazione?: number | null;
  lngRegistrazione?: number | null;
  distanzaMetri?: number | null;
};

type AnomaliaPresenza = {
  id: string;
  dipendenteId: string;
  data: string;
  ora: string;
  azione: string;
  motivo: string;
  ip: string | null;
  lat: number | null;
  lng: number | null;
  distanzaMetri: number | null;
  emailInviata: boolean;
  letta: boolean;
  createdAt: string;
  dipendente: {
    id: string;
    nome: string;
    cognome: string;
    ruolo: string;
  };
};

type ImpostazioniPresenze = {
  ipNegozio: string;
  raggioMetri: number;
  emailTitolari: string;
  currentIp?: string;
};

function titoloOrario(presenza: Presenza) {
  const fasce = [
    presenza.oraIngresso || presenza.oraUscita
      ? `${presenza.oraIngresso ?? "—"} – ${presenza.oraUscita ?? "—"}`
      : null,
    presenza.oraIngresso2 || presenza.oraUscita2
      ? `${presenza.oraIngresso2 ?? "—"} – ${presenza.oraUscita2 ?? "—"}`
      : null,
  ].filter(Boolean);
  const base = fasce.join(" · ");
  if (presenza.fuoriPerimetro) {
    return `${base} (⚠️ Fuori perimetro)`;
  }
  return base;
}

function adesso() {
  return format(new Date(), "HH:mm");
}

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
  username: "",
  password: "",
  retribuzione: "",
  dataAssunzione: "",
  note: "",
};

export default function DipendentiPage() {
  const [mese, setMese] = useState(() => startOfMonth(new Date()));
  const [dipendenti, setDipendenti] = useState<Dipendente[]>([]);
  const [presenze, setPresenze] = useState<Presenza[]>([]);
  const [anomalie, setAnomalie] = useState<AnomaliaPresenza[]>([]);
  const [impostazioni, setImpostazioni] = useState<ImpostazioniPresenze>({
    ipNegozio: "",
    raggioMetri: 120,
    emailTitolari: "info@bitora.it",
    currentIp: "",
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cell, setCell] = useState<{ dipendente: Dipendente; data: string } | null>(null);
  const [tipoDraft, setTipoDraft] = useState<TipoPresenza | null>(null);
  const [oraIngresso, setOraIngresso] = useState("");
  const [oraUscita, setOraUscita] = useState("");
  const [doppioTurno, setDoppioTurno] = useState(false);
  const [oraIngresso2, setOraIngresso2] = useState("");
  const [oraUscita2, setOraUscita2] = useState("");
  const [savingPresenza, setSavingPresenza] = useState(false);
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
      const data = await fetchJson<{
        dipendenti?: Dipendente[];
        presenze?: Presenza[];
        anomalie?: AnomaliaPresenza[];
        impostazioni?: ImpostazioniPresenze;
      }>(`/api/presenze?mese=${format(monthDate, "yyyy-MM")}`);
      setDipendenti(data.dipendenti ?? []);
      setPresenze(data.presenze ?? []);
      setAnomalie(data.anomalie ?? []);
      if (data.impostazioni) setImpostazioni(data.impostazioni);
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
    const map = new Map<string, Presenza>();
    for (const p of presenze) map.set(`${p.dipendenteId}:${p.data}`, p);
    return map;
  }, [presenze]);

  // Calcolo totale ore e giorni lavorati nel mese per ogni dipendente (incluso dettaglio fuori perimetro)
  const riepilogoMensile = useMemo(() => {
    const stats = new Map<
      string,
      {
        minutiTotali: number;
        minutiFuoriPerimetro: number;
        giorniPresente: number;
        giorniFuoriPerimetro: number;
        giorniFerie: number;
        giorniMalattia: number;
      }
    >();
    for (const d of dipendenti) {
      stats.set(d.id, {
        minutiTotali: 0,
        minutiFuoriPerimetro: 0,
        giorniPresente: 0,
        giorniFuoriPerimetro: 0,
        giorniFerie: 0,
        giorniMalattia: 0,
      });
    }
    for (const p of presenze) {
      const item = stats.get(p.dipendenteId);
      if (!item) continue;
      if (p.tipo === "PRESENTE") {
        item.giorniPresente += 1;
        const minGiorno = minutiLavorati({
          oraIngresso: p.oraIngresso,
          oraUscita: p.oraUscita,
          oraIngresso2: p.oraIngresso2 ?? null,
          oraUscita2: p.oraUscita2 ?? null,
        });
        item.minutiTotali += minGiorno;
        if (p.fuoriPerimetro) {
          item.giorniFuoriPerimetro += 1;
          item.minutiFuoriPerimetro += minGiorno;
        }
      } else if (p.tipo === "FERIE") {
        item.giorniFerie += 1;
      } else if (p.tipo === "MALATTIA") {
        item.giorniMalattia += 1;
      }
    }
    return stats;
  }, [dipendenti, presenze]);

  const { totaleMinutiTeam, totaleMinutiFuoriPerimetroTeam, totaleGiorniFuoriPerimetroTeam } =
    useMemo(() => {
      let tot = 0;
      let totFuori = 0;
      let ggFuori = 0;
      for (const v of riepilogoMensile.values()) {
        tot += v.minutiTotali;
        totFuori += v.minutiFuoriPerimetro;
        ggFuori += v.giorniFuoriPerimetro;
      }
      return {
        totaleMinutiTeam: tot,
        totaleMinutiFuoriPerimetroTeam: totFuori,
        totaleGiorniFuoriPerimetroTeam: ggFuori,
      };
    }, [riepilogoMensile]);

  function openCell(dipendente: Dipendente, data: string) {
    const presenza = presenzaMap.get(`${dipendente.id}:${data}`);
    setCell({ dipendente, data });
    setTipoDraft(presenza?.tipo ?? null);
    setOraIngresso(presenza?.oraIngresso ?? "");
    setOraUscita(presenza?.oraUscita ?? "");
    setDoppioTurno(Boolean(presenza?.oraIngresso2 || presenza?.oraUscita2));
    setOraIngresso2(presenza?.oraIngresso2 ?? "");
    setOraUscita2(presenza?.oraUscita2 ?? "");
  }

  async function setPresenza(tipo: TipoPresenza | null) {
    if (!cell) return;
    let orari = {
      oraIngresso: null as string | null,
      oraUscita: null as string | null,
      oraIngresso2: null as string | null,
      oraUscita2: null as string | null,
    };
    if (tipo === "PRESENTE") {
      const normalizzati = normalizzaOrari({
        oraIngresso,
        oraUscita,
        oraIngresso2: doppioTurno ? oraIngresso2 : null,
        oraUscita2: doppioTurno ? oraUscita2 : null,
        doppio: doppioTurno,
      });
      if ("error" in normalizzati) {
        toast.error(normalizzati.error);
        return;
      }
      orari = normalizzati.orari;
    }
    setSavingPresenza(true);
    try {
      const res = await fetch("/api/presenze", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dipendenteId: cell.dipendente.id,
          data: cell.data,
          tipo,
          ...orari,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(typeof body?.error === "string" ? body.error : "Errore salvataggio presenza");
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
    } finally {
      setSavingPresenza(false);
    }
  }

  async function segnaAnomaliaLetta(id?: string, tutte?: boolean) {
    const res = await fetch("/api/presenze/anomalie", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, tutte }),
    });
    if (!res.ok) {
      toast.error("Errore aggiornamento avviso");
      return;
    }
    if (tutte) {
      setAnomalie([]);
    } else if (id) {
      setAnomalie((prev) => prev.filter((a) => a.id !== id));
    }
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await fetch("/api/presenze/impostazioni", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ipNegozio: impostazioni.ipNegozio,
          raggioMetri: Number(impostazioni.raggioMetri) || 120,
          emailTitolari: impostazioni.emailTitolari,
        }),
      });
      if (!res.ok) {
        toast.error("Errore salvataggio impostazioni");
        return;
      }
      const data = await res.json();
      if (data.impostazioni) setImpostazioni(data.impostazioni);
      toast.success("Impostazioni di controllo salvate");
      setSettingsOpen(false);
    } finally {
      setSavingSettings(false);
    }
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
      username: d.username ?? "",
      password: "",
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
      const errBody = await res.json().catch(() => null);
      toast.error(typeof errBody?.error === "string" ? errBody.error : "Errore salvataggio dipendente");
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

  const oreLabel =
    tipoDraft === "PRESENTE"
      ? oreLavorateLabel({
          oraIngresso: oraIngresso || null,
          oraUscita: oraUscita || null,
          oraIngresso2: doppioTurno ? oraIngresso2 || null : null,
          oraUscita2: doppioTurno ? oraUscita2 || null : null,
        })
      : null;

  const currentCellPresenza = cell ? presenzaMap.get(`${cell.dipendente.id}:${cell.data}`) : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-[family-name:var(--font-display)] text-4xl">
            <IdCard className="h-7 w-7" /> Dipendenti
          </h1>
          <p className="text-sm text-stone-500">
            Anagrafica, credenziali personali, presenze, totale ore e controllo IP/GPS.
          </p>
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
          <Button variant="outline" onClick={() => setSettingsOpen(true)}>
            <Settings className="h-4 w-4" />
            Controllo IP / GPS & Mail
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nuovo dipendente
          </Button>
        </div>
      </div>

      {anomalie.length > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50/90 p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-red-900">
              <ShieldAlert className="h-5 w-5 text-red-600" />
              <h2 className="font-semibold">
                Avvisi riservati ai titolari: {anomalie.length}{" "}
                {anomalie.length === 1
                  ? "registrazione o login fuori dal perimetro"
                  : "registrazioni o login fuori dal perimetro"}
              </h2>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void segnaAnomaliaLetta(undefined, true)}
            >
              <Check className="h-4 w-4" />
              Segna tutte come lette
            </Button>
          </div>
          <p className="mt-1 text-xs text-red-700">
            Il dipendente non visualizza alcun avviso (sul suo telefono l&apos;operazione appare regolarmente effettuata).
          </p>
          <div className="mt-3 space-y-2">
            {anomalie.map((a) => {
              const presGiorno = presenzaMap.get(`${a.dipendenteId}:${a.data}`);
              const dipObj = dipendenti.find((d) => d.id === a.dipendenteId);
              const oreGiorno = presGiorno
                ? oreLavorateLabel({
                    oraIngresso: presGiorno.oraIngresso,
                    oraUscita: presGiorno.oraUscita,
                    oraIngresso2: presGiorno.oraIngresso2 ?? null,
                    oraUscita2: presGiorno.oraUscita2 ?? null,
                  })
                : null;
              const orariString = presGiorno ? titoloOrario(presGiorno) : null;

              return (
                <div
                  key={a.id}
                  className="flex flex-col justify-between gap-2 rounded-xl border border-red-200 bg-white p-3 text-sm sm:flex-row sm:items-center"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-stone-900">
                        {a.dipendente.cognome} {a.dipendente.nome}
                      </span>
                      <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">
                        {a.azione}
                      </span>
                      <span className="text-xs text-stone-500">
                        {a.data} alle {a.ora}
                      </span>
                      {oreGiorno && (
                        <span className="rounded-md border border-red-300 bg-red-50 px-2 py-0.5 font-mono text-xs font-bold text-red-900">
                          Ore segnate il {a.data.slice(8, 10)}/{a.data.slice(5, 7)}: {oreGiorno}
                        </span>
                      )}
                      {a.emailInviata && (
                        <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[11px] text-stone-600">
                          Mail inviata ai titolari
                        </span>
                      )}
                    </div>
                    {orariString && (
                      <p className="text-xs font-medium text-stone-800">
                        Turni registrati nella giornata: <span className="font-mono">{orariString}</span>
                      </p>
                    )}
                    <p className="text-xs text-stone-600">{a.motivo}</p>
                    {a.lat !== null && a.lng !== null && (
                      <a
                        href={`https://www.google.com/maps?q=${a.lat},${a.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-red-700 underline"
                      >
                        <MapPin className="h-3 w-3" />
                        Vedi posizione su Google Maps ({a.distanzaMetri} m dal locale)
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 self-end sm:self-center">
                    {dipObj && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openCell(dipObj, a.data)}
                      >
                        Vedi ore giorno
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void segnaAnomaliaLetta(a.id)}
                    >
                      Archivia
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {TIPI.map((t) => (
            <span key={t.tipo} className={cn("rounded-md border px-2 py-1 text-xs font-medium", t.className)}>
              {t.short} {t.label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-800">
            <AlertTriangle className="h-3.5 w-3.5" /> Fuori perimetro (solo Admin)
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-xl border border-[var(--line)] bg-white px-3 py-1.5 text-xs text-stone-600">
            Totale ore lavorate nel mese:{" "}
            <span className="font-mono font-bold text-[var(--espresso)]">
              {formatDurata(totaleMinutiTeam)}
            </span>
          </div>
          {totaleGiorniFuoriPerimetroTeam > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-800">
              ⚠️ Ore segnate fuori perimetro:{" "}
              <span className="font-mono font-bold">
                {totaleMinutiFuoriPerimetroTeam > 0
                  ? formatDurata(totaleMinutiFuoriPerimetroTeam)
                  : "in corso"}
              </span>{" "}
              ({totaleGiorniFuoriPerimetroTeam}{" "}
              {totaleGiorniFuoriPerimetroTeam === 1 ? "giorno" : "giorni"})
            </div>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
        {loading ? (
          <p className="p-10 text-center text-sm text-stone-400">Caricamento…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--paper)]">
                  <th className="sticky left-0 z-10 min-w-[11.5rem] border-r border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-left">
                    Dipendente
                  </th>
                  {days.map((day) => (
                    <th
                      key={format(day, "yyyy-MM-dd")}
                      className={cn(
                        "min-w-[2.35rem] px-0.5 py-1.5 text-center",
                        isWeekend(day) ? "text-stone-400" : "text-stone-600"
                      )}
                    >
                      <div className="text-[10px] uppercase">
                        {["D", "L", "M", "M", "G", "V", "S"][getDay(day)]}
                      </div>
                      <div className="text-xs">{format(day, "d")}</div>
                    </th>
                  ))}
                  <th className="sticky right-0 z-10 min-w-[6.5rem] border-l border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-right">
                    Tot. Ore
                  </th>
                </tr>
              </thead>
              <tbody>
                {dipendenti.map((d) => {
                  const stat = riepilogoMensile.get(d.id) ?? {
                    minutiTotali: 0,
                    minutiFuoriPerimetro: 0,
                    giorniPresente: 0,
                    giorniFuoriPerimetro: 0,
                    giorniFerie: 0,
                    giorniMalattia: 0,
                  };
                  return (
                    <tr key={d.id} className="border-b border-[var(--line)]">
                      <td className="sticky left-0 z-10 border-r border-[var(--line)] bg-white px-3 py-2">
                        <button type="button" className="text-left" onClick={() => openEdit(d)}>
                          <div className="font-medium">
                            {d.cognome} {d.nome}
                          </div>
                          <div className="text-[11px] text-stone-400">
                            {d.ruolo}
                            {d.username ? ` · @${d.username}` : ""}
                            {d.retribuzione ? ` · ${formatEuro(d.retribuzione)}` : ""}
                          </div>
                        </button>
                      </td>
                      {days.map((day) => {
                        const data = format(day, "yyyy-MM-dd");
                        const presenza = presenzaMap.get(`${d.id}:${data}`);
                        const tipo = presenza?.tipo ?? null;
                        const meta = TIPI.find((t) => t.tipo === tipo);
                        const fasce =
                          tipo === "PRESENTE" && presenza
                            ? [
                                fasciaBreve(presenza.oraIngresso, presenza.oraUscita),
                                fasciaBreve(presenza.oraIngresso2, presenza.oraUscita2),
                              ].filter((fascia): fascia is string => Boolean(fascia))
                            : [];
                        const oreCella =
                          tipo === "PRESENTE" && presenza
                            ? minutiLavorati({
                                oraIngresso: presenza.oraIngresso,
                                oraUscita: presenza.oraUscita,
                                oraIngresso2: presenza.oraIngresso2 ?? null,
                                oraUscita2: presenza.oraUscita2 ?? null,
                              })
                            : 0;
                        const isOut = Boolean(presenza?.fuoriPerimetro);
                        return (
                          <td key={data} className="p-0.5 text-center">
                            <button
                              type="button"
                              title={presenza ? titoloOrario(presenza) || meta?.label : meta?.label}
                              onClick={() => openCell(d, data)}
                              className={cn(
                                "relative mx-auto flex min-w-[3.4rem] flex-col items-center justify-center rounded border px-1 py-1 text-[10px] font-bold leading-tight",
                                fasce.length > 1 || isOut ? "min-h-12" : "min-h-10",
                                meta?.className ??
                                  (isWeekend(day)
                                    ? "border-transparent text-transparent"
                                    : "border-transparent text-transparent hover:border-stone-300"),
                                isOut && "bg-red-50 text-red-900 ring-2 ring-red-500 border-red-400"
                              )}
                            >
                              {isOut && (
                                <span
                                  className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-600 ring-1 ring-white"
                                  title="Timbratura fuori perimetro"
                                />
                              )}
                              <span className="whitespace-nowrap">
                                {meta?.short ?? "·"}
                                {oreCella > 0 ? ` · ${formatDurata(oreCella)}` : ""}
                              </span>
                              {fasce.map((fascia, index) => (
                                <span
                                  key={`${fascia}-${index}`}
                                  className="mt-0.5 whitespace-nowrap font-mono text-[8.5px] font-medium"
                                >
                                  {fascia}
                                </span>
                              ))}
                            </button>
                          </td>
                        );
                      })}
                      <td className="sticky right-0 z-10 border-l border-[var(--line)] bg-stone-50 px-3 py-2 text-right">
                        <div className="whitespace-nowrap font-mono text-sm font-bold text-[var(--espresso)]">
                          {formatDurata(stat.minutiTotali)}
                        </div>
                        <div className="text-[10px] text-stone-500">
                          {stat.giorniPresente}g pres.
                        </div>
                        {stat.giorniFuoriPerimetro > 0 && (
                          <div className="mt-1 inline-block rounded bg-red-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-red-800">
                            ⚠️{" "}
                            {stat.minutiFuoriPerimetro > 0
                              ? formatDurata(stat.minutiFuoriPerimetro)
                              : `${stat.giorniFuoriPerimetro}g`}{" "}
                            fuori
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {dipendenti.map((d) => {
          const stat = riepilogoMensile.get(d.id);
          return (
            <div key={d.id} className="rounded-2xl border border-[var(--line)] bg-white p-4 text-left">
              <button type="button" className="w-full text-left" onClick={() => openEdit(d)}>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">
                    {d.cognome} {d.nome}
                  </p>
                  <div className="flex flex-col items-end gap-1">
                    <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-0.5 font-mono text-xs font-bold text-emerald-800">
                      <Clock className="h-3 w-3" />
                      {formatDurata(stat?.minutiTotali ?? 0)}
                    </span>
                    {stat && stat.giorniFuoriPerimetro > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2 py-0.5 font-mono text-[11px] font-bold text-red-800">
                        ⚠️{" "}
                        {stat.minutiFuoriPerimetro > 0
                          ? formatDurata(stat.minutiFuoriPerimetro)
                          : `${stat.giorniFuoriPerimetro}g`}{" "}
                        fuori perim.
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge>{d.ruolo}</Badge>
                  {d.username && d.hasPassword ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-700">
                      <KeyRound className="h-3 w-3 text-[var(--gold-dim)]" /> @{d.username}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
                      Nessun login
                    </span>
                  )}
                </div>
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
          );
        })}
      </div>

      <Dialog open={Boolean(cell)} onClose={() => setCell(null)} title={cell ? `${cell.dipendente.cognome} ${cell.dipendente.nome}` : "Presenza"}>
        {cell && (
          <div className="space-y-4">
            <p className="text-sm text-stone-500">
              {format(new Date(`${cell.data}T12:00:00`), "EEEE d MMMM yyyy", { locale: it })}
            </p>
            {currentCellPresenza?.fuoriPerimetro && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-900">
                <p className="font-semibold flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4 text-red-600" />
                  Timbratura registrata fuori dal perimetro del negozio
                </p>
                <p className="mt-1 text-red-700">
                  IP: {currentCellPresenza.ipRegistrazione ?? "n/d"}
                  {currentCellPresenza.distanzaMetri !== null &&
                  currentCellPresenza.distanzaMetri !== undefined
                    ? ` · Distanza GPS: ${currentCellPresenza.distanzaMetri} m da Garavella 7`
                    : " · GPS non fornito / negato"}
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {TIPI.map((t) => (
                <button
                  key={t.tipo}
                  type="button"
                  onClick={() => setTipoDraft(t.tipo)}
                  className={cn(
                    "rounded-xl border px-3 py-3 text-left",
                    t.className,
                    tipoDraft === t.tipo && "ring-2 ring-[var(--espresso)]"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {tipoDraft === "PRESENTE" && (
              <div className="space-y-3 rounded-xl border border-[var(--line)] bg-white p-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="ora-ingresso">Ora ingresso</Label>
                    <Input
                      id="ora-ingresso"
                      type="time"
                      value={oraIngresso}
                      onChange={(e) => setOraIngresso(e.target.value)}
                    />
                    <Button type="button" variant="ghost" size="sm" className="px-0" onClick={() => setOraIngresso(adesso())}>
                      Adesso
                    </Button>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ora-uscita">Ora uscita</Label>
                    <Input
                      id="ora-uscita"
                      type="time"
                      value={oraUscita}
                      onChange={(e) => setOraUscita(e.target.value)}
                    />
                    <Button type="button" variant="ghost" size="sm" className="px-0" onClick={() => setOraUscita(adesso())}>
                      Adesso
                    </Button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDoppioTurno((attivo) => !attivo)}
                  className={cn(
                    "w-full rounded-xl border px-3 py-2 text-left text-sm font-medium",
                    doppioTurno
                      ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                      : "border-[var(--line)] text-stone-600"
                  )}
                >
                  {doppioTurno ? "Doppio turno / Pausa attivo" : "Aggiungi secondo turno (dopo pausa)"}
                </button>
                {doppioTurno && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="ora-ingresso-2">Secondo ingresso</Label>
                      <Input
                        id="ora-ingresso-2"
                        type="time"
                        value={oraIngresso2}
                        onChange={(e) => setOraIngresso2(e.target.value)}
                      />
                      <Button type="button" variant="ghost" size="sm" className="px-0" onClick={() => setOraIngresso2(adesso())}>
                        Adesso
                      </Button>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ora-uscita-2">Seconda uscita</Label>
                      <Input
                        id="ora-uscita-2"
                        type="time"
                        value={oraUscita2}
                        onChange={(e) => setOraUscita2(e.target.value)}
                      />
                      <Button type="button" variant="ghost" size="sm" className="px-0" onClick={() => setOraUscita2(adesso())}>
                        Adesso
                      </Button>
                    </div>
                  </div>
                )}
                {oreLabel && (
                  <p className="text-sm text-stone-600">
                    Ore lavorate: <span className="font-medium">{oreLabel}</span>
                  </p>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" disabled={savingPresenza} onClick={() => void setPresenza(null)}>
                Rimuovi
              </Button>
              <Button
                className="flex-1"
                disabled={savingPresenza || !tipoDraft}
                onClick={() => void setPresenza(tipoDraft)}
              >
                Salva
              </Button>
            </div>
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

          <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-3 space-y-2.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-700">
              Accesso personale registro presenze (solo data odierna)
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Username login</Label>
                <Input
                  placeholder="es. giulia.martini"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>{editing?.hasPassword ? "Nuova password (opz.)" : "Password"}</Label>
                <Input
                  type="password"
                  placeholder={editing?.hasPassword ? "Lascia vuoto per non cambiare" : "Imposta password"}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
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

      <Dialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Controllo IP Negozio, Fallback GPS & Email Titolari"
      >
        <form onSubmit={saveSettings} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Indirizzo IP pubblico del negozio (Wi-Fi Garavella 7)</Label>
            <div className="flex gap-2">
              <Input
                placeholder="es. 93.44.120.15"
                value={impostazioni.ipNegozio}
                onChange={(e) =>
                  setImpostazioni({ ...impostazioni, ipNegozio: e.target.value })
                }
              />
              {impostazioni.currentIp && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setImpostazioni({
                      ...impostazioni,
                      ipNegozio: impostazioni.currentIp ?? "",
                    })
                  }
                >
                  <Wifi className="h-4 w-4" />
                  Usa IP attuale ({impostazioni.currentIp})
                </Button>
              )}
            </div>
            <p className="text-xs text-stone-500">
              Se il dipendente è connesso a questo IP (Wi-Fi del bar), login e timbrature sono validati subito.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Raggio tolleranza Fallback GPS (metri da Piazza Garavella, 7)</Label>
            <Input
              type="number"
              min="20"
              max="5000"
              value={impostazioni.raggioMetri}
              onChange={(e) =>
                setImpostazioni({
                  ...impostazioni,
                  raggioMetri: Number(e.target.value) || 120,
                })
              }
            />
            <p className="text-xs text-stone-500">
              Coordinate negozio: 44.84655, 7.720389 (Piazza Garavella, 7 — Carmagnola).
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Email dei Titolari per avvisi di Login dubbio / Timbratura fuori perimetro</Label>
            <Input
              placeholder="es. titolare@garavella7.it, info@bitora.it"
              value={impostazioni.emailTitolari}
              onChange={(e) =>
                setImpostazioni({ ...impostazioni, emailTitolari: e.target.value })
              }
            />
            <p className="text-xs text-stone-500">
              Ad ogni login o timbratura effettuata da posizione non conforme viene inviata una mail automatica e generata una notifica nel gestionale (invisibile al dipendente).
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setSettingsOpen(false)}>
              Annulla
            </Button>
            <Button type="submit" disabled={savingSettings}>
              {savingSettings ? "Salvataggio…" : "Salva impostazioni"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
