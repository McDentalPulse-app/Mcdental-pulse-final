-- ============================================================================
-- 182 — El domingo no gasta vacaciones.
--
-- Pedido del dueño (2026-09-30): quien pedía de viernes a lunes gastaba 4 días, pero el
-- domingo nadie trabaja. Ahora son 3. Se eligió esto en vez de pedir día por día: el
-- empleado sigue eligiendo un rango y el sistema cuenta solo lo que de verdad deja de trabajar.
--
-- Misma regla que diasVacacionHabiles() en src/utils/vacaciones.js (la pantalla: saldo,
-- validación, aviso). Si cambia una, cambia la otra.
--
-- Qué cambia:
--   1. public.dias_vacacion_habiles(desde, hasta): días del rango, ambos incluidos, sin domingos.
--   2. vacaciones_respeta_antiguedad() (el candado de la 162/181):
--      · FIJA `dias` desde las fechas en TODA inserción, también las de gestión. Antes
--        rechazaba un `dias` distinto del rango; con la regla nueva la app nativa, que puede
--        seguir mandando días de calendario, habría empezado a fallar en cuanto el rango
--        tocara un domingo. Normalizar es seguro: el número correcto sale de las fechas.
--      · Cuenta lo pedido y lo ya usado de cada periodo sin domingos.
--      · Rechaza una solicitud que solo tenga domingos (no gasta nada).
--   3. Las solicitudes que ya existen se recalculan: quien ya había pedido un rango con domingo
--      recupera ese día en su saldo (el saldo se calcula de las fechas, así que eso pasa solo;
--      aquí se corrige el número guardado en `dias`, que es el que enseñan las pantallas).
-- ============================================================================

begin;

create or replace function public.dias_vacacion_habiles(p_desde date, p_hasta date)
returns integer
language sql
immutable
as $$
  select case
    when p_desde is null or p_hasta is null or p_hasta < p_desde then 0
    else (select count(*)::integer
            from generate_series(p_desde, p_hasta, interval '1 day') d
           where extract(isodow from d) <> 7)
  end;
$$;

comment on function public.dias_vacacion_habiles(date, date) is
  'Días de vacaciones de un rango (ambos incluidos): los de calendario sin domingos. Igual que diasVacacionHabiles() en src/utils/vacaciones.js. Migración 182.';

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
  -- Los días de la fila son SIEMPRE los que gasta el rango: sin domingos (mig. 182). Se fijan
  -- aquí, antes de la exención de gestión, para que ninguna fila guarde otra cosa venga de donde
  -- venga — la web, RH o la app nativa, que puede seguir mandando días de calendario.
  new.dias := public.dias_vacacion_habiles(new.fecha_inicio, new.fecha_fin);

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
  -- Antes (mig. 162) se rechazaba un `dias` distinto del rango. Ahora el `dias` ya se
  -- normalizó arriba, así que solo queda un caso que no tiene sentido: pedir solo domingos.
  v_dias_reales := new.dias;
  if v_dias_reales = 0 then
    raise exception 'El domingo no se trabaja, así que no gasta vacaciones. Elige al menos un día que trabajes.';
  end if;

  v_anios  := public.anios_cumplidos(v_fecha_ingreso, new.fecha_inicio);
  v_inicio := v_fecha_ingreso + (v_anios || ' years')::interval;

  loop
    exit when v_inicio > new.fecha_fin;

    v_fin  := v_fecha_ingreso + ((v_anios + 1) || ' years')::interval; -- exclusivo

    -- Días de ESTA solicitud que caen dentro de [v_inicio, v_fin).
    -- Días de ESTA solicitud dentro de [v_inicio, v_fin), sin domingos.
    v_pide := public.dias_vacacion_habiles(greatest(new.fecha_inicio, v_inicio), least(new.fecha_fin, v_fin - 1));

    if v_pide > 0 then
      -- Cada periodo con SUS días: el que empieza al cumplir N años trae los de N años.
      v_dias_periodo := public.dias_vacaciones_por_anios(v_anios);

      -- Lo pendiente CUENTA: si no, se podrían pedir los mismos días tres veces mientras RH
      -- no contesta. Lo rechazado no consume nada. Cada solicitud aporta solo su solape.
      select coalesce(sum(
               public.dias_vacacion_habiles(greatest(v.fecha_inicio, v_inicio), least(v.fecha_fin, v_fin - 1))
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

-- Las ya guardadas, con el número nuevo. Sin tocar updated_at: no es una edición de nadie.
alter table public.vacaciones disable trigger trg_vacaciones_updated_at;
update public.vacaciones
   set dias = public.dias_vacacion_habiles(fecha_inicio, fecha_fin)
 where dias is distinct from public.dias_vacacion_habiles(fecha_inicio, fecha_fin);
alter table public.vacaciones enable trigger trg_vacaciones_updated_at;

commit;

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN:
--   select public.dias_vacacion_habiles('2026-10-02', '2026-10-05');  -> 3 (viernes a lunes)
--   select public.dias_vacacion_habiles('2026-10-04', '2026-10-04');  -> 0 (un domingo)
--   select public.dias_vacacion_habiles('2026-10-05', '2026-10-11');  -> 6 (lunes a domingo)
--   select count(*) from vacaciones where dias <> dias_vacacion_habiles(fecha_inicio, fecha_fin);  -> 0
--
-- ROLLBACK: volver a correr vacaciones_respeta_antiguedad() de la 181, y
--   update vacaciones set dias = (fecha_fin - fecha_inicio) + 1;
--   drop function if exists public.dias_vacacion_habiles(date, date);
-- ----------------------------------------------------------------------------
