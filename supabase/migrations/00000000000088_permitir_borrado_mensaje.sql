-- ============================================================================
-- Permitir el borrado de un mensaje sin abrir la puerta a reescribirlo (mig. 088).
--
-- `prevent_mensaje_tampering` (trigger BEFORE UPDATE) compara todas las columnas
-- salvo `leido` y aborta si cambió cualquier otra. Es una buena guarda: impide que
-- nadie —ni siquiera un rol privilegiado por descuido— altere lo que se dijo.
--
-- Pero la 087 introdujo una transición legítima que esa regla no contemplaba: la
-- lápida. Se podría haber esquivado el trigger desde el servidor (service_role,
-- session_replication_role), y sería un error: dejaría la guarda intacta en el
-- papel y agujereada en la práctica, y el siguiente que lea el trigger creería que
-- protege más de lo que protege.
--
-- Así que la excepción se escribe AQUÍ, acotada: se admite exactamente el paso a
-- eliminado, y nada más de la fila puede moverse en esa misma operación.
-- ============================================================================

create or replace function public.prevent_mensaje_tampering()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  -- Campos que la lápida sí puede tocar. Se descuentan de la comparación para
  -- poder exigir después, uno a uno, que se muevan en la dirección correcta.
  campos_lapida text[] := array[
    'eliminado_en', 'eliminado_por', 'texto',
    'adjunto_path', 'adjunto_nombre', 'adjunto_mime', 'adjunto_bytes', 'adjunto_meta'
  ];
  resto_nuevo jsonb;
  resto_viejo jsonb;
  campo text;
begin
  -- Camino 1: solo cambió `leido` (marcar como leído). El de siempre.
  if (to_jsonb(new) - 'leido') is not distinct from (to_jsonb(old) - 'leido') then
    return new;
  end if;

  -- Camino 2: borrado. Todo lo que NO es lápida ni `leido` tiene que estar igual.
  resto_nuevo := to_jsonb(new) - 'leido';
  resto_viejo := to_jsonb(old) - 'leido';
  foreach campo in array campos_lapida loop
    resto_nuevo := resto_nuevo - campo;
    resto_viejo := resto_viejo - campo;
  end loop;

  if resto_nuevo is not distinct from resto_viejo
     -- Solo se puede borrar lo que no estaba borrado: sin esto, se podría
     -- "reborrar" un mensaje una y otra vez cambiando quién figura como autor.
     and old.eliminado_en is null
     and new.eliminado_en is not null
     and new.eliminado_por is not null
     -- Y el contenido tiene que irse DE VERDAD. Marcar la lápida dejando el texto
     -- convertiría el borrado en una casilla que el cliente puede ignorar, con el
     -- mensaje entero todavía disponible en la API.
     and new.texto is null
     and new.adjunto_path is null
  then
    return new;
  end if;

  raise exception 'No autorizado: de un mensaje solo puedes marcarlo leído o eliminarlo.';
end;
$function$;

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN:
--   update mensajes set leido = true where id = <m>;                       -> OK
--   update mensajes set eliminado_en=now(), eliminado_por=<u>,
--          texto=null, adjunto_path=null where id = <m>;                   -> OK
--   update mensajes set texto = 'otra cosa' where id = <m>;                -> rechazado
--   update mensajes set eliminado_en=now(), eliminado_por=<u>              -- sin limpiar texto
--          where id = <m>;                                                 -> rechazado
--   (repetir el borrado sobre uno ya eliminado)                            -> rechazado
--
-- ROLLBACK: restaurar la versión de la función anterior a esta migración.
-- ----------------------------------------------------------------------------
