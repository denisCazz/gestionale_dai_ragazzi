import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { disponibilitàVoce } from "@/lib/menu";
import { z } from "zod";

const voceSchema = z.object({
  categoriaId: z.string().min(1),
  nome: z.string().trim().min(1).max(200),
  descrizione: z.string().trim().max(2000).optional().nullable(),
  prezzo: z.coerce.number().min(0),
  attivo: z.boolean().optional().default(true),
  ingredienti: z
    .array(
      z.object({
        articoloId: z.string().min(1),
        quantitaNecessaria: z.coerce.number().positive(),
      })
    )
    .default([]),
});

function serializeVoce<
  T extends {
    attivo: boolean;
    ingredienti: Parameters<typeof disponibilitàVoce>[0];
  },
>(voce: T, soloDisponibili: boolean) {
  const disp = disponibilitàVoce(voce.ingredienti);
  if (soloDisponibili && (!voce.attivo || !disp.disponibile)) return null;
  return {
    ...voce,
    disponibile: voce.attivo && disp.disponibile,
    mancanti: disp.mancanti,
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const soloDisponibili = searchParams.get("disponibili") === "1";

    const [categorie, articoli] = await Promise.all([
      prisma.categoriaMenu.findMany({
        orderBy: { ordine: "asc" },
        include: {
          voci: {
            orderBy: [{ ordine: "asc" }, { nome: "asc" }],
            include: {
              categoria: { select: { id: true, nome: true } },
              ingredienti: { include: { articolo: true } },
            },
          },
        },
      }),
      prisma.articolo.findMany({
        where: { attivo: true },
        orderBy: { nome: "asc" },
        select: { id: true, nome: true, quantita: true, unitaMisura: true },
      }),
    ]);

    return NextResponse.json({
      categorie: categorie.map((c) => ({
        ...c,
        voci: c.voci
          .map((v) => serializeVoce(v, soloDisponibili))
          .filter(Boolean),
      })),
      articoli,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Errore caricamento menu" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const parsed = voceSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;
  const voce = await prisma.voceMenu.create({
    data: {
      categoriaId: data.categoriaId,
      nome: data.nome,
      descrizione: data.descrizione || null,
      prezzo: data.prezzo,
      attivo: data.attivo,
      ingredienti: {
        create: data.ingredienti,
      },
    },
    include: {
      categoria: true,
      ingredienti: { include: { articolo: true } },
    },
  });
  return NextResponse.json(serializeVoce(voce, false), { status: 201 });
}
