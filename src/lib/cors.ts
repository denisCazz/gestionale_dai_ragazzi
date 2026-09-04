const DEFAULT_ORIGINS = [
  "http://localhost:4321",
  "http://127.0.0.1:4321",
  "https://dairagazzi.bitora.it",
  "https://www.bardairagazzicarmagnola.it",
  "https://bardairagazzicarmagnola.it",
];

function allowedOrigins() {
  const extra = process.env.PUBLIC_SITE_ORIGIN?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return extra?.length ? extra : DEFAULT_ORIGINS;
}

function resolveOrigin(origin: string | null) {
  if (!origin) return "*";
  const allowed = allowedOrigins();
  if (allowed.includes(origin) || allowed.includes("*")) return origin;
  try {
    const host = new URL(origin).hostname;
    if (host === "localhost" || host === "127.0.0.1") return origin;
  } catch {
    /* ignore */
  }
  return allowed[0];
}

export function corsHeaders(req: Request) {
  const origin = resolveOrigin(req.headers.get("origin"));
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function corsJson(req: Request, body: unknown, init?: ResponseInit) {
  return Response.json(body, {
    ...init,
    headers: {
      ...corsHeaders(req),
      "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
      ...(init?.headers ?? {}),
    },
  });
}
