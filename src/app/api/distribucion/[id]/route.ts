import { requerirSesion } from "@/auth";
import { actualizarDistribucion, borrarDistribucion } from "@/lib/queries";
import { publish } from "@/lib/realtime";
import { ErrorValidacion, leerBody, parsearDistribucion } from "@/lib/validar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const sesion = await requerirSesion(true);
  if ("error" in sesion) return sesion.error;

  const { id } = await params;
  try {
    const body = await leerBody(req);
    const campos = parsearDistribucion(body, true);
    const updatedAtVisto = typeof body.updated_at_visto === "string" ? body.updated_at_visto : null;

    const res = await actualizarDistribucion(id, campos, sesion.user.id, updatedAtVisto);
    if (!res.ok && res.motivo === "no-encontrado") {
      return Response.json({ error: "La copia no existe." }, { status: 404 });
    }
    if (!res.ok) {
      return Response.json(
        {
          error: "conflicto",
          mensaje: `${res.row.updated_by_nombre ?? "Otra persona"} modificó esta copia mientras la editabas.`,
          distribucion: res.row,
        },
        { status: 409 }
      );
    }

    await publish({
      tipo: "distribucion.upsert",
      actor: sesion.user.nombre,
      ts: new Date().toISOString(),
      distribucion: res.row,
    });

    return Response.json({ distribucion: res.row });
  } catch (err) {
    if (err instanceof ErrorValidacion) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    console.error("[api/distribucion/:id] PATCH:", err);
    return Response.json({ error: "No se pudo guardar la copia." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const sesion = await requerirSesion(true);
  if ("error" in sesion) return sesion.error;

  const { id } = await params;
  try {
    const borrada = await borrarDistribucion(id);
    if (!borrada) return Response.json({ error: "La copia no existe." }, { status: 404 });

    await publish({
      tipo: "distribucion.delete",
      actor: sesion.user.nombre,
      ts: new Date().toISOString(),
      id: borrada.id,
    });

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[api/distribucion/:id] DELETE:", err);
    return Response.json({ error: "No se pudo eliminar la copia." }, { status: 500 });
  }
}
