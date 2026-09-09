-- ============================================================================
-- 155 — Canal de Soporte Mantenimiento dentro de Mensajes.
--
-- QUÉ AÑADE: un tercer canal, calcado del de Soporte TI (mig. 094), para los problemas que no
-- son de sistemas —una lámpara fundida, una silla rota, una fuga— y que hasta hoy llegaban al
-- buzón de TI porque era el único sitio donde reportar algo.
--
-- POR QUÉ POR ROL Y NO POR BANDERA, al revés que la 094: allí quienes atendían eran rol
-- `empleado` y una bandera era la única forma de darles ESE permiso sin darles nómina y
-- expedientes de propina. Aquí quienes atienden ya son admin, rh y psicóloga: el rol YA dice
-- quién es. Una columna nueva solo añadiría un interruptor que alguien tendría que acordarse
-- de encender cada vez que entre una persona a gestión.
--
-- current_role() pliega admin_plus -> admin (mig. 139), así que 'admin' aquí ya incluye a Admin+.
--
-- LOS CUERPOS DE LAS POLICIES SE COPIARON DE PRODUCCIÓN, NO DEL REPO (verificado 2026-09-09 con
-- pg_get_expr sobre pg_policy). Esta migración las reescribe enteras: si se copiara una versión
-- vieja, borraría ramas vivas sin fallar — aplicaría "bien" y dejaría el chat mal abierto o mal
-- cerrado. Cada policy de abajo es la de producción MÁS la rama nueva, nada menos.
-- ============================================================================

begin;

-- ── 1. Quién atiende ────────────────────────────────────────────────────────
-- Mismo patrón que es_soporte_ti() y current_role(): SECURITY DEFINER y search_path fijo, para
-- que las policies puedan preguntarlo sin depender de la RLS de `usuarios`.
create or replace function public.es_mantenimiento()
  returns boolean
  language sql
  stable security definer
  set search_path to 'public'
as $$
  select coalesce((select public."current_role"()) in ('admin', 'rh', 'psicologa'), false);
$$;

comment on function public.es_mantenimiento() is
  'Atiende el buzón de Soporte Mantenimiento. Por ROL (admin/admin_plus/rh/psicologa), a diferencia de es_soporte_ti(), que es una bandera por persona. Ver migración 155.';

-- ── 2. El canal ─────────────────────────────────────────────────────────────
alter table public.mensajes
  drop constraint if exists mensajes_canal_valido;
alter table public.mensajes
  add constraint mensajes_canal_valido
  check (canal in ('psicologa', 'soporte', 'mantenimiento'));

-- Sin destinatario en los DOS buzones. En el canal de la psicóloga un para_id nulo seguiría
-- siendo un mensaje que nadie recibe y que nadie podría leer: ahí sigue prohibido.
alter table public.mensajes
  drop constraint if exists mensajes_destinatario_salvo_soporte;
alter table public.mensajes
  add constraint mensajes_destinatario_salvo_soporte
  check (canal in ('soporte', 'mantenimiento') or para_id is not null);

comment on column public.mensajes.canal is
  'psicologa = canal confidencial 1 a 1. soporte = buzón compartido de Soporte Sistemas (bandera soporte_ti). mantenimiento = buzón compartido de Soporte Mantenimiento (por rol, mig. 155). En los dos buzones para_id es nulo cuando el mensaje va del personal HACIA el buzón.';

-- Gemelo de mensajes_soporte_fecha_idx: el buzón lee "todo lo de mantenimiento por fecha", y sin
-- el índice parcial eso es recorrer la tabla entera de mensajes, que solo crece.
create index if not exists mensajes_mantenimiento_fecha_idx
  on public.mensajes (fecha desc)
  where canal = 'mantenimiento';

-- ── 3. Policies de public.mensajes ──────────────────────────────────────────
-- INSERT (mensajes_insert_as_sender) NO SE TOCA: su with_check no mira el canal — solo exige
-- que el rol sea de la app y que de_id sea uno mismo — así que ya admite 'mantenimiento' tal
-- cual está. Reescribirla sería asumir el riesgo de la R1 sin ganar nada.
-- (Que no mire el canal es además un agujero preexistente, documentado en el plan como R4/P4:
-- fuera del alcance de este cambio, ni se abre ni se cierra acá.)

-- SELECT: cuerpo de producción + la rama del buzón nuevo.
drop policy if exists mensajes_select_participant on public.mensajes;
create policy mensajes_select_participant
  on public.mensajes for select
  using (
    (
      (select public."current_role"()) = any (array['admin', 'rh', 'psicologa', 'empleado', 'doctor']::rol_usuario[])
      and (
        de_id = (select public.current_usuario_id())
        or para_id = (select public.current_usuario_id())
      )
    )
    or (canal = 'soporte' and (select public.es_soporte_ti()))
    or (canal = 'mantenimiento' and (select public.es_mantenimiento()))
  );

