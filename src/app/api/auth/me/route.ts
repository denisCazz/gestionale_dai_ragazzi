import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { extractClientIp } from "@/lib/perimetro";

export async function GET(req: Request) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({
    authenticated: true,
    role: session.role,
    u: session.u,
    dipendenteId: session.dipendenteId ?? null,
    nome: session.nome ?? session.u,
    currentIp: extractClientIp(req),
  });
}
