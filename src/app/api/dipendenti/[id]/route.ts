import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  nome: z.string().trim().min(1).optional(),
  cognome: z.string().trim().min(1).optional(),
  ruolo: z.string().trim().min(1).optional(),
  telefono: z.string().trim().optional().nullable(),
  email: z.string().trim().optional().nullable(),
  dataAssunzione: z.string().optional().nullable(),
  retribuzione: z.coerce.number().min(0).optional(),
  note: z.string().trim().optional().nullable(),
  attivo: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  const dipendente = await prisma.dipendente.update({
    where: { id },
    data: {
      ...d,
      dataAssunzione:
        d.dataAssunzione === undefined
          ? undefined
          : d.dataAssunzione
            ? new Date(d.dataAssunzione)
            : null,
    },
  });
  return NextResponse.json({ dipendente });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.presenza.deleteMany({ where: { dipendenteId: id } });
  await prisma.dipendente.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
