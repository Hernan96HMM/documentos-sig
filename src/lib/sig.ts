import type { Categoria, Documento } from "./types";

/**
 * Reglas de negocio del listado maestro, portadas tal cual del HTML original.
 * Se calculan en el cliente a partir de las fechas: no se persisten, así el
 * semáforo se recalcula solo con el paso del tiempo sin tocar la base.
 */

export type Estado = "Vigente" | "Atencion" | "Revisar";
export type AreaSig = "Calidad" | "Seguridad" | "Ambiente" | "Compartido";

export const SEMAFORO: Record<Estado, string> = {
  Vigente: "🟢",
  Atencion: "🟡",
  Revisar: "🔴",
};

export const ESTADO_LABEL: Record<Estado, string> = {
  Vigente: "Vigente",
  Atencion: "Atención",
  Revisar: "Revisar",
};

export const AREA_ICONO: Record<AreaSig, string> = {
  Calidad: "⚙️",
  Seguridad: "🦺",
  Ambiente: "🌱",
  Compartido: "🤝",
};

export const AREA_LABEL: Record<AreaSig, string> = {
  Calidad: "Calidad",
  Seguridad: "Seguridad",
  Ambiente: "Medio Ambiente",
  Compartido: "Compartido (Seg. + Amb.)",
};

export function aniosDesde(iso: string | null, hoy = new Date()): number | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return (hoy.getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
}

/** 🟢 ≤ 2 años · 🟡 2–4 años · 🔴 > 4 años sin revisión. */
export function estadoDe(iso: string | null, hoy = new Date()): Estado | null {
  const y = aniosDesde(iso, hoy);
  if (y === null) return null;
  if (y > 4) return "Revisar";
  if (y > 2) return "Atencion";
  return "Vigente";
}

/** Área SIG por prefijo del código: MS = Compartido, MA = Ambiente, SE = Seguridad, resto = Calidad. */
export function areaSigDe(codigo: string | null | undefined): AreaSig {
  if (!codigo) return "Calidad";
  const prefijo = (String(codigo).match(/^[A-Za-zÁÉÍÓÚñÑ]+/) || [""])[0].toUpperCase();
  if (prefijo.includes("MS")) return "Compartido";
  if (prefijo.includes("MA")) return "Ambiente";
  if (prefijo.includes("SE")) return "Seguridad";
  return "Calidad";
}

export function fmtFecha(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function fmtAnios(iso: string | null, hoy = new Date()): string {
  const y = aniosDesde(iso, hoy);
  return y === null ? "—" : y.toFixed(1);
}

export function fmtCuando(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

/** Clasificación de la disposición final de un registro (colorea el badge). */
export function claseDisposicion(disp: string | null): Estado | null {
  const d = (disp || "").toLowerCase();
  if (d.includes("destruc")) return "Revisar";
  if (d.includes("archiv")) return "Vigente";
  if (d.includes("elimin")) return "Atencion";
  return null;
}

/** La fecha que le corresponde a cada categoría. */
export function fechaDe(doc: Documento): string | null {
  return doc.categoria === "registros" ? doc.vigencia : doc.ultimo_cambio;
}

export interface DocumentoVista extends Documento {
  estado: Estado | null;
  areaSig: AreaSig;
}

export function enriquecer(doc: Documento, hoy = new Date()): DocumentoVista {
  return {
    ...doc,
    estado: doc.categoria === "registros" ? null : estadoDe(doc.ultimo_cambio, hoy),
    areaSig: areaSigDe(doc.codigo),
  };
}

export const TABS: { key: string; label: string; categoria: Categoria | null; kind: string }[] = [
  { key: "proc_gen", label: "Procedimientos Generales", categoria: "proc_gen", kind: "proc" },
  { key: "it_moviles", label: "Instructivos Móviles", categoria: "it_moviles", kind: "it" },
  { key: "it_tks", label: "Instructivos Tks en Serie", categoria: "it_tks", kind: "it" },
  { key: "registros", label: "Registros", categoria: "registros", kind: "reg" },
  { key: "dist", label: "Política SIG · Distribución", categoria: null, kind: "dist" },
  { key: "help", label: "📖 Instructivo", categoria: null, kind: "help" },
];
