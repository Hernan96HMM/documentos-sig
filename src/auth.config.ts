import type { NextAuthConfig } from "next-auth";

/**
 * Config compartida y "edge-safe": sin `pg` ni `bcryptjs`.
 * El middleware importa SÓLO esto; el runtime Node importa src/auth.ts, que le
 * suma el provider de credenciales con acceso a la base.
 */
export const authConfig = {
  trustHost: true, // corre detrás de nginx sobre HTTP interno (AUTH_TRUST_HOST=true)
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.rol = (user as { rol?: string }).rol;
        token.nombre = (user as { nombre?: string }).nombre;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.uid ?? "");
        session.user.rol = (token.rol as "editor" | "lector") ?? "lector";
        session.user.nombre = String(token.nombre ?? session.user.email ?? "");
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
