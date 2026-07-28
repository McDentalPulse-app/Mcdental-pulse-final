-- ============================================================================
-- Previsualización de enlaces en el chat (migración 089).
--
-- Una sola columna jsonb en vez de cuatro columnas sueltas: la tarjeta es un
-- bloque que se guarda y se pinta entero, nunca se consulta por su título ni se
-- ordena por su descripción. Cuatro columnas solo añadirían formas de que la
-- fila quede a medias (título sin url, imagen sin nada más).
--
-- Se rellena en el SERVIDOR al enviar, no en el navegador de quien lee: si cada
-- persona que abre la conversación pidiera la vista previa, un enlace pegado en
-- el chat convertiría a toda la plantilla en clientes de ese sitio, avisándole de
-- cuántos somos y cuándo leemos. Se busca una vez y se guarda.
-- ============================================================================

alter table public.mensajes
  add column if not exists enlace jsonb;

comment on column public.mensajes.enlace is
  'Vista previa del primer enlace del mensaje: {url, titulo, descripcion, imagen}. La rellena api/link-preview.js al enviar. Null si no hay enlace o si no se pudo leer.';

-- ----------------------------------------------------------------------------
-- El trigger prevent_mensaje_tampering (migración 088) sigue sin admitir cambios
-- en esta columna después del insert, y es lo correcto: la tarjeta se decide al
-- enviar y no puede cambiar sola más tarde. Si el sitio enlazado cambia su
-- título, lo que se ve en la conversación sigue siendo lo que había cuando se
-- mandó — que es justo lo que un registro debe hacer.
--
-- VERIFICACIÓN:
--   insert ... enlace = '{"url":"https://x","titulo":"T"}'::jsonb;   -> OK
--   update mensajes set enlace = '{}'::jsonb where id = <m>;          -> rechazado
--
-- ROLLBACK:
--   alter table public.mensajes drop column if exists enlace;
-- ----------------------------------------------------------------------------
