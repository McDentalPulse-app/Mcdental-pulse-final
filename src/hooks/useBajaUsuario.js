import { useGlobal } from "../contexts/GlobalContext";
import { useNotification } from "../contexts/NotificationContext";
import {
  updateUsuario,
  eliminarUsuario,
  contarHistorialUsuario,
} from "../services/supabase/usuariosService";

/**
 * Baja de un empleado, con los dos niveles que se usan en la clínica.
 *
 *   Desactivar  -> sigue en la lista como "Inactivo". No puede entrar a la app
 *                  (AuthContext cierra la sesión de quien tenga `inactivo`).
 *   Archivar    -> desaparece de la lista. Tampoco entra. NADA se borra: checadas,
 *                  encuestas y fotos de rostro quedan intactas, y se puede restaurar.
 *   Borrar      -> ya no existe. Cascada a 23 tablas, sin papelera y sin vuelta atrás.
 *
 * Los dos primeros los pueden los tres roles de gestión. El tercero SOLO el admin, y solo
 * sobre alguien ya archivado: "rh y psico solo archivan, admin borra definitivamente"
 * (decisión del dueño, 2026-08-07). Archivar sigue siendo el camino normal de una baja —
 * un despido mal tecleado no debe destruir el historial de nadie.
 *
 * Vive como hook y no dentro de una pantalla porque lo comparten Gestión de Personal
 * y el listado de Empleados, y el flujo de confirmaciones tiene que ser el mismo en
 * los dos sitios.
 */
export const useBajaUsuario = () => {
  const { setUsuarios } = useGlobal();
  const { toast, confirm, prompt } = useNotification();

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

  /**
   * Borrado DEFINITIVO. Solo lo llama la papelera del admin sobre una fila archivada; quien
   * decide si ese botón existe es la pantalla, y la Edge Function lo vuelve a comprobar.
   *
   * Dos puertas, y la segunda obliga a teclear:
   *   1. Los números de lo que se pierde. Un "¿seguro?" a secas no informa; "412 checadas y 38
   *      encuestas" sí, y es justo el dato que hace recular a tiempo.
   *   2. Escribir el nombre exacto. Es lo que separa esto de un clic mal dado en la fila de al
   *      lado — la única acción de la app que no se puede deshacer merece esa fricción.
   */
  const eliminarDefinitivo = async (empleado) => {
    // Se cuenta ANTES de preguntar: preguntar y luego contar dejaría al admin decidiendo a
    // ciegas mientras carga. Si el conteo falla se sigue adelante, pero diciéndolo.
    const historial = await contarHistorialUsuario(empleado.id);

    const piezas = historial
      ? [
          [historial.checadas, "checadas"],
          [historial.encuestas, "encuestas"],
          [historial.notas, "notas psicológicas"],
          [historial.archivos, "archivos de expediente"],
          [historial.comisiones, "comisiones"],
          [historial.reconocimientos, "reconocimientos"],
        ].filter(([n]) => n > 0)
      : null;

    let queSePierde;
    if (piezas === null) {
      queSePierde = "No se pudo calcular qué historial tiene, así que puede haber más de lo que parece.";
    } else if (piezas.length === 0) {
      queSePierde = "No tiene historial registrado: no hay checadas, encuestas ni notas que perder.";
    } else {
      queSePierde =
        "Se borrarán también " +
        piezas.map(([n, etiqueta]) => `${n} ${etiqueta}`).join(", ") +
        ".";
    }

    const seguro = await confirm({
      title: `Borrar definitivamente a ${empleado.name}`,
      description:
        `${queSePierde} Esto NO se puede deshacer: no queda en «Archivados» ni en ninguna ` +
        `papelera. Si solo quieres que deje de aparecer, restaurar y archivar ya hacen eso.`,
      variant: "danger",
      confirmText: "Entiendo, continuar",
      cancelText: "Cancelar",
    });
    if (!seguro) return false;

    const tecleado = await prompt({
      title: "Escribe el nombre para confirmar",
      description: `Para borrar a esta persona, escribe exactamente: ${empleado.name}`,
      placeholder: empleado.name,
      confirmText: "Borrar definitivamente",
    });
    if (tecleado === null) return false;

    // Se comparan sin espacios sobrantes ni mayúsculas: el objetivo de teclear el nombre es
    // frenar el clic automático, no examinar de mecanografía.
    if (tecleado.trim().toLocaleLowerCase() !== empleado.name.trim().toLocaleLowerCase()) {
      toast.error("El nombre no coincide. No se borró nada.");
      return false;
    }

    try {
      await eliminarUsuario(empleado.id);
      setUsuarios((prev) => prev.filter((u) => u.id !== empleado.id));
      toast.success(`${empleado.name} fue borrado definitivamente.`);
      return true;
    } catch (error) {
      console.error("Error borrando al usuario:", error);
      toast.error(error?.message || "No se pudo borrar al usuario.");
      return false;
    }
  };

  return { pedirBaja, restaurar, activar, eliminarDefinitivo };
};
