import { supabase } from "../config/supabase";

/**
 * Notificaciones push, lado cliente.
 *
 * TRES REALIDADES QUE ESTE MÓDULO NO PUEDE CAMBIAR, solo respetar:
 *
 *   1. En iPhone, el push SOLO funciona si la app está instalada en la pantalla de inicio. En una
 *      pestaña de Safari, la API de push NO EXISTE. No es un permiso que se pueda pedir: el objeto
 *      entero falta. Por eso todo aquí empieza comprobando `soportado()`.
 *   2. El permiso se pide UNA vez. Si el usuario dice que no, en iOS ese "no" no se puede volver a
 *      pedir por código — hay que desinstalar la app. Así que no se pregunta al arrancar (un "no"
 *      reflejo), sino después de la primera checada, cuando la herramienta ya demostró que sirve.
 *   3. La clave pública VAPID tiene que ir en un formato binario concreto (Uint8Array). Pegarla
 *      como texto no falla ruidosamente: el navegador simplemente rechaza la suscripción.
 */

const VAPID_PUBLICA = import.meta.env.VITE_VAPID_PUBLIC_KEY;

// Huella de la clave pública con la que se hizo la última suscripción de ESTE navegador. Es la
// pieza que faltaba para que el push dejara de romperse en silencio: cada vez que se rota la
// clave VAPID (ya pasó dos veces), las suscripciones viejas quedan atadas a la clave anterior y
// se vuelven sordas sin ningún error visible. Guardando la huella se detecta el desajuste al
// abrir la app y se re-suscribe solo, sin que nadie tenga que tocar un botón.
const FP_KEY = "mcdental_push_vapid_fp";

/** Hash corto y estable (djb2) de la clave pública. No es criptográfico: solo sirve para
 * comparar "¿es la misma clave que la última vez?" sin guardar la clave entera. */
const huellaClave = (clave) => {
  let h = 5381;
  for (let i = 0; i < clave.length; i += 1) h = ((h << 5) + h + clave.charCodeAt(i)) >>> 0;
  return h.toString(36);
};

const guardarHuella = () => {
  try {
    if (VAPID_PUBLICA) localStorage.setItem(FP_KEY, huellaClave(VAPID_PUBLICA));
  } catch { /* almacenamiento no disponible: no es crítico */ }
};

/** ¿Este navegador puede recibir push? (En Safari sin instalar, no.) */
export const soportado = () =>
  "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

/** ¿La app está instalada en la pantalla de inicio? En iPhone es la condición para que el push exista. */
export const instalada = () =>
  window.matchMedia?.("(display-mode: standalone)").matches ||
  // Safari en iOS expone esto en vez del display-mode estándar.
  window.navigator.standalone === true;

/** Estado actual del permiso, sin pedir nada: 'granted' | 'denied' | 'default' | 'no-soportado'. */
export const estadoPermiso = () => (soportado() ? Notification.permission : "no-soportado");

/** La clave VAPID pública, de base64-url a los bytes que exige el navegador. */
const claveABytes = (base64) => {
  const relleno = "=".repeat((4 - (base64.length % 4)) % 4);
  const normal = (base64 + relleno).replace(/-/g, "+").replace(/_/g, "/");
  const crudo = atob(normal);
  return Uint8Array.from([...crudo].map((c) => c.charCodeAt(0)));
};

const post = async (metodo, cuerpo) => {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error("Tu sesión expiró.");

  const r = await fetch("/api/suscribir-push", {
    method: metodo,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(cuerpo),
  });
  if (!r.ok) throw new Error("No se pudo actualizar la suscripción.");
};

/**
 * Pide permiso y registra la suscripción. Devuelve el estado final para que la UI sepa qué contar.
 *
 * Es idempotente: si ya estaba suscrito, se re-suscribe con las mismas claves y el servidor hace
 * upsert. Llamarlo dos veces no crea dos suscripciones.
 */
export const activar = async () => {
  if (!soportado()) return "no-soportado";
  if (!VAPID_PUBLICA) {
    console.error("Falta VITE_VAPID_PUBLIC_KEY: el push no puede activarse.");
    return "sin-config";
  }

  const permiso = await Notification.requestPermission();
  if (permiso !== "granted") return permiso; // 'denied' | 'default'

  const registro = await navigator.serviceWorker.ready;

  // Si ya había una suscripción de este navegador se reutiliza; si no, se crea. application
  // ServerKey es la VAPID pública: ata la suscripción a NUESTRO servidor, y solo quien tenga la
  // privada podrá enviarle.
  const suscripcion =
    (await registro.pushManager.getSubscription()) ||
    (await registro.pushManager.subscribe({
      userVisibleOnly: true, // exigido por el navegador: nada de push silenciosos de rastreo
      applicationServerKey: claveABytes(VAPID_PUBLICA),
    }));

  await post("POST", { suscripcion: suscripcion.toJSON() });
  guardarHuella();
  return "granted";
};

