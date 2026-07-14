-- ============================================================================
-- Calibración del cotejo: medir el umbral, y avisar de los parecidos.
--
-- EL UMBRAL (0.50) ESTÁ CALIBRADO CON UNA PERSONA REAL Y UN IMPOSTOR. Con eso bastó para
-- descubrir que el valor de fábrica (0.363) dejaba pasar a un impostor por 0.003 — pero no
-- basta para dormir tranquilo. Un umbral es una raya entre dos nubes de números, y hasta que
-- no se ven las dos nubes con datos de verdad, la raya está donde alguien la puso a ojo.
--
-- Los datos YA se están guardando: `asistencias.match_score` (los que pasan) y
-- `cotejo_intentos.score` (los que no). Esta migración no los inventa: los hace VISIBLES.
--
-- EL CASO DIFÍCIL NUNCA FUE EL DESCONOCIDO. En las pruebas reales un desconocido daba 0.04-0.17
-- —ni se acerca— pero dos personas parecidas llegaron a 0.37. El peligro no es el extraño: es
-- el hermano, el primo, el que se le parece. Por eso `parecido_maximo` / `parecido_con`: cuando
-- RH aprueba una cara, el servidor la compara contra TODAS las demás ya enroladas y deja dicho
-- a quién se parece demasiado. Con 60 empleados son 60 comparaciones de 128 números:
-- milisegundos. Sin este aviso, dos caras que el cotejo puede confundir conviven en el sistema
-- y nadie lo sabe hasta que una checa por la otra.
--
-- Y DE PASO, LAS DOS COLUMNAS QUE NECESITA EL ANTI-SUPLANTACIÓN (que llega después):
--
--   - `liveness_score`: lo que opina el modelo anti-spoofing sobre si esa cara es una cara o
--     la FOTO de una cara. Nace EN MODO SOMBRA: se mide y no bloquea a nadie. Es exactamente
--     la lección del 0.363 — un umbral que no se ha medido con los teléfonos, la luz y la gente
--     de esta clínica no es un umbral, es una corazonada. Y como el cotejo SÍ bloquea, un falso
--     positivo del anti-spoofing sería una persona real que no puede fichar.
--   - `reto_superado`: si al empleado le tocó el reto de girar la cabeza y lo pasó. `null` = no
--     se le pidió (se pide al azar, no siempre).
--
-- Nacen aquí, vacías, para que el módulo que las llena no tenga que tocar la base.
-- ============================================================================

alter table public.rostros
  add column if not exists parecido_maximo real,
  add column if not exists parecido_con    uuid references public.usuarios(id) on delete set null;

comment on column public.rostros.parecido_maximo is
  'Parecido con la cara MÁS parecida de otro empleado, medido al aprobar. Por encima de ~0.40 el cotejo podría confundirlos. Lo calcula api/aprobar-rostro.js.';
comment on column public.rostros.parecido_con is
  'El empleado al que se parece. Se pone en null si ese empleado se borra: el aviso deja de tener sentido si la otra cara ya no existe.';

alter table public.asistencias
  add column if not exists liveness_score real,
  add column if not exists reto_superado  boolean;

comment on column public.asistencias.liveness_score is
  'Anti-spoofing, EN MODO SOMBRA: 1 = cara real, 0 = foto de una foto. No bloquea a nadie. Se activará cuando haya semanas de datos reales y el umbral esté MEDIDO, no supuesto.';
comment on column public.asistencias.reto_superado is
  'El reto de girar la cabeza: true = lo pasó, false = falló, null = NO SE LE PIDIÓ (se pide al azar). Lo decide el servidor recalculando la pose, nunca el navegador.';


-- ----------------------------------------------------------------------------
-- Los permisos de cotejo_intentos, que hoy dependen de QUIÉN aplicó la migración.
-- ----------------------------------------------------------------------------
-- La migración 043 creó la policy `cotejo_intentos_select_admin_rh` (RH puede ver los intentos
-- fallidos) pero solo hizo `grant ... to service_role`. Y ahí el permiso de `authenticated` se
-- quedó a merced de los DEFAULT PRIVILEGES, que en Supabase NO son los mismos según el rol que
-- ejecute la migración:
--
--   - aplicada por `supabase_admin` (así lo hace la CLI): authenticated hereda arwdDxtm — TODO.
--   - aplicada por `postgres`:                            authenticated hereda Dxtm — NADA útil.
--
-- Es decir: la misma migración, el mismo SQL, y la pantalla de calibración funciona o sale
-- VACÍA —sin un solo error que lo explique— según por dónde entró el archivo. En un caso RH lee
-- los rechazos; en el otro, Postgres corta antes siquiera de mirar la policy, porque RLS decide
-- QUÉ FILAS ves y el GRANT decide SI PUEDES MIRAR LA TABLA: son dos puertas y hay que abrir las
-- dos. Un permiso que depende de quién ejecutó el script es un permiso que no se ha decidido.
--
-- Aquí se decide, explícitamente y en los dos sentidos:
grant select on public.cotejo_intentos to authenticated;

-- Y se quitan los DML que en el camino "supabase_admin" llegan de regalo. Hoy no hacen daño
-- —RLS no tiene ninguna policy de insert/delete para el empleado, y lo para en seco— pero un
-- GRANT abierto solo espera a que alguien añada una policy descuidada. Si un empleado pudiera
-- borrar sus intentos fallidos, reiniciaría el contador y tendría intentos infinitos para colar
-- una cara ajena; si pudiera insertarlos, podría ahogar la señal que RH usa para detectarlo.
-- Escribir aquí es cosa del servidor, y solo del servidor.
revoke insert, update, delete on public.cotejo_intentos from authenticated;

-- Y el comentario de la tabla se quedó viejo: describía una "válvula de escape" (tras N fallos
-- se dejaba pasar la checada, marcada) que se ELIMINÓ. El bloqueo es estricto: si la cara no
-- coincide, no se registra la checada. Un comentario que miente sobre una regla de seguridad es
-- peor que no tener comentario.
comment on table public.cotejo_intentos is
  'Intentos de checada en los que la cara NO coincidió. Solo los escribe api/checar.js. No hay válvula de escape: si no coincide, no se registra la checada. Sirven para dos cosas: frenar al que insiste (tope por ventana de tiempo) y, sobre todo, para calibrar el umbral — son la nube de los rechazos. Se purgan a los 30 días (migración 046).';


-- ----------------------------------------------------------------------------
-- Rollback
-- ----------------------------------------------------------------------------
--   alter table public.rostros drop column if exists parecido_maximo, drop column if exists parecido_con;
--   alter table public.asistencias drop column if exists liveness_score, drop column if exists reto_superado;
--   revoke select on public.cotejo_intentos from authenticated;
