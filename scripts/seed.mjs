#!/usr/bin/env node
/**
 * Carga inicial de datos desde db/seed-data.json — el volcado exacto del
 * objeto DATA que vivía embebido en el HTML autocontenido original.
 *
 * Es idempotente por diseño: sólo inserta si la tabla destino está vacía.
 * Con --force borra y recarga (útil sólo antes de que la app esté en uso real).
 *
 *   DATABASE_URL_OWNER=... npm run db:seed
 *   DATABASE_URL_OWNER=... npm run db:seed -- --force
 */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const HERE = dirname(fileURLToPath(import.meta.url));
const SEED_FILE = join(HERE, "..", "db", "seed-data.json");
const FORCE = process.argv.includes("--force");

const connectionString = process.env.DATABASE_URL_OWNER || process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Falta DATABASE_URL_OWNER.");
  process.exit(1);
}

/** Normaliza fechas: el HTML traía "" y null indistintamente. */
const date = (v) => (v ? String(v) : null);
/** Versiones: casi todas enteras, alguna vacía. */
const int = (v) => (v === null || v === undefined || v === "" ? null : Number.parseInt(String(v), 10));
/** Texto libre: se preserva tal cual (incluye códigos con espacios y barras). */
const text = (v) => (v === null || v === undefined ? null : String(v));

const client = new pg.Client({ connectionString });

async function isEmpty(table) {
  const { rows } = await client.query(`select count(*)::int as n from ${table}`);
  return rows[0].n === 0;
}

async function main() {
  const data = JSON.parse(await readFile(SEED_FILE, "utf8"));
  await client.connect();
  await client.query("begin");

  if (FORCE) {
    console.log("--force: vaciando documento, politica_distribucion y politica_sector…");
    await client.query("truncate documento, politica_distribucion, politica_sector");
  }

  // --- documento -----------------------------------------------------------
  if (FORCE || (await isEmpty("documento"))) {
    const categorias = [
      ["proc_gen", data.proc_gen],
      ["it_moviles", data.it_moviles],
      ["it_tks", data.it_tks],
      ["registros", data.registros],
    ];
    let total = 0;
    for (const [categoria, items] of categorias) {
      for (let i = 0; i < items.length; i++) {
        const x = items[i];
        const esRegistro = categoria === "registros";
        await client.query(
          `insert into documento
             (categoria, codigo, titulo, procedimiento, version,
              ultimo_cambio, vigencia, area, archivado, retencion, disposicion, orden)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [
            categoria,
            text(x.codigo) ?? "",
            text(x.titulo) ?? "",
            esRegistro ? text(x.procedimiento) : null,
            int(x.version),
            esRegistro ? null : date(x.ultimo_cambio),
            esRegistro ? date(x.vigencia) : null,
            categoria === "proc_gen" ? text(x.area) : null,
            esRegistro ? text(x.archivado) : null,
            esRegistro ? text(x.retencion) : null,
            esRegistro ? text(x.disposicion) : null,
            i,
          ]
        );
        total++;
      }
      console.log(`  ${categoria.padEnd(11)} → ${items.length}`);
    }
    console.log(`documento: ${total} filas insertadas.`);
  } else {
    console.log("documento: ya tiene datos, se saltea (usá --force para recargar).");
  }

  // --- politica_sector -----------------------------------------------------
  if (FORCE || (await isEmpty("politica_sector"))) {
    for (let i = 0; i < data.politica_sectores.length; i++) {
      await client.query(
        `insert into politica_sector (nombre, orden) values ($1, $2)
         on conflict (nombre) do nothing`,
        [String(data.politica_sectores[i]), i]
      );
    }
    console.log(`politica_sector: ${data.politica_sectores.length} filas insertadas.`);
  } else {
    console.log("politica_sector: ya tiene datos, se saltea.");
  }

  // --- politica_distribucion ----------------------------------------------
  if (FORCE || (await isEmpty("politica_distribucion"))) {
    for (let i = 0; i < data.politica_dist.length; i++) {
      const x = data.politica_dist[i];
      await client.query(
        `insert into politica_distribucion (copia, fecha_distribucion, fecha_vigencia, sectores, orden)
         values ($1,$2,$3,$4,$5)`,
        [
          text(x.copia) ?? "",
          date(x.fecha_distribucion),
          date(x.fecha_vigencia),
          Array.isArray(x.sectores) ? x.sectores.map(String) : [],
          i,
        ]
      );
    }
    console.log(`politica_distribucion: ${data.politica_dist.length} filas insertadas.`);
  } else {
    console.log("politica_distribucion: ya tiene datos, se saltea.");
  }

  await client.query("commit");
  console.log("\nSeed completo.");
}

main()
  .catch(async (err) => {
    try {
      await client.query("rollback");
    } catch {}
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => client.end());
