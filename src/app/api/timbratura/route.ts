import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureExtendedSchema } from "@/lib/schema-ensure";
import {
  adessoRoma,
  registraAnomaliaEInviaEmail,
  verificaPerimetro,
} from "@/lib/perimetro";

export async function GET(req: Request) {
  await ensureExtendedSchema();
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const targetId =
    session.role === "DIPENDENTE"
      ? session.dipendenteId
      : searchParams.get("dipendenteId");

  if (!targetId) {
    const first = await prisma.dipendente.findFirst({
      where: { attivo: true },
      orderBy: [{ cognome: "asc" }, { nome: "asc" }],
    });
    if (!first) {
      return NextResponse.json({ error: "Nessun dipendente attivo" }, { status: 404 });
    }
    return buildStatusResponse(first.id);
  }

  return buildStatusResponse(targetId);
}

async function buildStatusResponse(dipendenteId: string) {
  const dipendente = await prisma.dipendente.findUnique({
    where: { id: dipendenteId },
    select: { id: true, nome: true, cognome: true, ruolo: true, attivo: true },
  });
  if (!dipendente || !dipendente.attivo) {
    return NextResponse.json({ error: "Utenza non trovata" }, { status: 404 });
  }

  const { data: oggi, ora: oraCorrente } = adessoRoma();
  const presenza = await prisma.presenza.findUnique({
    where: { dipendenteId_data: { dipendenteId, data: oggi } },
    select: {
      oraIngresso: true,
      oraUscita: true,
      oraIngresso2: true,
      oraUscita2: true,
    },
  });

  return NextResponse.json({
    dipendente: {
      id: dipendente.id,
      nome: dipendente.nome,
      cognome: dipendente.cognome,
      ruolo: dipendente.ruolo,
    },
    oggi,
    oraCorrente,
    presenza: presenza ?? {
      oraIngresso: null,
      oraUscita: null,
      oraIngresso2: null,
      oraUscita2: null,
    },
  });
}

const postSchema = z.object({
  azione: z.enum(["ENTRATA", "INIZIO_PAUSA", "FINE_PAUSA", "USCITA"]),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  dipendenteId: z.string().optional(),
});

export async function POST(req: Request) {
  await ensureExtendedSchema();
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 });
  }

  const dipendenteId =
    session.role === "DIPENDENTE"
      ? session.dipendenteId
      : parsed.data.dipendenteId;

  if (!dipendenteId) {
    return NextResponse.json({ error: "Seleziona un dipendente" }, { status: 400 });
  }

  const dipendente = await prisma.dipendente.findUnique({
    where: { id: dipendenteId },
  });
  if (!dipendente || !dipendente.attivo) {
    return NextResponse.json({ error: "Dipendente non trovato" }, { status: 404 });
  }

  const { data: oggi, ora: adesso } = adessoRoma();
  const esistente = await prisma.presenza.findUnique({
    where: { dipendenteId_data: { dipendenteId, data: oggi } },
  });

  let oraIngresso = esistente?.oraIngresso ?? null;
  let oraUscita = esistente?.oraUscita ?? null;
  let oraIngresso2 = esistente?.oraIngresso2 ?? null;
  let oraUscita2 = esistente?.oraUscita2 ?? null;

  const { azione, lat, lng } = parsed.data;

  if (azione === "ENTRATA") {
    if (!oraIngresso) {
      oraIngresso = adesso;
    } else if (oraUscita && !oraIngresso2) {
      oraIngresso2 = adesso;
    } else {
      return NextResponse.json(
        { error: "Entrata già registrata per il turno in corso" },
        { status: 400 }
      );
    }
  } else if (azione === "INIZIO_PAUSA") {
    if (!oraIngresso) {
      return NextResponse.json(
        { error: "Registra prima l'entrata" },
        { status: 400 }
      );
    }
    if (oraUscita) {
      return NextResponse.json(
        { error: "Pausa o uscita del primo turno già registrata" },
        { status: 400 }
      );
    }
    oraUscita = adesso;
  } else if (azione === "FINE_PAUSA") {
    if (!oraIngresso || !oraUscita) {
      return NextResponse.json(
        { error: "Avvia prima la pausa per registrare il rientro" },
        { status: 400 }
      );
    }
    if (oraIngresso2) {
      return NextResponse.json(
        { error: "Rientro dalla pausa già registrato" },
        { status: 400 }
      );
    }
    oraIngresso2 = adesso;
  } else if (azione === "USCITA") {
    if (!oraIngresso) {
      return NextResponse.json(
        { error: "Registra prima l'entrata" },
        { status: 400 }
      );
    }
    if (oraIngresso2) {
      oraUscita2 = adesso;
    } else {
      oraUscita = adesso;
    }
  }

  const verifica = await verificaPerimetro(req, { lat, lng });
  const fuoriPerimetro = Boolean(esistente?.fuoriPerimetro) || !verifica.conforme;
  const metodoVerifica = fuoriPerimetro
    ? "FUORI_PERIMETRO"
    : verifica.metodo;

  const aggiornata = await prisma.presenza.upsert({
    where: { dipendenteId_data: { dipendenteId, data: oggi } },
    create: {
      dipendenteId,
      data: oggi,
      tipo: "PRESENTE",
      oraIngresso,
      oraUscita,
      oraIngresso2,
      oraUscita2,
      fuoriPerimetro,
      metodoVerifica,
      ipRegistrazione: verifica.ip,
      latRegistrazione: verifica.lat,
      lngRegistrazione: verifica.lng,
      distanzaMetri: verifica.distanzaMetri,
    },
    update: {
      tipo: "PRESENTE",
      oraIngresso,
      oraUscita,
      oraIngresso2,
      oraUscita2,
      fuoriPerimetro,
      metodoVerifica,
      ipRegistrazione: verifica.ip,
      latRegistrazione: verifica.lat,
      lngRegistrazione: verifica.lng,
      distanzaMetri: verifica.distanzaMetri,
    },
  });

  // Se la timbratura è fuori perimetro, registriamo l'anomalia e inviamo la mail ai titolari,
  // ma al dipendente restituiamo una risposta identica a una timbratura normale.
  if (!verifica.conforme) {
    try {
      await registraAnomaliaEInviaEmail({
        dipendente,
        azione,
        data: oggi,
        ora: adesso,
        verifica,
        req,
      });
    } catch (err) {
      console.error("Errore salvataggio anomalia timbratura:", err);
    }
  }

  return NextResponse.json({
    ok: true,
    ora: adesso,
    presenza: {
      oraIngresso: aggiornata.oraIngresso,
      oraUscita: aggiornata.oraUscita,
      oraIngresso2: aggiornata.oraIngresso2,
      oraUscita2: aggiornata.oraUscita2,
    },
  });
}
