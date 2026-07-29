/**
 * Las dos señales que deciden si se muestra el aviso obligatorio de actualización.
 *
 * Vive fuera de React porque quien detecta la versión nueva es `main.jsx`, escuchando al
 * service worker: eso ocurre antes de que exista cualquier componente y no puede depender de
 * un contexto. Un módulo con suscripción es lo más simple que sirve a los dos lados.
 *
 * `checadaEnCurso` está aquí, y no en el checador, porque su única razón de existir es esta:
 * un overlay obligatorio en mitad de una checada deja al empleado sin poder marcar. El aviso
 * espera a que la cámara se cierre y aparece justo después. Es la única concesión — en
 * cualquier otra pantalla bloquea de inmediato.
 */

let versionNueva = false;
let checadaEnCurso = false;
const oyentes = new Set();

const avisar = () => oyentes.forEach((fn) => fn());

/** La llama main.jsx cuando un service worker nuevo toma el control (o sea, tras un deploy). */
export const marcarVersionNueva = () => {
  if (versionNueva) return;   // una vez marcada no se desmarca: solo la recarga la limpia
  versionNueva = true;
  avisar();
};

/** La llama el checador mientras la cámara está abierta o se está enviando la checada. */
export const marcarChecadaEnCurso = (valor) => {
  const v = !!valor;
  if (v === checadaEnCurso) return;
  checadaEnCurso = v;
  avisar();
};

export const estadoActualizacion = () => ({ versionNueva, checadaEnCurso });

/** Devuelve la función para darse de baja, tal cual la espera el cleanup de un useEffect. */
export const alCambiarActualizacion = (fn) => {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
};
