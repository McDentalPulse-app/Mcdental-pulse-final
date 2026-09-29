-- ============================================================================
-- 181 — Vacaciones que crecen con la antigüedad.
--
-- Decisión del dueño (2026-09-29): en vez de 8 días fijos por periodo, la tabla del Art. 76
-- de la LFT (reforma 2023) MENOS 4 días en cada escalón:
--
--   años cumplidos:  1   2   3   4   5   6-10  11-15  16-20  21-25 …
--   LFT:            12  14  16  18  20   22     24     26     28   (+2 cada 5 años)
--   clínica:         8  10  12  14  16   18     20     22     24
--
-- Es la misma tabla que diasVacacionesPorAnios() en src/utils/vacaciones.js: la pantalla la usa
-- para enseñar el saldo y validar, y esta función es el tope de verdad al insertar (el trigger
-- de la migración 162). Si cambia una, cambia la otra.
--
-- Qué cambia respecto a la 162: SOLO el número de días de cada periodo (antes la constante 8,
-- ahora dias_vacaciones_por_anios(años del periodo)). Todo lo demás del trigger —desbloqueo al
-- año, periodo de aniversario a aniversario, reparto de días por donde caen, pendientes que
-- cuentan, lock por empleado, exención de gestión— es idéntico, copiado de la 162.
--
-- Unas vacaciones sobre el aniversario tocan dos periodos, y cada uno se valida con SUS días:
-- el que acaba con los del año que termina y el que empieza con los del año siguiente.
--
-- No toca solicitudes ya hechas: el trigger es BEFORE INSERT. Quien ya tiene su periodo
-- en curso ve más días disponibles desde ya (el saldo se calcula, no se guarda).
-- ============================================================================

begin;

create or replace function public.dias_vacaciones_por_anios(p_anios integer)
returns integer
language sql
immutable
as $$
  select case
    when p_anios is null or p_anios < 1 then 0
    when p_anios <= 5 then 6 + 2 * p_anios
    else 16 + 2 * ceil((p_anios - 5) / 5.0)::integer
  end;
$$;

comment on function public.dias_vacaciones_por_anios(integer) is
  'Días de vacaciones del periodo que empieza al cumplir N años: tabla del Art. 76 LFT menos 4 (8, 10, 12, 14, 16, luego +2 cada 5 años). Igual que diasVacacionesPorAnios() en src/utils/vacaciones.js. Migración 181.';

create or replace function public.vacaciones_respeta_antiguedad()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c_tz               constant text    := 'America/Monterrey'; -- TZ_CLINICA (src/utils/asistencia.js)

  v_rol           public.rol_usuario;
  v_hoy           date;
  v_fecha_ingreso date;
  v_dias_reales   integer;
  v_anios         integer;
  v_inicio        date;
  v_fin           date;
  v_pide          integer;
  v_usados        integer;
  v_dias_periodo  integer; -- los del periodo que se está revisando (crecen con la antigüedad)
