-- ============================================================================
-- Romper la recursión infinita entre las políticas de reuniones (migración 091).
--
-- QUÉ PASABA. La 090 dejó dos políticas que se llamaban la una a la otra:
--
--   reuniones.select          -> consulta reunion_invitados
--   reunion_invitados.select  -> consulta reuniones
--
-- Cada consulta a una tabla disparaba la política de la otra, que volvía a disparar
-- la primera. Postgres lo detecta y aborta con "infinite recursion detected in
-- policy for relation reuniones", así que la lista de reuniones llegaba VACÍA al
-- navegador — sin error visible en pantalla: simplemente no había nada que unirse.
--
-- CÓMO SE ROMPE. Con dos funciones `security definer`. Al ejecutarse como su dueño
-- se saltan la RLS de la tabla que consultan, así que la comprobación termina ahí
-- y no vuelve a entrar en el ciclo. Cada una corta una dirección.
--
-- No debilita nada: las funciones solo responden "sí o no" sobre la reunión que se
-- les pregunta, y siempre respecto de QUIEN LLAMA (`current_usuario_id()`). No hay
-- forma de usarlas para leer una reunión ajena.
-- ============================================================================

create or replace function public.es_invitado_reunion(p_reunion uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.reunion_invitados i
    where i.reunion_id = p_reunion
      and i.usuario_id = current_usuario_id()
  );
$function$;

create or replace function public.es_anfitrion_reunion(p_reunion uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.reuniones r
    where r.id = p_reunion
      and r.creado_por = current_usuario_id()
  );
$function$;

comment on function public.es_invitado_reunion is
  'Rompe la recursión RLS: la política de `reuniones` necesita mirar `reunion_invitados`, cuya política mira `reuniones`. Al ser security definer, la consulta interna no vuelve a evaluar políticas.';

-- ── Políticas rehechas ──────────────────────────────────────────────────────

drop policy if exists reuniones_select_participante on public.reuniones;
create policy reuniones_select_participante on public.reuniones
  for select using (
    creado_por = (select current_usuario_id())
    or public.es_invitado_reunion(id)
  );

drop policy if exists reunion_invitados_select_participante on public.reunion_invitados;
create policy reunion_invitados_select_participante on public.reunion_invitados
  for select using (
    usuario_id = (select current_usuario_id())
    or public.es_anfitrion_reunion(reunion_id)
  );

-- La de INSERT también miraba `reuniones` desde `reunion_invitados`. Con la tabla
-- ya cargada de políticas mutuas, conviene dejarla igual de plana.
drop policy if exists reunion_invitados_insert_anfitrion on public.reunion_invitados;
create policy reunion_invitados_insert_anfitrion on public.reunion_invitados
  for insert with check (public.es_anfitrion_reunion(reunion_id));

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN (la que faltó en la 090 — probar las políticas de SELECT con la
-- RLS puesta, no solo contar cuántas hay):
--
--   set local role authenticated;
--   set local request.jwt.claims to '{"sub":"<auth_user_id del anfitrión>"}';
--   select count(*) from reuniones;          -> 1, sin error de recursión
--   select count(*) from reunion_invitados;  -> los suyos
--
--   lo mismo con el invitado                 -> ve la reunión
--   lo mismo con un tercero                  -> 0 filas
--
-- ROLLBACK: restaurar las políticas de la 090 (y volver al fallo).
-- ----------------------------------------------------------------------------
