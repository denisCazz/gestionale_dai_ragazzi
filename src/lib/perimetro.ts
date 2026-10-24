import { prisma } from "./db";
import { ensureExtendedSchema } from "./schema-ensure";

export const DEFAULT_STORE_LAT = 44.84655;
export const DEFAULT_STORE_LNG = 7.720389;
export const DEFAULT_STORE_RADIUS_M = 120;

export type AzioneTimbratura =
  | "LOGIN"
  | "ENTRATA"
  | "INIZIO_PAUSA"
  | "FINE_PAUSA"
  | "USCITA";

export type RisultatoVerifica = {
  conforme: boolean;
  metodo: "IP" | "GPS" | "FUORI_PERIMETRO";
  ip: string;
  lat: number | null;
  lng: number | null;
  distanzaMetri: number | null;
  motivo: string;
};

export function adessoRoma(): { data: string; ora: string } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const hourRaw = get("hour");
  const hour = hourRaw === "24" ? "00" : hourRaw.padStart(2, "0");
  const minute = get("minute").padStart(2, "0");
  return {
    data: `${get("year")}-${get("month")}-${get("day")}`,
    ora: `${hour}:${minute}`,
  };
}

export function extractClientIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip")?.trim();
  if (cf) return normalizeIp(cf);
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return normalizeIp(realIp);
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return normalizeIp(first);
  }
  return "127.0.0.1";
}

function normalizeIp(ip: string): string {
  const trimmed = ip.trim();
  if (trimmed.startsWith("::ffff:")) return trimmed.slice(7);
  if (trimmed === "::1") return "127.0.0.1";
  return trimmed;
}

export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export async function getImpostazioniPresenze() {
  await ensureExtendedSchema();
  const envIps = process.env.STORE_ALLOWED_IPS?.trim() || "";
  const envRadius = Number(process.env.STORE_RADIUS_METERS) || DEFAULT_STORE_RADIUS_M;
  const envEmail =
    process.env.OWNER_ALERT_EMAIL?.trim() ||
    process.env.MAIL_TO?.trim() ||
    "info@bitora.it";

  try {
    const row = await prisma.impostazioniPresenze.findUnique({
      where: { id: "default" },
    });
    if (row) {
      return {
        ipNegozio: row.ipNegozio || envIps,
        latNegozio: row.latNegozio || DEFAULT_STORE_LAT,
        lngNegozio: row.lngNegozio || DEFAULT_STORE_LNG,
        raggioMetri: row.raggioMetri > 0 ? row.raggioMetri : envRadius,
        emailTitolari: row.emailTitolari || envEmail,
      };
    }
    const created = await prisma.impostazioniPresenze.create({
      data: {
        id: "default",
        ipNegozio: envIps,
        latNegozio: DEFAULT_STORE_LAT,
        lngNegozio: DEFAULT_STORE_LNG,
        raggioMetri: envRadius,
        emailTitolari: envEmail,
      },
    });
    return created;
  } catch {
    return {
      ipNegozio: envIps,
      latNegozio: DEFAULT_STORE_LAT,
      lngNegozio: DEFAULT_STORE_LNG,
      raggioMetri: envRadius,
      emailTitolari: envEmail,
    };
  }
}