begin
  v_rol := public.current_role();

  -- Gestión y las tareas del servidor pasan de largo.
  if v_rol is null or v_rol not in ('empleado', 'doctor') then
    return new;
  end if;

  -- Candado por empleado ANTES de contar, igual que registrar_checada() con las checadas
  -- (migración 144). Sin él, dos solicitudes a la vez —un doble clic, dos pestañas, un
  -- reintento de red— leen las dos el mismo "van 0 usados" antes de que ninguna haga commit,
  -- y las dos pasan: 16 días comprometidos contra un tope de 8. El lock es por empleado, así
  -- que no estorba a nadie más, y se suelta solo al terminar la transacción.
  perform pg_advisory_xact_lock(hashtext('vacaciones:' || new.empleado_id::text));

  -- El día de HOY en la zona de la clínica, igual que hoyClinica() en la pantalla. Con la
  -- zona del servidor (UTC) el aniversario se adelantaría unas horas.
  v_hoy := (now() at time zone c_tz)::date;

  select u.fecha_ingreso into v_fecha_ingreso
  from public.usuarios u where u.id = new.empleado_id;

  if v_fecha_ingreso is null then
    raise exception
      'No tienes fecha de ingreso registrada, así que no se puede calcular tu derecho a vacaciones. Pídele a Recursos Humanos que la capture.';
  end if;

  -- El derecho se mide HOY: sin el año cumplido no se puede pedir nada, ni siquiera fechas
  -- posteriores al aniversario. Es lo mismo que le dice la pantalla.
  if public.anios_cumplidos(v_fecha_ingreso, v_hoy) < 1 then
    raise exception
      'Tus vacaciones se desbloquean el %, al cumplir tu primer año. Mientras tanto puedes solicitar un permiso.',
      to_char(v_fecha_ingreso + interval '1 year', 'DD/MM/YYYY');
  end if;

  -- Y LAS FECHAS PEDIDAS también tienen que caer en un periodo ya ganado. Sin esto, quien hoy
  -- tiene su año podía fechar la solicitud antes de su ingreso —el bucle de abajo no llegaba a
  -- iterar ni una vez y el insert entraba SIN NINGÚN TOPE— o dentro de su primer año, que es un
  -- periodo que nunca existió. La pantalla ya lo rechaza; esto cierra la puerta de PostgREST.
  if public.anios_cumplidos(v_fecha_ingreso, new.fecha_inicio) < 1 then
    raise exception
      'Esas fechas caen antes de que cumplieras tu primer año (%), así que no hay vacaciones que tomar en ellas.',
      to_char(v_fecha_ingreso + interval '1 year', 'DD/MM/YYYY');
  end if;

  if new.fecha_fin < new.fecha_inicio then
    raise exception 'La fecha final de tus vacaciones no puede ser anterior a la inicial.';
  end if;

  -- Los días se RECALCULAN del rango, no se creen: `dias` lo manda el cliente y un insert
  -- a mano podría pedir tres semanas diciendo que es un día. Se rechaza la contradicción en
  -- vez de corregirla en silencio, porque la pantalla nunca manda un valor incoherente y un
  -- ajuste mudo escondería el intento.
  v_dias_reales := (new.fecha_fin - new.fecha_inicio) + 1;

  if coalesce(new.dias, 0) <> v_dias_reales then
    raise exception 'Los días solicitados (%) no coinciden con el rango de fechas (% días).',
      coalesce(new.dias, 0), v_dias_reales;
  end if;

  -- Un recorrido por cada periodo que toca el rango. Son uno o dos en la práctica (nadie pide
  -- más de un año seguido), pero el bucle no supone cuántos.
  v_anios  := public.anios_cumplidos(v_fecha_ingreso, new.fecha_inicio);
  v_inicio := v_fecha_ingreso + (v_anios || ' years')::interval;

  loop
    exit when v_inicio > new.fecha_fin;

    v_fin  := v_fecha_ingreso + ((v_anios + 1) || ' years')::interval; -- exclusivo

    -- Días de ESTA solicitud que caen dentro de [v_inicio, v_fin).
    v_pide := greatest(0,
      (least(new.fecha_fin, v_fin - 1) - greatest(new.fecha_inicio, v_inicio)) + 1);

    if v_pide > 0 then
      -- Cada periodo con SUS días: el que empieza al cumplir N años trae los de N años.
      v_dias_periodo := public.dias_vacaciones_por_anios(v_anios);

      -- Lo pendiente CUENTA: si no, se podrían pedir los mismos días tres veces mientras RH
      -- no contesta. Lo rechazado no consume nada. Cada solicitud aporta solo su solape.
      select coalesce(sum(
               greatest(0, (least(v.fecha_fin, v_fin - 1) - greatest(v.fecha_inicio, v_inicio)) + 1)
             ), 0)
        into v_usados
      from public.vacaciones v
      where v.empleado_id = new.empleado_id
        and v.estado in ('pendiente', 'aprobado')
        and v.fecha_inicio < v_fin
        and v.fecha_fin   >= v_inicio;

      if v_usados + v_pide > v_dias_periodo then
        if v_usados >= v_dias_periodo then
          raise exception
            'Ya usaste tus % días de vacaciones del periodo que termina el %.',
            v_dias_periodo, to_char(v_fin, 'DD/MM/YYYY');
        end if;
        raise exception
          'Solo te quedan % días en el periodo que termina el % y ahí caen % de los que pides.',
          v_dias_periodo - v_usados, to_char(v_fin, 'DD/MM/YYYY'), v_pide;
      end if;
    end if;

    v_anios  := v_anios + 1;
    v_inicio := v_fin;
  end loop;

  return new;
end;
$$;

commit;

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN:
--   select n, public.dias_vacaciones_por_anios(n) from generate_series(0, 26) n;
--     -> 0:0, 1:8, 2:10, 3:12, 4:14, 5:16, 6..10:18, 11..15:20, 16..20:22, 21..25:24, 26:26
--   Como un empleado con 2 años cumplidos: pedir 10 días en su periodo entra; 11, no.
--
-- ROLLBACK: volver a correr vacaciones_respeta_antiguedad() de la 162 (tope fijo de 8) y
--   drop function if exists public.dias_vacaciones_por_anios(integer);
-- ----------------------------------------------------------------------------
