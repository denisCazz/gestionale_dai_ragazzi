import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, parseSession } from "@/lib/auth";

function isPublic(pathname: string) {
  return (
    pathname === "/login" ||
    pathname === "/api/auth/login" ||
    pathname.startsWith("/api/public/")
  );
}

function isAllowedForDipendente(pathname: string) {
  return (
    pathname === "/timbratura" ||
    pathname.startsWith("/timbratura/") ||
    pathname === "/api/timbratura" ||
    pathname.startsWith("/api/timbratura/") ||
    pathname === "/api/auth/logout" ||
    pathname === "/api/auth/me"
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = parseSession(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === "/login" && session) {
    const dest = session.role === "DIPENDENTE" ? "/timbratura" : "/";
    return NextResponse.redirect(new URL(dest, request.url));
  }

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }
    const login = new URL("/login", request.url);
    login.searchParams.set("from", pathname);
    return NextResponse.redirect(login);
  }

  if (session.role === "DIPENDENTE" && !isAllowedForDipendente(pathname)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Accesso riservato agli amministratori" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/timbratura", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
