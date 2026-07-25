import { useEffect, useState } from "react";
import { soportado, estadoPermiso, activar } from "../services/pushService";
import { useNotification } from "../contexts/NotificationContext";

/**
 * La oferta de activar avisos push, para los roles que no tienen un momento
 * contextual propio como la checada del empleado (ver ChecadorEmpleado.jsx).
 *
 * Se usa en AdminLayout/PsicologaLayout/HRLayout: sin esto, RH/psicóloga/admin nunca
 * ven la invitación a activar push, y enviarARH() (api/_push.js) le manda avisos a
 * gente que jamás pudo suscribirse.
 *
 * El retraso evita que sea un reflejo al arrancar (ver services/pushService.js: en
 * iOS, un "no" no se puede volver a pedir por código).
 */
const RETRASO_OFERTA_PUSH_MS = 4000;

export const useAvisoPush = () => {
  const { toast } = useNotification();
  const [ofrecerPush, setOfrecerPush] = useState(false);

  useEffect(() => {
    if (!soportado() || estadoPermiso() !== "default") return;
    const t = setTimeout(() => setOfrecerPush(true), RETRASO_OFERTA_PUSH_MS);
    return () => clearTimeout(t);
  }, []);

  const activarAvisos = async () => {
    const r = await activar();
    setOfrecerPush(false);
    if (r === "granted") toast.success("Listo, te avisaremos aquí.");
    else if (r === "denied") toast.info("No pasa nada, puedes activarlos luego desde tu perfil.");
  };

  return { ofrecerPush, activarAvisos, cerrarOfertaPush: () => setOfrecerPush(false) };
};
