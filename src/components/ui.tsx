"use client";

import { motion } from "framer-motion";
import { AREA_ICONO, AREA_LABEL, ESTADO_LABEL, SEMAFORO, type AreaSig, type Estado } from "@/lib/sig";

const ESTADO_CLASES: Record<Estado, string> = {
  Vigente: "bg-[rgba(63,184,127,0.12)] text-ok",
  Atencion: "bg-[rgba(224,176,48,0.12)] text-warn",
  Revisar: "bg-[rgba(224,85,90,0.12)] text-bad",
};

const AREA_CLASES: Record<AreaSig, string> = {
  Calidad: "bg-[rgba(63,120,184,0.14)] text-[#7fb0e8]",
  Seguridad: "bg-[rgba(224,85,90,0.14)] text-[#f0888c]",
  Ambiente: "bg-[rgba(63,184,127,0.14)] text-ok",
  Compartido: "bg-[rgba(224,176,48,0.14)] text-warn",
};

export function BadgeEstado({ estado }: { estado: Estado | null }) {
  if (!estado) return <span className="badge bg-white/5 text-ink-faint">—</span>;
  return (
    <span className={`badge ${ESTADO_CLASES[estado]}`}>
      {SEMAFORO[estado]} {ESTADO_LABEL[estado]}
    </span>
  );
}

export function BadgeArea({ area }: { area: AreaSig }) {
  return (
    <span className={`badge ${AREA_CLASES[area]}`}>
      {AREA_ICONO[area]} {AREA_LABEL[area]}
    </span>
  );
}

export function BadgeDisposicion({ texto, clase }: { texto: string | null; clase: Estado | null }) {
  if (!texto) return <span className="text-ink-faint">—</span>;
  if (!clase) return <span>{texto}</span>;
  return <span className={`badge ${ESTADO_CLASES[clase]}`}>{texto}</span>;
}

export function Kpi({
  num,
  label,
  tono = "neutro",
  delay = 0,
}: {
  num: number;
  label: string;
  tono?: "neutro" | "ok" | "warn" | "bad";
  delay?: number;
}) {
  const borde = {
    neutro: "border-l-amber-dim hover:border-l-amber",
    ok: "border-l-ok",
    warn: "border-l-warn",
    bad: "border-l-bad",
  }[tono];
  const color = { neutro: "text-ink", ok: "text-ok", warn: "text-warn", bad: "text-bad" }[tono];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: "easeOut" }}
      whileHover={{ y: -2 }}
      className={`rounded-md border border-line border-l-[3px] ${borde} bg-gradient-to-b from-panel to-panel-2 px-4 pb-3.5 pt-4 transition-colors panel-print-reset`}
    >
      <div className={`font-serif text-3xl leading-none ${color}`}>{num}</div>
      <div className="mt-1.5 text-[11.5px] text-ink-dim">{label}</div>
    </motion.div>
  );
}

export function Pastilla({
  activa,
  onClick,
  children,
  colorActivo = "amber",
}: {
  activa: boolean;
  onClick: () => void;
  children: React.ReactNode;
  colorActivo?: "amber" | "ok" | "warn" | "bad" | "azul";
}) {
  const activo = {
    amber: "bg-amber border-amber text-[#0b1220]",
    ok: "bg-ok border-ok text-[#0b1220]",
    warn: "bg-warn border-warn text-[#0b1220]",
    bad: "bg-bad border-bad text-[#0b1220]",
    azul: "bg-[#7fb0e8] border-[#7fb0e8] text-[#0b1220]",
  }[colorActivo];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap rounded-full border px-3 py-2 font-mono text-[11.5px] transition-all duration-150 ${
        activa ? `${activo} font-semibold` : "border-line bg-panel text-ink-faint hover:border-line-lt hover:text-ink-dim"
      }`}
    >
      {children}
    </button>
  );
}

export function EstadoConexionChip({ estado }: { estado: "conectando" | "en-vivo" | "reconectando" }) {
  const cfg = {
    conectando: { color: "bg-ink-faint", texto: "Conectando…", pulso: true },
    "en-vivo": { color: "bg-ok", texto: "En vivo", pulso: false },
    reconectando: { color: "bg-warn", texto: "Reconectando…", pulso: true },
  }[estado];

  return (
    <span
      className="flex items-center gap-2 font-mono text-[11.5px] text-ink-faint"
      title="Los cambios de otros usuarios aparecen solos, sin recargar la página."
    >
      <span className={`h-[7px] w-[7px] rounded-full ${cfg.color} ${cfg.pulso ? "animate-pulse" : ""}`} />
      {cfg.texto}
    </span>
  );
}
