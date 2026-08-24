import { requerirSesion } from "@/auth";
import { crearSector, listarSectores } from "@/lib/queries";
import { publish } from "@/lib/realtime";
import { ErrorValidacion, leerBody, parsearNombreSector } from "@/lib/validar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sesion = await requerirSesion();
  if ("error" in sesion) return sesion.error;
  return Response.json({ sectores: await listarSectores() });
}

export async function POST(req: Request) {
  const sesion = await requerirSesion(true);
  if ("error" in sesion) return sesion.error;

  try {
    const nombre = parsearNombreSector(await leerBody(req));
    const sector = await crearSector(nombre, sesion.user.id);
    if (!sector) return Response.json({ error: "Ese sector ya existe." }, { status: 409 });

    await publish({ tipo: "sector.upsert", actor: sesion.user.nombre, ts: new Date().toISOString(), sector });
    return Response.json({ sector }, { status: 201 });
  } catch (err) {
    if (err instanceof ErrorValidacion) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    console.error("[api/sectores] POST:", err);
    return Response.json({ error: "No se pudo crear el sector." }, { status: 500 });
  }
}
