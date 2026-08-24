"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Distribucion, Documento, RealtimeEvent, Sector, Snapshot } from "@/lib/types";

export type EstadoConexion = "conectando" | "en-vivo" | "reconectando";

export interface Aviso {
  id: number;
  texto: string;
  tono: "info" | "ok" | "error";
}

const TIPOS: RealtimeEvent["tipo"][] = [
  "documento.upsert",
  "documento.delete",
  "distribucion.upsert",
  "distribucion.delete",
  "sector.upsert",
  "sector.delete",
  "recargar",
];

function reemplazar<T extends { id: string }>(lista: T[], item: T): T[] {
  const i = lista.findIndex((x) => x.id === item.id);
  if (i === -1) return [...lista, item];
  const copia = [...lista];
  copia[i] = item;
  return copia;
}

/**
 * Mantiene el listado sincronizado con el resto de los usuarios.
 *
 * Recibe el snapshot que ya renderizó el servidor y, a partir de ahí, abre una
 * conexión SSE contra /api/events. Cada evento se aplica en memoria: nadie
 * necesita recargar la página para ver lo que guardó otra persona.
 *
 * Si la conexión se corta (deploy, reinicio de nginx, notebook que se suspende),
 * EventSource reintenta solo y, al volver, se vuelve a pedir el snapshot
 * completo para no quedar con cambios perdidos del intervalo caído.
 */
export function useRealtime(inicial: Snapshot) {
  const [documentos, setDocumentos] = useState<Documento[]>(inicial.documentos);
  const [distribucion, setDistribucion] = useState<Distribucion[]>(inicial.distribucion);
  const [sectores, setSectores] = useState<Sector[]>(inicial.sectores);
  const [conexion, setConexion] = useState<EstadoConexion>("conectando");
  const [avisos, setAvisos] = useState<Aviso[]>([]);

  const idAviso = useRef(0);
  const huboCaida = useRef(false);

  const avisar = useCallback((texto: string, tono: Aviso["tono"] = "info") => {
    const id = ++idAviso.current;
    setAvisos((prev) => [...prev, { id, texto, tono }]);
    setTimeout(() => setAvisos((prev) => prev.filter((a) => a.id !== id)), 5000);
  }, []);

  const descartarAviso = useCallback((id: number) => {
    setAvisos((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const recargarSnapshot = useCallback(async () => {
    try {
      const res = await fetch("/api/snapshot", { cache: "no-store" });
      if (!res.ok) return;
      const snap: Snapshot = await res.json();
      setDocumentos(snap.documentos);
      setDistribucion(snap.distribucion);
      setSectores(snap.sectores);
    } catch {
      /* el reintento llega con la próxima reconexión */
    }
  }, []);

  const aplicar = useCallback(
    (ev: RealtimeEvent) => {
      switch (ev.tipo) {
        case "documento.upsert":
          setDocumentos((prev) => reemplazar(prev, ev.documento));
          avisar(`${ev.actor} guardó ${ev.documento.codigo}`);
          break;
        case "documento.delete":
          setDocumentos((prev) => prev.filter((d) => d.id !== ev.id));
          avisar(`${ev.actor} eliminó un documento`);
          break;
        case "distribucion.upsert":
          setDistribucion((prev) => reemplazar(prev, ev.distribucion));
          avisar(`${ev.actor} actualizó ${ev.distribucion.copia}`);
          break;
        case "distribucion.delete":
          setDistribucion((prev) => prev.filter((d) => d.id !== ev.id));
          avisar(`${ev.actor} eliminó una copia controlada`);
          break;
        case "sector.upsert":
          setSectores((prev) => reemplazar(prev, ev.sector));
          break;
        case "sector.delete":
          setSectores((prev) => prev.filter((s) => s.id !== ev.id));
          break;
        case "recargar":
          void recargarSnapshot();
          avisar(`${ev.actor} hizo cambios — actualizando…`);
          break;
      }
    },
    [avisar, recargarSnapshot]
  );

  useEffect(() => {
    const source = new EventSource("/api/events");

    const onOpen = () => {
      setConexion("en-vivo");
      if (huboCaida.current) {
        huboCaida.current = false;
        void recargarSnapshot();
        avisar("Conexión restablecida", "ok");
      }
    };
    const onError = () => {
      // EventSource reintenta solo con el `retry` que manda el servidor.
      huboCaida.current = true;
      setConexion("reconectando");
    };
    const onEvento = (e: MessageEvent) => {
      try {
        aplicar(JSON.parse(e.data) as RealtimeEvent);
      } catch {
        /* payload corrupto: se ignora, el próximo snapshot corrige */
      }
    };

    source.addEventListener("open", onOpen);
    source.addEventListener("error", onError);
    source.addEventListener("conectado", onOpen as EventListener);
    for (const tipo of TIPOS) source.addEventListener(tipo, onEvento as EventListener);

    return () => {
      for (const tipo of TIPOS) source.removeEventListener(tipo, onEvento as EventListener);
      source.close();
    };
  }, [aplicar, avisar, recargarSnapshot]);

  // Al volver a la pestaña después de un rato, se re-sincroniza por las dudas.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void recargarSnapshot();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [recargarSnapshot]);

  return {
    documentos,
    distribucion,
    sectores,
    conexion,
    avisos,
    avisar,
    descartarAviso,
    recargarSnapshot,
    setDocumentos,
    setDistribucion,
    setSectores,
  };
}
