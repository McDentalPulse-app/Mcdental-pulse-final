-- Permiso "entrada libre": mismo patrón exacto que puede_marcar_salida_sin_geocerca
-- (migración 127), pero para ENTRADA y con dos efectos a la vez: sin geocerca y sin
-- retardo. A diferencia de la salida (que aplica siempre que está encendida), esta se
-- pide caso por caso — un interruptor en el propio Checador que el empleado prende
-- antes de marcar (ver migración 136 para la lógica del lado del servidor).

alter table public.usuarios
  add column if not exists puede_marcar_entrada_libre boolean not null default false;

comment on column public.usuarios.puede_marcar_entrada_libre is
  'Permite, cuando la persona prende el interruptor en su Checador, registrar la ENTRADA '
  'sin exigir geocerca y sin que salga como retardo (la hora guardada pasa a ser la de '
  'inicio de turno). No aplica solo; hace falta pedirlo en cada checada. Se otorga desde '
  'gestión.';

-- No hace falta protegerlo de auto-otorgamiento: el trigger
-- prevent_usuario_privilege_escalation (migración 103) ya cubre esto.
