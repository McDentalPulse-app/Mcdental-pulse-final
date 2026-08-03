-- Por qué falló un intento de cotejo, no solo que falló.
--
-- EL PROBLEMA QUE ESTO ARREGLA: hoy los tres fallos posibles caen en la misma tabla sin
-- distinguirse, y api/checar.js avisa a gestión de "Posible suplantación" al tercero, sea cual
-- sea. Medido en producción sobre 7 días: de 66 fallos, 26 eran "no se distingue tu cara" —
-- luz mala, contraluz, encuadre— y solo 7 eran una cara que de verdad no coincidía. Es decir,
-- la mayoría de esos avisos acusaban de suplantación a alguien que peleaba con la iluminación
-- de las ocho de la mañana. Un aviso que casi siempre es falso deja de leerse, y entonces el
-- que sí importa tampoco se lee.
--
-- Con el motivo guardado, el aviso se manda solo cuando la señal es de identidad, y la
-- pantalla de Calibración puede separar "no vemos la cara" de "no es su cara" — que son dos
-- problemas de dos personas distintas: uno lo arregla la cámara, el otro lo mira RH.

alter table public.cotejo_intentos
  add column if not exists motivo text;

comment on column public.cotejo_intentos.motivo is
  'Por qué falló: sin_cara | no_coincide | reto_sin_cara | reto_giro | reto_no_coincide | reto_falta_foto | spoof. '
  'Los de identidad (no_coincide, reto_no_coincide) son los únicos que avisan a gestión. '
  'NULL = intento anterior al 2026-08-03, cuando no se guardaba el motivo.';

-- Los intentos se consultan siempre por empleado dentro de una ventana de minutos (el freno de
-- coste y el contador de avisos). Sin este índice son dos escaneos completos por checada fallida.
create index if not exists idx_cotejo_intentos_empleado_fecha
  on public.cotejo_intentos (empleado_id, creado_en desc);
