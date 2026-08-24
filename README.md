# documentos-sig — Listado Maestro de Documentos SIG

App del stack `sicalab` que reemplaza al HTML autocontenido
`Listado Maestro Documentos SIG por area corregido.html`.

Next.js + Postgres self-hosted, con **tiempo real vía SSE**: cuando un editor
guarda un cambio, el resto de los usuarios lo ve aparecer sin recargar la página.

- Subdominio: **`documentos-sig.sica`**
- Puerto publicado al host: **`3110`** (configurable con `APP_PORT`)
- Usuarios: 4 (2 `editor`, 2 `lector`)

---

## Arquitectura

```
navegador ──HTTP──> nginx (host) ──proxy_pass──> 192.168.0.195:3110 ──> contenedor app (Next :3000)
                                                                              │
navegador <──SSE─── /api/events <──────── LISTEN documentos_sig ───────── Postgres (contenedor db)
                                                          ▲
                                     NOTIFY tras cada POST/PATCH/DELETE
```

Flujo de un cambio: el editor guarda → la ruta de API persiste en Postgres →
`pg_notify('documentos_sig', …)` → el cliente que está en `LISTEN` reparte el
evento a todas las conexiones SSE abiertas → cada navegador aplica el cambio en
memoria. Sin polling y sin recargar.

### Modelo de datos

| Tabla                   | Contenido                                                             |
| ----------------------- | --------------------------------------------------------------------- |
| `usuario`               | 4 personas, rol `editor` \| `lector`, contraseña con `bcryptjs`        |
| `documento`             | las 4 categorías (`proc_gen`, `it_moviles`, `it_tks`, `registros`)     |
| `politica_distribucion` | copias controladas de la Política SIG (`sectores` como `text[]`)       |
| `politica_sector`       | catálogo de sectores                                                   |

Normalizado, no un blob JSON. `orden` preserva el orden de visualización
original dentro de cada categoría; `updated_at` / `updated_by` registran quién
tocó cada fila.

El semáforo (🟢/🟡/🔴) y el área SIG (⚙️/🦺/🌱/🤝) **no se guardan**: se calculan
en el cliente a partir de la fecha y del prefijo del código, igual que en el HTML
original, así el estado se actualiza solo con el paso del tiempo.

### Concurrencia

Last write wins por fila. Además, si el cliente manda `updated_at_visto` y otra
persona modificó esa fila después, la API responde **409** con el nombre de quien
la tocó y la app pregunta si se pisa igual.

---

## Rutas de API

| Método   | Ruta                     | Rol         | Nota                                |
| -------- | ------------------------ | ----------- | ----------------------------------- |
| `GET`    | `/api/health`            | público     | healthcheck del contenedor          |
| `GET`    | **`/api/events`**        | autenticado | **SSE — requiere config de nginx**  |
| `GET`    | `/api/snapshot`          | autenticado | estado completo (resync)            |
| `GET`    | `/api/documentos`        | autenticado |                                     |
| `POST`   | `/api/documentos`        | **editor**  |                                     |
| `PATCH`  | `/api/documentos/:id`    | **editor**  | 409 si hubo cambio concurrente      |
| `DELETE` | `/api/documentos/:id`    | **editor**  |                                     |
| `GET`    | `/api/distribucion`      | autenticado |                                     |
| `POST`   | `/api/distribucion`      | **editor**  |                                     |
| `PATCH`  | `/api/distribucion/:id`  | **editor**  |                                     |
| `DELETE` | `/api/distribucion/:id`  | **editor**  |                                     |
| `GET`    | `/api/sectores`          | autenticado |                                     |
| `POST`   | `/api/sectores`          | **editor**  |                                     |
| `DELETE` | `/api/sectores/:id`      | **editor**  |                                     |

El rol se verifica **en el servidor** (`requerirSesion(true)` en `src/auth.ts`):
esconder los botones en la UI no alcanza, un `lector` que arme el request a mano
recibe `403`.

---

## nginx — la ruta SSE necesita config propia

`/api/events` mantiene la conexión abierta indefinidamente. Con el buffering por
defecto, nginx acumula los eventos y no los entrega hasta cerrar: el tiempo real
deja de funcionar sin dar ningún error visible.

