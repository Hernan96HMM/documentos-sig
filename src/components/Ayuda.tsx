"use client";

import type { Rol } from "@/lib/types";

/**
 * Instructivo de uso. Reemplaza al del HTML autocontenido: ya no hay archivo
 * vinculado, ni copias de respaldo manuales, ni caché por navegador.
 */
export function Ayuda({ rol }: { rol: Rol }) {
  return (
    <div className="mx-auto max-w-[840px] px-1 pb-8 pt-1">
      <Seccion titulo="¿Qué es esta app?">
        <p>
          Es el <b>Listado Maestro de Documentos del SIG</b> (Procedimientos, Instructivos, Registros y
          Política de Distribución) de SICA. Antes vivía como un único archivo <code>.html</code> en una
          carpeta de red, donde cada persona tenía su propia copia local. Ahora es una app con base de datos
          central: <b>hay una sola versión de la verdad</b> y todos ven lo mismo.
        </p>
      </Seccion>

      <Seccion titulo="Los cambios se ven solos, sin recargar">
        <Callout tono="ok">
          Cuando alguien guarda un cambio, el resto lo ve aparecer <b>en el acto</b>, sin apretar F5 ni volver
          a entrar. El indicador <b>«En vivo»</b> arriba a la derecha muestra que tu pantalla está conectada.
          Si dice <b>«Reconectando…»</b> (por ejemplo, si se cortó la red un momento), se reconecta solo y
          vuelve a sincronizar todo apenas puede.
        </Callout>
      </Seccion>

      <Seccion titulo="Quién puede modificar">
        <table className="my-2 w-full border-collapse text-[13px]">
          <tbody>
            <Fila
              titulo="Editor"
              texto="Puede crear, modificar y eliminar cualquier documento, registro o copia controlada, en cualquier categoría."
            />
            <Fila
              titulo="Lector"
              texto="Sólo lectura. Puede buscar, filtrar, ordenar, exportar a CSV e imprimir a PDF sin restricciones — pero no ve botones de edición, y el servidor rechaza cualquier intento de escritura."
            />
          </tbody>
        </table>
        <p>
          Tu usuario es <b>{rol === "editor" ? "editor" : "lector"}</b>.
        </p>
      </Seccion>

      <Seccion titulo="Si dos personas editan lo mismo a la vez">
        <p>
          Es raro con este tamaño de equipo, pero está contemplado. Si guardás una fila que otra persona
          modificó <b>después</b> de que la abriste en pantalla, la app te avisa quién la tocó y te pregunta si
          querés continuar igual o cancelar para revisar primero. Si continuás, tu versión es la que queda.
        </p>
      </Seccion>

      <Seccion titulo="Criterios del listado">
        <p>
          <b>Estado (semáforo):</b> 🟢 Vigente = última revisión hace 2 años o menos · 🟡 Atención = entre 2 y 4
          años · 🔴 Revisar = más de 4 años sin revisión. Aplica a Procedimientos Generales e Instructivos;
          Registros no lleva semáforo. Se recalcula solo con la fecha de hoy, no hay que actualizar nada a mano.
        </p>
        <p>
          <b>Área SIG:</b> se deduce del prefijo del código — 🦺 <b>SE</b> = Seguridad · 🌱 <b>MA</b> = Medio
          Ambiente · 🤝 <b>MS</b> = Compartido (Seguridad + Ambiente) · ⚙️ cualquier otro prefijo = Calidad. Se
          puede filtrar y exportar cada listado por separado con las pastillas de «Área SIG».
        </p>
      </Seccion>

      <Seccion titulo="Exportar e imprimir">
        <p>
          <b>⭳ CSV</b> baja exactamente lo que estás viendo (con los filtros y el orden aplicados), listo para
          abrir en Excel. <b>⭳ PDF</b> abre el diálogo de impresión del navegador con la vista preparada para
          papel — elegí «Guardar como PDF» como destino.
        </p>
      </Seccion>

      <Seccion titulo="Qué cambió respecto del archivo HTML anterior">
        <ul className="my-3 flex list-none flex-col gap-2.5 p-0">
          {[
            "Ya no hay que «vincular» el archivo del servidor ni descargar copias de respaldo: los datos viven en una base de datos con backup del servidor.",
            "Ya no hay caché por navegador que pueda dejarte viendo una versión vieja.",
            "Ya no hay una contraseña compartida para editar: cada persona entra con su propio usuario y su rol.",
            "Los cambios de los demás aparecen en tu pantalla al instante, sin recargar.",
          ].map((t) => (
            <li
              key={t}
              className="rounded-md border border-line border-l-[3px] border-l-amber-dim bg-panel px-4 py-3 text-[13.5px] leading-relaxed text-ink-dim"
            >
              {t}
            </li>
          ))}
        </ul>
      </Seccion>
    </div>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 mt-8 border-b border-line pb-2 font-serif text-xl font-normal text-amber first:mt-0">
        {titulo}
      </h2>
      <div className="[&_b]:text-ink [&_code]:rounded [&_code]:bg-white/[0.06] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12.5px] [&_code]:text-amber [&_p]:my-2 [&_p]:text-[13.5px] [&_p]:leading-relaxed [&_p]:text-ink-dim">
        {children}
      </div>
    </section>
  );
}

function Callout({ tono, children }: { tono: "ok" | "warn" | "info"; children: React.ReactNode }) {
  const clases = {
    ok: "bg-[rgba(63,184,127,0.12)] border-ok text-ink",
    warn: "bg-[rgba(224,176,48,0.12)] border-warn text-ink",
    info: "bg-white/[0.03] border-line-lt text-ink-dim",
  }[tono];
  return (
    <div className={`my-3.5 rounded-md border px-4 py-3.5 text-[13px] leading-relaxed ${clases}`}>{children}</div>
  );
}

function Fila({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <tr className="border-b border-line/50">
      <td className="whitespace-nowrap px-3 py-2.5 align-top font-mono text-[12.5px] text-ink">{titulo}</td>
      <td className="px-3 py-2.5 align-top text-ink-dim">{texto}</td>
    </tr>
  );
}
