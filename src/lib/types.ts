export const CATEGORIAS = ["proc_gen", "it_moviles", "it_tks", "registros"] as const;
export type Categoria = (typeof CATEGORIAS)[number];

export function esCategoria(v: unknown): v is Categoria {
  return typeof v === "string" && (CATEGORIAS as readonly string[]).includes(v);
}

export type Rol = "editor" | "lector";

export interface Documento {
  id: string;
  categoria: Categoria;
  codigo: string;
  titulo: string;
  procedimiento: string | null;
  version: number | null;
  ultimo_cambio: string | null; // YYYY-MM-DD
  vigencia: string | null; // YYYY-MM-DD
  area: string | null;
  archivado: string | null;
  retencion: string | null;
  disposicion: string | null;
  orden: number;
  updated_at: string; // ISO
  updated_by_nombre: string | null;
}

export interface Distribucion {
  id: string;
  copia: string;
  fecha_distribucion: string | null;
  fecha_vigencia: string | null;
  sectores: string[];
  orden: number;
  updated_at: string;
  updated_by_nombre: string | null;
}

export interface Sector {
  id: string;
  nombre: string;
  orden: number;
}

export interface Snapshot {
  documentos: Documento[];
  distribucion: Distribucion[];
  sectores: Sector[];
  generado_at: string;
}

/** Eventos que viajan por SSE. */
export type RealtimeEvent =
  | { tipo: "documento.upsert"; actor: string; ts: string; documento: Documento }
  | { tipo: "documento.delete"; actor: string; ts: string; id: string; categoria: Categoria }
  | { tipo: "distribucion.upsert"; actor: string; ts: string; distribucion: Distribucion }
  | { tipo: "distribucion.delete"; actor: string; ts: string; id: string }
  | { tipo: "sector.upsert"; actor: string; ts: string; sector: Sector }
  | { tipo: "sector.delete"; actor: string; ts: string; id: string }
  /** Fallback cuando el payload no entra en NOTIFY (8000 bytes): el cliente recarga. */
  | { tipo: "recargar"; actor: string; ts: string };
