/**
 * El motivo REAL de un fallo, para enseñárselo a quien lo sufre.
 *
 * Por qué existe: la app hablaba con RLS, con edge functions y con /api, y las tres
 * devuelven un motivo concreto —"No tienes permiso para cambiar nombres de usuario",
 * "El prompt es demasiado largo", "Has alcanzado el límite de 30 consultas"—. Ese motivo
 * llegaba intacto hasta el `catch`, y ahí se tiraba a la basura para poner un texto fijo,
 * casi siempre sobre la conexión.
 *
 * El coste no fue teórico: la pantalla de IA estuvo caída y decía "revisa la conexión"
 * mientras el servidor contestaba un 413 clarísimo. Se buscó en la red, en la llave y en
 * el SDK antes que en el propio mensaje. Lo mismo pasa con RLS, que al bloquear no lanza
 * un error de permisos sino que afecta cero filas (ver migración 095).
 *
 * Regla: si hay motivo, se muestra. Solo el fallo de red de verdad —`fetch` rechazado,
 * sin respuesta— cae al genérico, que ahí sí es el mensaje correcto.
 */
const SIN_RED = /failed to fetch|networkerror|load failed|network request failed/i;

export const motivoFallo = (error, generico = "Revisa la conexión e inténtalo de nuevo.") => {
  const msg = typeof error === "string" ? error : error?.message;
  const limpio = msg?.trim();
  if (!limpio || SIN_RED.test(limpio)) return generico;
  return limpio;
};

/** Une un encabezado propio con el motivo: `mensajeDeFallo("No se pudo guardar", e)`. */
export const mensajeDeFallo = (encabezado, error) => `${encabezado} ${motivoFallo(error)}`;
