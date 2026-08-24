import { query, queryOne } from "./db";
import type { Categoria, Distribucion, Documento, Sector, Snapshot } from "./types";

/**
 * Las columnas `date` se leen con to_char: si se dejaran como tipo date, el
 * driver las convierte a Date de JS y el navegador puede correrlas un día por
 * zona horaria. Acá siempre viajan como 'YYYY-MM-DD' plano.
 */
const DOC_COLS = `
  d.id,
  d.categoria,
  d.codigo,
  d.titulo,
  d.procedimiento,
  d.version,
  to_char(d.ultimo_cambio, 'YYYY-MM-DD') as ultimo_cambio,
  to_char(d.vigencia,      'YYYY-MM-DD') as vigencia,
  d.area,
  d.archivado,
  d.retencion,
  d.disposicion,
  d.orden,
  to_char(d.updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as updated_at,
  u.nombre as updated_by_nombre
`;

const DIST_COLS = `
  p.id,
  p.copia,
  to_char(p.fecha_distribucion, 'YYYY-MM-DD') as fecha_distribucion,
  to_char(p.fecha_vigencia,     'YYYY-MM-DD') as fecha_vigencia,
  p.sectores,
  p.orden,
  to_char(p.updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as updated_at,
  u.nombre as updated_by_nombre
`;

// --- lectura ---------------------------------------------------------------

export async function listarDocumentos(): Promise<Documento[]> {
  return query<Documento>(`
    select ${DOC_COLS}
      from documento d
      left join usuario u on u.id = d.updated_by
     order by d.categoria, d.orden, d.codigo
  `);
}

export async function obtenerDocumento(id: string): Promise<Documento | null> {
  return queryOne<Documento>(
    `select ${DOC_COLS} from documento d left join usuario u on u.id = d.updated_by where d.id = $1`,
    [id]
  );
}

export async function listarDistribucion(): Promise<Distribucion[]> {
  return query<Distribucion>(`
    select ${DIST_COLS}
      from politica_distribucion p
      left join usuario u on u.id = p.updated_by
     order by p.orden, p.copia
  `);
}

export async function obtenerDistribucion(id: string): Promise<Distribucion | null> {
  return queryOne<Distribucion>(
    `select ${DIST_COLS} from politica_distribucion p left join usuario u on u.id = p.updated_by where p.id = $1`,
    [id]
  );
}

export async function listarSectores(): Promise<Sector[]> {
  return query<Sector>(`select id, nombre, orden from politica_sector order by orden, nombre`);
}

export async function obtenerSnapshot(): Promise<Snapshot> {
  const [documentos, distribucion, sectores] = await Promise.all([
    listarDocumentos(),
    listarDistribucion(),
    listarSectores(),
  ]);
  return { documentos, distribucion, sectores, generado_at: new Date().toISOString() };
}

// --- escritura -------------------------------------------------------------

export interface DocumentoInput {
  categoria: Categoria;
  codigo: string;
  titulo: string;
  procedimiento: string | null;
  version: number | null;
  ultimo_cambio: string | null;
  vigencia: string | null;
  area: string | null;
  archivado: string | null;
  retencion: string | null;
  disposicion: string | null;
}

export async function crearDocumento(input: DocumentoInput, userId: string): Promise<Documento> {
  const creado = await queryOne<{ id: string }>(
    `insert into documento
       (categoria, codigo, titulo, procedimiento, version, ultimo_cambio, vigencia,
        area, archivado, retencion, disposicion, orden, updated_at, updated_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
             coalesce((select max(orden) + 1 from documento where categoria = $1), 0),
             now(), $12)
     returning id`,
    [
      input.categoria,
      input.codigo,
      input.titulo,
      input.procedimiento,
      input.version,
      input.ultimo_cambio,
      input.vigencia,
      input.area,
      input.archivado,
      input.retencion,
      input.disposicion,
      userId,
    ]
  );
  const doc = creado ? await obtenerDocumento(creado.id) : null;
  if (!doc) throw new Error("El documento recién creado no se pudo releer");
  return doc;
}

export type ResultadoActualizar<T> =
  | { ok: true; row: T }
  | { ok: false; motivo: "no-encontrado" }
  | { ok: false; motivo: "conflicto"; row: T };

/**
 * Actualiza una fila con "last write wins" — con un aviso opcional.
 *
 * Si el cliente manda `updated_at_visto` (la marca que tenía en pantalla) y en
 * la base hay una más nueva, se devuelve conflicto en vez de pisar el cambio de
 * la otra persona. El frontend le pregunta al usuario y reintenta sin la marca
 * si decide continuar. Con `updated_at_visto` ausente, gana quien escribe último.
 */
