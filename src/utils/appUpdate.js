import { refrescarSuscripcion } from "../services/pushService";

/**
 * Fuerza un chequeo de actualización del service worker, resuscribe el push si hacía
 * falta, y recarga.
 *
 * `registration.update()` solo dispara la descarga/comparación de sw.js contra el
 * servidor; no espera a que el worker nuevo (si lo hay) termine de instalarse y activarse.
 * Como sw.js llama a skipWaiting() sin condiciones, ese proceso es rápido pero no
 * instantáneo — se da un margen antes de recargar para que, si había versión nueva, ya
 * esté al mando cuando la página vuelva a pedir el HTML. Sin el margen, el reload podría
 * ganarle la carrera a la instalación y volver a servir la versión vieja.
 *
 * De paso resuscribe el push (silencioso, no pide permiso de nuevo si ya estaba
 * concedido): en un PWA instalado, no hay otro botón en la app para arreglar una
 * suscripción vieja atada a una clave VAPID que ya cambió — este es el único momento en
 * que la app "se toca a sí misma" de arriba a abajo, así que es el lugar natural.
 */
export const buscarActualizacion = async () => {
  if (!("serviceWorker" in navigator)) {
    window.location.reload();
    return;
  }
  const registration = await navigator.serviceWorker.ready;
  await registration.update().catch(() => {});
  await refrescarSuscripcion().catch(() => {});
  await new Promise((resolve) => setTimeout(resolve, 800));
  window.location.reload();
};
