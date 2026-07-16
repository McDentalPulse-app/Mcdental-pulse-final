/**
 * Fuerza un chequeo de actualización del service worker y recarga.
 *
 * `registration.update()` solo dispara la descarga/comparación de sw.js contra el
 * servidor; no espera a que el worker nuevo (si lo hay) termine de instalarse y activarse.
 * Como sw.js llama a skipWaiting() sin condiciones, ese proceso es rápido pero no
 * instantáneo — se da un margen antes de recargar para que, si había versión nueva, ya
 * esté al mando cuando la página vuelva a pedir el HTML. Sin el margen, el reload podría
 * ganarle la carrera a la instalación y volver a servir la versión vieja.
 */
export const buscarActualizacion = async () => {
  if (!("serviceWorker" in navigator)) {
    window.location.reload();
    return;
  }
  const registration = await navigator.serviceWorker.ready;
  await registration.update().catch(() => {});
  await new Promise((resolve) => setTimeout(resolve, 800));
  window.location.reload();
};
