import { Client } from "pg";
import type { RealtimeEvent } from "./types";

/**
 * Bus de tiempo real.
 *
 * Flujo completo:
 *   1. Un editor guarda  → la ruta de API persiste en Postgres.
 *   2. Esa misma ruta llama a `publish()` → `NOTIFY documentos_sig, '<json>'`.
 *   3. Un cliente pg dedicado (uno por proceso Node) está en `LISTEN` y recibe
 *      la notificación.
 *   4. El listener reparte el evento a todos los suscriptores locales, que son
 *      las conexiones SSE abiertas en `/api/events`.
 *   5. Cada navegador aplica el cambio en memoria — sin recargar la página.
 *
 * Se usa NOTIFY en vez de un EventEmitter a secas para que el broadcast siga
 * funcionando si algún día la app corre con más de una réplica: todas escuchan
 * el mismo canal de Postgres.
 *
 * NOTIFY tiene un límite de 8000 bytes de payload; cuando un evento no entra,
 * se manda `{tipo:'recargar'}` y el cliente vuelve a pedir el snapshot.
 */

const CANAL = "documentos_sig";
const MAX_PAYLOAD = 7000;

type Subscriber = (event: RealtimeEvent) => void;

interface Bus {
  subscribers: Set<Subscriber>;
  listener: Client | null;
  conectando: Promise<void> | null;
}

const globalForBus = globalThis as unknown as { __sigBus?: Bus };

function bus(): Bus {
  if (!globalForBus.__sigBus) {
    globalForBus.__sigBus = { subscribers: new Set(), listener: null, conectando: null };
  }
  return globalForBus.__sigBus;
}

function fanout(raw: string) {
  let event: RealtimeEvent;
  try {
    event = JSON.parse(raw) as RealtimeEvent;
  } catch {
    console.error("[realtime] payload NOTIFY inválido, se ignora");
    return;
  }
  for (const sub of bus().subscribers) {
    try {
      sub(event);
    } catch (err) {
      console.error("[realtime] suscriptor falló:", err);
    }
  }
}

/** Abre (una sola vez por proceso) el cliente dedicado que hace LISTEN. */
async function ensureListener(): Promise<void> {
  const b = bus();
  if (b.listener) return;
  if (b.conectando) return b.conectando;

  b.conectando = (async () => {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("Falta DATABASE_URL");
    const client = new Client({ connectionString });

    client.on("notification", (msg) => {
      if (msg.channel === CANAL && msg.payload) fanout(msg.payload);
    });
    client.on("error", (err) => {
      console.error("[realtime] listener caído:", err.message);
      b.listener = null;
      b.conectando = null;
      // Reintento con backoff corto: si hay clientes SSE, se reconecta solo.
      setTimeout(() => {
        if (bus().subscribers.size > 0) ensureListener().catch(() => {});
      }, 2000);
    });

    await client.connect();
    await client.query(`listen ${CANAL}`);
    b.listener = client;
    b.conectando = null;
  })();

  return b.conectando;
}

/** Suscribe una conexión SSE. Devuelve la función para darse de baja. */
export async function subscribe(fn: Subscriber): Promise<() => void> {
  await ensureListener();
  bus().subscribers.add(fn);
  return () => {
    bus().subscribers.delete(fn);
  };
}

/** Emite un evento a todos los navegadores conectados. */
export async function publish(event: RealtimeEvent): Promise<void> {
  const { getPool } = await import("./db");
  let payload = JSON.stringify(event);
  if (payload.length > MAX_PAYLOAD) {
    payload = JSON.stringify({ tipo: "recargar", actor: event.actor, ts: event.ts });
  }
  try {
    await getPool().query("select pg_notify($1, $2)", [CANAL, payload]);
  } catch (err) {
    console.error("[realtime] no se pudo publicar el evento:", err);
  }
}

export function conexionesActivas(): number {
  return bus().subscribers.size;
}
