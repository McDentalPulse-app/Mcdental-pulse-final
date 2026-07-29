-- 094 — Canal de Soporte TI dentro de Mensajes.
--
-- QUÉ AÑADE: además del canal confidencial empleado ↔ psicóloga, un canal empleado ↔ Soporte TI
-- que atienden DOS personas a la vez (un buzón compartido, no una conversación privada).
--
-- POR QUÉ UNA BANDERA POR PERSONA Y NO UN ROL: quienes atienden soporte —Erick y Alfredo— son
-- rol `empleado` en esta base. Hacerlo por rol obligaría a ascenderlos a admin, lo que les
-- abriría nómina, expedientes y reportes confidenciales solo para que puedan contestar dudas de
-- TI. La bandera concede exactamente un permiso: leer y contestar el canal de soporte.
--
-- POR QUÉ `para_id` PASA A ADMITIR NULL: la tabla era estrictamente 1 a 1, y un buzón compartido
-- no tiene un destinatario único. Un mensaje del empleado HACIA soporte va sin destinatario
-- (`para_id is null`, canal 'soporte'); la respuesta de cualquiera de los dos encargados sí lo
-- lleva, porque va a una persona concreta. El CHECK impide que el canal de la psicóloga se quede
-- sin destinatario por accidente.

begin;

-- 1) Quién atiende soporte -----------------------------------------------------------------
alter table public.usuarios
  add column if not exists soporte_ti boolean not null default false;

comment on column public.usuarios.soporte_ti is
  'Atiende el canal de Soporte TI en Mensajes. Es un permiso puntual, no un rol: se concede por persona.';

update public.usuarios set soporte_ti = true
where id in (
  '106cff6e-ada2-4120-b233-dc8bad7c8c13',   -- ERICK JOSEPH TORRES SUAREZ
  'fff31b54-81d2-4353-b1df-fc6b30350ec2'    -- ALFREDO EDUARDO BURGOS REYES
);

-- Mismo patrón que current_role() y current_usuario_id() (mig. 016/028): SECURITY DEFINER y
-- search_path fijo, para que las policies puedan preguntarlo sin depender de la RLS de usuarios.
create or replace function public.es_soporte_ti()
  returns boolean
  language sql
  stable security definer
  set search_path to 'public'
as $$
  select coalesce((select soporte_ti from public.usuarios where auth_user_id = auth.uid()), false);
$$;

-- 2) El canal en cada mensaje --------------------------------------------------------------
alter table public.mensajes
  add column if not exists canal text not null default 'psicologa';

alter table public.mensajes
  drop constraint if exists mensajes_canal_valido;
alter table public.mensajes
  add constraint mensajes_canal_valido check (canal in ('psicologa', 'soporte'));

alter table public.mensajes
  alter column para_id drop not null;

-- Sin destinatario SOLO en el canal de soporte. En el de la psicóloga, un para_id nulo sería un
-- mensaje que nadie recibe y que nadie podría leer: mejor que reviente al insertarlo.
alter table public.mensajes
  drop constraint if exists mensajes_destinatario_salvo_soporte;
alter table public.mensajes
  add constraint mensajes_destinatario_salvo_soporte
  check (canal = 'soporte' or para_id is not null);

comment on column public.mensajes.canal is
  'psicologa = canal confidencial 1 a 1. soporte = buzón compartido de Soporte TI (para_id nulo cuando va del empleado hacia soporte).';

-- El buzón lee "todo lo de soporte ordenado por fecha"; sin este índice sería un recorrido de la
-- tabla entera de mensajes, que solo crece.
create index if not exists mensajes_soporte_fecha_idx
  on public.mensajes (fecha desc)
  where canal = 'soporte';

-- 3) RLS de mensajes -----------------------------------------------------------------------
-- Se reescriben las tres policies tal como estaban (mig. 073) y se les añade la rama del canal
-- de soporte. Se conserva el envoltorio `(select ...)` de la mig. 028: sin él, PostgreSQL evalúa
-- la función una vez POR FILA en vez de una sola vez por consulta.

drop policy if exists mensajes_select_participant on public.mensajes;
create policy mensajes_select_participant
  on public.mensajes for select
  using (
    (
      (select public.current_role()) in ('admin', 'psicologa', 'empleado', 'doctor')
      and (
        de_id = (select public.current_usuario_id())
        or para_id = (select public.current_usuario_id())
      )
    )
    -- Buzón compartido: los encargados ven TODO el canal de soporte, incluidos los mensajes sin
    -- destinatario. Es justo lo que un buzón de soporte significa.
    or (canal = 'soporte' and (select public.es_soporte_ti()))
  );

drop policy if exists mensajes_insert_as_sender on public.mensajes;
create policy mensajes_insert_as_sender
  on public.mensajes for insert
  with check (
    (select public.current_role()) in ('admin', 'psicologa', 'empleado', 'doctor')
    and de_id = (select public.current_usuario_id())
  );

-- Marcar leído: en el buzón compartido, quien lo lea lo marca para los dos. Es lo correcto para
-- un buzón —lo que importa es si el equipo lo atendió, no quién lo abrió primero.
drop policy if exists mensajes_update_mark_read on public.mensajes;
create policy mensajes_update_mark_read
  on public.mensajes for update
  using (
    para_id = (select public.current_usuario_id())
    or (canal = 'soporte' and (select public.es_soporte_ti()))
  )
  with check (
    para_id = (select public.current_usuario_id())
    or (canal = 'soporte' and (select public.es_soporte_ti()))
  );

-- 4) Adjuntos: LA TRAMPA ------------------------------------------------------------------
-- Las policies del bucket viven en el esquema `storage`, no en `public`. Olvidarlas fue lo que
-- costó el primer fallo del corte del 2026-07-27: el chat funcionaba y las fotos no se abrían,
-- con un síntoma que apuntaba al detector de rostros cuando era un permiso.
--
-- Sin esto, un empleado podría mandar una captura de pantalla a soporte y los encargados verían
-- el mensaje pero no podrían abrir la imagen: `para_id` es nulo, así que la rama de "va dirigido
-- a mí" no aplica.
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
    )
  );

commit;
