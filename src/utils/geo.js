/**
 * Ubicación del navegador para el checador.
 *
 * Decisión de producto (no técnica): esta función NUNCA falla. Si el usuario deniega el
 * permiso, si el GPS expira o si el navegador no lo soporta, devuelve null y la checada
 * sigue adelante marcada como 'sin_gps'. Un empleado que no puede fichar a las ocho de
 * la mañana porque el GPS no engancha dentro de una clínica —cosa que pasa a diario— es
 * un problema peor que el que la geocerca pretende resolver. Se registra, se marca, y
 * RH lo mira.
 */

const TIMEOUT_MS = 10000;

export const obtenerUbicacion = () =>
  new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          // accuracy es el radio de incertidumbre en metros que reporta el propio
          // dispositivo. Se guarda para poder distinguir "checó a 300 m de la clínica"
          // de "el GPS solo sabía dónde estaba con 300 m de margen".
          precision: Math.round(pos.coords.accuracy),
        }),
      (error) => {
        console.warn("No se pudo obtener la ubicación:", error?.message || error);
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: TIMEOUT_MS, maximumAge: 0 }
    );
  });

/** Texto para el empleado, según lo que el servidor decidió sobre su ubicación. */
export const textoUbicacion = (ubicacionEstado, distanciaM, sucursal) => {
  switch (ubicacionEstado) {
    case "dentro":
      return `Ubicación confirmada · ${sucursal || "tu clínica"}`;
    case "fuera":
      return `Fuera del área de ${sucursal || "tu clínica"} (a ${distanciaM} m). Se registró y RH lo revisará.`;
    case "sin_gps":
      return "Sin ubicación. Tu checada se registró igual.";
    case "sin_geocerca":
      return "Tu clínica aún no tiene ubicación configurada. Tu checada se registró igual.";
    default:
      return "";
  }
};
