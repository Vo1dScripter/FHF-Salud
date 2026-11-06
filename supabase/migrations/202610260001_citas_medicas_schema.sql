-- TAR05: la propuesta original se conserva en docs/sql-historico/.
-- No ejecutar dos modelos incompatibles sobre patients/physicians/appointments.
-- El contrato real utiliza starts_at/ends_at, active y roles app_metadata.
-- Esta version se conserva en la secuencia para no alterar numeros de historial.
-- Si el remoto tiene el modelo alternativo, detenerse para planificar su conversion
-- con respaldo; no eliminar tablas ni marcar migraciones como aplicadas a ciegas.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'appointments'
      and column_name = 'starts_at'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'appointments'
      and column_name = 'ends_at'
  ) then
    raise exception 'Esquema incompatible: se requiere auditar y convertir antes de continuar';
  end if;
end;
$$;
