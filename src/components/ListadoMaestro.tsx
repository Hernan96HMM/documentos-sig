"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { signOut } from "next-auth/react";
import { useRealtime } from "@/hooks/useRealtime";
import {
  AREA_ICONO,
  ESTADO_LABEL,
  TABS,
  enriquecer,
  fmtFecha,
  type AreaSig,
  type DocumentoVista,
  type Estado,
} from "@/lib/sig";
import type { Categoria, Distribucion, Documento, Rol, Snapshot } from "@/lib/types";
import { TablaDocumentos, type Borrador } from "./TablaDocumentos";
import { DistribucionGrid, type BorradorDist } from "./Distribucion";
import { Ayuda } from "./Ayuda";
import { EstadoConexionChip, Kpi, Pastilla } from "./ui";

interface Props {
  inicial: Snapshot;
  usuario: { nombre: string; rol: Rol };
}

const AREAS_SIG: AreaSig[] = ["Calidad", "Seguridad", "Ambiente", "Compartido"];
const ESTADOS: Estado[] = ["Vigente", "Atencion", "Revisar"];

/** Convierte el borrador de la tabla (todo strings) al JSON que espera la API. */
function payloadDocumento(b: Borrador, categoria: Categoria): Record<string, unknown> {
  const comun = {
    codigo: b.codigo?.trim() ?? "",
    titulo: b.titulo?.trim() ?? "",
    version: b.version === "" ? null : b.version,
  };
  if (categoria === "registros") {
    return {
      ...comun,
      procedimiento: b.procedimiento?.trim() || null,
      vigencia: b.vigencia || null,
      archivado: b.archivado?.trim() || null,
      retencion: b.retencion?.trim() || null,
      disposicion: b.disposicion?.trim() || null,
    };
  }
  return {
    ...comun,
    ultimo_cambio: b.ultimo_cambio || null,
    ...(categoria === "proc_gen" ? { area: b.area?.trim() || null } : {}),
  };
}

