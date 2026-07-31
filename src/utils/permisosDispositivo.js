import { estadoPermiso as estadoAvisos, activar as activarAvisos, soportado as avisosSoportados } from "../services/pushService";

/**
 * Permisos del navegador que la app necesita, en un solo sitio.
 *
 * LO QUE HAY QUE ENTENDER ANTES DE TOCAR ESTO: un navegador NO deja volver a preguntar por
 * código una vez que la persona pulsó "Bloquear". No hay API para ello, y no la hay a
 * propósito. Así que un botón de "activar" sobre un permiso denegado no haría nada: por eso
 * `pedir()` devuelve 'denied' y la interfaz tiene que enseñar dónde reactivarlo a mano.
 *
 * El que importa de verdad es la ubicación: sin ella, ChecadorEmpleado deja `sin_gps`, y
 * `sin_gps` bloquea el botón de fichar. Los otros tres degradan la experiencia pero no
 * impiden trabajar.
 */

export const PERMISOS = {
  ubicacion: {
    id: "ubicacion",
    nombre: "Ubicación",
    icono: "pin",
    // El único que impide fichar. Lo usa la interfaz para decidir a quién interrumpir.
    bloquea: true,
    porQue: "Sin ella no puedes registrar tu entrada ni tu salida.",
  },
  camara: {
    id: "camara",
    nombre: "Cámara",
    icono: "camera",
    bloquea: false,
    porQue: "Para la foto de tu checada y para subir comprobantes.",
  },
  microfono: {
    id: "microfono",
    nombre: "Micrófono",
    icono: "mic",
    bloquea: false,
    porQue: "Para enviar notas de voz en tus mensajes.",
  },
  avisos: {
    id: "avisos",
    nombre: "Avisos",
    icono: "bell",
    bloquea: false,
    porQue: "Para enterarte de permisos y aprobaciones sin entrar a revisar.",
  },
};

// Nombre que usa la Permissions API para cada uno. Los avisos no van por aquí: se leen de
// `Notification.permission`, que sí existe en todas partes.
const NOMBRE_API = {
  ubicacion: "geolocation",
  camara: "camera",
  microfono: "microphone",
};

/** Estado normalizado: 'granted' | 'denied' | 'prompt' | 'no-soportado'. */
export const consultarPermiso = async (id) => {
  if (id === "avisos") {
    if (!avisosSoportados()) return "no-soportado";
    // pushService habla en el idioma de Notification ('default'); aquí todo es 'prompt'.
    const estado = estadoAvisos();
    return estado === "default" ? "prompt" : estado;
  }

  const nombre = NOMBRE_API[id];
  if (!nombre) return "no-soportado";

  if (id === "ubicacion" && !navigator.geolocation) return "no-soportado";
  if ((id === "camara" || id === "microfono") && !navigator.mediaDevices?.getUserMedia) {
    return "no-soportado";
  }

  // Safari no implementó `permissions.query` para cámara ni micrófono, y Firefox tampoco para
  // todo. Cuando no se puede consultar, se responde 'prompt': es lo honesto — no sabemos si
  // está concedido, y ofrecer el botón no rompe nada (si ya estaba dado, no se vuelve a
  // preguntar). Dar por hecho 'granted' sí engañaría.
  if (!navigator.permissions?.query) return "prompt";

  try {
    const r = await navigator.permissions.query({ name: nombre });
    return r.state; // 'granted' | 'denied' | 'prompt'
  } catch {
    return "prompt";
  }
};

/** Estado de los cuatro de una vez, como objeto {id: estado}. */
export const consultarTodos = async () => {
  const ids = Object.keys(PERMISOS);
  const estados = await Promise.all(ids.map(consultarPermiso));
  return Object.fromEntries(ids.map((id, i) => [id, estados[i]]));
};

/**
 * Dispara la pregunta del navegador. Devuelve el estado resultante.
 *
 * Cámara y micrófono se piden abriendo el flujo y cerrándolo en el acto: es la única forma de
 * provocar el diálogo. Si no se sueltan las pistas, el piloto de la cámara se queda encendido
 * y la gente cree que la app la está grabando.
 */
export const pedirPermiso = async (id) => {
  const estadoPrevio = await consultarPermiso(id);
  if (estadoPrevio === "granted" || estadoPrevio === "denied" || estadoPrevio === "no-soportado") {
    return estadoPrevio;
  }

  if (id === "avisos") {
    const r = await activarAvisos();
    return r === "granted" ? "granted" : r === "denied" ? "denied" : "prompt";
  }

  if (id === "ubicacion") {
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => resolve("granted"),
        (error) => resolve(error?.code === 1 ? "denied" : "prompt"), // code 1 = PERMISSION_DENIED
        { enableHighAccuracy: false, timeout: 15000 }
      );
    });
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia(
      id === "camara" ? { video: true } : { audio: true }
    );
    stream.getTracks().forEach((t) => t.stop());
    return "granted";
  } catch (error) {
    return error?.name === "NotAllowedError" ? "denied" : "prompt";
  }
};

/**
 * Cómo reactivarlo a mano, que es lo único que queda cuando está en 'denied'. El texto cambia
 * por navegador porque el gesto es distinto y una instrucción genérica no le sirve a nadie.
 */
export const comoReactivar = (ua = navigator.userAgent) => {
  const esIOS = /iphone|ipad|ipod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (esIOS) return "En el iPhone: Ajustes › Safari › Ubicación (o Cámara / Micrófono) y elige «Preguntar» o «Permitir».";
  if (/android/i.test(ua)) return "En Android: toca el candado 🔒 junto a la dirección web, entra en «Permisos» y actívalo.";
  return "En el navegador: pulsa el candado 🔒 a la izquierda de la dirección web y activa el permiso.";
};
