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
  return "granted";
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
