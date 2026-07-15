-- ============================================================================
-- Suscripciones a notificaciones push.
--
-- Hoy no llega nada a nadie. Si RH aprueba un rostro o un permiso, el empleado se entera solo si
-- entra a mirar la app — o sea, casi nunca. Esta tabla es la libreta de direcciones del push:
-- una fila por cada aparato donde una persona aceptó recibir avisos.
--
-- QUÉ ES UNA SUSCRIPCIÓN. Cuando el navegador acepta el permiso, devuelve un `endpoint` (una URL
-- larguísima de Apple o de Google, única para ese aparato) y dos claves (`p256dh`, `auth`) con
-- las que se CIFRA el mensaje. El servidor manda el aviso a esa URL, cifrado con esas claves, y
-- Apple/Google lo entregan al teléfono. Sin las tres cosas no se puede enviar nada.
--
-- LA REGLA DE PRIVACIDAD QUE MANDA AQUÍ: NADIE LEE ESTA TABLA DESDE EL NAVEGADOR. Ni siquiera su
-- propio dueño. El endpoint es un canal directo al teléfono de una persona — con la lista en la
-- mano, cualquiera con acceso al cliente podría mandarle push a quien quisiera, o saber en qué
-- aparatos está conectado cada quién. Solo la service role (el servidor, para enviar) la lee.
--
-- Cada quien SÍ puede escribir la suya (dar de alta su teléfono) y borrarla (dejar de recibir),
-- pero acotado a su propio empleado_id: no puede suscribir el teléfono de otro para inundarlo de
-- avisos.
-- ============================================================================

create table if not exists public.push_suscripciones (
  id          uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references public.usuarios(id) on delete cascade,

  -- Único de verdad: el mismo teléfono, si se re-suscribe, debe ACTUALIZAR su fila, no crear una
  -- segunda. Sin esto, cada vez que el navegador renueva la suscripción (lo hace solo de tanto en
  -- tanto) se acumularía una fila más y el mismo aviso se enviaría cuatro veces al mismo teléfono.
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,

  -- Para que la persona reconozca sus aparatos si algún día se le listan ("iPhone de Ana"). No es
  -- identificación de seguridad: un user-agent se falsifica sin esfuerzo.
  user_agent  text,
  creado_en   timestamptz not null default now()
);

create index if not exists idx_push_suscripciones_empleado
  on public.push_suscripciones (empleado_id);

comment on table public.push_suscripciones is
  'Aparatos donde cada persona aceptó recibir push. NADIE la lee desde el navegador (el endpoint es un canal directo a un teléfono); solo la service role, para enviar. Cada quien escribe y borra la suya.';

alter table public.push_suscripciones enable row level security;

-- Los GRANT, explícitos y en los dos sentidos: no se dejan al azar de qué rol aplique la
-- migración (esa lección la enseñó cotejo_intentos en la 047). El empleado inserta y borra; NO
-- selecciona: la privacidad de la tabla depende de que nadie pueda leerla desde el cliente.
grant insert, delete on public.push_suscripciones to authenticated;
revoke select, update on public.push_suscripciones from authenticated;
grant select, insert, update, delete on public.push_suscripciones to service_role;

-- Cada quien da de alta SU teléfono, en SU nombre. El with check impide suscribir a otro.
drop policy if exists push_insert_propia on public.push_suscripciones;
create policy push_insert_propia
  on public.push_suscripciones for insert
  with check (empleado_id = (select public.current_usuario_id()));

-- Y borra las suyas (dejar de recibir, o limpiar un teléfono viejo).
drop policy if exists push_delete_propia on public.push_suscripciones;
create policy push_delete_propia
  on public.push_suscripciones for delete
  using (empleado_id = (select public.current_usuario_id()));

-- No hay policy de SELECT ni de UPDATE para el cliente. A propósito: leer la tabla es cosa del
-- servidor, y actualizar una suscripción se hace borrando y volviendo a insertar (el upsert por
-- endpoint lo resuelve el servidor con la service role).


-- ----------------------------------------------------------------------------
-- Rollback
-- ----------------------------------------------------------------------------
--   drop table if exists public.push_suscripciones;
