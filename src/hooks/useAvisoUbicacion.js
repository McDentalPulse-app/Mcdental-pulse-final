import { useCallback, useEffect, useState } from "react";
import { consultarPermiso, pedirPermiso } from "../utils/permisosDispositivo";
import { useNotification } from "../contexts/NotificationContext";

/**
 * El aviso de "activa tu ubicación", hermano de useAvisoPush.
 *
 * POR QUÉ ESTE SÍ INTERRUMPE Y LOS OTROS PERMISOS NO: sin ubicación, ChecadorEmpleado deja el
 * candado en `sin_gps` y el botón de fichar se queda deshabilitado. Hoy la persona solo ve un
 * botón muerto, sin ninguna explicación, y se entera a las ocho de la mañana con la clínica
 * abriendo. Los demás permisos degradan la experiencia; este impide trabajar.
 *
 * Se puede cerrar, pero solo por esta sesión (sessionStorage, no localStorage): callarse para
 * siempre nos devolvería exactamente al problema de hoy.
 */
const RETRASO_MS = 2500;
const CLAVE_CERRADO = "pulse:aviso-ubicacion-cerrado";

export const useAvisoUbicacion = () => {
  const { toast } = useNotification();
  const [estado, setEstado] = useState(null); // null = todavía sin comprobar
  const [cerrado, setCerrado] = useState(() => sessionStorage.getItem(CLAVE_CERRADO) === "1");

  useEffect(() => {
    let vivo = true;
    const t = setTimeout(async () => {
      const e = await consultarPermiso("ubicacion");
      if (vivo) setEstado(e);
    }, RETRASO_MS);
    return () => { vivo = false; clearTimeout(t); };
  }, []);

  const activarUbicacion = useCallback(async () => {
    const resultado = await pedirPermiso("ubicacion");
    setEstado(resultado);
    if (resultado === "granted") toast.success("Listo, ya puedes registrar tu entrada.");
    else if (resultado === "denied") toast.info("Quedó bloqueada. Puedes reactivarla desde Mi perfil.");
  }, [toast]);

  const cerrarAviso = useCallback(() => {
    sessionStorage.setItem(CLAVE_CERRADO, "1");
    setCerrado(true);
  }, []);

  // 'no-soportado' no se avisa: no hay nada que la persona pueda hacer y sería ruido puro.
  const ofrecerUbicacion = !cerrado && (estado === "prompt" || estado === "denied");

  return { ofrecerUbicacion, estadoUbicacion: estado, activarUbicacion, cerrarAviso };
};
