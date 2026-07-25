-- Centro de notificaciones in-app: la bandeja persistente que faltaba.
--
-- Hasta aquí una notificación era push efímero (frágil: claves, iOS sin instalar, permisos) o
-- un toast transitorio. Si no la viste en el momento, se perdía. Esta tabla es la FUENTE DE
-- VERDAD: cada evento deja una fila que el usuario ve en la campana aunque el push no llegue.
-- El push pasa a ser el "empujón" encima (api/_notificaciones.js: notificar() hace las dos).
--
-- Una fila POR DESTINATARIO (no compartida): la campana de cada quien es suya, con su propio
-- 'leida'. Los eventos de gestión (checada sospechosa, rostro registrado) se insertan una vez
-- por cada persona de gestión, igual que enviarARH ya reparte el push a individuos.

create table public.notificaciones (
  id          uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references public.usuarios(id) on delete cascade,
  -- tipo: 'rostro' | 'permiso' | 'vacacion' | 'mensaje' | 'checada' | 'encuesta' | 'ticket'.
  -- Texto libre a propósito: agregar un tipo nuevo no debe exigir tocar un enum ni migrar.
  tipo        text not null,
  titulo      text not null,
  cuerpo      text,
  url         text default '/',
  leida       boolean not null default false,
  creada_en   timestamptz not null default now()
);

-- La consulta de la campana: las de un empleado, más recientes primero.
create index notificaciones_empleado_idx on public.notificaciones (empleado_id, creada_en desc);
-- El contador de no-leídas: índice parcial, solo las que importan para el badge.
create index notificaciones_noleidas_idx on public.notificaciones (empleado_id) where leida = false;

alter table public.notificaciones enable row level security;

-- Cada quien ve SOLO las suyas. Vale para la consulta y para el realtime (que respeta esta
-- misma policy al decidir qué filas empujar a cada cliente).
create policy notificaciones_select_own on public.notificaciones
  for select using (empleado_id = (select public.current_usuario_id()));

-- Y marca leídas SOLO las suyas. Sin poder cambiar el destinatario (with check), o alguien
-- reasignaría una notificación ajena a su propia cuenta.
create policy notificaciones_update_own on public.notificaciones
  for update
  using (empleado_id = (select public.current_usuario_id()))
  with check (empleado_id = (select public.current_usuario_id()));

-- Insertar y borrar (la purga del cron) es cosa del servidor. No hay policy de insert/delete
-- para clientes: nadie se fabrica notificaciones ni las borra desde el navegador.
grant select, update on public.notificaciones to authenticated;
grant select, insert, update, delete on public.notificaciones to service_role;

-- Realtime: para que el badge suba solo cuando llega una notificación, sin recargar.
alter publication supabase_realtime add table public.notificaciones;
