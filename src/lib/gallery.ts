import { prisma } from "./db";
import { publicGalleryPath } from "./images";

const fotoSelect = {
  id: true,
  alt: true,
  ordine: true,
  larghezza: true,
  altezza: true,
  updatedAt: true,
} as const;

export async function listGallery() {
  return prisma.fotoGallery.findMany({
    orderBy: [{ ordine: "asc" }, { createdAt: "asc" }],
    select: fotoSelect,
  });
}

export function serializeGallery(
  foto: {
    id: string;
    alt: string;
    larghezza: number;
    altezza: number;
    updatedAt: Date;
  }
) {
  return {
    src: publicGalleryPath(foto.id, foto.updatedAt),
    width: foto.larghezza,
    height: foto.altezza,
    alt: foto.alt,
  };
}

export async function getPublicGallery() {
  const foto = await listGallery();
  return {
    updatedAt: new Date().toISOString(),
    foto: foto.map(serializeGallery),
  };
}
