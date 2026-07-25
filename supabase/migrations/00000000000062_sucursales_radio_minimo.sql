-- Permite radios de geocerca más chicos (5-20 m), a pedido del dueño (2026-07-16).
--
-- AVISO dejado en el código, no solo en el historial de chat: el GPS de un celular en
-- interior suele tener un margen de error real de 10-30 m. Con un radio de 5-10 m es
-- esperable que empleados reales queden marcados "fuera de geocerca" con cierta frecuencia
-- aunque estén parados adentro de la clínica — no es un bug del checador, es una
-- limitación física del GPS. checar.js ya no bloquea por esto (marca 'fuera' pero deja
-- checar), así que el riesgo real es más ruido en el panel de revisión de RH que checadas
-- perdidas.

alter table public.sucursales drop constraint if exists sucursales_radio_m_check;
alter table public.sucursales add constraint sucursales_radio_m_check
  check (radio_m between 5 and 5000);
