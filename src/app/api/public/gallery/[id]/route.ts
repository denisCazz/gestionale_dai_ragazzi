import { corsHeaders } from "@/lib/cors";
import { prisma } from "@/lib/db";
import { storeCachedImage, takeCachedImage } from "@/lib/image-cache";

export const dynamic = "force-dynamic";

export async function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!/^[a-z0-9]+$/i.test(id)) {
    return new Response("Non trovata", { status: 404, headers: corsHeaders(req) });
  }

  const headers = {
    ...corsHeaders(req),
    "Content-Type": "image/webp",
    "Cache-Control": "public, max-age=604800, immutable",
  };

  try {
    const cached = takeCachedImage(`gallery:${id}`);
    if (cached) {
      return new Response(Buffer.from(cached), {
        headers: { ...headers, "Content-Length": String(cached.byteLength) },
      });
    }

    const foto = await prisma.fotoGallery.findUnique({
      where: { id },
      select: { contenuto: true },
    });
    if (!foto) {
      return new Response("Non trovata", { status: 404, headers: corsHeaders(req) });
    }

    const body = new Uint8Array(foto.contenuto);
    storeCachedImage(`gallery:${id}`, body);
    return new Response(Buffer.from(body), {
      headers: { ...headers, "Content-Length": String(body.byteLength) },
    });
  } catch (error) {
    console.error(error);
    return new Response("Foto non disponibile", { status: 500, headers: corsHeaders(req) });
  }
}
