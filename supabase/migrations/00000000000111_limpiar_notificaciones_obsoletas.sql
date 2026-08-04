-- Retirar los avisos que ya no significan nada.
--
-- ============================================================================
-- POR QUÉ
-- ============================================================================
--
-- La campana acumula 1.178 notificaciones, de las cuales **272 son recordatorios de encuesta
-- sin leer** y 125 son avisos sin leer. Un buzón con cientos de pendientes deja de leerse, y
-- entonces el aviso que sí importa —"no hay copia de seguridad desde hace seis días"— se pierde
-- entre ellos. Fue exactamente lo que pasó.
--
-- La purga que ya existe borra por EDAD (leídas > 30 días, no leídas > 90). Eso mantiene la
-- tabla a raya, pero no quita el ruido: un recordatorio de "contesta tu encuesta" sigue ahí
-- semanas después de que la persona la contestara.
--
-- Esto borra por OBSOLESCENCIA, que es distinto: no importa cuándo se creó, importa que ya no
-- describe nada real.
--
-- SOLO SE BORRAN RECORDATORIOS. Nada que sea el registro de un hecho (un mensaje, un permiso
-- resuelto, una checada) se toca: eso es historial, no una tarea pendiente.
--
-- ============================================================================

create or replace function public.limpiar_notificaciones_obsoletas()
returns table (encuestas integer, avisos integer, rostros integer)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_encuestas integer := 0;
  v_avisos    integer := 0;
  v_rostros   integer := 0;
begin
  -- ── Recordatorios de encuesta ya contestada ───────────────────────────────
  -- Se compara la semana en que se EMITIÓ el recordatorio con las encuestas de esa persona.
  -- Así también caen los de semanas pasadas, que son los que más se acumulan: el recordatorio
  -- sale tres veces por semana y solo deja de emitirse cuando contestas, pero los ya emitidos
  -- se quedaban para siempre.
  --
  -- Y también los de semanas PASADAS aunque nadie contestara: `EncuestaEmpleado.jsx` guarda
  -- siempre `semana: getISOWeek()`, la semana en curso, así que una encuesta de hace tres
  -- semanas ya no se puede contestar. Un recordatorio de algo que ya no se puede hacer no es
  -- un pendiente: es ruido que entierra lo que sí lo es.
  with obsoletas as (
    select n.id
      from notificaciones n
     where n.tipo = 'encuesta'
       and (
         to_char(n.creada_en at time zone 'America/Monterrey', 'IYYY-"W"IW')
           <> to_char(now() at time zone 'America/Monterrey', 'IYYY-"W"IW')
         or exists (
           select 1 from encuestas e
            where e.empleado_id = n.empleado_id
              and e.semana = to_char(n.creada_en at time zone 'America/Monterrey', 'IYYY-"W"IW')
         )
       )
  )
  delete from notificaciones d using obsoletas o where d.id = o.id;
  get diagnostics v_encuestas = row_count;

  -- ── Avisos que esa persona ya leyó todos ──────────────────────────────────
  -- La notificación de un aviso NO guarda a cuál se refiere (su `url` es "/"), así que no se
  -- puede emparejar una a una. La regla es la buena aproximación disponible: si no te queda
  -- ningún aviso por leer, el recordatorio de que los leas ya no dice nada.
  --
  -- `sucursales` acota a quién va dirigido un aviso; NULL o vacío significa "a todos".
  with sin_pendientes as (
    select u.id as empleado_id
      from usuarios u
     where not exists (
       select 1
         from avisos a
        where (a.sucursales is null or cardinality(a.sucursales) = 0
               or u.sucursal = any (a.sucursales))
          and not exists (
            select 1 from avisos_leidos al
             where al.aviso_id = a.id and al.usuario_id = u.id
          )
     )
  )
  delete from notificaciones d
   using sin_pendientes s
   where d.empleado_id = s.empleado_id and d.tipo = 'aviso';
  get diagnostics v_avisos = row_count;

  -- ── "Rostro por revisar" cuando no queda ninguno por revisar ──────────────
  -- Es una TAREA para gestión, no el registro de un hecho: cuando la cara ya se aprobó o
  -- rechazó, el recordatorio no pide nada. Hoy hay 279 de estos con cero rostros pendientes.
  --
  -- Se distingue por el TÍTULO y no por el tipo, y hay que tenerlo presente: el mismo tipo
  -- 'rostro' se usa también para "Rostro verificado", que SÍ es el registro de un hecho
  -- (le confirma a la persona que su cara quedó aprobada) y no se toca. Si algún día cambia
  -- ese título, esta limpieza deja de encontrarlos — preferible a borrar de más.
  if not exists (select 1 from rostros where estado = 'pendiente') then
    delete from notificaciones where tipo = 'rostro' and titulo = 'Rostro por revisar';
    get diagnostics v_rostros = row_count;
  end if;

  return query select v_encuestas, v_avisos, v_rostros;
end;
$$;

revoke all on function public.limpiar_notificaciones_obsoletas() from public;
-- La llama la tarea de fondo con la llave de servicio. Ningún cliente tiene por qué invocarla.
revoke all on function public.limpiar_notificaciones_obsoletas() from authenticated;

comment on function public.limpiar_notificaciones_obsoletas() is
  'Retira recordatorios que ya no describen nada: encuestas ya contestadas y avisos ya leídos. '
  'Distinto de la purga por edad — esta borra por obsolescencia, para que la campana no acumule '
  'cientos de pendientes falsos que entierran lo que sí importa.';
