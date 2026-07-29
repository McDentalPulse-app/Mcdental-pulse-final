-- ============================================================================
-- Retención de adjuntos del chat: 90 días (migración 092).
--
-- El canal empleado ↔ psicóloga acumulaba imágenes, documentos y notas de voz
-- indefinidamente. Una nota de voz es la grabación de alguien contándole algo a la
-- psicóloga: guardarla para siempre "porque nadie lo pensó" no es una finalidad, y
-- la ley pide conservar datos personales solo el tiempo necesario.
--
-- Se va el ARCHIVO. El mensaje, su texto, sus reacciones y sus respuestas se quedan:
-- son la conversación, no el adjunto.
-- ============================================================================

alter table public.mensajes
  add column if not exists adjunto_purgado  boolean not null default false,
  add column if not exists adjunto_aviso_en timestamptz;

-- POR QUÉ UNA MARCA Y NO SOLO PONER LA RUTA A NULL.
--
-- Es la lección que ya está escrita en api/limpiar-fotos.js: al purgar una selfie no
-- basta con vaciar la ruta, porque entonces TODA checada vieja parecería sospechosa
-- en el panel de RH. Por eso existe `foto_purgada`.
--
-- Aquí es peor: un mensaje sin texto y sin adjunto sería indistinguible de uno que
-- alguien eliminó a propósito. Con esta marca, la burbuja puede decir "el archivo se
-- eliminó por antigüedad", que es verdad y es otra cosa.
comment on column public.mensajes.adjunto_purgado is
  'El archivo se borró por retención (90 días), no por decisión de nadie. Distingue esta fila de un mensaje eliminado.';
comment on column public.mensajes.adjunto_aviso_en is
  'Cuándo se avisó de que el archivo iba a caducar. Evita avisar dos veces del mismo.';

-- El índice del barrido: busca por fecha entre los que aún tienen archivo. Parcial,
-- porque los mensajes sin adjunto —la mayoría— no le interesan a esta consulta.
create index if not exists idx_mensajes_retencion
  on public.mensajes (fecha)
  where adjunto_path is not null and not adjunto_purgado;

-- ── El CHECK admite ahora una tercera forma legítima de mensaje ─────────────
-- Ni contenido (086) ni lápida (087): purgado. Sin esto, el propio barrido dejaría
-- filas que violan la restricción y no podría escribirlas.
alter table public.mensajes drop constraint if exists mensajes_contenido_no_vacio;
alter table public.mensajes add constraint mensajes_contenido_no_vacio
  check (
    eliminado_en is not null
    or adjunto_purgado
    or (texto is not null and length(btrim(texto)) > 0)
    or adjunto_path is not null
  );

-- ── El trigger tiene que dejar pasar la purga ──────────────────────────────
-- `prevent_mensaje_tampering` compara todas las columnas salvo las que enumera y
-- aborta si cambió cualquier otra. Ahora hay dos transiciones legítimas más: avisar
-- de la caducidad y purgar. Se escriben aquí, acotadas, en vez de esquivar el
-- trigger desde el servidor — que dejaría la guarda intacta en el papel y agujereada
-- en la práctica.
create or replace function public.prevent_mensaje_tampering()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  campos_lapida text[] := array[
    'eliminado_en', 'eliminado_por', 'texto',
    'adjunto_path', 'adjunto_nombre', 'adjunto_mime', 'adjunto_bytes', 'adjunto_meta'
  ];
  campos_purga text[] := array[
    'adjunto_purgado', 'adjunto_path', 'adjunto_nombre', 'adjunto_mime',
    'adjunto_bytes', 'adjunto_meta'
  ];
  resto_nuevo jsonb;
  resto_viejo jsonb;
  campo text;
begin
  -- 1) Solo cambió `leido`.
  if (to_jsonb(new) - 'leido') is not distinct from (to_jsonb(old) - 'leido') then
    return new;
  end if;

  -- 2) Solo se anotó el aviso de caducidad, y solo la primera vez.
  if (to_jsonb(new) - 'adjunto_aviso_en') is not distinct from (to_jsonb(old) - 'adjunto_aviso_en')
     and old.adjunto_aviso_en is null
     and new.adjunto_aviso_en is not null
  then
    return new;
  end if;

  -- 3) Borrado (lápida).
  resto_nuevo := to_jsonb(new) - 'leido';
  resto_viejo := to_jsonb(old) - 'leido';
  foreach campo in array campos_lapida loop
    resto_nuevo := resto_nuevo - campo;
    resto_viejo := resto_viejo - campo;
  end loop;

  if resto_nuevo is not distinct from resto_viejo
     and old.eliminado_en is null
     and new.eliminado_en is not null
     and new.eliminado_por is not null
     and new.texto is null
     and new.adjunto_path is null
  then
    return new;
  end if;

  -- 4) Purga por retención. A diferencia del borrado, el TEXTO NO SE TOCA: se va el
  --    archivo, no lo que la persona escribió.
  resto_nuevo := to_jsonb(new) - 'leido';
  resto_viejo := to_jsonb(old) - 'leido';
  foreach campo in array campos_purga loop
    resto_nuevo := resto_nuevo - campo;
    resto_viejo := resto_viejo - campo;
  end loop;

  if resto_nuevo is not distinct from resto_viejo
     and not old.adjunto_purgado
     and new.adjunto_purgado
     and new.adjunto_path is null
     -- El texto tiene que quedar EXACTAMENTE igual. Sin esta línea, la purga sería
     -- una vía para reescribir lo que alguien dijo.
     and new.texto is not distinct from old.texto
  then
    return new;
  end if;

  raise exception 'No autorizado: de un mensaje solo puedes marcarlo leído, eliminarlo o purgar su adjunto.';
end;
$function$;

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN (con la RLS puesta y sobre datos fechados hacia atrás, no esperando
-- 90 días — ver el bucle de simulación del plan):
--   update mensajes set leido = true                                   -> OK
--   update mensajes set adjunto_aviso_en = now()  (primera vez)        -> OK
--   update mensajes set adjunto_aviso_en = now()  (segunda vez)        -> rechazado
--   update mensajes set adjunto_purgado=true, adjunto_path=null        -> OK
--   ... lo mismo pero cambiando tambien el texto                       -> rechazado
--   update mensajes set texto='otra cosa'                              -> rechazado
--
-- ROLLBACK: restaurar la función de la 088 y el CHECK de la 087, y
--   alter table public.mensajes drop column if exists adjunto_purgado, adjunto_aviso_en;
-- ----------------------------------------------------------------------------
