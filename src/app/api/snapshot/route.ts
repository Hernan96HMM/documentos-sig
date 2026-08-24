import { requerirSesion } from "@/auth";
import { obtenerSnapshot } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Estado completo del listado. Lo usa el cliente para rearmarse cuando la
 * conexión SSE se corta y vuelve, o cuando llega un evento `recargar`.
 */
export async function GET() {
  const sesion = await requerirSesion();
  if ("error" in sesion) return sesion.error;
  return Response.json(await obtenerSnapshot());
}
