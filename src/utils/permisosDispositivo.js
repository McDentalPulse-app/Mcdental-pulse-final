import { estadoPermiso as estadoAvisos, activar as activarAvisos, soportado as avisosSoportados } from "../services/pushService";

// Ground truth de ubicación, para no depender de `permissions.query` en iOS (ver consultarPermiso
// más abajo). Solo 'granted'/'denied' se guardan — 'prompt' es "no sé todavía", no hay nada que
// recordar. try/catch por dos motivos, no uno: Safari en modo privado tira SecurityError al
// tocar localStorage, y en un entorno sin `localStorage` (como los tests de este archivo, que
// corren en Node puro) referenciarlo directamente también lanza — el catch cubre ambos.
const CLAVE_UBICACION_REAL = "pulse:permiso-ubicacion-real";

const leerEstadoUbicacionReal = () => {
  try {
    const v = localStorage.getItem(CLAVE_UBICACION_REAL);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
};

/** Lo escriben pedirPermiso('ubicacion') y ChecadorEmpleado.jsx (watchPosition). NO todo lo que
 * usa el GPS pasa por acá — utils/geo.js:obtenerUbicacion() también corre en GestionSucursales.jsx
 * y MiClinica.jsx sin alimentar este registro; para el rol Admin (sin ruta checador) esos dos son
 * la única señal en segundo plano, así que el registro puede quedarse desactualizado más tiempo
 * ahí. No es grave: pedirPermiso() ya no depende del registro para decidir si reintenta (ver su
 * comentario), así que el peor caso es un aviso de más, no un botón roto. */
export const registrarEstadoUbicacionReal = (estado) => {
  if (estado !== "granted" && estado !== "denied") return;
  try { localStorage.setItem(CLAVE_UBICACION_REAL, estado); } catch { /* privado o sin localStorage */ }
};

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

  if (id === "ubicacion") {
    // iOS Safari SIEMPRE responde 'prompt' a permissions.query({name:'geolocation'}), incluso
    // con el permiso ya concedido desde hace semanas — bug de WebKit documentado, no arreglable
    // del lado de la API. Por eso NO se le cree ciegamente: se le pregunta primero, y solo se
    // cae al registro (lo que de verdad pasó la última vez que se usó el GPS — pedirPermiso()
    // más abajo y ChecadorEmpleado.jsx) cuando la API responde justo esa mentira ('prompt'). Si
    // responde algo concreto (granted/denied — lo que hacen los navegadores donde SÍ funciona
    // bien), se le cree a ella y se refresca el registro: así una reactivación real hecha desde
    // Ajustes del sistema, fuera de la app, se refleja en vez de quedar atascada en lo que el
    // registro recordaba de antes. (2da revisión adversarial, HIGH: la primera versión de este
    // fix confiaba en el registro ANTES de preguntar, y eso volvía a atascar el aviso para
    // siempre en CUALQUIER navegador —no solo iOS— para quien no pasa por ChecadorEmpleado.jsx,
    // como Admin.)
    if (!navigator.permissions?.query) return leerEstadoUbicacionReal() ?? "prompt";
    try {
      const r = await navigator.permissions.query({ name: "geolocation" });
      if (r.state !== "prompt") {
        registrarEstadoUbicacionReal(r.state);
        return r.state;
      }
    } catch {
      // sigue abajo, al registro
    }
    return leerEstadoUbicacionReal() ?? "prompt";
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
  if (estadoPrevio === "no-soportado") return estadoPrevio;
  // Ubicación NUNCA usa este atajo para granted/denied: consultarPermiso() puede estar leyendo
  // el registro de registrarEstadoUbicacionReal (localStorage), que se queda viejo si la persona
  // reactivó el permiso desde Ajustes del sistema, fuera de la app. pedirPermiso() es un toque
  // explícito de "Activar" — el momento correcto para preguntarle al navegador de verdad y
  // corregir el registro si hace falta. Hallazgo HIGH de revisión adversarial: sin esto, quien
  // reactivaba el permiso en Ajustes quedaba con el botón roto para siempre — sobre todo Admin,
  // que no tiene ChecadorEmpleado.jsx (su watchPosition) para autosanarse en segundo plano.
  if (id !== "ubicacion" && (estadoPrevio === "granted" || estadoPrevio === "denied")) {
    return estadoPrevio;
  }

  if (id === "avisos") {
    const r = await activarAvisos();
    return r === "granted" ? "granted" : r === "denied" ? "denied" : "prompt";
  }

  if (id === "ubicacion") {
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => { registrarEstadoUbicacionReal("granted"); resolve("granted"); },
        (error) => { // code 1 = PERMISSION_DENIED
          const denegado = error?.code === 1;
          if (denegado) registrarEstadoUbicacionReal("denied");
          resolve(denegado ? "denied" : "prompt");
        },
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
