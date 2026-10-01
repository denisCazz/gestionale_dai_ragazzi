import { corsHeaders } from "@/lib/cors";
import { prisma } from "@/lib/db";

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

  try {
    const immagine = await prisma.immagineVoce.findUnique({
      where: { voceMenuId: id },
      select: { contenuto: true },
    });
    if (!immagine) {
      return new Response("Non trovata", { status: 404, headers: corsHeaders(req) });
    }

    const body = Buffer.from(immagine.contenuto);
    return new Response(body, {
      headers: {
        ...corsHeaders(req),
        "Content-Type": "image/webp",
        "Content-Length": String(body.length),
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    console.error(error);
    return new Response("Foto non disponibile", { status: 500, headers: corsHeaders(req) });
  }
}
