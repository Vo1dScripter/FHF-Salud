-- Regression: authenticated sin rol no debe entrar a ninguna RPC privilegiada.
-- Ejecutar como administrador; SET ROLE comprueba el permiso authenticated real.
begin;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","app_metadata":{}}',true);
set local role authenticated;
do $$
begin
  begin
    perform public.confirm_appointment('aaaaaaaa-1111-4111-8111-111111111111',now());
    raise exception 'FAIL: confirm permitida';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.cancel_appointment('aaaaaaaa-1111-4111-8111-111111111111',now(),'Prueba');
    raise exception 'FAIL: cancel permitida';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.reschedule_appointment('aaaaaaaa-1111-4111-8111-111111111111',now(),now(),30::smallint);
    raise exception 'FAIL: reschedule permitida';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS: tres RPC rechazan authenticated sin rol con SQLSTATE 42501';
end;
$$;
rollback;
