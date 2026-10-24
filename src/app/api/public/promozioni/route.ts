import { corsHeaders, corsJson } from "@/lib/cors";
import { prisma } from "@/lib/db";
import { ensureExtendedSchema } from "@/lib/schema-ensure";

export const dynamic = "force-dynamic";

function formatPriceString(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2).replace(/\.00$/, "");
}

export async function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

export async function GET(req: Request) {
  try {
    await ensureExtendedSchema();
    const list = await prisma.promozione.findMany({
      where: { attiva: true },
      orderBy: [{ ordine: "asc" }, { createdAt: "asc" }],
    });

    const promozioni = list.map((p) => ({
      id: p.id,
      title: p.titolo,
      titleEn: p.titoloEn || p.titolo,
      when: p.quando,
      whenEn: p.quandoEn || p.quando,
      time: p.orario || "",
      price: formatPriceString(p.prezzo),
      note: p.nota || "",
      noteEn: p.notaEn || p.nota || "",
      highlight: p.evidenza,
    }));

    return corsJson(req, {
      updatedAt: new Date().toISOString(),
      promozioni,
    });
  } catch (error) {
    console.error(error);
    return corsJson(req, { error: "Promozioni non disponibili" }, { status: 500 });
  }
}
