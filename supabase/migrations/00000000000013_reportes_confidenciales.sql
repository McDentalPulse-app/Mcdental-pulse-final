create table public.reportes_confidenciales (
  id            uuid primary key default gen_random_uuid(),
  empleado_id   uuid not null references public.usuarios(id) on delete cascade,
  tipo          text,
  urgencia      text,
  descripcion   text not null,
  evidencias    text,
  estado        public.estado_reporte not null default 'nuevo',
  fecha         date not null default current_date,
  created_at    timestamptz not null default now()
  -- NOTA: la columna "visiblePara" de Firestore se elimina; esa lógica pasa a ser RLS.
);

create index idx_reportes_confidenciales_empleado_id on public.reportes_confidenciales(empleado_id);