export function ListadoMaestro({ inicial, usuario }: Props) {
  const {
    documentos,
    distribucion,
    sectores,
    conexion,
    avisos,
    avisar,
    descartarAviso,
    recargarSnapshot,
  } = useRealtime(inicial);

  const puedeEditar = usuario.rol === "editor";

  const [tab, setTab] = useState("proc_gen");
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<Estado | "">("");
  const [filtroAreaSig, setFiltroAreaSig] = useState<AreaSig | "">("");
  const [filtroArea, setFiltroArea] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  const tabDef = TABS.find((t) => t.key === tab)!;

  // --- datos derivados -----------------------------------------------------

  const vistas = useMemo<DocumentoVista[]>(() => {
    const hoy = new Date();
    return documentos.map((d) => enriquecer(d, hoy));
  }, [documentos]);

  const porCategoria = useMemo(() => {
    const mapa: Record<Categoria, DocumentoVista[]> = {
      proc_gen: [],
      it_moviles: [],
      it_tks: [],
      registros: [],
    };
    for (const d of vistas) mapa[d.categoria].push(d);
    return mapa;
  }, [vistas]);

  const areasProcGen = useMemo(
    () => [...new Set(porCategoria.proc_gen.map((d) => d.area).filter((a): a is string => Boolean(a)))].sort(),
    [porCategoria.proc_gen]
  );

  const kpis = useMemo(() => {
    const conSemaforo = [...porCategoria.proc_gen, ...porCategoria.it_moviles, ...porCategoria.it_tks];
    const cuenta: Record<Estado, number> = { Vigente: 0, Atencion: 0, Revisar: 0 };
    for (const d of conSemaforo) if (d.estado) cuenta[d.estado]++;
    return { total: vistas.length, conSemaforo: conSemaforo.length, ...cuenta };
  }, [porCategoria, vistas.length]);

  const filtrados = useMemo(() => {
    if (!tabDef.categoria) return [];
    const q = busqueda.trim().toLowerCase();
    let lista = porCategoria[tabDef.categoria].filter((d) => {
      if (q && !`${d.codigo} ${d.titulo} ${d.procedimiento ?? ""}`.toLowerCase().includes(q)) return false;
      if (filtroEstado && d.estado !== filtroEstado) return false;
      if (filtroAreaSig && d.areaSig !== filtroAreaSig) return false;
      if (filtroArea && d.area !== filtroArea) return false;
      return true;
    });

    if (sortKey) {
      // "Años" es una columna calculada: ordenarla es ordenar por la fecha.
      const k = sortKey === "anios" ? "ultimo_cambio" : sortKey;
      lista = [...lista].sort((a, b) => {
        const va = (a as unknown as Record<string, unknown>)[k] ?? "";
        const vb = (b as unknown as Record<string, unknown>)[k] ?? "";
        if (typeof va === "number" && typeof vb === "number") return (va - vb) * sortDir;
        return String(va).localeCompare(String(vb), "es", { numeric: true }) * sortDir;
      });
    }
    return lista;
  }, [tabDef.categoria, porCategoria, busqueda, filtroEstado, filtroAreaSig, filtroArea, sortKey, sortDir]);

  const copiasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return distribucion;
    return distribucion.filter((c) => `${c.copia} ${c.sectores.join(" ")}`.toLowerCase().includes(q));
  }, [distribucion, busqueda]);

  const resumenAreaSig = useMemo(() => {
    const cuenta: Record<AreaSig, number> = { Calidad: 0, Seguridad: 0, Ambiente: 0, Compartido: 0 };
    if (tabDef.categoria) for (const d of porCategoria[tabDef.categoria]) cuenta[d.areaSig]++;
    return cuenta;
  }, [tabDef.categoria, porCategoria]);

  // --- llamadas a la API ---------------------------------------------------

  async function pedir(url: string, init: RequestInit): Promise<Response> {
    return fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init.headers ?? {}) } });
  }

  async function guardarDocumento(id: string, b: Borrador, updatedAtVisto: string): Promise<boolean> {
    const categoria = tabDef.categoria!;
    const cuerpo = payloadDocumento(b, categoria);

    let res = await pedir(`/api/documentos/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ ...cuerpo, updated_at_visto: updatedAtVisto }),
    });

    if (res.status === 409) {
      const data = await res.json();
      const seguir = window.confirm(
        `${data.mensaje}\n\n¿Guardar igual y pisar ese cambio?\n(Cancelar deja tu edición sin aplicar para que revises primero.)`
      );
      if (!seguir) {
        await recargarSnapshot();
        return false;
      }
      res = await pedir(`/api/documentos/${id}`, { method: "PATCH", body: JSON.stringify(cuerpo) });
    }

    if (!res.ok) {
      avisar((await res.json().catch(() => ({}))).error ?? "No se pudo guardar.", "error");
      return false;
    }
    avisar("Cambio guardado", "ok");
    return true;
  }

  async function crearDocumento(b: Borrador): Promise<boolean> {
    const categoria = tabDef.categoria!;
    const res = await pedir("/api/documentos", {
      method: "POST",
      body: JSON.stringify({ ...payloadDocumento(b, categoria), categoria }),
    });
    if (!res.ok) {
      avisar((await res.json().catch(() => ({}))).error ?? "No se pudo crear.", "error");
      return false;
    }
    avisar("Documento creado", "ok");
    return true;
  }

  async function borrarDocumento(doc: Documento) {
    if (!window.confirm(`¿Eliminar «${doc.codigo} — ${doc.titulo}» del listado?`)) return;
    const res = await pedir(`/api/documentos/${doc.id}`, { method: "DELETE" });
    if (!res.ok) avisar("No se pudo eliminar.", "error");
    else avisar("Documento eliminado", "ok");
  }

  async function guardarCopia(id: string, b: BorradorDist, updatedAtVisto: string): Promise<boolean> {
    const cuerpo = {
      copia: b.copia.trim(),
      fecha_distribucion: b.fecha_distribucion || null,
      fecha_vigencia: b.fecha_vigencia || null,
      sectores: b.sectores,
    };
    let res = await pedir(`/api/distribucion/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ ...cuerpo, updated_at_visto: updatedAtVisto }),
    });
    if (res.status === 409) {
      const data = await res.json();
      if (!window.confirm(`${data.mensaje}\n\n¿Guardar igual?`)) {
        await recargarSnapshot();
        return false;
      }
      res = await pedir(`/api/distribucion/${id}`, { method: "PATCH", body: JSON.stringify(cuerpo) });
    }
    if (!res.ok) {
      avisar((await res.json().catch(() => ({}))).error ?? "No se pudo guardar.", "error");
      return false;
    }
    avisar("Copia actualizada", "ok");
    return true;
  }

  async function crearCopia(b: BorradorDist): Promise<boolean> {
    const res = await pedir("/api/distribucion", {
      method: "POST",
      body: JSON.stringify({
        copia: b.copia.trim(),
        fecha_distribucion: b.fecha_distribucion || null,
        fecha_vigencia: b.fecha_vigencia || null,
        sectores: b.sectores,
      }),
    });
    if (!res.ok) {
      avisar((await res.json().catch(() => ({}))).error ?? "No se pudo crear.", "error");
      return false;
    }
    avisar("Copia creada", "ok");
    return true;
  }

  async function borrarCopia(c: Distribucion) {
    if (!window.confirm(`¿Eliminar «${c.copia}»?`)) return;
    const res = await pedir(`/api/distribucion/${c.id}`, { method: "DELETE" });
    if (!res.ok) avisar("No se pudo eliminar.", "error");
  }

  async function crearSector(nombre: string) {
    const res = await pedir("/api/sectores", { method: "POST", body: JSON.stringify({ nombre }) });
    if (!res.ok) avisar((await res.json().catch(() => ({}))).error ?? "No se pudo crear el sector.", "error");
  }

  // --- exportación ---------------------------------------------------------

  function exportarCsv() {
    const esc = (v: unknown) => {
      const s = v === null || v === undefined ? "" : String(v);
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    let cabeceras: string[];
    let filas: unknown[][];

    if (tabDef.kind === "dist") {
      cabeceras = ["Copia", "Fecha distribución", "Fecha vigencia", "Sectores"];
      filas = copiasFiltradas.map((c) => [
        c.copia,
        fmtFecha(c.fecha_distribucion),
        fmtFecha(c.fecha_vigencia),
        c.sectores.join(" · "),
      ]);
    } else if (tabDef.categoria === "registros") {
      cabeceras = [
        "Código",
        "Título",
        "Procedimiento",
        "Versión",
        "Vigencia",
        "Archivado",
        "Retención",
        "Disposición final",
      ];
      filas = filtrados.map((d) => [
        d.codigo,
        d.titulo,
        d.procedimiento,
        d.version,
        fmtFecha(d.vigencia),
        d.archivado,
        d.retencion,
        d.disposicion,
      ]);
    } else {
      const conArea = tabDef.categoria === "proc_gen";
      cabeceras = [
        "Código",
        "Título",
        ...(conArea ? ["Área"] : []),
        "Área SIG",
        "Versión",
        "Último cambio",
        "Estado",
      ];
      filas = filtrados.map((d) => [
        d.codigo,
        d.titulo,
        ...(conArea ? [d.area] : []),
        d.areaSig,
        d.version,
        fmtFecha(d.ultimo_cambio),
        d.estado ? ESTADO_LABEL[d.estado] : "",
      ]);
    }

    // BOM para que Excel en español abra los acentos bien.
    const csv = "﻿" + [cabeceras, ...filas].map((f) => f.map(esc).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `listado-maestro-${tabDef.key}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportarPdf() {
    window.print();
  }

  // --- render --------------------------------------------------------------

  const hoy = new Date();
  const titulosFiltro = [
    busqueda && `búsqueda: ${busqueda}`,
    filtroEstado && `estado: ${ESTADO_LABEL[filtroEstado]}`,
    filtroAreaSig && `área SIG: ${filtroAreaSig}`,
    filtroArea && `área: ${filtroArea}`,
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-[1220px] px-5 pb-16 pt-7">
      {/* hero */}
      <header className="mb-6 flex flex-col justify-between gap-6 border-b border-line pb-6 md:flex-row md:items-end">
        <div>
          <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-amber">
            Sistema Integrado de Gestión — SICA
          </div>
          <h1 className="font-serif text-[34px] font-normal leading-tight text-ink">
            Listado Maestro de Documentos
          </h1>
          <p className="mt-1.5 text-[13.5px] text-ink-dim">
            Procedimientos, instructivos, registros y distribución controlada del SIG
          </p>
        </div>
        <div className="text-left font-mono text-[11px] leading-relaxed text-ink-faint md:text-right no-print">
          {hoy.toLocaleDateString("es-AR")}
          <br />
          {kpis.total} documentos · {distribucion.length} copias controladas
          <br />
          <span className="text-ink-dim">{usuario.nombre}</span> ·{" "}
          <span className={usuario.rol === "editor" ? "text-amber" : "text-ink-faint"}>{usuario.rol}</span>
        </div>
      </header>

      <div className="print-title">
        Listado Maestro de Documentos — {tabDef.label}
        {titulosFiltro.length > 0 ? ` (${titulosFiltro.join(", ")})` : ""} — {hoy.toLocaleDateString("es-AR")}
      </div>

      {/* toolbar */}
      <div className="mb-6 flex flex-wrap items-center gap-2.5 no-print">
        <EstadoConexionChip estado={conexion} />
        <span className="mx-1 h-5 w-px bg-line" />
        <button type="button" className="btn" onClick={exportarCsv}>
          ⭳ Exportar vista a CSV
        </button>
        <button type="button" className="btn" onClick={exportarPdf}>
          ⭳ Exportar vista a PDF
        </button>
        <span className="mx-1 h-5 w-px bg-line" />
        <button type="button" className="btn" onClick={() => signOut({ callbackUrl: "/login" })}>
          ⎋ Salir
        </button>
      </div>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-3.5 md:grid-cols-5 no-print">
        <Kpi num={kpis.total} label="Documentos totales" delay={0} />
        <Kpi num={kpis.conSemaforo} label="Procedimientos + instructivos" delay={0.04} />
        <Kpi num={kpis.Vigente} label="Vigentes (≤ 2 años)" tono="ok" delay={0.08} />
        <Kpi num={kpis.Atencion} label="En atención (2–4 años)" tono="warn" delay={0.12} />
        <Kpi num={kpis.Revisar} label="A revisar (> 4 años)" tono="bad" delay={0.16} />
      </div>

      {/* tabs */}
      <nav className="mb-4 flex flex-wrap gap-1 border-b border-line no-print">
        {TABS.map((t) => {
          const activo = t.key === tab;
          const cuenta =
            t.categoria !== null
              ? porCategoria[t.categoria].length
              : t.kind === "dist"
                ? distribucion.length
                : null;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setTab(t.key);
                setBusqueda("");
                setFiltroEstado("");
                setFiltroAreaSig("");
                setFiltroArea("");
                setSortKey(null);
              }}
              className={`relative px-4 py-2.5 font-mono text-xs tracking-wide transition-colors ${
                activo ? "text-amber" : "text-ink-faint hover:text-ink-dim"
              }`}
            >
              {t.label}
              {cuenta !== null && (
                <span className={`ml-1.5 ${activo ? "text-amber-dim" : "text-ink-faint"}`}>{cuenta}</span>
              )}
              {activo && (
                <motion.span
                  layoutId="tab-activo"
                  className="absolute inset-x-0 -bottom-px h-0.5 bg-amber"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* controles */}
      {tabDef.kind !== "help" && (
        <div className="no-print">
          {(tabDef.kind === "proc" || tabDef.kind === "it") && (
            <div className="mb-3 flex flex-wrap gap-3.5 font-mono text-[11.5px] text-ink-dim">
              {AREAS_SIG.map((a) => (
                <span key={a}>
                  {AREA_ICONO[a]} {a}: <b className="text-ink">{resumenAreaSig[a]}</b>
                </span>
              ))}
            </div>
          )}

          <div className="mb-4 flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[260px] flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[15px] text-ink-faint">
                ⌕
              </span>
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder={
                  tabDef.kind === "dist" ? "Buscar por copia o sector…" : "Buscar por código o título…"
                }
                className="w-full rounded-md border border-line bg-panel py-2.5 pl-8 pr-3.5 text-[13.5px] text-ink outline-none transition-colors focus:border-amber-dim"
              />
            </div>

            {tabDef.kind === "proc" && (
              <select
                value={filtroArea}
                onChange={(e) => setFiltroArea(e.target.value)}
                className="cursor-pointer rounded-md border border-line bg-panel px-3 py-2.5 text-[13px] text-ink-dim outline-none hover:border-line-lt"
              >
                <option value="">Todas las áreas</option>
                {areasProcGen.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            )}

            {(tabDef.kind === "proc" || tabDef.kind === "it") && (
              <>
                <div className="flex gap-1.5">
                  <Pastilla activa={filtroEstado === ""} onClick={() => setFiltroEstado("")}>
                    Todos
                  </Pastilla>
                  {ESTADOS.map((e) => (
                    <Pastilla
                      key={e}
                      activa={filtroEstado === e}
                      onClick={() => setFiltroEstado(e)}
                      colorActivo={e === "Vigente" ? "ok" : e === "Atencion" ? "warn" : "bad"}
                    >
                      {ESTADO_LABEL[e]}
                    </Pastilla>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Pastilla activa={filtroAreaSig === ""} onClick={() => setFiltroAreaSig("")}>
                    Todas las áreas SIG
                  </Pastilla>
                  {AREAS_SIG.map((a) => (
                    <Pastilla
                      key={a}
                      activa={filtroAreaSig === a}
                      onClick={() => setFiltroAreaSig(a)}
                      colorActivo={
                        a === "Calidad" ? "azul" : a === "Seguridad" ? "bad" : a === "Ambiente" ? "ok" : "warn"
                      }
                    >
                      {AREA_ICONO[a]} {a}
                    </Pastilla>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* contenido */}
      {tabDef.kind === "help" ? (
        <Ayuda rol={usuario.rol} />
      ) : tabDef.kind === "dist" ? (
        <DistribucionGrid
          copias={copiasFiltradas}
          sectores={sectores}
          puedeEditar={puedeEditar}
          onGuardar={guardarCopia}
          onCrear={crearCopia}
          onBorrar={borrarCopia}
          onNuevoSector={crearSector}
        />
      ) : (
        <TablaDocumentos
          docs={filtrados}
          categoria={tabDef.categoria!}
          puedeEditar={puedeEditar}
          areas={areasProcGen}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={(k) => {
            if (sortKey === k) setSortDir((d) => (d === 1 ? -1 : 1));
            else {
              setSortKey(k);
              setSortDir(1);
            }
          }}
          onGuardar={guardarDocumento}
          onCrear={crearDocumento}
          onBorrar={borrarDocumento}
        />
      )}

      {tabDef.kind !== "help" && (
        <div className="mt-4 rounded-md border border-line bg-white/[0.02] px-4 py-3.5 text-[11.5px] leading-relaxed text-ink-faint no-print">
          <b className="text-ink-dim">Criterio de estado:</b> 🟢 Vigente = última revisión hace 2 años o menos ·
          🟡 Atención = entre 2 y 4 años sin revisión · 🔴 Revisar = más de 4 años sin revisión. Aplica a
          Procedimientos Generales e Instructivos — Registros queda sin semáforo. Se recalcula en cada carga
          según la fecha de hoy.
          <br />
          <b className="text-ink-dim">Criterio de área SIG:</b> se calcula automáticamente según el prefijo del
          código — 🦺 <b className="text-ink-dim">SE</b> = Seguridad · 🌱 <b className="text-ink-dim">MA</b> =
          Medio Ambiente · 🤝 <b className="text-ink-dim">MS</b> = Compartido · ⚙️ cualquier otro prefijo =
          Calidad.
          {!puedeEditar && (
            <>
              <br />
              <b className="text-ink-dim">Tu usuario es de sólo lectura:</b> podés buscar, filtrar, ordenar y
              exportar, pero no modificar el listado.
            </>
          )}
        </div>
      )}

      {/* avisos flotantes */}
      <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2 no-print">
        <AnimatePresence>
          {avisos.map((a) => (
            <motion.button
              key={a.id}
              type="button"
              onClick={() => descartarAviso(a.id)}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.2 }}
              className={`pointer-events-auto max-w-xs rounded-md border px-4 py-2.5 text-left text-[12.5px] shadow-panel ${
                a.tono === "error"
                  ? "border-bad bg-[rgba(224,85,90,0.15)] text-ink"
                  : a.tono === "ok"
                    ? "border-ok bg-[rgba(63,184,127,0.15)] text-ink"
                    : "border-line-lt bg-panel-2 text-ink-dim"
              }`}
            >
              {a.texto}
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
