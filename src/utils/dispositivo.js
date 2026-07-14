/**
 * Identidad del dispositivo desde el que se checa.
 *
 * EL VECTOR REAL DE FRAUDE NO ES LA FOTO: es la contraseña compartida. Un compañero
 * entra con tu usuario, se hace un selfie y el sistema lo da por bueno. La cara no
 * ayuda a detectarlo (a menos que se coteje contra la tuya, que es caro y es dato
 * biométrico), pero el TELÉFONO sí: quien checa por ti lo hace desde el suyo.
 *
 * Dos señales salen de aquí:
 *
 *   1. "Este empleado está checando desde un teléfono que nunca había usado."
 *      Ruidosa por sí sola (la gente cambia de móvil, borra datos del navegador), así
 *      que NO bloquea: se marca y RH la ve.
 *
 *   2. "Este mismo teléfono ha checado hoy a DOS personas distintas."
 *      Esta es la buena. Es la firma exacta de la suplantación y no hay una explicación
 *      inocente frecuente. Se deriva al leer, no se guarda (ver src/utils/asistencia.js).
 *
 * HONESTIDAD SOBRE SUS LÍMITES: el id lo genera y lo guarda el propio navegador, así
 * que alguien decidido puede borrarlo o inventarse otro. Pero hacerlo le sale caro: un
 * id nuevo se marca como dispositivo desconocido, que es justo la señal que queríamos.
 * Esto no es una barrera, es un detector — y un detector barato, que no toca datos
 * sensibles ni necesita consentimiento especial.
 */

const CLAVE = "mcdental_device_id";

/**
 * Id estable de este navegador. Se crea la primera vez y se conserva.
 *
 * Si localStorage no está disponible (modo incógnito con todo bloqueado, navegadores
 * muy restrictivos) devuelve null: la checada se registra igual, sin dato de dispositivo.
 * No vamos a impedirle fichar a nadie por esto.
 */
export const getDeviceId = () => {
  try {
    const guardado = localStorage.getItem(CLAVE);
    if (guardado) return guardado;

    const nuevo = crypto.randomUUID();
    localStorage.setItem(CLAVE, nuevo);
    return nuevo;
  } catch {
    return null;
  }
};
