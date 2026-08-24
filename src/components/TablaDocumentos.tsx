"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Categoria, Documento } from "@/lib/types";
import { claseDisposicion, fmtAnios, fmtCuando, fmtFecha, type DocumentoVista } from "@/lib/sig";
import { BadgeArea, BadgeDisposicion, BadgeEstado } from "./ui";

export type Borrador = Record<string, string>;

interface Props {
  docs: DocumentoVista[];
  categoria: Categoria;
  puedeEditar: boolean;
  areas: string[];
  sortKey: string | null;
  sortDir: 1 | -1;
  onSort: (key: string) => void;
  onGuardar: (id: string, cambios: Borrador, updatedAtVisto: string) => Promise<boolean>;
  onCrear: (cambios: Borrador) => Promise<boolean>;
  onBorrar: (doc: Documento) => Promise<void>;
}

interface Columna {
  key: string;
  label: string;
  centrado?: boolean;
  ancho?: string;
  ver: (d: DocumentoVista) => React.ReactNode;
  /** Ausente = la columna es calculada y no se edita. */
  campo?: string;
  tipo?: "text" | "date" | "number" | "area";
}

const COL_CODIGO: Columna = {
  key: "codigo",
  label: "Código",
  campo: "codigo",
  ver: (d) => <span className="font-mono text-[12.5px] text-ink">{d.codigo}</span>,
};

const COL_TITULO: Columna = {
  key: "titulo",
  label: "Título",
  campo: "titulo",
  ancho: "max-w-[420px]",
  ver: (d) => <span className="text-ink">{d.titulo}</span>,
};

const COL_VERSION: Columna = {
  key: "version",
  label: "Versión",
  centrado: true,
  campo: "version",
  tipo: "number",
  ver: (d) => <>{d.version ?? "—"}</>,
};

const COL_AREA_SIG: Columna = {
  key: "areaSig",
  label: "Área SIG",
  centrado: true,
  ver: (d) => <BadgeArea area={d.areaSig} />,
};

const COL_ESTADO: Columna = {
  key: "estado",
  label: "Estado",
  centrado: true,
  ver: (d) => <BadgeEstado estado={d.estado} />,
};

function columnas(categoria: Categoria): Columna[] {
  if (categoria === "registros") {
    return [
      COL_CODIGO,
      COL_TITULO,
      {
        key: "procedimiento",
        label: "Procedimiento",
        campo: "procedimiento",
        ver: (d) => <span className="font-mono text-[12.5px] text-ink">{d.procedimiento ?? "—"}</span>,
      },
      COL_VERSION,
      { key: "vigencia", label: "Vigencia", campo: "vigencia", tipo: "date", ver: (d) => <>{fmtFecha(d.vigencia)}</> },
      { key: "archivado", label: "Archivado", campo: "archivado", ver: (d) => <>{d.archivado ?? "—"}</> },
      { key: "retencion", label: "Retención", campo: "retencion", ver: (d) => <>{d.retencion ?? "—"}</> },
      {
        key: "disposicion",
        label: "Disposición final",
        campo: "disposicion",
        ver: (d) => <BadgeDisposicion texto={d.disposicion} clase={claseDisposicion(d.disposicion)} />,
      },
    ];
  }

  const base: Columna[] = [COL_CODIGO, COL_TITULO];
  if (categoria === "proc_gen") {
    base.push({ key: "area", label: "Área", campo: "area", tipo: "area", ver: (d) => <>{d.area ?? "—"}</> });
  }
  base.push(
    COL_AREA_SIG,
    COL_VERSION,
    {
      key: "ultimo_cambio",
      label: "Último cambio",
      campo: "ultimo_cambio",
      tipo: "date",
      ver: (d) => <>{fmtFecha(d.ultimo_cambio)}</>,
    },
    { key: "anios", label: "Años", centrado: true, ver: (d) => <>{fmtAnios(d.ultimo_cambio)}</> },
    COL_ESTADO
  );
  return base;
}

function borradorDe(doc: Documento): Borrador {
  return {
    codigo: doc.codigo ?? "",
    titulo: doc.titulo ?? "",
    procedimiento: doc.procedimiento ?? "",
    version: doc.version === null ? "" : String(doc.version),
    ultimo_cambio: doc.ultimo_cambio ?? "",
    vigencia: doc.vigencia ?? "",
    area: doc.area ?? "",
    archivado: doc.archivado ?? "",
    retencion: doc.retencion ?? "",
    disposicion: doc.disposicion ?? "",
  };
}

function borradorNuevo(categoria: Categoria, areaPorDefecto: string): Borrador {
  const hoy = new Date().toISOString().slice(0, 10);
  return {
    codigo: "",
    titulo: "",
    procedimiento: "",
    version: "1",
    ultimo_cambio: categoria === "registros" ? "" : hoy,
    vigencia: categoria === "registros" ? hoy : "",
    area: categoria === "proc_gen" ? areaPorDefecto : "",
    archivado: "",
    retencion: "",
    disposicion: "",
  };
}

