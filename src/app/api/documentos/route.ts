import { requerirSesion } from "@/auth";
import { crearDocumento, listarDocumentos } from "@/lib/queries";
import { publish } from "@/lib/realtime";
import { ErrorValidacion, leerBody, parsearDocumentoNuevo } from "@/lib/validar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sesion = await requerirSesion();
  if ("error" in sesion) return sesion.error;
  return Response.json({ documentos: await listarDocumentos() });
}

/** Crear documento — sólo rol editor (verificado en el servidor, no en la UI). */
export async function POST(req: Request) {
  const sesion = await requerirSesion(true);
  if ("error" in sesion) return sesion.error;

  try {
    const body = await leerBody(req);
    const input = parsearDocumentoNuevo(body);
    const documento = await crearDocumento(input, sesion.user.id);

    await publish({
      tipo: "documento.upsert",
      actor: sesion.user.nombre,
      ts: new Date().toISOString(),
      documento,
    });

    return Response.json({ documento }, { status: 201 });
  } catch (err) {
    if (err instanceof ErrorValidacion) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    console.error("[api/documentos] POST:", err);
    return Response.json({ error: "No se pudo crear el documento." }, { status: 500 });
  }
}
