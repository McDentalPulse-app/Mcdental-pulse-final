import { useGlobal } from "../contexts/GlobalContext";
import { useNotification } from "../contexts/NotificationContext";
import { updateUsuario } from "../services/supabase/usuariosService";

/**
 * Baja de un empleado, con los dos niveles que se usan en la clínica.
 *
 *   Desactivar  -> sigue en la lista como "Inactivo". No puede entrar a la app
 *                  (AuthContext cierra la sesión de quien tenga `inactivo`).
 *   Archivar    -> desaparece de la lista. Tampoco entra. NADA se borra: checadas,
 *                  encuestas y fotos de rostro quedan intactas, y se puede restaurar.
 *
 * Deliberadamente no hay borrado en cascada detrás de ningún botón: archivar es
 * reversible y un despido mal tecleado no debería destruir el historial de nadie.
 *
 * Vive como hook y no dentro de una pantalla porque lo comparten Gestión de Personal
 * y el listado de Empleados, y el flujo de confirmaciones tiene que ser el mismo en
 * los dos sitios.
 */
export const useBajaUsuario = () => {
  const { setUsuarios } = useGlobal();
  const { toast, confirm } = useNotification();

  const aplicar = async (empleado, cambios, mensajeOk) => {
    try {
      await updateUsuario(empleado.id, cambios);
      setUsuarios((prev) => prev.map((u) => (u.id === empleado.id ? { ...u, ...cambios } : u)));
      toast.success(mensajeOk);
      return true;
    } catch (error) {
      console.error("Error cambiando el estado del usuario:", error);
      toast.error(error?.message || "No se pudo cambiar el estado del usuario.");
      return false;
    }
  };

  /** Pregunta desactivar vs archivar; archivar pide una segunda confirmación. */
  const pedirBaja = async (empleado) => {
    const quiereArchivar = await confirm({
      title: `Baja de ${empleado.name}`,
      description:
        "Desactivar: deja de entrar a la app pero sigue en la lista como inactivo. " +
        "Archivar: además desaparece de la lista (se puede restaurar después).",
      variant: "warning",
      confirmText: "Archivar",
      cancelText: "Solo desactivar",
    });

    if (!quiereArchivar) {
      return aplicar(empleado, { inactivo: true }, `${empleado.name} quedó inactivo.`);
    }

    const seguro = await confirm({
      title: `¿Archivar a ${empleado.name}?`,
      description:
        "Va a desaparecer de la lista y no va a poder entrar. No se borra nada: su historial " +
        "queda guardado y podés restaurarlo desde el filtro «Archivados».",
      variant: "danger",
      confirmText: "Sí, archivar",
      cancelText: "Cancelar",
    });
    if (!seguro) return false;

    return aplicar(
      empleado,
      { inactivo: true, archivado: true },
      `${empleado.name} fue archivado. Podés restaurarlo desde el filtro «Archivados».`
    );
  };

  /**
   * Restaurar. Vuelve a la lista COMO INACTIVO, no activo: restaurar es deshacer un
   * archivado equivocado, y no debería devolverle el acceso a la app sin que alguien
   * lo decida explícitamente con el botón de Activar.
   */
  const restaurar = async (empleado) => {
    const seguro = await confirm({
      title: `Restaurar a ${empleado.name}`,
      description: "Vuelve a la lista como inactivo. Para que pueda entrar de nuevo hay que activarlo.",
      confirmText: "Restaurar",
    });
    if (!seguro) return false;

    return aplicar(empleado, { archivado: false }, `${empleado.name} volvió a la lista como inactivo.`);
  };

  const activar = async (empleado) =>
    aplicar(empleado, { inactivo: false }, `${empleado.name} fue activado.`);

  return { pedirBaja, restaurar, activar };
};