export async function verificaPerimetro(
  req: Request,
  coords?: { lat?: number | null; lng?: number | null }
): Promise<RisultatoVerifica> {
  const ip = extractClientIp(req);
  const settings = await getImpostazioniPresenze();

  const allowedIps = [
    ...settings.ipNegozio.split(/[\s,;]+/),
    ...(process.env.STORE_ALLOWED_IPS?.split(/[\s,;]+/) ?? []),
  ]
    .map((s) => normalizeIp(s))
    .filter(Boolean);

  const hasValidCoords =
    typeof coords?.lat === "number" &&
    Number.isFinite(coords.lat) &&
    typeof coords?.lng === "number" &&
    Number.isFinite(coords.lng);

  const lat = hasValidCoords ? (coords!.lat as number) : null;
  const lng = hasValidCoords ? (coords!.lng as number) : null;
  const distanzaMetri =
    lat !== null && lng !== null
      ? haversineMeters(lat, lng, settings.latNegozio, settings.lngNegozio)
      : null;

  // 1. Controllo primario: IP del negozio
  if (allowedIps.length > 0 && allowedIps.includes(ip)) {
    return {
      conforme: true,
      metodo: "IP",
      ip,
      lat,
      lng,
      distanzaMetri: distanzaMetri ?? 0,
      motivo: `Connesso alla rete IP del negozio (${ip})`,
    };
  }

  // 2. Fallback: posizione GPS entro il raggio del locale
  if (distanzaMetri !== null) {
    if (distanzaMetri <= settings.raggioMetri) {
      return {
        conforme: true,
        metodo: "GPS",
        ip,
        lat,
        lng,
        distanzaMetri,
        motivo: `Posizione GPS nel perimetro del locale (${distanzaMetri} m da Garavella 7)`,
      };
    }
    return {
      conforme: false,
      metodo: "FUORI_PERIMETRO",
      ip,
      lat,
      lng,
      distanzaMetri,
      motivo: `IP non corrispondente al negozio (${ip}) e posizione GPS fuori perimetro (${distanzaMetri} m da Piazza Garavella 7 · limite ${settings.raggioMetri} m)`,
    };
  }

  return {
    conforme: false,
    metodo: "FUORI_PERIMETRO",
    ip,
    lat: null,
    lng: null,
    distanzaMetri: null,
    motivo:
      allowedIps.length > 0
        ? `IP non corrispondente al negozio (${ip}) e posizione GPS di fallback non fornita / negata dallo smartphone`
        : `IP del negozio non riconosciuto (${ip}) e posizione GPS di fallback non fornita / negata dallo smartphone`,
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function labelAzione(azione: AzioneTimbratura): string {
  switch (azione) {
    case "LOGIN":
      return "Accesso (Login) da posizione non conforme";
    case "ENTRATA":
      return "Timbratura ENTRATA fuori perimetro";
    case "INIZIO_PAUSA":
      return "Timbratura INIZIO PAUSA fuori perimetro";
    case "FINE_PAUSA":
      return "Timbratura FINE PAUSA (Rientro) fuori perimetro";
    case "USCITA":
      return "Timbratura USCITA fuori perimetro";
  }
}

async function inviaEmailTitolari(params: {
  dipendenteNome: string;
  dipendenteRuolo: string;
  azione: AzioneTimbratura;
  data: string;
  ora: string;
  verifica: RisultatoVerifica;
  userAgent: string;
  destinatari: string[];
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.MAIL_FROM?.trim() || "Garavella 7 <info@bitora.it>";
  if (!apiKey || params.destinatari.length === 0) {
    console.warn(
      "[Alert Presenze] Email non inviata (RESEND_API_KEY o destinatari mancanti):",
      params.dipendenteNome,
      params.azione,
      params.verifica.motivo
    );
    return false;
  }

  const isLogin = params.azione === "LOGIN";
  const subject = isLogin
    ? `⚠️ [Garavella 7] Login dubbio fuori perimetro: ${params.dipendenteNome} (${params.ora})`
    : `⚠️ [Garavella 7] Timbratura fuori perimetro (${params.azione}): ${params.dipendenteNome} (${params.ora})`;

  const mapsUrl =
    params.verifica.lat !== null && params.verifica.lng !== null
      ? `https://www.google.com/maps?q=${params.verifica.lat},${params.verifica.lng}`
      : null;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; border: 1px solid #e5e0d8; border-radius: 14px; overflow: hidden; background: #ffffff; color: #1c1917;">
      <div style="background: #231815; color: #f6efe6; padding: 18px 22px;">
        <p style="margin: 0; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: #d4a857;">Garavella 7 · Controllo Presenze</p>
        <h2 style="margin: 6px 0 0; font-size: 20px;">${escapeHtml(labelAzione(params.azione))}</h2>
      </div>
      <div style="padding: 20px 22px; font-size: 14px; line-height: 1.55;">
        <p style="margin-top: 0;">È stata rilevata un'operazione effettuata <strong>fuori dal perimetro del locale</strong> (né sotto rete IP del negozio né entro il raggio GPS di Piazza Garavella 7).</p>
        <p style="background: #fef3c7; border: 1px solid #fcd34d; color: #92400e; padding: 10px 12px; border-radius: 8px; font-size: 13px;">
          <strong>Nota silenziosa:</strong> Al dipendente non è stato mostrato alcun errore o avviso; sul suo dispositivo l'operazione risulta completata normalmente.
        </p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 13.5px;">
          <tr>
            <td style="padding: 7px 0; color: #78716c; width: 38%;">Dipendente:</td>
            <td style="padding: 7px 0; font-weight: 600;">${escapeHtml(params.dipendenteNome)} (${escapeHtml(params.dipendenteRuolo)})</td>
          </tr>
          <tr>
            <td style="padding: 7px 0; color: #78716c;">Evento:</td>
            <td style="padding: 7px 0; font-weight: 600; color: #b91c1c;">${escapeHtml(params.azione)}</td>
          </tr>
          <tr>
            <td style="padding: 7px 0; color: #78716c;">Data e Ora:</td>
            <td style="padding: 7px 0;">${escapeHtml(params.data)} alle <strong>${escapeHtml(params.ora)}</strong></td>
          </tr>
          <tr>
            <td style="padding: 7px 0; color: #78716c;">Indirizzo IP usato:</td>
            <td style="padding: 7px 0; font-family: monospace;">${escapeHtml(params.verifica.ip)}</td>
          </tr>
          <tr>
            <td style="padding: 7px 0; color: #78716c;">Posizione GPS:</td>
            <td style="padding: 7px 0;">
              ${
                params.verifica.distanzaMetri !== null
                  ? `Distanza dal locale: <strong>${params.verifica.distanzaMetri} metri</strong> (${params.verifica.lat?.toFixed(5)}, ${params.verifica.lng?.toFixed(5)})`
                  : "Posizione GPS non fornita / permesso negato dallo smartphone"
              }
              ${
                mapsUrl
                  ? `<br/><a href="${mapsUrl}" style="color: #0c5c54; font-weight: 600;">Apri posizione esatta su Google Maps →</a>`
                  : ""
              }
            </td>
          </tr>
          <tr>
            <td style="padding: 7px 0; color: #78716c;">Dettaglio controllo:</td>
            <td style="padding: 7px 0;">${escapeHtml(params.verifica.motivo)}</td>
          </tr>
          <tr>
            <td style="padding: 7px 0; color: #78716c;">Dispositivo:</td>
            <td style="padding: 7px 0; font-size: 12px; color: #57534e;">${escapeHtml(params.userAgent || "n/d")}</td>
          </tr>
        </table>
      </div>
    </div>
  `;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: params.destinatari,
        subject,
        html,
      }),
    });
    return res.ok;
  } catch (err) {
    console.error("Errore invio email alert presenze:", err);
    return false;
  }
}

export async function registraAnomaliaEInviaEmail(params: {
  dipendente: { id: string; nome: string; cognome: string; ruolo: string };
  azione: AzioneTimbratura;
  data: string;
  ora: string;
  verifica: RisultatoVerifica;
  req: Request;
}) {
  await ensureExtendedSchema();
  const settings = await getImpostazioniPresenze();
  const destinatari = settings.emailTitolari
    .split(/[\s,;]+/)
    .map((e) => e.trim())
    .filter((e) => e.includes("@"));

  const userAgent = (params.req.headers.get("user-agent") ?? "").slice(0, 480);

  const anomalia = await prisma.anomaliaPresenza.create({
    data: {
      dipendenteId: params.dipendente.id,
      data: params.data,
      ora: params.ora,
      azione: params.azione,
      motivo: params.verifica.motivo.slice(0, 490),
      ip: params.verifica.ip,
      lat: params.verifica.lat,
      lng: params.verifica.lng,
      distanzaMetri: params.verifica.distanzaMetri,
      userAgent,
      emailInviata: false,
      letta: false,
    },
  });

  const emailInviata = await inviaEmailTitolari({
    dipendenteNome: `${params.dipendente.cognome} ${params.dipendente.nome}`,
    dipendenteRuolo: params.dipendente.ruolo,
    azione: params.azione,
    data: params.data,
    ora: params.ora,
    verifica: params.verifica,
    userAgent,
    destinatari,
  });

  if (emailInviata) {
    await prisma.anomaliaPresenza
      .update({
        where: { id: anomalia.id },
        data: { emailInviata: true },
      })
      .catch(() => null);
  }

  return anomalia;
}
