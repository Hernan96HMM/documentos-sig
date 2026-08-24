import { requerirSesion } from "@/auth";
import { subscribe } from "@/lib/realtime";
import type { RealtimeEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// La conexión queda abierta indefinidamente: nada de caché ni de revalidación.
export const fetchCache = "force-no-store";

const HEARTBEAT_MS = 25_000;

/**
 * GET /api/events — canal Server-Sent Events.
 *
 * · Protegido: cualquiera de los dos roles (editor o lector) puede escuchar,
 *   pero un anónimo recibe 401. Nunca es público.
 * · Sólo emite; el cliente nunca escribe por acá (para escribir usa las rutas
 *   POST/PATCH/DELETE, que verifican rol editor).
 * · Manda un comentario `: ping` cada 25 s para que ningún proxy intermedio
 *   corte la conexión por inactividad.
 *
 * nginx necesita, SOLO para esta ruta:
 *     proxy_buffering off;
 *     proxy_cache off;
 *     add_header X-Accel-Buffering no;
 *     proxy_read_timeout 3600s;
 *     proxy_http_version 1.1;
 */
export async function GET(req: Request) {
  const sesion = await requerirSesion();
  if ("error" in sesion) return sesion.error;

  const encoder = new TextEncoder();
  let cerrado = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enviar = (texto: string) => {
        if (cerrado) return;
        try {
          controller.enqueue(encoder.encode(texto));
        } catch {
          cerrado = true;
        }
      };

      const enviarEvento = (event: RealtimeEvent) => {
        enviar(`event: ${event.tipo}\ndata: ${JSON.stringify(event)}\n\n`);
      };

      // `retry` le dice al navegador cada cuánto reintentar si se corta.
      enviar(`retry: 3000\n\n`);
      enviar(`event: conectado\ndata: ${JSON.stringify({ ts: new Date().toISOString() })}\n\n`);

      const desuscribir = await subscribe(enviarEvento);
      const heartbeat = setInterval(() => enviar(`: ping ${Date.now()}\n\n`), HEARTBEAT_MS);

      const limpiar = () => {
        if (cerrado) return;
        cerrado = true;
        clearInterval(heartbeat);
        desuscribir();
        try {
          controller.close();
        } catch {}
      };

      req.signal.addEventListener("abort", limpiar);
    },
    cancel() {
      cerrado = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Redundante con la config de nginx, pero sirve como cinturón y tiradores.
      "X-Accel-Buffering": "no",
    },
  });
}
