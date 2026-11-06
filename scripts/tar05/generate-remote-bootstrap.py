"""SQL de instalacion inicial atomica para proyecto NUEVO confirmado en Dashboard.
No usa auth-bootstrap.sql ni suplanta Auth; conserva el historial CLI real.
"""
from pathlib import Path
root=Path(__file__).resolve().parents[2]
parts=['begin;',"do $$ begin if exists(select 1 from pg_tables where schemaname = 'public') then raise exception 'Proyecto no vacio: inspeccionar antes de aplicar'; end if; end $$;",'create schema if not exists supabase_migrations;', 'create table if not exists supabase_migrations.schema_migrations (version text primary key, name text, statements text[]);']
parts.extend(['alter table supabase_migrations.schema_migrations enable row level security;', 'revoke all on schema supabase_migrations from public, anon, authenticated;', 'revoke all on supabase_migrations.schema_migrations from public, anon, authenticated;'])
for p in sorted((root/'supabase/migrations').glob('*.sql')):
    version,name=p.stem.split('_',1)
    content=p.read_text()
    parts.extend([content, f"insert into supabase_migrations.schema_migrations(version,name,statements) values ('{version}','{name}',array[$migration_source${content}$migration_source$]);"])
parts.extend(['commit;',"select version,name from supabase_migrations.schema_migrations order by version;"])
output=root/'evidencias/TAR05/instalacion-remota.sql'
output.write_text('\n\n'.join(parts))
print(output)
