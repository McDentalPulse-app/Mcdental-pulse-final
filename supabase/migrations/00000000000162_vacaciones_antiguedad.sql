-- ============================================================================
-- Vacaciones: se desbloquean al cumplir el PRIMER AÑO y son 8 días por periodo.
--
-- La regla ya vive en la pantalla del empleado (src/utils/vacaciones.js), pero una
-- pantalla no es un candado: cualquiera con el token de su propia sesión puede insertar
-- directo contra PostgREST y saltársela. Aquí queda el enforcement de verdad.
--
-- EL PERIODO VA DE ANIVERSARIO A ANIVERSARIO, no de enero a diciembre: quien entró un
-- 10 de marzo estrena sus 8 días cada 10 de marzo. Y SE REINICIA: lo que no se tomó en
-- su periodo se pierde, no se acumula (decisión del dueño).
--
-- LOS DÍAS SE REPARTEN POR DONDE CAEN. Unas vacaciones del 5 al 12 de marzo con el
-- aniversario el día 10 gastan 5 días del periodo que acaba y 3 del que empieza, y tienen
-- que caber en LOS DOS. Cargarlas enteras al periodo donde empiezan regalaría 3 días cada
-- aniversario, que es exactamente el agujero que se abriría con un solo `fecha_inicio
-- between`.
--
-- A QUIÉN SE LE APLICA: solo a quien pide para sí mismo como plantilla — 'empleado' y
-- 'doctor'. Gestión (admin / admin_plus / rh / psicologa) queda EXENTA, igual que en la
-- pantalla: RH y la psicóloga se auto-agendan sus días ya aprobados (migración 079), y
-- RH necesita poder registrar a mano una vacación que se salga de la cuenta.
--
-- El rol se lee de current_role() —el usuario AUTENTICADO—, nunca de `origen`: `origen`
-- es una columna que manda el cliente y se puede falsear. Un empleado tampoco puede
-- inventarse el rol, porque current_role() sale de auth.uid(). Las tareas del servidor
-- (service role, migraciones, seed) no resuelven a ninguna fila de usuarios, así que
-- current_role() devuelve NULL y no se les aplica nada: es deliberado.
--
-- SOLO EN INSERT. El empleado no tiene ninguna policy de UPDATE sobre vacaciones (mig.
-- 016: vacaciones_update_rh), así que no hay por dónde ampliarse los días después.
-- ============================================================================

-- Años de servicio CUMPLIDOS de una fecha respecto al ingreso.
--
-- NO se usa age(): para quien entró un 29 de febrero, age('2025-02-28','2024-02-29') da 0 años
-- mientras que '2024-02-29'::date + interval '1 year' da '2025-02-28' — la misma base se
-- contradice a sí misma, y el bucle de abajo usa la segunda forma para los límites del periodo.
-- Aquí se hace la misma cuenta que aniosCumplidos() en src/utils/vacaciones.js: diferencia de
-- años y un paso atrás si el aniversario de ese año todavía no llegó.
create or replace function public.anios_cumplidos(p_ingreso date, p_fecha date)
returns integer
language sql
immutable
as $$
  select case
    when p_ingreso is null or p_fecha is null or p_fecha < p_ingreso then 0
    when p_ingreso + (n || ' years')::interval > p_fecha then n - 1
    else n
  end
  from (select (extract(year from p_fecha) - extract(year from p_ingreso))::integer as n) t;
$$;

create or replace function public.vacaciones_respeta_antiguedad()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c_dias_por_periodo constant integer := 8;
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
      -- Lo pendiente CUENTA: si no, se podrían pedir los mismos 8 días tres veces mientras RH
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

      if v_usados + v_pide > c_dias_por_periodo then
        if v_usados >= c_dias_por_periodo then
          raise exception
            'Ya usaste tus % días de vacaciones del periodo que termina el %.',
            c_dias_por_periodo, to_char(v_fin, 'DD/MM/YYYY');
        end if;
        raise exception
          'Solo te quedan % días en el periodo que termina el % y ahí caen % de los que pides.',
          c_dias_por_periodo - v_usados, to_char(v_fin, 'DD/MM/YYYY'), v_pide;
      end if;
    end if;

    v_anios  := v_anios + 1;
    v_inicio := v_fin;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_vacaciones_antiguedad on public.vacaciones;

create trigger trg_vacaciones_antiguedad
  before insert on public.vacaciones
  for each row execute function public.vacaciones_respeta_antiguedad();
