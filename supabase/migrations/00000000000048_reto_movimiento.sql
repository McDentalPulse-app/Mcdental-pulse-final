-- ============================================================================
-- El reto de movimiento: que la foto de una foto deje de pasar.
--
-- HOY, SI LE ENSEÑAS A LA CÁMARA UNA FOTO DE LA CARA DE ANA, EL SISTEMA DICE QUE ES ANA. El
-- cotejo compara caras, y la foto de una cara ES esa cara. No hay nada en el cotejo que pueda
-- distinguir una persona de un papel.
--
-- Una foto plana, en cambio, NO PUEDE GIRAR LA CABEZA. Al rotarla delante de la cámara la
-- imagen se comprime, pero la nariz no se mueve respecto a los ojos: no hay relieve, no hay
-- paralaje. Una cabeza de verdad sí. Eso es lo que se le pide.
--
-- ESTAS DOS COLUMNAS SON LO QUE HACE QUE EL RETO NO SEA TEATRO, y merecen la explicación:
--
-- El reto se pide AL AZAR (1 de cada 5 checadas). Si se pidiera siempre, 60 personas girarían la
-- cabeza dos veces al día, todos los días — y alguien acabaría buscando cómo saltárselo. Al
-- azar, el tramposo no sabe cuándo le toca, así que necesita poder pasarlo SIEMPRE.
--
-- Pero un reto al azar tiene un agujero enorme y evidente: SI FALLARLO TE DEJA VOLVER A INTENTAR
-- SIN RETO, no has hecho nada. El impostor reintenta y vuelve a tirar el dado — 4 de cada 5
-- veces le sale "sin reto" y entra igual. El reto sería un peaje que basta con esperar a que no
-- esté.
--
-- Por eso el reto, una vez que sale, SE QUEDA PEGADO al empleado (`reto_pendiente`) hasta que lo
-- pase. No se vuelve a tirar el dado. Quien lo falla se queda con él delante, intento tras
-- intento, y no hay forma de esquivarlo reintentando. Esa es la columna: la memoria de que a
-- esta persona se le pidió algo y todavía no lo ha hecho.
--
-- Y lo elige el SERVIDOR, no el navegador. Si el cliente escogiera el reto, escogería el que ya
-- tiene resuelto. Misma lección que con el match_score: el navegador guía, el servidor juzga.
-- ============================================================================

alter table public.rostros
  add column if not exists reto_pendiente text,
  add column if not exists reto_pedido_en timestamptz;

alter table public.rostros drop constraint if exists rostros_reto_valido;
alter table public.rostros add constraint rostros_reto_valido
  check (reto_pendiente is null or reto_pendiente in ('derecha', 'izquierda'));

comment on column public.rostros.reto_pendiente is
  'Giro de cabeza que este empleado tiene pendiente de superar (null = ninguno). Lo sortea el servidor y SE QUEDA hasta que se pase: si fallarlo permitiera volver a tirar el dado, bastaría con reintentar hasta que saliera "sin reto".';
comment on column public.rostros.reto_pedido_en is
  'Cuándo se le pidió. Sirve para que RH vea a quién se le está atragantando el reto.';

-- El empleado NO puede escribir en `rostros` (no hay policy de update para él: migración 041), y
-- eso es lo que impide que se borre su propio reto pendiente desde la consola del navegador. Se
-- deja dicho aquí porque es fácil "arreglar" ese hueco por descuido y cargarse el mecanismo
-- entero.


-- ----------------------------------------------------------------------------
-- Rollback
-- ----------------------------------------------------------------------------
--   alter table public.rostros drop constraint if exists rostros_reto_valido;
--   alter table public.rostros drop column if exists reto_pendiente, drop column if exists reto_pedido_en;
