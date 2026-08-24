import { esCategoria, type Categoria } from "./types";
import type { DistribucionInput, DocumentoInput } from "./queries";

export class ErrorValidacion extends Error {}

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;

function texto(v: unknown, campo: string, { requerido = false, max = 500 } = {}): string | null {
  if (v === null || v === undefined || v === "") {
    if (requerido) throw new ErrorValidacion(`El campo "${campo}" es obligatorio.`);
    return null;
  }
  if (typeof v !== "string") throw new ErrorValidacion(`El campo "${campo}" debe ser texto.`);
  const s = v.trim();
  if (requerido && !s) throw new ErrorValidacion(`El campo "${campo}" es obligatorio.`);
  if (s.length > max) throw new ErrorValidacion(`El campo "${campo}" supera ${max} caracteres.`);
  return s === "" ? null : s;
}

function fecha(v: unknown, campo: string): string | null {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v);
  if (!RE_FECHA.test(s) || Number.isNaN(new Date(`${s}T00:00:00Z`).getTime())) {
    throw new ErrorValidacion(`El campo "${campo}" debe tener formato AAAA-MM-DD.`);
  }
  return s;
}

function entero(v: unknown, campo: string): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number.parseInt(String(v), 10);
  if (!Number.isInteger(n) || n < 0 || n > 9999) {
    throw new ErrorValidacion(`El campo "${campo}" debe ser un número entero entre 0 y 9999.`);
  }
  return n;
}

/**
 * Arma el input de un documento respetando qué campos aplican a cada categoría
 * (el modelo tiene checks equivalentes del lado de Postgres).
 * En modo parcial sólo se devuelven las claves realmente presentes en el body.
 */
export function parsearDocumento(
  body: Record<string, unknown>,
  categoria: Categoria,
  parcial: boolean
): Partial<DocumentoInput> {
  const esRegistro = categoria === "registros";
  const out: Partial<DocumentoInput> = {};
  const tiene = (k: string) => !parcial || k in body;

  if (tiene("codigo")) out.codigo = texto(body.codigo, "codigo", { requerido: true, max: 120 })!;
  if (tiene("titulo")) out.titulo = texto(body.titulo, "titulo", { max: 500 }) ?? "";
  if (tiene("version")) out.version = entero(body.version, "version");

  if (esRegistro) {
    if (tiene("procedimiento")) out.procedimiento = texto(body.procedimiento, "procedimiento", { max: 120 });
    if (tiene("vigencia")) out.vigencia = fecha(body.vigencia, "vigencia");
    if (tiene("archivado")) out.archivado = texto(body.archivado, "archivado", { max: 200 });
    if (tiene("retencion")) out.retencion = texto(body.retencion, "retencion", { max: 200 });
    if (tiene("disposicion")) out.disposicion = texto(body.disposicion, "disposicion", { max: 200 });
    if (!parcial) {
      out.ultimo_cambio = null;
      out.area = null;
    }
  } else {
    if (tiene("ultimo_cambio")) out.ultimo_cambio = fecha(body.ultimo_cambio, "ultimo_cambio");
    if (categoria === "proc_gen" && tiene("area")) out.area = texto(body.area, "area", { max: 200 });
    if (!parcial) {
      out.procedimiento = null;
      out.vigencia = null;
      out.archivado = null;
      out.retencion = null;
      out.disposicion = null;
      if (categoria !== "proc_gen") out.area = null;
    }
  }

  return out;
}

export function parsearDocumentoNuevo(body: Record<string, unknown>): DocumentoInput {
  if (!esCategoria(body.categoria)) {
    throw new ErrorValidacion("Categoría inválida: usá it_moviles, it_tks, proc_gen o registros.");
  }
  const campos = parsearDocumento(body, body.categoria, false);
  return {
    categoria: body.categoria,
    codigo: campos.codigo!,
    titulo: campos.titulo ?? "",
    procedimiento: campos.procedimiento ?? null,
    version: campos.version ?? null,
    ultimo_cambio: campos.ultimo_cambio ?? null,
    vigencia: campos.vigencia ?? null,
    area: campos.area ?? null,
    archivado: campos.archivado ?? null,
    retencion: campos.retencion ?? null,
    disposicion: campos.disposicion ?? null,
  };
}

export function parsearDistribucion(
  body: Record<string, unknown>,
  parcial: boolean
): Partial<DistribucionInput> {
  const out: Partial<DistribucionInput> = {};
  const tiene = (k: string) => !parcial || k in body;

  if (tiene("copia")) out.copia = texto(body.copia, "copia", { requerido: true, max: 120 })!;
  if (tiene("fecha_distribucion")) out.fecha_distribucion = fecha(body.fecha_distribucion, "fecha_distribucion");
  if (tiene("fecha_vigencia")) out.fecha_vigencia = fecha(body.fecha_vigencia, "fecha_vigencia");
  if (tiene("sectores")) {
    const raw = body.sectores;
    if (raw === null || raw === undefined) out.sectores = [];
    else if (!Array.isArray(raw)) throw new ErrorValidacion('El campo "sectores" debe ser una lista.');
    else {
      out.sectores = raw
        .map((s) => texto(s, "sectores", { max: 200 }))
        .filter((s): s is string => Boolean(s));
    }
  }
  return out;
}

export function parsearDistribucionNueva(body: Record<string, unknown>): DistribucionInput {
  const campos = parsearDistribucion(body, false);
  return {
    copia: campos.copia!,
    fecha_distribucion: campos.fecha_distribucion ?? null,
    fecha_vigencia: campos.fecha_vigencia ?? null,
    sectores: campos.sectores ?? [],
  };
}

export function parsearNombreSector(body: Record<string, unknown>): string {
  const nombre = texto(body.nombre, "nombre", { requerido: true, max: 200 });
  return nombre!;
}

export async function leerBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new ErrorValidacion("El cuerpo del pedido debe ser un objeto JSON.");
    }
    return body as Record<string, unknown>;
  } catch (err) {
    if (err instanceof ErrorValidacion) throw err;
    throw new ErrorValidacion("JSON inválido.");
  }
}