export async function actualizarDocumento(
  id: string,
  campos: Partial<DocumentoInput>,
  userId: string,
  updatedAtVisto?: string | null
): Promise<ResultadoActualizar<Documento>> {
  const actual = await obtenerDocumento(id);
  if (!actual) return { ok: false, motivo: "no-encontrado" };
  if (updatedAtVisto && new Date(actual.updated_at).getTime() > new Date(updatedAtVisto).getTime()) {
    return { ok: false, motivo: "conflicto", row: actual };
  }

  const permitidos: (keyof DocumentoInput)[] = [
    "codigo",
    "titulo",
    "procedimiento",
    "version",
    "ultimo_cambio",
    "vigencia",
    "area",
    "archivado",
    "retencion",
    "disposicion",
  ];
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const campo of permitidos) {
    if (campo in campos) {
      params.push(campos[campo] ?? null);
      sets.push(`${campo} = $${params.length}`);
    }
  }
  params.push(userId);
  sets.push(`updated_by = $${params.length}`);
  sets.push(`updated_at = now()`);
  params.push(id);

  await query(`update documento set ${sets.join(", ")} where id = $${params.length}`, params);
  const row = await obtenerDocumento(id);
  if (!row) return { ok: false, motivo: "no-encontrado" };
  return { ok: true, row };
}

export async function borrarDocumento(id: string): Promise<Documento | null> {
  const doc = await obtenerDocumento(id);
  if (!doc) return null;
  await query(`delete from documento where id = $1`, [id]);
  return doc;
}

export interface DistribucionInput {
  copia: string;
  fecha_distribucion: string | null;
  fecha_vigencia: string | null;
  sectores: string[];
}

export async function crearDistribucion(input: DistribucionInput, userId: string): Promise<Distribucion> {
  const row = await queryOne<{ id: string }>(
    `insert into politica_distribucion (copia, fecha_distribucion, fecha_vigencia, sectores, orden, updated_at, updated_by)
     values ($1,$2,$3,$4, coalesce((select max(orden) + 1 from politica_distribucion), 0), now(), $5)
     returning id`,
    [input.copia, input.fecha_distribucion, input.fecha_vigencia, input.sectores, userId]
  );
  const dist = await obtenerDistribucion(row!.id);
  if (!dist) throw new Error("La copia recién creada no se pudo releer");
  return dist;
}

export async function actualizarDistribucion(
  id: string,
  campos: Partial<DistribucionInput>,
  userId: string,
  updatedAtVisto?: string | null
): Promise<ResultadoActualizar<Distribucion>> {
  const actual = await obtenerDistribucion(id);
  if (!actual) return { ok: false, motivo: "no-encontrado" };
  if (updatedAtVisto && new Date(actual.updated_at).getTime() > new Date(updatedAtVisto).getTime()) {
    return { ok: false, motivo: "conflicto", row: actual };
  }

  const permitidos: (keyof DistribucionInput)[] = ["copia", "fecha_distribucion", "fecha_vigencia", "sectores"];
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const campo of permitidos) {
    if (campo in campos) {
      params.push(campos[campo] ?? null);
      sets.push(`${campo} = $${params.length}`);
    }
  }
  params.push(userId);
  sets.push(`updated_by = $${params.length}`);
  sets.push(`updated_at = now()`);
  params.push(id);

  await query(`update politica_distribucion set ${sets.join(", ")} where id = $${params.length}`, params);
  const row = await obtenerDistribucion(id);
  if (!row) return { ok: false, motivo: "no-encontrado" };
  return { ok: true, row };
}

export async function borrarDistribucion(id: string): Promise<Distribucion | null> {
  const dist = await obtenerDistribucion(id);
  if (!dist) return null;
  await query(`delete from politica_distribucion where id = $1`, [id]);
  return dist;
}

export async function crearSector(nombre: string, userId: string): Promise<Sector | null> {
  return queryOne<Sector>(
    `insert into politica_sector (nombre, orden, updated_at, updated_by)
     values ($1, coalesce((select max(orden) + 1 from politica_sector), 0), now(), $2)
     on conflict (nombre) do nothing
     returning id, nombre, orden`,
    [nombre, userId]
  );
}

export async function borrarSector(id: string): Promise<Sector | null> {
  return queryOne<Sector>(`delete from politica_sector where id = $1 returning id, nombre, orden`, [id]);
}
