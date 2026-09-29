-- ============================================================================
-- 175 — El recibo de una semana: sueldo, descuento y pago final.
--
-- NÚMERO CAMBIADO AL GUARDARLA EN EL REPO (2026-09-29). Se escribió y se aplicó en producción
-- como la 173 (hacia el 2026-09-21, desde la sesión de la app nativa), pero nunca se commiteó, y
-- mientras tanto prod/main usó 171 y 172 para otras dos. No hay registro de migraciones
-- aplicadas, así que el número solo ordena el repo. COMPROBADO el 2026-09-29 contra la base: el
-- cuerpo que corre en producción es exactamente este (salvo el número de migración en los textos).
--
-- La 174 devuelve el detalle día por día. Esta devuelve la CUENTA: lo que gana, lo que se le
-- descuenta y lo que le queda. Es el equivalente de `calcularNomina()` en src/utils/nomina.js.
--
-- POR QUÉ EN LA BASE Y NO EN LA APP. La resta parece trivial —sueldo menos descuento— y por eso
-- mismo es tentador hacerla en el cliente. No se hace: las dos reglas que la rodean no son
-- triviales y ya mordieron una vez.
--
--   · Sin sueldo capturado el pago final es 0, no "sueldo menos descuento". Un pago final
--     calculado sobre un sueldo que nadie ha metido es un número inventado con cara de cuenta
--     hecha.
--   · El pago final NUNCA es negativo. Si los descuentos se comen el sueldo, es 0. Un recibo en
--     rojo no significa que la persona le deba dinero a la clínica.
--
-- Teniéndolas aquí, la app suma cero y la web podrá usar lo mismo el día que se quiera.
-- ============================================================================

begin;

drop function if exists public.recibo_semana(uuid, date, date);

create function public.recibo_semana(
  p_empleado uuid,
  p_desde    date,
  p_hasta    date
)
returns table (
  sueldo_semanal numeric(10,2),
  descuento      numeric(10,2),
  pago_final     numeric(10,2),
  sin_sueldo     boolean,
  retardos       integer,
  faltas         integer,
  justificados   integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_bruto numeric(10,2);
  v_sin   boolean;
begin
  -- El guard está DENTRO de resumen_asistencia_semana, que se llama abajo: pedir el recibo de
  -- otro revienta ahí. Se comprueba igualmente aquí para que el error llegue antes de leer el
  -- sueldo de nadie.
  if p_empleado is distinct from public.current_usuario_id()
     and coalesce(public.current_role()::text, '') not in ('admin', 'rh', 'psicologa') then
    raise exception 'no autorizado';
  end if;

  select u.sueldo_semanal into v_bruto from public.usuarios u where u.id = p_empleado;

  -- Igual que `sinSueldo` en nomina.js: null o <= 0 es "no capturado", no "gana cero".
  v_sin := (v_bruto is null or v_bruto <= 0);

  return query
  with d as (
    select * from public.resumen_asistencia_semana(p_empleado, p_desde, p_hasta)
  )
  select
    case when v_sin then 0::numeric else v_bruto end,
    coalesce(sum(d.descuento), 0)::numeric(10,2),
    case
      when v_sin then 0::numeric
      -- Nunca negativo: si los descuentos se comen el sueldo, el pago es cero.
      else greatest(0, v_bruto - coalesce(sum(d.descuento), 0))
    end,
    v_sin,
    count(*) filter (where d.estado = 'retardo')::integer,
    count(*) filter (where d.estado = 'falta')::integer,
    count(*) filter (where d.estado = 'justificado')::integer
    from d;
end;
$$;

revoke all on function public.recibo_semana(uuid, date, date) from public;
grant execute on function public.recibo_semana(uuid, date, date) to authenticated;

comment on function public.recibo_semana(uuid, date, date) is
  'Sueldo, descuento y pago final de una semana, con las mismas reglas que calcularNomina() en src/utils/nomina.js. Solo lee. Cada empleado, lo suyo; admin/rh/psicologa, el de cualquiera. Migración 175.';

commit;

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN:
--   · scripts/paridad-asistencia.test.mjs compara este recibo contra calcularNomina() para
--     todos los empleados activos y las últimas 8 semanas. Criterio: 0 diferencias.
--   · Con el JWT de un empleado normal, pedir el recibo de otro -> ERROR: no autorizado.
--
-- ROLLBACK:
--   drop function if exists public.recibo_semana(uuid, date, date);
-- ----------------------------------------------------------------------------
