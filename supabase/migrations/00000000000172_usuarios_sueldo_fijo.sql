-- Sueldo fijo: la persona cobra su sueldo semanal completo, sin descuentos por asistencia
-- (faltas, retardos, salidas anticipadas), y aparece en Nómina aunque su cuenta esté oculta
-- (mig. 170).
--
-- Caso de uso (pedido del dueño, 2026-09-26): la psicóloga no checa en la app. Sin esto, cada
-- día de su horario contaba como falta y la nómina se comía casi todo su sueldo. Es por
-- persona y no por rol a propósito: el dueño decidió que RH siga con descuentos normales.

alter table public.usuarios
  add column if not exists sueldo_fijo boolean not null default false;

comment on column public.usuarios.sueldo_fijo is
  'Cobra el sueldo semanal completo, sin descuentos por asistencia. Aparece en Nómina aunque esté oculta.';
