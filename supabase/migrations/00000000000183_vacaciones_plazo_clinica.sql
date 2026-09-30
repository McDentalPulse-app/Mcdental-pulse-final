-- ============================================================================
-- 183 — En clínica, las vacaciones de cada periodo solo se piden en sus primeros 6 meses.
--
-- Pedido del dueño (2026-09-30): quien cumple su año el 1 de enero tiene sus días de ese
-- periodo, pero solo puede PEDIRLOS hasta el 30 de junio. Las fechas de las vacaciones pueden
-- caer en cualquier día del periodo (hasta el siguiente aniversario); lo que vence es poder
-- solicitarlas. Aplica a todos menos Oficina Administrativa, que sigue sin plazo.
--
-- Misma regla que validarSolicitud()/saldoVacaciones() con `mesesParaPedir` en
-- src/utils/vacaciones.js y MESES_PARA_PEDIR_VACACIONES en src/utils/constants.js.
--
-- El límite es `inicio del periodo + 6 months` (exclusivo), con el recorte a fin de mes de
-- Postgres: un aniversario el 31 de agosto vence el 28 de febrero, y el último día para pedir es
-- el 27. La pantalla recorta igual (sumarMeses en vacaciones.js).
--
-- Solo cambia vacaciones_respeta_antiguedad() (el candado de la 162/181/182); lo demás igual.
-- Gestión (admin/rh/psicóloga) sigue exenta: RH puede registrar una vacación fuera de plazo.
-- No toca solicitudes existentes: es un candado de INSERT.
-- ============================================================================

begin;

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
  -- Plazo para PEDIR (mig. 183): en clínica, las vacaciones de un periodo solo se piden en sus
  -- primeros 6 meses. MESES_PARA_PEDIR_VACACIONES en src/utils/constants.js.
  c_meses_plazo   constant integer := 6;
  v_sucursal      text;
  v_con_plazo     boolean;
  v_limite_pedir  date;
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

  select u.fecha_ingreso, u.sucursal into v_fecha_ingreso, v_sucursal
  from public.usuarios u where u.id = new.empleado_id;
  -- Oficina no tiene plazo; los otros dos nombres son los alias viejos que la app también trata
  -- como oficina (SUCURSAL_ALIASES en src/utils/constants.js). Sin sucursal = clínica, igual que allá.
  v_con_plazo := coalesce(v_sucursal, '') not in ('Oficina Administrativa', 'Oficina Central', 'Central');

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
      -- En clínica, pasado el plazo de este periodo ya no se pide nada de él. Se mide con HOY
      -- (cuándo se pide), no con las fechas: esas pueden caer en cualquier día del periodo.
      if v_con_plazo then
        v_limite_pedir := (v_inicio + make_interval(months => c_meses_plazo))::date;  -- exclusivo
        if v_hoy >= v_limite_pedir then
          raise exception
            'Las vacaciones del periodo que empezó el % se podían pedir hasta el % (en clínica hay % meses para pedirlas). Ya no se pueden solicitar; tus próximas vacaciones se desbloquean el %.',
            to_char(v_inicio, 'DD/MM/YYYY'), to_char(v_limite_pedir - 1, 'DD/MM/YYYY'), c_meses_plazo, to_char(v_fin, 'DD/MM/YYYY');
        end if;
      end if;

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

commit;

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN (como un empleado de clínica, en transacción con ROLLBACK):
--   · con su periodo empezado hace menos de 6 meses: pedir entra;
--   · con más de 6 meses: "…se podían pedir hasta el …";
--   · el mismo caso con sucursal 'Oficina Administrativa': entra.
--
-- ROLLBACK: volver a correr vacaciones_respeta_antiguedad() de la 182.
-- ----------------------------------------------------------------------------
