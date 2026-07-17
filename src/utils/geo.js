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

// Metros de incertidumbre del GPS que se le perdonan como máximo. Gemelo del tope de la SQL
// `evaluar_ubicacion` (migración 063): si cambia uno, cambia el otro, o el candado del cliente
// y el bloqueo del servidor dejarían de coincidir.
const TOPE_PRECISION_M = 100;

/**
 * Distancia en metros entre dos coordenadas (Haversine). Gemelo de la SQL `distancia_metros`.
 * Vive acá porque el candado del checador necesita evaluar la ubicación EN VIVO, sin ir al
 * servidor en cada fix del GPS.
 */
const distanciaMetros = (lat1, lng1, lat2, lng2) => {
  const R = 6371000;
  const rad = (g) => (g * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.asin(Math.sqrt(a)));
};

/**
 * Veredicto de ubicación para el candado del cliente. MISMA regla que el servidor
 * (`evaluar_ubicacion`, migración 063): 'fuera' solo si lo está incluso descontando la
 * incertidumbre del propio GPS (con tope), para no rechazar a quien está parado en su sitio.
 *
 * El servidor sigue siendo la ley — esto solo evita que la persona haga todo el baile de
 * selfie/reto para rebotar al final.
 *
 * @param {{lat:number,lng:number,precision:number}|null} ubicacion
 * @param {{lat:number|null,lng:number|null,radioM:number}|null} sucursal
 * @returns {{estado:'dentro'|'fuera'|'sin_gps'|'sin_geocerca', distanciaM:number|null}}
 */
export const evaluarUbicacion = (ubicacion, sucursal) => {
  if (!ubicacion || ubicacion.lat == null || ubicacion.lng == null) {
    return { estado: "sin_gps", distanciaM: null };
  }
  if (!sucursal || sucursal.lat == null || sucursal.lng == null) {
    return { estado: "sin_geocerca", distanciaM: null };
  }
  const distanciaM = distanciaMetros(ubicacion.lat, ubicacion.lng, sucursal.lat, sucursal.lng);
  const margen = Math.min(ubicacion.precision ?? 0, TOPE_PRECISION_M);
  const estado = distanciaM - margen <= sucursal.radioM ? "dentro" : "fuera";
  return { estado, distanciaM };
};

/** Texto del candado EN VIVO, antes de fichar (no confundir con textoUbicacion, que es tras la checada). */
export const textoCandado = (estado, distanciaM, sucursal) => {
  switch (estado) {
    case "fuera":
      return `Estás fuera del área de marcado${
        distanciaM != null ? ` (a ${distanciaM} m)` : ""
      }. Acércate a ${sucursal || "tu clínica"} para poder checar.`;
    case "sin_gps":
      return "Buscando tu ubicación… activa el GPS de tu teléfono para poder checar.";
    default:
      return null; // dentro / sin_geocerca: no bloquean, sin banner
  }
};

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
