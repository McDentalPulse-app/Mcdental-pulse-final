-- ============================================================================
-- Rol 'doctor' (parte 1/2): agregar el valor al enum.
--
-- Los ~54 dentistas hoy viven como role='empleado' distinguidos solo por `puesto`
-- (Doctora/Doctor/…). Se les da un rol propio para colgarles menús extra (Comisiones,
-- Calendario de intercambio) sin perder NADA de lo que ya tienen como empleado.
--
-- ¿Por qué en su propio archivo? Postgres no deja USAR un valor de enum recién agregado
-- dentro de la MISMA transacción que lo crea. El backfill (UPDATE ... role='doctor') y las
-- policies que mencionan 'doctor' van en la migración 073, ya en otra transacción.
-- ============================================================================

alter type public.rol_usuario add value if not exists 'doctor';
