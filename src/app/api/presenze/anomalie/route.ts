import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ensureExtendedSchema } from "@/lib/schema-ensure";

export async function GET() {
  await ensureExtendedSchema();
  const anomalie = await prisma.anomaliaPresenza.findMany({
    where: { letta: false },
    include: {
      dipendente: { select: { id: true, nome: true, cognome: true, ruolo: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ anomalie });
}

const patchSchema = z.object({
  id: z.string().optional(),
  tutte: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  await ensureExtendedSchema();
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 });
  }

  if (parsed.data.tutte) {
    await prisma.anomaliaPresenza.updateMany({
      where: { letta: false },
      data: { letta: true },
    });
  } else if (parsed.data.id) {
    await prisma.anomaliaPresenza.update({
      where: { id: parsed.data.id },
      data: { letta: true },
    });
  }

  return NextResponse.json({ ok: true });
}
