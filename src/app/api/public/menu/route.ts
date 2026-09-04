import { corsHeaders, corsJson } from "@/lib/cors";
import { getPublicMenu } from "@/lib/public-menu";

export const dynamic = "force-dynamic";

export async function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

export async function GET(req: Request) {
  try {
    const menu = await getPublicMenu();
    return corsJson(req, menu);
  } catch (error) {
    console.error(error);
    return corsJson(req, { error: "Menu non disponibile" }, { status: 500 });
  }
}
