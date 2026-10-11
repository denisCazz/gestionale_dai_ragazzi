import { format } from "date-fns";
import { it } from "date-fns/locale";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { disponibilitàVoce } from "@/lib/menu";
import {
  menuPdfFilename,
  renderMenuPdf,
  type MenuPdfModel,
  type MenuPdfVoce,
} from "@/lib/menu-pdf";

export const runtime = "nodejs";

function contentDisposition(filename: string) {
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function toVoce(
  voce: {
    attivo: boolean;
    nome: string;
    descrizione: string | null;
    prezzo: number;
    ingredienti: Parameters<typeof disponibilitàVoce>[0];
  },
  soloDisponibili: boolean
): MenuPdfVoce | null {
  const disponibile = voce.attivo && disponibilitàVoce(voce.ingredienti).disponibile;
  if (soloDisponibili && !disponibile) return null;
  return {
    nome: voce.nome,
    descrizione: voce.descrizione?.trim() || null,
    prezzo: voce.prezzo,
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const categoriaId = searchParams.get("categoriaId");
    const soloDisponibili = searchParams.get("disponibili") === "1";
    const aggiornato = format(new Date(), "d MMMM yyyy", { locale: it });

    const categorie = await prisma.categoriaMenu.findMany({
      where: categoriaId ? { id: categoriaId } : undefined,
      orderBy: { ordine: "asc" },
      include: {
        voci: {
          orderBy: [{ ordine: "asc" }, { nome: "asc" }],
          include: { ingredienti: { include: { articolo: true } } },
        },
      },
    });

    if (categoriaId && categorie.length === 0) {
      return NextResponse.json({ error: "Sezione non trovata" }, { status: 404 });
    }

    const sezioni = categorie
      .map((categoria) => ({
        nome: categoria.nome,
        sottotitolo: categoria.sottotitolo?.trim() || null,
        voci: categoria.voci
          .map((voce) => toVoce(voce, soloDisponibili))
          .filter((voce): voce is MenuPdfVoce => voce !== null),
      }))
      .filter((sezione) => sezione.voci.length > 0 || Boolean(categoriaId));

    if (!categoriaId && sezioni.length === 0) {
      return NextResponse.json({ error: "Nessuna voce da esportare" }, { status: 400 });
    }

    const model: MenuPdfModel = categoriaId
      ? {
          scope: "sezione",
          titolo: sezioni[0]?.nome ?? "Menu",
          sottotitolo: sezioni[0]?.sottotitolo ?? null,
          sezioni,
          aggiornato,
        }
      : {
          scope: "menu",
          titolo: "Menu",
          sottotitolo: null,
          sezioni,
          aggiornato,
        };

    const pdf = await renderMenuPdf(model);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": contentDisposition(menuPdfFilename(model)),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Errore creazione PDF" }, { status: 500 });
  }
}
