import { requerirSesion } from "@/auth";
import { actualizarDocumento, borrarDocumento, obtenerDocumento } from "@/lib/queries";
import { publish } from "@/lib/realtime";
import { ErrorValidacion, leerBody, parsearDocumento } from "@/lib/validar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH — modificar documento. Sólo rol editor.
 *
 * Si el body trae `updated_at_visto`, se compara contra la fila en base: si
 * alguien más la tocó después de que este usuario la cargó en pantalla, se
 * responde 409 con la versión actual en vez de pisarla. El frontend avisa y
 * deja reintentar (esa segunda vez ya sin la marca → last write wins).
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const sesion = await requerirSesion(true);
  if ("error" in sesion) return sesion.error;

  const { id } = await params;
  try {
    const body = await leerBody(req);
    const actual = await obtenerDocumento(id);
    if (!actual) return Response.json({ error: "El documento no existe." }, { status: 404 });

    const campos = parsearDocumento(body, actual.categoria, true);
    const updatedAtVisto = typeof body.updated_at_visto === "string" ? body.updated_at_visto : null;

    const res = await actualizarDocumento(id, campos, sesion.user.id, updatedAtVisto);
    if (!res.ok && res.motivo === "no-encontrado") {
      return Response.json({ error: "El documento no existe." }, { status: 404 });
    }
    if (!res.ok) {
      return Response.json(
        {
          error: "conflicto",
          mensaje: `${res.row.updated_by_nombre ?? "Otra persona"} modificó este documento mientras lo editabas.`,
          documento: res.row,
        },
        { status: 409 }
      );
    }

    await publish({
      tipo: "documento.upsert",
      actor: sesion.user.nombre,
      ts: new Date().toISOString(),
      documento: res.row,
    });

    return Response.json({ documento: res.row });
  } catch (err) {
    if (err instanceof ErrorValidacion) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    console.error("[api/documentos/:id] PATCH:", err);
    return Response.json({ error: "No se pudo guardar el documento." }, { status: 500 });
  }
}

/** DELETE — eliminar documento. Sólo rol editor. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const sesion = await requerirSesion(true);
  if ("error" in sesion) return sesion.error;

  const { id } = await params;
  try {
    const borrado = await borrarDocumento(id);
    if (!borrado) return Response.json({ error: "El documento no existe." }, { status: 404 });

    await publish({
      tipo: "documento.delete",
      actor: sesion.user.nombre,
      ts: new Date().toISOString(),
      id: borrado.id,
      categoria: borrado.categoria,
    });

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[api/documentos/:id] DELETE:", err);
    return Response.json({ error: "No se pudo eliminar el documento." }, { status: 500 });
  }
}
