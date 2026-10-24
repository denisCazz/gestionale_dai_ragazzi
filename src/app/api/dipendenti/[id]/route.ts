import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { ensureExtendedSchema } from "@/lib/schema-ensure";
import { z } from "zod";

const schema = z.object({
  nome: z.string().trim().min(1).optional(),
  cognome: z.string().trim().min(1).optional(),
  ruolo: z.string().trim().min(1).optional(),
  telefono: z.string().trim().optional().nullable(),
  email: z.string().trim().optional().nullable(),
  username: z.string().trim().optional().nullable(),
  password: z.string().optional().nullable(),
  dataAssunzione: z.string().optional().nullable(),
  retribuzione: z.coerce.number().min(0).optional(),
  note: z.string().trim().optional().nullable(),
  attivo: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureExtendedSchema();
  const { id } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { password, username, dataAssunzione, ...rest } = parsed.data;
  const cleanUser =
    username === undefined ? undefined : username?.trim().toLowerCase() || null;

  if (cleanUser) {
    const exists = await prisma.dipendente.findFirst({
      where: { username: cleanUser, NOT: { id } },
    });
    if (exists) {
      return NextResponse.json(
        { error: "Username già assegnato a un altro dipendente" },
        { status: 400 }
      );
    }
  }

  const updated = await prisma.dipendente.update({
    where: { id },
    data: {
      ...rest,
      username: cleanUser,
      passwordHash:
        password && password.trim().length > 0
          ? hashPassword(password.trim())
          : undefined,
      dataAssunzione:
        dataAssunzione === undefined
          ? undefined
          : dataAssunzione
            ? new Date(dataAssunzione)
            : null,
    },
  });
  const { passwordHash, ...dipendente } = updated;
  return NextResponse.json({
    dipendente: { ...dipendente, hasPassword: Boolean(passwordHash) },
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureExtendedSchema();
  const { id } = await params;
  await prisma.presenza.deleteMany({ where: { dipendenteId: id } });
  await prisma.dipendente.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