-- UPDATE (marcar leído): en un buzón compartido, quien lo lea lo marca para todos. Es lo
-- correcto para un buzón —lo que importa es si el equipo lo atendió, no quién lo abrió primero.
--
-- Que cuatro personas tengan UPDATE sobre filas que no les fueron dirigidas es seguro por el
-- trigger trg_mensajes_prevent_tampering (mig. 032), verificado en producción el 2026-09-09:
-- deja pasar el UPDATE solo si lo único que cambió es `leido` (o la lápida/purga de adjuntos).
-- Sin ese trigger, esto sería "reescribir lo que dijo otro".
drop policy if exists mensajes_update_mark_read on public.mensajes;
create policy mensajes_update_mark_read
  on public.mensajes for update
  using (
    para_id = (select public.current_usuario_id())
    or (canal = 'soporte' and (select public.es_soporte_ti()))
    or (canal = 'mantenimiento' and (select public.es_mantenimiento()))
  )
  with check (
    para_id = (select public.current_usuario_id())
    or (canal = 'soporte' and (select public.es_soporte_ti()))
    or (canal = 'mantenimiento' and (select public.es_mantenimiento()))
  );

-- ── 4. Adjuntos: LA TRAMPA ──────────────────────────────────────────────────
-- Las policies del bucket viven en `storage`, no en `public`. Olvidarlas fue lo que costó el
-- primer fallo del corte del 2026-07-27: el chat funcionaba y las fotos no se abrían, con un
-- síntoma que apuntaba a otra cosa.
--
-- Acá pesa más que en la 094: un reporte de mantenimiento es, casi siempre, LA FOTO del
-- desperfecto. Sin esta rama, quien atiende ve "mandó una imagen" y no puede abrirla, porque
-- para_id es nulo y la rama de "va dirigido a mí" no aplica.
drop policy if exists mensajes_obj_select_participante on storage.objects;
create policy mensajes_obj_select_participante
  on storage.objects for select
  using (
    bucket_id = 'mensajes'
    and (
      (storage.foldername(name))[1] = ((select public.current_usuario_id()))::text
      or exists (
        select 1 from public.mensajes m
        where m.adjunto_path = objects.name
          and m.para_id = (select public.current_usuario_id())
      )
      or exists (
        select 1 from public.mensajes m
        where m.adjunto_path = objects.name
          and m.canal = 'soporte'
          and (select public.es_soporte_ti())
      )
      or exists (
        select 1 from public.mensajes m
        where m.adjunto_path = objects.name
          and m.canal = 'mantenimiento'
          and (select public.es_mantenimiento())
      )
    )
  );

commit;

-- ============================================================================
-- VERIFICACIÓN (contra pulse-db real, con SET LOCAL ROLE authenticated + request.jwt.claims
-- para simular cada rol, y SAVEPOINT alrededor de lo que debe fallar):
--
-- 1. Como empleado: insert en mensajes (canal 'mantenimiento', para_id null)      -> OK
-- 2. Como empleado: select de ESE mensaje                                          -> lo ve (es de_id)
-- 3. Como OTRO empleado: select de ese mensaje                                     -> 0 filas
-- 4. Como rh / psicologa / admin / admin_plus: select                              -> lo ven los 4
-- 5. Como rh: update ... set leido = true                                          -> OK
-- 6. Como rh: update ... set texto = 'otra cosa'                                   -> falla (trigger de tampering)
-- 7. Como empleado: insert canal 'mantenimiento' CON para_id                       -> OK (respuesta dirigida)
-- 8. Como empleado: insert canal 'psicologa' SIN para_id                           -> falla (CHECK)
-- 9. Las 3 policies conservan sus ramas viejas:
--    select pg_get_expr(polqual, polrelid) from pg_policy
--     where polrelid='public.mensajes'::regclass;   -> debe seguir mencionando 'soporte' Y 'psicologa'
-- 10. select es_mantenimiento() como cada rol -> true para admin/rh/psicologa, false para empleado/doctor
-- ============================================================================

-- ============================================================================
-- ROLLBACK:
--   OJO: si ya hay mensajes con canal='mantenimiento', el CHECK viejo los rechaza y el rollback
--   falla. El rollback real DEJA el CHECK ampliado (no estorba: nadie escribe ese canal si el
--   frontend no lo ofrece) y quita solo las ramas nuevas de las policies:
--
--   drop policy ... / create policy ...  (los tres cuerpos de arriba SIN la rama de mantenimiento)
--   drop index if exists public.mensajes_mantenimiento_fecha_idx;
--   drop function if exists public.es_mantenimiento();
--
--   Y solo si el canal quedó vacío (select count(*) from mensajes where canal='mantenimiento' = 0):
--   alter table public.mensajes drop constraint mensajes_canal_valido;
--   alter table public.mensajes add constraint mensajes_canal_valido
--     check (canal in ('psicologa','soporte'));
--   alter table public.mensajes drop constraint mensajes_destinatario_salvo_soporte;
--   alter table public.mensajes add constraint mensajes_destinatario_salvo_soporte
--     check (canal = 'soporte' or para_id is not null);
-- ============================================================================
