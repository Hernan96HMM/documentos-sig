"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Distribucion as Dist, Sector } from "@/lib/types";
import { fmtCuando, fmtFecha } from "@/lib/sig";

export interface BorradorDist {
  copia: string;
  fecha_distribucion: string;
  fecha_vigencia: string;
  sectores: string[];
}

interface Props {
  copias: Dist[];
  sectores: Sector[];
  puedeEditar: boolean;
  onGuardar: (id: string, cambios: BorradorDist, updatedAtVisto: string) => Promise<boolean>;
  onCrear: (cambios: BorradorDist) => Promise<boolean>;
  onBorrar: (copia: Dist) => Promise<void>;
  onNuevoSector: (nombre: string) => Promise<void>;
}

const vacio = (): BorradorDist => ({ copia: "", fecha_distribucion: "", fecha_vigencia: "", sectores: [] });

function desde(d: Dist): BorradorDist {
  return {
    copia: d.copia,
    fecha_distribucion: d.fecha_distribucion ?? "",
    fecha_vigencia: d.fecha_vigencia ?? "",
    sectores: [...d.sectores],
  };
}

export function DistribucionGrid({
  copias,
  sectores,
  puedeEditar,
  onGuardar,
  onCrear,
  onBorrar,
  onNuevoSector,
}: Props) {
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const [borrador, setBorrador] = useState<BorradorDist>(vacio());
  const [ocupado, setOcupado] = useState(false);
  const [nuevoSector, setNuevoSector] = useState("");

  const cerrar = () => {
    setEditandoId(null);
    setCreando(false);
    setBorrador(vacio());
  };

  const toggleSector = (nombre: string) => {
    setBorrador((b) => ({
      ...b,
      sectores: b.sectores.includes(nombre)
        ? b.sectores.filter((s) => s !== nombre)
        : [...b.sectores, nombre],
    }));
  };

  const editor = (onAceptar: () => void) => (
    <div className="rounded-lg border border-line-lt bg-gradient-to-b from-panel to-panel-2 p-4">
      <input
        className="field mb-2 font-mono"
        placeholder="COPIA Nº …"
        value={borrador.copia}
        onChange={(e) => setBorrador((b) => ({ ...b, copia: e.target.value }))}
      />
      <div className="mb-3 grid grid-cols-2 gap-2">
        <label className="text-[11px] text-ink-faint">
          Distribución
          <input
            className="field mt-1"
            type="date"
            value={borrador.fecha_distribucion}
            onChange={(e) => setBorrador((b) => ({ ...b, fecha_distribucion: e.target.value }))}
          />
        </label>
        <label className="text-[11px] text-ink-faint">
          Vigencia
          <input
            className="field mt-1"
            type="date"
            value={borrador.fecha_vigencia}
            onChange={(e) => setBorrador((b) => ({ ...b, fecha_vigencia: e.target.value }))}
          />
        </label>
      </div>

      <div className="mb-2 font-mono text-[10.5px] uppercase tracking-wider text-ink-faint">Sectores</div>
      <div className="mb-3 max-h-44 overflow-y-auto rounded border border-line bg-bg-0 p-2">
        {sectores.map((s) => (
          <label key={s.id} className="flex cursor-pointer items-center gap-2 py-0.5 text-[12.5px] text-ink-dim">
            <input
              type="checkbox"
              className="accent-[var(--amber)]"
              checked={borrador.sectores.includes(s.nombre)}
              onChange={() => toggleSector(s.nombre)}
            />
            {s.nombre}
          </label>
        ))}
        {sectores.length === 0 && <div className="py-2 text-[12px] text-ink-faint">Sin sectores cargados.</div>}
      </div>

      <div className="flex gap-2">
        <button type="button" className="btn border-ok text-ok" disabled={ocupado} onClick={onAceptar}>
          {ocupado ? "Guardando…" : "💾 Guardar"}
        </button>
        <button type="button" className="btn" onClick={cerrar}>
          ✕ Cancelar
        </button>
      </div>
    </div>
  );

  return (
    <>
      {puedeEditar && (
        <div className="mb-4 flex flex-wrap items-center gap-2 no-print">
          <button
            type="button"
            className="btn"
            disabled={creando}
            onClick={() => {
              setEditandoId(null);
              setCreando(true);
              setBorrador(vacio());
            }}
          >
            + Nueva copia controlada
          </button>
          <span className="mx-1 h-5 w-px bg-line" />
          <input
            className="field w-auto min-w-[200px]"
            placeholder="Nuevo sector…"
            value={nuevoSector}
            onChange={(e) => setNuevoSector(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === "Enter" && nuevoSector.trim()) {
                await onNuevoSector(nuevoSector.trim());
                setNuevoSector("");
              }
            }}
          />
          <button
            type="button"
            className="btn"
            disabled={!nuevoSector.trim()}
            onClick={async () => {
              await onNuevoSector(nuevoSector.trim());
              setNuevoSector("");
            }}
          >
            + Sector
          </button>
        </div>
      )}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
        <AnimatePresence initial={false}>
          {creando && (
            <motion.div key="nueva" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              {editor(async () => {
                setOcupado(true);
                const ok = await onCrear(borrador);
                setOcupado(false);
                if (ok) cerrar();
              })}
            </motion.div>
          )}

          {copias.map((c) => (
            <motion.div
              key={c.id}
              layout="position"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              {editandoId === c.id ? (
                editor(async () => {
                  setOcupado(true);
                  const ok = await onGuardar(c.id, borrador, c.updated_at);
                  setOcupado(false);
                  if (ok) cerrar();
                })
              ) : (
                <div className="h-full rounded-lg border border-line bg-panel p-4 transition-colors hover:border-line-lt panel-print-reset">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-mono text-[13px] font-bold text-amber">{c.copia}</div>
                    {puedeEditar && (
                      <div className="flex gap-1.5 no-print">
                        <button
                          type="button"
                          className="btn px-2 py-1"
                          title="Editar"
                          onClick={() => {
                            setCreando(false);
                            setEditandoId(c.id);
                            setBorrador(desde(c));
                          }}
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger px-2 py-1"
                          title="Eliminar"
                          onClick={() => onBorrar(c)}
                        >
                          🗑
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="mb-2 mt-1 text-[11px] text-ink-faint">
                    Distribución: {fmtFecha(c.fecha_distribucion)} · Vigencia: {fmtFecha(c.fecha_vigencia)}
                  </div>
                  <div className="text-[12.5px] leading-relaxed text-ink-dim">
                    {c.sectores.length > 0 ? (
                      c.sectores.join(", ")
                    ) : (
                      <span className="text-ink-faint">Sin sector asignado</span>
                    )}
                  </div>
                  {c.updated_by_nombre && (
                    <div className="mt-3 border-t border-line/60 pt-2 font-mono text-[10px] text-ink-faint no-print">
                      {c.updated_by_nombre} · {fmtCuando(c.updated_at)}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {copias.length === 0 && !creando && (
        <div className="px-5 py-16 text-center text-[13.5px] text-ink-faint">Sin resultados.</div>
      )}

      {puedeEditar && sectores.length > 0 && (
        <div className="mt-6 rounded-md border border-line bg-white/[0.02] p-4 no-print">
          <div className="mb-2 font-mono text-[10.5px] uppercase tracking-wider text-ink-faint">
            Sectores disponibles ({sectores.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {sectores.map((s) => (
              <span
                key={s.id}
                className="flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1 font-mono text-[11.5px] text-ink-dim"
              >
                {s.nombre}
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
