import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ImageError, optimizePhoto } from "@/lib/images";
import { z } from "zod";

export const runtime = "nodejs";

const schema = z.object({
  alt: z.string().trim().max(300).optional(),
  ordine: z.coerce.number().int().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
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
      const image = await optimizePhoto(file);
      const foto = await prisma.fotoGallery.update({
        where: { id },
        data: {
          contenuto: image.bytes,
          larghezza: image.width,
          altezza: image.height,
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
      return NextResponse.json(foto);
    } catch (error) {
      if (error instanceof ImageError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      console.error(error);
      return NextResponse.json({ error: "Sostituzione foto non riuscita" }, { status: 500 });
    }
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const foto = await prisma.fotoGallery.update({
      where: { id },
      data: parsed.data,
      select: {
        id: true,
        alt: true,
        ordine: true,
        larghezza: true,
        altezza: true,
        updatedAt: true,
      },
    });
    return NextResponse.json(foto);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Foto non trovata" }, { status: 404 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.fotoGallery.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
