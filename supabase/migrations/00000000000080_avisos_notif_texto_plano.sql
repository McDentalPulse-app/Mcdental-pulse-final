-- ============================================================================
-- Los avisos ahora se escriben con editor de texto enriquecido (guardan HTML en `cuerpo`).
-- La notificación de la campana debe mostrar TEXTO PLANO, no las etiquetas HTML. Se actualiza
-- el trigger para quitar las etiquetas y decodificar las entidades más comunes antes de recortar
-- a 120 caracteres. Solo cambia la generación de la notificación; el aviso guarda su HTML igual.
-- ============================================================================

create or replace function public.notificar_aviso_nuevo()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_texto text;
begin
  -- Decodifica entidades comunes → quita etiquetas → colapsa espacios → recorta.
  v_texto := replace(replace(replace(replace(replace(coalesce(new.cuerpo, ''),
              '&nbsp;', ' '), '&amp;', '&'), '&lt;', '<'), '&gt;', '>'), '&quot;', '"');
  v_texto := regexp_replace(v_texto, '<[^>]+>', ' ', 'g');
  v_texto := btrim(regexp_replace(v_texto, '\s+', ' ', 'g'));

  insert into public.notificaciones (empleado_id, tipo, titulo, cuerpo, url)
  select u.id, 'aviso', 'Nuevo aviso: ' || new.titulo, left(v_texto, 120), '/'
  from public.usuarios u
  where coalesce(u.inactivo, false) = false
    and u.id <> new.creado_por;
  return new;
end;
$function$;
