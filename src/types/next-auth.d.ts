import type { DefaultSession } from "next-auth";
import type { Rol } from "@/lib/types";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      rol: Rol;
      nombre: string;
    } & DefaultSession["user"];
  }

  interface User {
    rol?: Rol;
    nombre?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    rol?: Rol;
    nombre?: string;
  }
}
