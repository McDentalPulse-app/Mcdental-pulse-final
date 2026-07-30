-- RH entra a la tabla `mensajes`, para poder escribirle a Soporte TI.
--
-- QUÉ PASABA: las policies de `mensajes` listaban admin/psicologa/empleado/doctor y dejaban
-- fuera a `rh`. Con el canal de Soporte TI (migración 094) eso significa que la única persona
-- del organigrama que NO podía reportar una falla de TI por Mensajes era justo RH.
--
-- QUÉ NO CAMBIA — y es el motivo por el que RH estaba fuera: el canal confidencial
-- empleado ↔ psicóloga sigue siendo suyo y de nadie más. La regla de SELECT solo deja ver un
-- mensaje a quien lo escribió o lo recibió, así que meter a `rh` en la lista NO le abre las
-- conversaciones de otros: le permite tener las propias. La única excepción sigue siendo
-- es_soporte_ti(), que existe para que el buzón compartido pueda leerse, y esa bandera la
-- tienen dos personas concretas, no un rol.
--
-- En la interfaz, admin y RH solo ven la conversación de Soporte TI: nunca la de la psicóloga.
-- Pero la garantía de confidencialidad vive aquí, en RLS, no en la pantalla.

begin;

drop policy if exists mensajes_insert_as_sender on public.mensajes;

create policy mensajes_insert_as_sender
  on public.mensajes for insert
  with check (
    (select public.current_role()) in ('admin', 'rh', 'psicologa', 'empleado', 'doctor')
    and de_id = (select public.current_usuario_id())
  );

drop policy if exists mensajes_select_participant on public.mensajes;

create policy mensajes_select_participant
  on public.mensajes for select
  using (
    (
      (select public.current_role()) in ('admin', 'rh', 'psicologa', 'empleado', 'doctor')
      and (
        de_id = (select public.current_usuario_id())
        or para_id = (select public.current_usuario_id())
      )
    )
    -- Buzón compartido: quien atiende soporte lee el hilo aunque no sea el destinatario.
    or (canal = 'soporte' and (select public.es_soporte_ti()))
  );

commit;
