import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);

/**
 * Todo requiere sesión salvo /login, /api/auth/* y /api/health (healthcheck del
 * contenedor, que corre sin cookies).
 *
 * Esto es la primera barrera, no la única: las rutas de API que escriben
 * vuelven a verificar el rol contra la base (ver requerirSesion en src/auth.ts).
 */
export default auth((req) => {
  const { pathname } = req.nextUrl;

  const publica =
    pathname === "/login" ||
    pathname === "/api/health" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico";

  if (publica) {
    // Alguien ya logueado que entra a /login va directo al listado.
    if (pathname === "/login" && req.auth?.user) {
      return NextResponse.redirect(new URL("/", req.nextUrl));
    }
    return NextResponse.next();
  }

  if (!req.auth?.user) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const url = new URL("/login", req.nextUrl);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
