import { prisma } from "./db";
import {
  COMING_SOON_COPY,
  disponibilitàVoce,
  formatPrezzoPubblico,
  slugify,
} from "./menu";

export async function uniqueCategoriaSlug(nome: string, excludeId?: string) {
  const base = slugify(nome);
  let slug = base;
  let n = 2;
  while (true) {
    const existing = await prisma.categoriaMenu.findUnique({ where: { slug } });
    if (!existing || existing.id === excludeId) return slug;
    slug = `${base}-${n}`;
    n += 1;
  }
}

export type PublicMenuItem = {
  name: string;
  description?: string;
  price?: string;
};

export type PublicMenuSection = {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  items: PublicMenuItem[];
};

export type PublicMenu = {
  updatedAt: string;
  comingSoonCopy: string;
  categorie: PublicMenuSection[];
};

export async function getPublicMenu(): Promise<PublicMenu> {
  const categorie = await prisma.categoriaMenu.findMany({
    where: { pubblicata: true },
    orderBy: { ordine: "asc" },
    include: {
      voci: {
        where: { attivo: true },
        orderBy: [{ ordine: "asc" }, { nome: "asc" }],
        include: { ingredienti: { include: { articolo: true } } },
      },
    },
  });

  return {
    updatedAt: new Date().toISOString(),
    comingSoonCopy: COMING_SOON_COPY,
    categorie: categorie.map((c) => {
      const slug = c.slug || slugify(c.nome);
      return {
        id: slug,
        slug,
        title: c.nome,
        subtitle: c.sottotitolo || undefined,
        items: c.voci
          .filter((v) => disponibilitàVoce(v.ingredienti).disponibile)
          .map((v) => ({
            name: v.nome,
            description: v.descrizione || undefined,
            price: v.prezzo > 0 ? formatPrezzoPubblico(v.prezzo) : undefined,
          })),
      };
    }),
  };
}