```nginx
server {
    listen 80;
    server_name documentos-sig.sica;

    location / {
        proxy_pass http://192.168.0.195:3110;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ---- Server-Sent Events: SOLO esta ruta ----
    location /api/events {
        proxy_pass http://192.168.0.195:3110;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection        '';

        proxy_buffering off;          # sin esto el SSE no llega en tiempo real
        proxy_cache off;
        chunked_transfer_encoding off;
        add_header X-Accel-Buffering no;
        proxy_read_timeout 3600s;     # la conexión queda abierta indefinidamente
        proxy_send_timeout 3600s;
    }
}
```

---

## Puesta en marcha en el server

```bash
# 1. Carpeta de datos de Postgres (bind mount real)
sudo mkdir -p /mnt/disco1/sicalab/documentos-sig/data
sudo chown -R 70:70 /mnt/disco1/sicalab/documentos-sig/data   # postgres en postgres:16-alpine

# 2. .env
cp .env.example .env && nano .env          # reemplazar todos los REEMPLAZAR
openssl rand -base64 32                    # para AUTH_SECRET

# 3. Postgres
docker compose up -d db

# 4. Rol de runtime con permisos mínimos (una sola vez)
docker exec -it documentos-sig-db psql -U documentos_owner -d documentos_sig -c \
  "create role documentos_app with login password 'LA_DE_.ENV' nosuperuser nocreatedb nocreaterole noinherit nobypassrls;"

# 5. Build + levantar la app
docker compose up -d --build app

# 6. Migraciones (rol owner, puntual — nunca queda en el environment)
docker exec -e DATABASE_URL_OWNER='postgres://documentos_owner:PASS@db:5432/documentos_sig' \
  documentos-sig-app npm run db:migrate

# 7. Carga inicial desde el HTML viejo (313 documentos + 22 copias + 21 sectores)
docker exec -e DATABASE_URL_OWNER='postgres://documentos_owner:PASS@db:5432/documentos_sig' \
  documentos-sig-app npm run db:seed

# 8. Usuarios reales
docker exec -e DATABASE_URL_OWNER='postgres://documentos_owner:PASS@db:5432/documentos_sig' \
  documentos-sig-app npm run user:create -- \
    --email alejandra@sica --nombre "Alejandra Foos" --rol editor --password '...'
# …ídem para el segundo editor y los dos lectores (--rol lector)

# 9. Verificar
curl -s http://192.168.0.195:3110/api/health
docker compose ps        # ambos contenedores en (healthy)
```

Después: bloque de nginx (arriba) + recarga.

### Comprobar el tiempo real

```bash
# Terminal 1 — quedarse escuchando el canal
docker exec -it documentos-sig-db psql -U documentos_owner -d documentos_sig \
  -c "listen documentos_sig;" -c "select pg_sleep(60);"
```

Con dos navegadores abiertos con usuarios distintos: al guardar en uno, el otro
debe reflejar el cambio en menos de un segundo y sin recargar.

---

## Desarrollo local

```bash
npm install
cp .env.example .env          # DATABASE_URL apuntando a un Postgres local
npm run db:migrate
npm run db:seed
npm run user:create -- --email vos@sica --nombre "Vos" --rol editor --password dev
npm run dev
```

---

## Notas de despliegue (errores ya cometidos en otras apps del stack)

- **`HOSTNAME=0.0.0.0`** en el `environment` del compose. Sin eso Next bindea
  sólo a la IP interna del contenedor y el healthcheck falla (bug de
  `inducciones`).
- **Healthcheck con `127.0.0.1`, nunca `localhost`.** En `puestos-clave`
  `localhost` resolvía primero a `::1`, donde el server no escucha: "Connection
  refused" con la app funcionando perfectamente desde afuera.
- **`node_modules` de producción completo en la imagen final** (stage
  `deps-prod`). El que arma `.next/standalone` es recortado y en `puestos-clave`
  no traía `bcryptjs`, rompiendo los scripts sueltos y el `bcrypt.compare()` del
  `authorize()` real.
- **`proxy_pass` contra `192.168.0.195`, no `127.0.0.1`** — nginx corre en el
  host y no ve el contenedor por loopback.
- **Migraciones en `pg` puro**, sin `drizzle-kit` ni generadores de ORM.
