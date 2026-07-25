-- ============================================================================
-- Avisos: firma del autor visible para todos + espera de "De acuerdo" configurable
-- (migración 084).
--
-- 1) QUIÉN LO ENVIÓ. El panel traía el autor con un join a `usuarios`, pero la RLS de esa
--    tabla solo deja a cada quien leer SU PROPIA fila (usuarios_select_own; admin/rh/
--    psicologa sí ven todas). Resultado: al empleado — justo a quien va dirigido el
--    comunicado — el join le volvía vacío y la pantalla mostraba "—". Abrir `usuarios` a
--    toda la plantilla para rescatar un nombre sería regalar el directorio entero, así que
--    el aviso se FIRMA al publicarse: nombre y rol del autor se copian a la propia fila del
--    aviso, que todos sí pueden leer.
--
--    La copia es deliberada, no una desnormalización perezosa: un comunicado firmado
--    conserva quién lo firmó aunque esa persona después cambie de nombre o de puesto
--    (mismo criterio que `otorgadoPor` en reconocimientos). Por eso el trigger es solo
--    BEFORE INSERT: editar el texto de un aviso no le cambia la firma.
--
-- 2) EL TEMPORIZADOR. Los 30 segundos mínimos antes de poder pulsar "De acuerdo" estaban
--    clavados en el código (SEGUNDOS_ESPERA en AvisoModal.jsx): moverlos exigía compilar y
--    redesplegar el frontend. Pasan a `ajustes` — la fila única de configuración global —
--    editable por admin, igual que `exigir_rostro` (migración 044).
-- ============================================================================

-- ── 1) Firma del autor en el propio aviso ──────────────────────────────────
alter table public.avisos add column if not exists autor_nombre text;
alter table public.avisos add column if not exists autor_rol public.rol_usuario;

comment on column public.avisos.autor_nombre is
  'Nombre de quien publicó, copiado al insertar. Existe porque la RLS de usuarios no deja a un empleado leer la fila del autor. Migración 084.';
comment on column public.avisos.autor_rol is
  'Rol de quien publicó al momento de publicar (admin/rh/psicologa). Se congela: la firma no cambia si la persona cambia de rol.';

-- security definer: el aviso lo publica gestión (que sí puede leer `usuarios`), pero así el
-- trigger tampoco depende de la RLS del que llame — si mañana un endpoint con service_role
-- inserta un aviso, la firma sale igual.
create or replace function public.avisos_firmar_autor()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  select u.name, u.role into new.autor_nombre, new.autor_rol
  from public.usuarios u
  where u.id = new.creado_por;
  return new;
end;
$function$;

drop trigger if exists trg_avisos_firmar_autor on public.avisos;
create trigger trg_avisos_firmar_autor
  before insert on public.avisos
  for each row execute function public.avisos_firmar_autor();

-- Backfill de los avisos ya publicados (en prod hay pocos; en local puede no haber ninguno).
update public.avisos a
set autor_nombre = u.name,
    autor_rol    = u.role
from public.usuarios u
where u.id = a.creado_por
  and a.autor_nombre is null;

-- ── 2) Espera configurable del botón "De acuerdo" ──────────────────────────
alter table public.ajustes
  add column if not exists avisos_segundos smallint not null default 30;

-- Tope de 300 s (5 min) a propósito: sin límite, un cero de más ("300" → "3000") dejaría a
-- toda la plantilla presa del modal casi una hora, sin forma de cerrarlo — el aviso es
-- bloqueante por diseño. 0 es válido y significa "sin espera".
alter table public.ajustes drop constraint if exists ajustes_avisos_segundos_rango;
alter table public.ajustes add constraint ajustes_avisos_segundos_rango
  check (avisos_segundos between 0 and 300);

comment on column public.ajustes.avisos_segundos is
  'Segundos que el botón "De acuerdo" del modal de avisos permanece deshabilitado. 0 = sin espera, tope 300. Lo cambia solo admin (ajustes_update_admin). Migración 084.';

-- No hacen falta grants ni policies nuevas: `ajustes` ya concede SELECT a authenticated y su
-- UPDATE está acotado a admin por ajustes_update_admin (migración 044), que aplica a la fila
-- entera y por lo tanto también a esta columna.

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN:
--   (como rh) insert into avisos (titulo, cuerpo, creado_por, sucursales)
--     values ('Prueba', 'Cuerpo', current_usuario_id(), ARRAY['McDental Palmas']);
--   select autor_nombre, autor_rol from avisos order by created_at desc limit 1;
--     -> el nombre y el rol de quien insertó, sin haberlos mandado en el INSERT.
--   update avisos set cuerpo = 'otro' where id = <ese>;  -> la firma NO cambia.
--
--   update ajustes set avisos_segundos = 45;   -- (como admin) OK
--   update ajustes set avisos_segundos = 45;   -- (como rh)    UPDATE 0 (RLS)
--   update ajustes set avisos_segundos = 3000; -- rechazado por ajustes_avisos_segundos_rango
--
-- ROLLBACK:
--   drop trigger if exists trg_avisos_firmar_autor on public.avisos;
--   drop function if exists public.avisos_firmar_autor();
--   alter table public.avisos drop column if exists autor_nombre;
--   alter table public.avisos drop column if exists autor_rol;
--   alter table public.ajustes drop constraint if exists ajustes_avisos_segundos_rango;
--   alter table public.ajustes drop column if exists avisos_segundos;
-- ----------------------------------------------------------------------------
