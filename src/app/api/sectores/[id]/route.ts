import { requerirSesion } from "@/auth";
import { borrarSector } from "@/lib/queries";
import { publish } from "@/lib/realtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Ctx) {
  const sesion = await requerirSesion(true);
  if ("error" in sesion) return sesion.error;

  const { id } = await params;
  try {
    const borrado = await borrarSector(id);
    if (!borrado) return Response.json({ error: "El sector no existe." }, { status: 404 });

    await publish({
      tipo: "sector.delete",
      actor: sesion.user.nombre,
      ts: new Date().toISOString(),
      id: borrado.id,
    });

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[api/sectores/:id] DELETE:", err);
    return Response.json({ error: "No se pudo eliminar el sector." }, { status: 500 });
  }
}
