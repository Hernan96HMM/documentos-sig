import { requerirSesion } from "@/auth";
import { crearDistribucion, listarDistribucion } from "@/lib/queries";
import { publish } from "@/lib/realtime";
import { ErrorValidacion, leerBody, parsearDistribucionNueva } from "@/lib/validar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sesion = await requerirSesion();
  if ("error" in sesion) return sesion.error;
  return Response.json({ distribucion: await listarDistribucion() });
}

/** Nueva copia controlada de la Política SIG — sólo rol editor. */
export async function POST(req: Request) {
  const sesion = await requerirSesion(true);
  if ("error" in sesion) return sesion.error;

  try {
    const body = await leerBody(req);
    const distribucion = await crearDistribucion(parsearDistribucionNueva(body), sesion.user.id);

    await publish({
      tipo: "distribucion.upsert",
      actor: sesion.user.nombre,
      ts: new Date().toISOString(),
      distribucion,
    });

    return Response.json({ distribucion }, { status: 201 });
  } catch (err) {
    if (err instanceof ErrorValidacion) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    console.error("[api/distribucion] POST:", err);
    return Response.json({ error: "No se pudo crear la copia." }, { status: 500 });
  }
}
