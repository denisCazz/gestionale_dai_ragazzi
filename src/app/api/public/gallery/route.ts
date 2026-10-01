import { corsHeaders, corsJson } from "@/lib/cors";
import { getPublicGallery } from "@/lib/gallery";

export const dynamic = "force-dynamic";

export async function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

export async function GET(req: Request) {
  try {
    return corsJson(req, await getPublicGallery());
  } catch (error) {
    console.error(error);
    return corsJson(req, { error: "Gallery non disponibile" }, { status: 500 });
  }
}
