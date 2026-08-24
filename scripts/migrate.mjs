#!/usr/bin/env node
/**
 * Runner de migraciones en `pg` puro — sin drizzle-kit ni generadores de ORM.
 *
 * Aplica en orden alfabético los archivos db/migrations/*.sql que todavía no
 * figuren en la tabla schema_migrations. Cada archivo corre dentro de su propia
 * transacción: si falla, no queda aplicado a medias.
 *
 * Uso:
 *   DATABASE_URL_OWNER=postgres://owner:...@host:5432/documentos_sig npm run db:migrate
 *
 * En producción:
 *   docker exec -e DATABASE_URL_OWNER=... documentos-sig-app npm run db:migrate
 */
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(HERE, "..", "db", "migrations");

const connectionString = process.env.DATABASE_URL_OWNER || process.env.DATABASE_URL;
if (!connectionString) {
  console.error(
    "Falta DATABASE_URL_OWNER (rol owner de Postgres). Las migraciones nunca corren con el rol de runtime."
  );
  process.exit(1);
}
if (!process.env.DATABASE_URL_OWNER) {
  console.warn("⚠️  DATABASE_URL_OWNER no está definida: se usa DATABASE_URL. Verificá que ese rol pueda hacer DDL.");
}

const client = new pg.Client({ connectionString });

async function main() {
  await client.connect();

  await client.query(`
    create table if not exists schema_migrations (
      version     text primary key,
      applied_at  timestamptz not null default now()
    )
  `);

  const { rows } = await client.query("select version from schema_migrations");
  const applied = new Set(rows.map((r) => r.version));

  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`· ${file} — ya aplicada`);
      continue;
    }
    const sql = await readFile(join(MIGRATIONS_DIR, file), "utf8");
    process.stdout.write(`→ ${file} … `);
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("insert into schema_migrations (version) values ($1)", [file]);
      await client.query("commit");
      console.log("ok");
      count++;
    } catch (err) {
      await client.query("rollback");
      console.log("FALLÓ");
      console.error(err);
      process.exitCode = 1;
      return;
    }
  }

  console.log(count === 0 ? "\nSin migraciones pendientes." : `\n${count} migración(es) aplicada(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => client.end());
