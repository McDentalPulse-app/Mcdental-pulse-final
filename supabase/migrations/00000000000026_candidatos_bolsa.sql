-- Bolsa de trabajo: candidatos filtrados que llegan desde la app de reclutamiento
-- McDental Talent. Talent escribe con la service_role key (bypassa RLS); en Pulse
-- solo rh/admin pueden leer. Tabla aditiva: no toca ninguna tabla existente.
create table if not exists public.candidatos_bolsa (
  id                   uuid primary key default gen_random_uuid(),
  talent_candidato_id  integer not null unique,  -- id del candidato en Talent (idempotencia)
  nombre               text not null,
  vacante              text not null,
  ciudad               text,
  telefono             text,
  email                text,
  score                integer not null default 0,
  semaforo             text not null default 'yellow',  -- green | yellow | red
  estado               text not null default 'pending_rh',
  escolaridad          text,
  experiencia          text,
  disponibilidad       text,
  expectativa_salarial text,
  notas                text,
  aplicado_en          date,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists idx_candidatos_bolsa_estado
  on public.candidatos_bolsa(estado);

drop trigger if exists trg_candidatos_bolsa_updated_at on public.candidatos_bolsa;
create trigger trg_candidatos_bolsa_updated_at
  before update on public.candidatos_bolsa
  for each row execute function public.set_updated_at();

alter table public.candidatos_bolsa enable row level security;

-- Lectura solo para rh/admin (usa el helper existente public.current_role()).
-- No hay política de escritura: Talent escribe con service_role, que bypassa RLS.
drop policy if exists candidatos_bolsa_select_rh_admin on public.candidatos_bolsa;
create policy candidatos_bolsa_select_rh_admin
  on public.candidatos_bolsa for select
  using (public.current_role() in ('admin', 'rh'));
