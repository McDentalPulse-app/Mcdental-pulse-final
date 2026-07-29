-- ============================================================================
-- Latidos del respaldo externo (migración 093).
--
-- POR QUÉ EXISTE ESTA TABLA.
--
-- El respaldo fuera de la VPS lo TIRA la máquina de la oficina, no lo empuja la
-- VPS. Eso es deliberado —una VPS comprometida no debe tener credenciales hacia
-- la red interna de la clínica— pero deja un hueco: la VPS no puede comprobar si
-- la copia se hizo. Si la máquina de la oficina se apaga en vacaciones, o el disco
-- se llena, o alguien desenchufa el cable de red, el respaldo externo deja de
-- existir Y NADIE SE ENTERA. Un respaldo que se cree que existe es peor que no
-- tenerlo: se toman decisiones confiando en él.
--
-- Así que se invierte: la oficina AVISA cada día de cómo le fue, y la VPS vigila
-- el silencio. Si no llega el latido, salta el aviso a gestión.
--
-- No guarda datos de nadie: solo si el respaldo de anoche funcionó.
-- ============================================================================

create table if not exists public.respaldo_latidos (
  id          uuid primary key default gen_random_uuid(),
  recibido_en timestamptz not null default now(),
  ok          boolean     not null,
  -- Qué fichero se copió y su huella. Permite comprobar a ojo, meses después, que
  -- la copia de la oficina es la misma que la de la VPS y no una versión trunca.
  archivo     text,
  sha256      text,
  bytes       bigint,
  -- En qué falló, o 'silencio' cuando lo escribe la propia vigilancia de la VPS
  -- porque no llegó ningún latido.
  detalle     text
);

comment on table public.respaldo_latidos is
  'Parte diario del respaldo externo. Lo escribe la máquina de la oficina tras copiar y VERIFICAR el dump. Su ausencia es la señal de alarma, no su contenido.';

create index if not exists idx_respaldo_latidos_recibido
  on public.respaldo_latidos (recibido_en desc);

-- ── RLS ────────────────────────────────────────────────────────────────────
-- Escribe solo el servidor (service role, que se salta la RLS). Lee solo admin:
-- el estado del respaldo es información de infraestructura, no algo que deba ver
-- un empleado. Sin política de insert/update/delete: nadie con sesión normal
-- puede fabricar un latido falso y hacer creer que hay respaldo.
alter table public.respaldo_latidos enable row level security;

drop policy if exists respaldo_latidos_select_admin on public.respaldo_latidos;
create policy respaldo_latidos_select_admin on public.respaldo_latidos
  for select using (
    exists (
      select 1 from public.usuarios u
      where u.id = (select current_usuario_id())
        and u.role = 'admin'
    )
  );

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN:
--   insert desde el servidor (service role)            -> OK
--   select como admin                                  -> ve las filas
--   select como empleado                               -> 0 filas
--   insert como admin (sesión normal)                  -> rechazado
--
-- ROLLBACK: drop table public.respaldo_latidos;
-- ----------------------------------------------------------------------------
