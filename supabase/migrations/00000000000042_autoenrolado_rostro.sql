-- ============================================================================
-- Auto-registro del rostro: el empleado se toma sus fotos, RH las APRUEBA.
--
-- Antes, enrolar exigía a RH sentarse con cada empleado. Con 60 personas, eso no pasa
-- nunca — y un control que exige un esfuerzo que nadie va a hacer no es un control, es
-- una intención.
--
-- Ahora el empleado captura sus propias fotos desde la app, y quedan PENDIENTES. No
-- sirven para nada hasta que RH las aprueba mirándolas.
--
-- LO QUE DECIDE SI ESTO VALE ALGO O NO VALE NADA:
--
-- El peligro nunca estuvo en quién TOMA la foto. Está en quién la APRUEBA. Si RH aprueba
-- sin mirar, el compañero que le robó la contraseña a Juan registra SU PROPIA cara en la
-- cuenta de Juan, se aprueba de un clic, y a partir de ahí checa por él con un 99% de
-- parecido — verificado y bendecido por el sistema. El cotejo no solo dejaría de servir:
-- legitimaría el fraude y lo volvería indetectable.
--
-- Por eso la aprobación es una comprobación de IDENTIDAD, no un trámite: la pantalla
-- enseña las fotos capturadas junto al avatar del empleado, y quien aprueba está diciendo
-- "esta cara es la de esta persona". Queda registrado quién aprobó y cuándo.
--
-- TRES FOTOS, no una: distintos ángulos y luces. Al cotejar se compara contra las tres y
-- se toma el MEJOR parecido, no el promedio — promediar tres fotos buenas con una mala
-- estropea las tres.
-- ============================================================================

-- Estado del enrolado. Solo 'aprobado' se usa para cotejar.
alter table public.rostros
  add column if not exists estado      text not null default 'aprobado',
  add column if not exists revisado_por uuid references public.usuarios(id),
  add column if not exists revisado_en  timestamptz,
  add column if not exists motivo_rechazo text;

-- Default 'aprobado' para no romper las filas que ya existieran (las creó RH en persona,
-- que es la vía de confianza). Las nuevas del auto-registro nacen 'pendiente' porque la
-- función serverless lo pone explícitamente.
alter table public.rostros drop constraint if exists rostros_estado_valido;
alter table public.rostros add constraint rostros_estado_valido
  check (estado in ('pendiente', 'aprobado', 'rechazado'));

comment on column public.rostros.estado is
  'pendiente = el empleado se registró solo y NADIE lo ha mirado: NO se usa para cotejar. aprobado = alguien confirmó que esa cara es de esa persona. rechazado = no lo es, o las fotos no sirven.';
comment on column public.rostros.revisado_por is
  'Quién dio la cara por buena. Aprobar es afirmar una identidad, y eso tiene un responsable con nombre.';

-- La huella pasa a ser una por foto. La columna vieja se queda para no perder los
-- enrolados existentes, pero las nuevas van a rostro_fotos.
alter table public.rostros alter column huella drop not null;

create table if not exists public.rostro_fotos (
  id          uuid primary key default gen_random_uuid(),
  rostro_id   uuid not null references public.rostros(id) on delete cascade,
  huella      real[] not null,
  selfie_path text not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_rostro_fotos_rostro on public.rostro_fotos (rostro_id);

comment on table public.rostro_fotos is
  'Las fotos de referencia de un enrolado (3). Al cotejar se compara contra todas y se toma el MEJOR parecido. Ver migración 042.';

alter table public.rostro_fotos enable row level security;

grant select on public.rostro_fotos to authenticated;
grant select, insert, update, delete on public.rostro_fotos to service_role;

-- Solo RH y admin las ven: son las que hay que MIRAR para aprobar.
drop policy if exists rostro_fotos_select_admin_rh on public.rostro_fotos;
create policy rostro_fotos_select_admin_rh
  on public.rostro_fotos for select
  using ((select public.current_role()) in ('admin', 'rh'));

-- Sin policy de escritura para nadie: solo la service role, igual que `rostros`.


-- El empleado necesita saber en qué estado está SU registro (para que la pantalla le diga
-- "en revisión" y no le ofrezca registrarse otra vez). Ve su fila, no la de nadie más.
--
-- Ojo: ve la fila entera, huella incluida. No es un problema — es SU cara, y esos 128
-- números no se pueden volver a convertir en una foto. Lo que NO puede es escribirlos.
drop policy if exists rostros_select_own on public.rostros;
create policy rostros_select_own
  on public.rostros for select
  using (empleado_id = (select public.current_usuario_id()));


-- El empleado sube sus propias fotos de registro, en SU carpeta. Misma convención que el
-- bucket de asistencias: la carpeta es su uuid, y la policy lo comprueba.
drop policy if exists rostros_insert_own on storage.objects;
create policy rostros_insert_own
  on storage.objects for insert
  with check (
    bucket_id = 'rostros'
    and (storage.foldername(name))[1] = (select public.current_usuario_id())::text
  );

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN:
--   (como empleado) select estado from public.rostros;  -> solo su fila
--   (como empleado) update public.rostros set estado = 'aprobado';
--     -> UPDATE 0. Si esto funcionara, cualquiera se auto-aprobaría la cara que quisiera
--        y el cotejo entero valdría cero.
--
--   (como empleado A) subir a 'rostros/<id-de-B>/1.jpg'  -> DEBE FALLAR (RLS)
--
-- ROLLBACK:
--   drop table if exists public.rostro_fotos;
--   alter table public.rostros drop column if exists estado, drop column if exists revisado_por,
--     drop column if exists revisado_en, drop column if exists motivo_rechazo;
-- ----------------------------------------------------------------------------
