#!/usr/bin/env node
/**
 * Alta / actualización de usuarios reales.
 *
 *   DATABASE_URL_OWNER=... npm run user:create -- \
 *     --email alejandra@sica --nombre "Alejandra Foos" --rol editor --password "..."
 *
 * Si el email ya existe, actualiza nombre / rol / contraseña.
 * Sin --password, genera una y la imprime una única vez.
 *
 * Nota: este script usa bcryptjs desde node_modules. La imagen Docker copia el
 * node_modules completo del stage deps-prod justamente para que esto funcione
 * dentro del contenedor (el node_modules reducido de .next/standalone no lo trae).
 */
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import pg from "pg";

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

const email = (arg("email") || "").trim().toLowerCase();
const nombre = arg("nombre");
const rol = arg("rol");
let password = arg("password");

if (!email || !nombre || !rol) {
  console.error(
    'Uso: npm run user:create -- --email <email> --nombre "<nombre>" --rol <editor|lector> [--password <pass>]'
  );
  process.exit(1);
}
if (rol !== "editor" && rol !== "lector") {
  console.error("El rol debe ser 'editor' o 'lector'.");
  process.exit(1);
}

let generada = false;
if (!password) {
  password = randomBytes(9).toString("base64url");
  generada = true;
}

const connectionString = process.env.DATABASE_URL_OWNER || process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Falta DATABASE_URL_OWNER.");
  process.exit(1);
}

const client = new pg.Client({ connectionString });

async function main() {
  const hash = await bcrypt.hash(password, 12);
  await client.connect();
  const { rows } = await client.query(
    `insert into usuario (email, password_hash, nombre, rol)
     values ($1, $2, $3, $4)
     on conflict (email) do update
       set password_hash = excluded.password_hash,
           nombre        = excluded.nombre,
           rol           = excluded.rol
     returning id, email, nombre, rol, created_at`,
    [email, hash, nombre, rol]
  );
  const u = rows[0];
  console.log(`✓ ${u.email} — ${u.nombre} (${u.rol})`);
  if (generada) console.log(`  contraseña generada: ${password}   ← anotala, no se vuelve a mostrar`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => client.end());
