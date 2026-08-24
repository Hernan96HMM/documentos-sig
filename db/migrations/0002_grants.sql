-- 0002_grants.sql — permisos mínimos para el rol de runtime.
--
-- Separación de credenciales:
--   · rol owner (dueño del esquema)  -> migraciones y seeds, nunca en el
--     entorno persistente del contenedor de la app.
--   · rol documentos_app             -> runtime. Sin BYPASSRLS, sin DDL,
--     sólo DML sobre las tablas de esta app.
--
-- El rol se crea a mano una sola vez (ver README, sección "Base de datos").
-- Esta migración es idempotente y no falla si el rol todavía no existe.

do $$
declare
  app_role text := 'documentos_app';
begin
  if not exists (select 1 from pg_roles where rolname = app_role) then
    raise notice 'Rol % inexistente: se saltean los GRANT (crealo y volvé a correr db:migrate).', app_role;
    return;
  end if;

  execute format('grant connect on database %I to %I', current_database(), app_role);
  execute format('grant usage on schema public to %I', app_role);
  execute format('grant select, insert, update, delete on all tables in schema public to %I', app_role);
  execute format('grant usage, select on all sequences in schema public to %I', app_role);
  -- Tablas futuras creadas por el owner quedan accesibles sin re-otorgar.
  execute format(
    'alter default privileges for role %I in schema public grant select, insert, update, delete on tables to %I',
    current_user, app_role
  );
  execute format(
    'alter default privileges for role %I in schema public grant usage, select on sequences to %I',
    current_user, app_role
  );
end
$$;
