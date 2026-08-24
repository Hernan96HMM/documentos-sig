-- 0001_init.sql — esquema base de documentos-sig
-- Se aplica con el rol owner: npm run db:migrate (DATABASE_URL_OWNER).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- usuario
-- 4 personas, dos roles. Sin sectores ni doble rol (a diferencia de puestos-clave).
-- ---------------------------------------------------------------------------
create table if not exists usuario (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  password_hash text not null,
  nombre        text not null,
  rol           text not null check (rol in ('editor', 'lector')),
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- documento
-- Modelo normalizado (no un blob JSON). Las columnas opcionales aplican sólo
-- a ciertas categorías; los checks de más abajo lo hacen explícito.
-- ---------------------------------------------------------------------------
create table if not exists documento (
  id             uuid primary key default gen_random_uuid(),
  categoria      text not null check (categoria in ('it_moviles', 'it_tks', 'proc_gen', 'registros')),
  codigo         text not null,
  titulo         text not null default '',
  procedimiento  text,          -- sólo registros
  version        integer,
  ultimo_cambio  date,          -- it_moviles / it_tks / proc_gen
  vigencia       date,          -- registros
  area           text,          -- sólo proc_gen
  archivado      text,          -- sólo registros
  retencion      text,          -- sólo registros (texto libre: "3 AÑOS", "SIEMPRE")
  disposicion    text,          -- sólo registros (texto libre: "DESTRUCCION", "DIGITAL")
  orden          integer not null default 0,
  updated_at     timestamptz not null default now(),
  updated_by     uuid references usuario(id) on delete set null,

  -- Campos exclusivos de registros
  constraint documento_campos_registros check (
    categoria = 'registros'
    or (procedimiento is null and vigencia is null and archivado is null
        and retencion is null and disposicion is null)
  ),
  -- Campos exclusivos de proc_gen
  constraint documento_campo_area check (
    categoria = 'proc_gen' or area is null
  ),
  -- ultimo_cambio no aplica a registros (ahí la fecha es `vigencia`)
  constraint documento_campo_ultimo_cambio check (
    categoria <> 'registros' or ultimo_cambio is null
  )
);

-- El orden de visualización dentro de cada categoría es el del listado original.
create index if not exists documento_categoria_orden_idx on documento (categoria, orden, codigo);
create index if not exists documento_codigo_idx on documento (codigo);

-- Los códigos vienen con formato inconsistente del listado original
-- ("F- 143" con espacio, "F-100/1" con barra, duplicados históricos),
-- así que NO se declara unique sobre codigo. Se valida sólo que no esté vacío.
alter table documento drop constraint if exists documento_codigo_no_vacio;
alter table documento add constraint documento_codigo_no_vacio check (length(btrim(codigo)) > 0);

-- ---------------------------------------------------------------------------
-- politica_distribucion — copias controladas de la Política SIG
-- ---------------------------------------------------------------------------
create table if not exists politica_distribucion (
  id                 uuid primary key default gen_random_uuid(),
  copia              text not null,
  fecha_distribucion date,
  fecha_vigencia     date,
  sectores           text[] not null default '{}',
  orden              integer not null default 0,
  updated_at         timestamptz not null default now(),
  updated_by         uuid references usuario(id) on delete set null
);

create index if not exists politica_distribucion_orden_idx on politica_distribucion (orden, copia);

-- ---------------------------------------------------------------------------
-- politica_sector — catálogo simple de sectores.
-- Se mantiene independiente (no se comparte con otras apps del stack) porque
-- es el listado propio de la distribución de la Política SIG.
-- ---------------------------------------------------------------------------
create table if not exists politica_sector (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null unique,
  orden      integer not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references usuario(id) on delete set null
);

create index if not exists politica_sector_orden_idx on politica_sector (orden, nombre);
