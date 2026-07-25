-- ============================================================================
-- Cotejo facial: ¿la cara de la selfie es la de esa persona?
--
-- Hasta ahora el sistema comprobaba que HABÍA una cara (se acabó la foto al techo), pero
-- no DE QUIÉN era. Un compañero con tu contraseña podía checar por ti y salir en la foto.
--
-- CÓMO FUNCIONA, y por qué así:
--
-- El cliente NO calcula nada. Sube la foto al bucket privado y ya. El servidor
-- (api/verificar-rostro.js) la baja, detecta la cara, la alinea, la convierte en 128
-- números y los compara contra los de la cara enrolada. Si el navegador calculara el
-- parecido, cualquiera mandaría un 99% desde la consola: por eso la huella se calcula y
-- se compara donde el empleado no puede tocarla.
--
-- NO BLOQUEA. Un parecido bajo marca la checada para que RH la mire, no impide fichar. El
-- reconocimiento facial se equivoca —con gafas nuevas, con mala luz, con una barba— y un
-- empleado que no puede entrar a trabajar a las ocho de la mañana porque un modelo tuvo un
-- mal día es un problema peor que el que resuelve.
--
-- EL ENROLADO LO HACE RH, EN PERSONA. Es la parte que no se puede saltar: si el empleado
-- pudiera enrolarse solo, el compañero que le robó la contraseña enrolaría SU PROPIA cara
-- en la cuenta ajena y a partir de ahí checaría por él con un 99% de parecido, verificado
-- y todo. El fraude quedaría legitimado por el propio sistema.
--
-- DATO PERSONAL SENSIBLE. Una cara cotejada ya no es "una foto": es un dato biométrico.
-- Por eso `consentimiento_en` es NOT NULL — sin consentimiento no hay fila, y sin fila no
-- hay cotejo. No es una casilla de burocracia: es la columna que impide que esto exista
-- sin que la persona lo sepa y lo acepte.
-- ============================================================================

create table if not exists public.rostros (
  id               uuid primary key default gen_random_uuid(),
  empleado_id      uuid not null unique references public.usuarios(id) on delete cascade,

  -- 128 números. No es una foto ni se puede volver a convertir en una cara, pero
  -- identifica a una persona: se trata con el mismo cuidado que la foto.
  huella           real[] not null,

  -- La foto de referencia, en el bucket privado `rostros`. Se conserva para poder
  -- re-enrolar si se cambia de modelo, y para que RH pueda ver contra qué se está
  -- comparando cuando algo no cuadra.
  selfie_path      text,

  -- SIN ESTO NO HAY FILA. Ver la cabecera.
  consentimiento_en timestamptz not null,
  enrolado_por     uuid references public.usuarios(id),

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.rostros is
  'Cara de referencia de cada empleado. La escribe SOLO api/enrolar-rostro.js con la service role: ni el empleado ni RH pueden insertar desde el navegador. Ver migración 041.';
comment on column public.rostros.consentimiento_en is
  'Cuándo consintió el empleado, en persona. NOT NULL a propósito: sin consentimiento no hay fila, y sin fila no hay cotejo. Un dato biométrico exige consentimiento expreso.';

drop trigger if exists trg_rostros_updated_at on public.rostros;
create trigger trg_rostros_updated_at
  before update on public.rostros
  for each row execute function public.set_updated_at();

alter table public.rostros enable row level security;

-- Solo lectura, y solo para RH y admin: necesitan saber quién está enrolado y quién no.
-- El empleado no lee esta tabla — no le aporta nada y expone su huella.
--
-- No hay policy de INSERT/UPDATE/DELETE para NADIE. La única escritura es la función
-- serverless con la service role, que se salta RLS. Si RH pudiera insertar desde el
-- navegador, podría inyectar una huella cualquiera; y el empleado, la suya en otra cuenta.
grant select on public.rostros to authenticated;
-- La ÚNICA vía de escritura de las huellas: api/enrolar-rostro.js, con la service role.
grant select, insert, update on public.rostros to service_role;

drop policy if exists rostros_select_admin_rh on public.rostros;
create policy rostros_select_admin_rh
  on public.rostros for select
  using ((select public.current_role()) in ('admin', 'rh'));


-- El resultado del cotejo, en cada checada.
alter table public.asistencias
  add column if not exists match_score       real,
  add column if not exists rostro_verificado boolean;

comment on column public.asistencias.match_score is
  'Parecido (coseno, -1 a 1) entre la selfie de esta checada y la cara enrolada. NULL = no se pudo cotejar: sin foto, sin cara reconocible, o el empleado no está enrolado.';
comment on column public.asistencias.rostro_verificado is
  'true = la cara coincide. false = NO coincide (revisar). NULL = no se pudo cotejar. Los tres estados son distintos y la interfaz los distingue: "no coincide" y "no se comprobó" no significan lo mismo.';

-- Lo escribe la función serverless con la service role. El cliente NO puede: no tiene
-- policy de update sobre asistencias (solo RH la tiene, y solo para anular). Si pudiera,
-- se pondría un match_score de 1.0 y adiós cotejo.


-- Bucket de las caras de referencia. Privado, y aparte del de las selfies: son datos de
-- vida distinta (la selfie de una checada es un registro del día; la cara de referencia
-- vive mientras la persona trabaje aquí) y conviene poder borrar una sin tocar la otra.
insert into storage.buckets (id, name, public)
values ('rostros', 'rostros', false)
on conflict (id) do nothing;

update storage.buckets set file_size_limit = 1048576 where id = 'rostros';

-- Sube RH/admin (el enrolado es presencial). El empleado no sube aquí: si pudiera,
-- enrolaría la cara que quisiera.
drop policy if exists rostros_insert_admin_rh on storage.objects;
create policy rostros_insert_admin_rh
  on storage.objects for insert
  with check (
    bucket_id = 'rostros'
    and (select public.current_role()) in ('admin', 'rh')
  );

drop policy if exists rostros_select_admin_rh_storage on storage.objects;
create policy rostros_select_admin_rh_storage
  on storage.objects for select
  using (
    bucket_id = 'rostros'
    and (select public.current_role()) in ('admin', 'rh')
  );

-- Re-enrolar sobrescribe (upsert), así que aquí SÍ hace falta policy de update — y de
-- select, por la trampa que documenta la migración 022: con upsert, Storage necesita leer
-- la metadata del objeto y sin select falla con un error de RLS que no dice eso.
drop policy if exists rostros_update_admin_rh on storage.objects;
create policy rostros_update_admin_rh
  on storage.objects for update
  using (
    bucket_id = 'rostros'
    and (select public.current_role()) in ('admin', 'rh')
  );

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN:
--   (como rh) insert into public.rostros (empleado_id, huella, consentimiento_en)
--             values (..., '{1,2,3}', now());
--     -> DEBE FALLAR: no hay policy de insert para nadie. Solo escribe la service role.
--
--   (como empleado) select * from public.rostros;  -> 0 filas (RLS)
--
--   insert into public.rostros (empleado_id, huella) values (..., '{1,2}');
--     -> DEBE FALLAR: consentimiento_en es NOT NULL. Sin consentimiento no hay cotejo.
--
-- ROLLBACK:
--   drop table if exists public.rostros;
--   alter table public.asistencias drop column if exists match_score, drop column if exists rostro_verificado;
--   delete from storage.buckets where id = 'rostros';
-- ----------------------------------------------------------------------------
