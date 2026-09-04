import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await prisma.categoriaCassa.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: "Categoria non trovata" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