/**
 * Prueba de notificación (admin): pide al servidor que se mande un push a uno mismo y devuelve
 * el resultado exacto ({ enviados, limpiados, motivo? }) para saber si de verdad llega.
 */
export const probar = async () => {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error("Tu sesión expiró.");

  const r = await fetch("/api/suscribir-push", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ accion: "probar" }),
  });
  const cuerpo = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(cuerpo.error || "No se pudo enviar la prueba.");
  return cuerpo;
};

/** Deja de recibir: se borra la suscripción del navegador y del servidor. */
export const desactivar = async () => {
  if (!soportado()) return;
  const registro = await navigator.serviceWorker.ready;
  const suscripcion = await registro.pushManager.getSubscription();
  if (!suscripcion) return;

  await post("DELETE", { suscripcion: suscripcion.toJSON() });
  await suscripcion.unsubscribe();
};

/**
 * Fuerza una suscripción NUEVA, descartando la que hubiera.
 *
 * `activar()` reusa la suscripción existente si ya hay una — perfecto la mayoría del
 * tiempo, pero si la clave VAPID pública cambió (rotación, o como pasó el 2026-07-16: se
 * terminó de configurar recién) esa suscripción vieja quedó atada a una clave que ya no es
 * la que firma los envíos, y se queda sorda para siempre. No hay ningún error visible — el
 * push simplemente nunca llega — así que no basta con esperar a que alguien note el
 * síntoma. Se llama sola cada vez que se busca actualización de la app (appUpdate.js), sin
 * pedir permiso de nuevo si ya estaba concedido.
 */
export const refrescarSuscripcion = async () => {
  if (!soportado() || !VAPID_PUBLICA || Notification.permission !== "granted") return;

  const registro = await navigator.serviceWorker.ready;
  const vieja = await registro.pushManager.getSubscription();
  if (vieja) {
    await post("DELETE", { suscripcion: vieja.toJSON() }).catch(() => {});
    await vieja.unsubscribe();
  }

  const nueva = await registro.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: claveABytes(VAPID_PUBLICA),
  });
  await post("POST", { suscripcion: nueva.toJSON() });
  guardarHuella();
};

/**
 * Se auto-repara al abrir la app: si el permiso ya está concedido pero (a) no hay suscripción
 * en este navegador, o (b) la clave VAPID cambió desde la última vez, re-suscribe solo. Es lo
 * que hace que un cambio de clave o una suscripción caducada deje de necesitar que alguien pulse
 * "Buscar actualización" — la causa #1 por la que el push se rompía y no se arreglaba solo.
 *
 * No pide permiso y no hace nada si el permiso no está concedido: es silencioso a propósito.
 */
export const sincronizarSuscripcion = async () => {
  if (!soportado() || !VAPID_PUBLICA || Notification.permission !== "granted") return;

  const registro = await navigator.serviceWorker.ready;
  const actual = await registro.pushManager.getSubscription();
  let huellaGuardada = null;
  try { huellaGuardada = localStorage.getItem(FP_KEY); } catch { /* ignore */ }

  // Ya suscrito y con la clave vigente: nada que hacer.
  if (actual && huellaGuardada === huellaClave(VAPID_PUBLICA)) return;

  // Falta suscripción, o la clave cambió: re-suscribir de cero (esto ya reguarda la huella).
  await refrescarSuscripcion();
};

/**
 * Diagnóstico para saber por qué NO llega el push. Devuelve si el servidor tiene el push
 * configurado y la huella de SU clave pública, y la huella de la clave del bundle del cliente.
 * Si las dos huellas no coinciden, ahí está el problema: cliente y servidor firman con claves
 * distintas y todo falla en silencio.
 */
export const diagnostico = async () => {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error("Tu sesión expiró.");

  const r = await fetch("/api/suscribir-push", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ accion: "diagnostico" }),
  });
  const cuerpo = await r.json().catch(() => ({}));
  return {
    ...cuerpo,
    clientePublicaFp: VAPID_PUBLICA ? huellaClave(VAPID_PUBLICA) : null,
    coincide: Boolean(cuerpo.servidorPublicaFp) && cuerpo.servidorPublicaFp === (VAPID_PUBLICA ? huellaClave(VAPID_PUBLICA) : null),
  };
};
