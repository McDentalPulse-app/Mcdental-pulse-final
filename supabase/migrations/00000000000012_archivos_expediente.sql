create table public.archivos_expediente (
  id               uuid primary key default gen_random_uuid(),
  empleado_id      uuid not null references public.usuarios(id) on delete cascade,
  nombre_archivo   text not null,
  tipo_archivo     text,
  ruta_archivo     text not null,   -- path DENTRO del bucket 'expedientes'
                                     -- NOTA: no se persiste una "url" pública descargable (el bucket es privado);
                                     -- las URLs se generan on-demand con signed URLs.
  fecha            date not null default current_date,
  subido_por       uuid references public.usuarios(id),
  created_at       timestamptz not null default now()
);

create index idx_archivos_expediente_empleado_id on public.archivos_expediente(empleado_id);
