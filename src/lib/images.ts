import sharp from "sharp";

const MAX_BYTES = 12 * 1024 * 1024;

export class ImageError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function toWebp(file: File) {
  if (file.size <= 0) throw new ImageError("Seleziona una foto.");
  if (file.size > MAX_BYTES) throw new ImageError("La foto supera 12 MB.");
  if (file.type === "image/svg+xml" || (file.type && !file.type.startsWith("image/"))) {
    throw new ImageError("Usa un JPG, PNG o WebP.");
  }

  try {
    return await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate()
      .resize({ width: 1400, height: 1400, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new ImageError("Impossibile leggere la foto. Usa un JPG, PNG o WebP.");
  }
}

export function publicImagePath(voceId: string, updatedAt: Date) {
  return `/api/public/menu/immagini/${voceId}?v=${updatedAt.getTime()}`;
}
