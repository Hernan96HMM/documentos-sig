import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";
import { queryOne } from "./lib/db";
import type { Rol } from "./lib/types";

interface UsuarioRow {
  id: string;
  email: string;
  password_hash: string;
  nombre: string;
  rol: Rol;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credenciales",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        const row = await queryOne<UsuarioRow>(
          `select id, email, password_hash, nombre, rol from usuario where lower(email) = $1`,
          [email]
        );
        // Se compara igual contra un hash dummy cuando el usuario no existe,
        // para no filtrar por tiempo de respuesta qué emails están dados de alta.
        const hash = row?.password_hash ?? "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi";
        const ok = await bcrypt.compare(password, hash);
        if (!row || !ok) return null;

        return { id: row.id, email: row.email, name: row.nombre, nombre: row.nombre, rol: row.rol };
      },
    }),
  ],
});

/** Helper para rutas de API: exige sesión y, opcionalmente, rol editor. */
export async function requerirSesion(soloEditor = false) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: Response.json({ error: "No autenticado" }, { status: 401 }) } as const;
  }
  if (soloEditor && session.user.rol !== "editor") {
    return {
      error: Response.json({ error: "Tu usuario es de sólo lectura" }, { status: 403 }),
    } as const;
  }
  return { user: session.user } as const;
}
