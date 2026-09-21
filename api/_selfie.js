/**
 * Validación de la ruta de la selfie de una checada.
 *
 * Vive aparte de `checar.js` para que se pueda PROBAR. Estaba escrita en línea dentro del
 * handler, y por eso su fallo —abajo— pasó desapercibido: no había forma de ejercitarla sin
 * levantar Supabase, los modelos y una sesión.
 */

/**
 * Cuánto puede desviarse la marca de tiempo de la foto respecto al reloj del servidor.
 *
 * 10 minutos y no 60 segundos: sigue acotando el replay sin depender de que el reloj del
 * teléfono esté sincronizado al segundo. Con 60s se rechazaban checadas reales de teléfonos
 * ligeramente desajustados.
 */
export const FRESCURA_MS = 10 * 60 * 1000;

/**
 * ¿La selfie es de esta persona y de hace un momento?
 *
 * DOS COSAS, Y LAS DOS HACEN FALTA. Si no se exige la primera, cualquiera reenvía la ruta de la
 * selfie de otro; si no se exige la segunda, cualquiera reenvía la ruta de una selfie PROPIA ya
 * aprobada —la ve en su propio historial— y pasa el cotejo sin haber estado frente a la cámara.
 *
 * LA VENTANA ES DE DOS LADOS, y esto es un arreglo (2026-09-20, hallazgo de una revisión de
 * seguridad). Antes se comprobaba `ahora - marca > FRESCURA_MS`, que solo acota el PASADO: una
 * ruta con una marca en el FUTURO da una resta negativa y pasaba. Y la policy de storage solo
 * mira la carpeta, no el nombre del fichero, así que subir con ese nombre estaba permitido.
 *
 * Es decir: se podía subir la selfie UNA vez con nombre futuro y reutilizar esa ruta
 * indefinidamente. Combinado con que las coordenadas viajan en el cuerpo de la petición, eso es
 * fichar desde cualquier sitio con la cara correcta. `Math.abs` cierra esa mitad.
 *
 * Formato de la ruta, fijado por el cliente: `${empleadoId}/${Date.now()}.jpg`.
 */
export const selfieValida = (ruta, empleadoId, ahora = Date.now()) => {
  const [carpeta, archivo] = String(ruta ?? "").split("/");
  const marca = Number(archivo?.split(".")[0]);

  if (carpeta !== empleadoId) return false;
  if (!marca || !Number.isFinite(marca)) return false;

  return Math.abs(ahora - marca) <= FRESCURA_MS;
};
