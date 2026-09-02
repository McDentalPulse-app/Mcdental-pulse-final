-- ============================================================================
-- Módulos apagables por persona (parte 1/2): columnas.
--
-- 6 interruptores nuevos, uno por módulo que hoy no tiene ninguno (Comisiones,
-- Checador, Notas, Departamentos, Avisos, Encuestas). Default TRUE: nadie pierde
-- acceso al desplegar esto — Admin+ los apaga a quien quiera después, desde el
-- panel Módulos (ModulosPanel.jsx).
--
-- Mismo patrón que los 6 interruptores que ya existen (puede_gestionar_bodega y
-- compañía, migraciones 120-135): una columna booleana en usuarios, nada más.
-- ============================================================================

alter table public.usuarios
  add column if not exists puede_ver_comisiones boolean not null default true,
  add column if not exists puede_usar_checador boolean not null default true,
  add column if not exists puede_usar_notas boolean not null default true,
  add column if not exists puede_ver_departamentos boolean not null default true,
  add column if not exists puede_ver_avisos boolean not null default true,
  add column if not exists puede_ver_encuestas boolean not null default true;