export function TablaDocumentos({
  docs,
  categoria,
  puedeEditar,
  areas,
  sortKey,
  sortDir,
  onSort,
  onGuardar,
  onCrear,
  onBorrar,
}: Props) {
  const cols = columnas(categoria);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const [borrador, setBorrador] = useState<Borrador>({});
  const [ocupado, setOcupado] = useState(false);

  const totalCols = cols.length + (puedeEditar ? 1 : 0);

  const abrirEdicion = (doc: Documento) => {
    setCreando(false);
    setEditandoId(doc.id);
    setBorrador(borradorDe(doc));
  };

  const abrirAlta = () => {
    setEditandoId(null);
    setCreando(true);
    setBorrador(borradorNuevo(categoria, areas[0] ?? ""));
  };

  const cerrar = () => {
    setEditandoId(null);
    setCreando(false);
    setBorrador({});
  };

  const guardar = async (doc: DocumentoVista) => {
    setOcupado(true);
    const ok = await onGuardar(doc.id, borrador, doc.updated_at);
    setOcupado(false);
    if (ok) cerrar();
  };

  const crear = async () => {
    setOcupado(true);
    const ok = await onCrear(borrador);
    setOcupado(false);
    if (ok) cerrar();
  };

  const celdaEditor = (col: Columna) => {
    if (!col.campo) {
      return <span className="font-mono text-[11px] text-ink-faint">auto</span>;
    }
    const valor = borrador[col.campo] ?? "";
    const set = (v: string) => setBorrador((b) => ({ ...b, [col.campo!]: v }));

    if (col.tipo === "area") {
      return (
        <input
          className="field"
          list="lista-areas"
          value={valor}
          onChange={(e) => set(e.target.value)}
          placeholder="Área"
        />
      );
    }
    return (
      <input
        className={`field ${col.key === "codigo" || col.key === "procedimiento" ? "font-mono" : ""}`}
        type={col.tipo === "date" ? "date" : col.tipo === "number" ? "number" : "text"}
        value={valor}
        onChange={(e) => set(e.target.value)}
        placeholder={col.label}
      />
    );
  };

  const filaEditor = (key: string, onAceptar: () => void) => (
    <motion.tr
      key={key}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="border-b border-line/50 bg-[rgba(240,160,48,0.06)]"
    >
      {cols.map((col) => (
        <td key={col.key} className={`px-3.5 py-2 align-top ${col.centrado ? "text-center" : ""}`}>
          {celdaEditor(col)}
        </td>
      ))}
      <td className="whitespace-nowrap px-3.5 py-2 align-top">
        <div className="flex gap-1.5">
          <button
            type="button"
            className="btn border-ok text-ok px-2 py-1"
            disabled={ocupado}
            onClick={onAceptar}
            title="Guardar"
          >
            {ocupado ? "…" : "💾"}
          </button>
          <button type="button" className="btn px-2 py-1" onClick={cerrar} title="Cancelar">
            ✕
          </button>
        </div>
      </td>
    </motion.tr>
  );

  return (
    <>
      <datalist id="lista-areas">
        {areas.map((a) => (
          <option key={a} value={a} />
        ))}
      </datalist>

      {puedeEditar && (
        <div className="mb-3 no-print">
          <button type="button" className="btn" onClick={abrirAlta} disabled={creando}>
            + Nuevo {categoria === "registros" ? "registro" : "documento"}
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-line bg-panel panel-print-reset">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              {cols.map((col) => {
                const activa = sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    onClick={() => onSort(col.key)}
                    className={`cursor-pointer select-none whitespace-nowrap border-b border-line px-3.5 py-3 text-left font-mono text-[10.5px] font-medium uppercase tracking-wider transition-colors ${
                      activa ? "text-amber" : "text-ink-faint hover:text-amber-dim"
                    }`}
                  >
                    {col.label} {activa ? (sortDir === 1 ? "↑" : "↓") : ""}
                  </th>
                );
              })}
              {puedeEditar && <th className="border-b border-line no-print" />}
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {creando && filaEditor("nuevo", crear)}

              {docs.map((doc) =>
                editandoId === doc.id ? (
                  filaEditor(doc.id, () => guardar(doc))
                ) : (
                  <motion.tr
                    key={doc.id}
                    layout="position"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="border-b border-line/50 transition-colors last:border-b-0 hover:bg-[rgba(240,160,48,0.045)]"
                    title={
                      doc.updated_by_nombre
                        ? `Última edición: ${doc.updated_by_nombre} · ${fmtCuando(doc.updated_at)}`
                        : undefined
                    }
                  >
                    {cols.map((col) => (
                      <td
                        key={col.key}
                        className={`px-3.5 py-2.5 align-top text-ink-dim ${col.centrado ? "text-center" : ""} ${
                          col.ancho ?? ""
                        }`}
                      >
                        {col.ver(doc)}
                      </td>
                    ))}
                    {puedeEditar && (
                      <td className="whitespace-nowrap px-3.5 py-2.5 align-top no-print">
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            className="btn px-2 py-1"
                            onClick={() => abrirEdicion(doc)}
                            title="Editar"
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger px-2 py-1"
                            onClick={() => onBorrar(doc)}
                            title="Eliminar"
                          >
                            🗑
                          </button>
                        </div>
                      </td>
                    )}
                  </motion.tr>
                )
              )}
            </AnimatePresence>

            {docs.length === 0 && !creando && (
              <tr>
                <td colSpan={totalCols}>
                  <div className="px-5 py-16 text-center text-[13.5px] text-ink-faint">
                    Sin resultados para el filtro aplicado.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
