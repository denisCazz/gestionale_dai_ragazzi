import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { looksLikeEan, normalizeScanCode, serializeArticolo } from "@/lib/magazzino";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = normalizeScanCode(searchParams.get("code") ?? "");
  if (!code) {
    return NextResponse.json({ error: "Codice mancante" }, { status: 400 });
  }

  const articolo = await prisma.articolo.findFirst({
    where: looksLikeEan(code)
      ? { OR: [{ ean: code }, { codice: code }] }
      : { OR: [{ codice: code }, { ean: code }] },
  });

  if (!articolo) {
    return NextResponse.json({
      found: false,
      code,
      suggestedField: looksLikeEan(code) ? "ean" : "codice",
    });
  }

  return NextResponse.json({
    found: true,
    code,
    articolo: serializeArticolo(articolo),
  });
}
