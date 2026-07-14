/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { clientsClaim } from "workbox-core";

/**
 * El service worker de la app.
 *
 * Hasta ahora vite-plugin-pwa lo generaba solo (generateSW) y no hacía más que cachear. Se pasa a
 * injectManifest —un worker escrito a mano— por UNA razón: el push. Un push llega al teléfono
 * aunque la app esté cerrada, y quien lo recibe y lo muestra es este archivo. Sin un worker
 * propio, no hay dónde escuchar el evento `push`, y la notificación no existe.
 *
 * Todo lo que ya hacía el worker automático se conserva abajo (precache, limpieza, control
 * inmediato): quitar eso para añadir el push habría cambiado, de paso, cómo carga la app.
 */

// self.__WB_MANIFEST lo rellena vite-plugin-pwa en el build con la lista de archivos a precachear.
// Es el mismo precache de antes, solo que ahora en un worker que además sabe de push.
precacheAndRoute(self.__WB_MANIFEST || []);
cleanupOutdatedCaches();

// SPA fallback: cualquier navegación (entrar a /empleado/rostro directo, recargar en una ruta
// interna) devuelve el index.html cacheado y deja que React Router resuelva. Era lo que hacía el
// navigateFallback del worker automático; al escribir el worker a mano, hay que traerlo aquí o
// las rutas profundas dejarían de cargar offline.
const denylist = [/^\/api\//, /firebase/, /googleapis\.com/];
registerRoute(
  new NavigationRoute(createHandlerBoundToURL("index.html"), { denylist })
);

clientsClaim();
self.skipWaiting();

/**
 * Llega un push. El cuerpo lo manda api/_push.js como JSON: { titulo, cuerpo, url }.
 *
 * event.waitUntil es OBLIGATORIO, no un adorno: sin él, el navegador puede matar al worker antes
 * de que la notificación se muestre, y el push llegaría al teléfono para no aparecer nunca. Le
 * dice "sigo ocupado, no me apagues".
 */
self.addEventListener("push", (event) => {
  let datos;
  try {
    datos = event.data ? event.data.json() : {};
  } catch {
    // Si el cuerpo no es el JSON que esperamos, se muestra algo genérico en vez de tragarse el
    // aviso: mejor una notificación sosa que ninguna.
    datos = {};
  }

  const titulo = datos.titulo || "McDental Pulse";
  const opciones = {
    body: datos.cuerpo || "Tienes una novedad.",
    icon: "/pwa-192x192.png",
    badge: "/pwa-192x192.png",
    // La URL viaja en `data` para que el click sepa a dónde ir. No se abre nada todavía: mostrar
    // la notificación y abrir una pantalla son dos momentos distintos.
    data: { url: datos.url || "/" },
    // Que vibre: un aviso de fichaje que no se siente es un aviso que no sirve.
    vibrate: [80, 40, 80],
  };

  event.waitUntil(self.registration.showNotification(titulo, opciones));
});

/**
 * La persona toca la notificación. Debe abrir LA PANTALLA del aviso, no la home.
 *
 * Y si ya tiene la app abierta, se reutiliza esa pestaña en vez de abrir una segunda: nada
 * enfada más que acabar con tres copias de la misma app por tocar tres avisos.
 */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientes) => {
      for (const cliente of clientes) {
        // Ya hay una ventana de la app abierta: se enfoca y se navega, sin abrir otra.
        if ("focus" in cliente) {
          cliente.focus();
          if ("navigate" in cliente) cliente.navigate(destino);
          return undefined;
        }
      }
      // No había ninguna: se abre una.
      return self.clients.openWindow(destino);
    })
  );
});
