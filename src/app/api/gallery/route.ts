import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { listGallery } from "@/lib/gallery";
import { ImageError, optimizePhoto } from "@/lib/images";

export const runtime = "nodejs";

export async function GET() {
  try {
    const foto = await listGallery();
    return NextResponse.json({ foto });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Errore caricamento gallery" }, { status: 500 });
  }
}

export async function POST(req: Request) {
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
  const alt = String(form.get("alt") ?? "").trim().slice(0, 300);

  try {
    const image = await optimizePhoto(file);
    const last = await prisma.fotoGallery.findFirst({
      orderBy: { ordine: "desc" },
      select: { ordine: true },
    });
    const foto = await prisma.fotoGallery.create({
      data: {
        alt,
        ordine: (last?.ordine ?? 0) + 1,
        larghezza: image.width,
        altezza: image.height,
        contenuto: image.bytes,
      },
      select: {
        id: true,
        alt: true,
        ordine: true,
        larghezza: true,
        altezza: true,
        updatedAt: true,
      },
    });
    return NextResponse.json(foto, { status: 201 });
  } catch (error) {
    if (error instanceof ImageError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error(error);
    return NextResponse.json({ error: "Caricamento foto non riuscito" }, { status: 500 });
  }
}
