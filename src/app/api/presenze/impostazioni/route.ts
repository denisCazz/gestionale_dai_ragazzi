import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ensureExtendedSchema } from "@/lib/schema-ensure";
import {
  DEFAULT_STORE_LAT,
  DEFAULT_STORE_LNG,
  extractClientIp,
  getImpostazioniPresenze,
} from "@/lib/perimetro";

export async function GET(req: Request) {
  const settings = await getImpostazioniPresenze();
  return NextResponse.json({
    impostazioni: {
      ...settings,
      currentIp: extractClientIp(req),
    },
  });
}

const schema = z.object({
  ipNegozio: z.string().max(480).optional().default(""),
  raggioMetri: z.coerce.number().int().min(20).max(5000).optional().default(120),
  emailTitolari: z.string().max(480).optional().default(""),
});

export async function PUT(req: Request) {
  await ensureExtendedSchema();
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Impostazioni non valide" }, { status: 400 });
  }
  const { ipNegozio, raggioMetri, emailTitolari } = parsed.data;
  const saved = await prisma.impostazioniPresenze.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      ipNegozio: ipNegozio.trim(),
      latNegozio: DEFAULT_STORE_LAT,
      lngNegozio: DEFAULT_STORE_LNG,
      raggioMetri,
      emailTitolari: emailTitolari.trim(),
    },
    update: {
      ipNegozio: ipNegozio.trim(),
      raggioMetri,
      emailTitolari: emailTitolari.trim(),
    },
  });
  return NextResponse.json({
    impostazioni: {
      ...saved,
      currentIp: extractClientIp(req),
    },
  });
}
