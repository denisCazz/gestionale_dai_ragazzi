import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ImageError, publicImagePath, toWebp } from "@/lib/images";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const voce = await prisma.voceMenu.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!voce) {
    return NextResponse.json({ error: "Voce non trovata" }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "File non valido" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Seleziona una foto" }, { status: 400 });
  }

  try {
    const contenuto = await toWebp(file);
    const aggiornata = new Date();
    await prisma.$transaction([
      prisma.immagineVoce.upsert({
        where: { voceMenuId: id },
        create: { voceMenuId: id, contenuto },
        update: { contenuto },
      }),
      prisma.voceMenu.update({
        where: { id },
        data: { immagineAggiornata: aggiornata },
      }),
    ]);
    return NextResponse.json({
      immagineUrl: publicImagePath(id, aggiornata),
      immagineAggiornata: aggiornata.toISOString(),
    });
  } catch (error) {
    if (error instanceof ImageError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error(error);
    return NextResponse.json({ error: "Caricamento foto non riuscito" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const voce = await prisma.voceMenu.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!voce) {
    return NextResponse.json({ error: "Voce non trovata" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.immagineVoce.deleteMany({ where: { voceMenuId: id } }),
    prisma.voceMenu.update({
      where: { id },
      data: { immagineAggiornata: null },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
