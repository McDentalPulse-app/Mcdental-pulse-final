-- Enums de dominio
create type public.rol_usuario as enum ('admin', 'rh', 'psicologa', 'empleado');
create type public.estado_solicitud as enum ('pendiente', 'aprobado', 'rechazado');
create type public.estado_descuento as enum ('pendiente', 'activo', 'pagado', 'cancelado');
create type public.estado_reporte as enum ('nuevo', 'revisado', 'cerrado');
create type public.origen_solicitud as enum ('empleado', 'rh');
create type public.tipo_pregunta as enum ('escala', 'sino', 'opcion', 'abierta');
