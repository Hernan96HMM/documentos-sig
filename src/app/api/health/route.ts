import { queryOne } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Healthcheck del contenedor. Público a propósito: lo consulta wget desde
 * dentro del contenedor, sin cookies de sesión.
 *   wget -q -O- http://127.0.0.1:3000/api/health
 */
export async function GET() {
  try {
    await queryOne("select 1 as ok");
    return Response.json({ status: "ok", db: "ok", ts: new Date().toISOString() });
  } catch (err) {
    return Response.json(
      { status: "degraded", db: "error", detalle: (err as Error).message },
      { status: 503 }
    );
  }
}
