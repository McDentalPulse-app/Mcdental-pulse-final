import { admin } from "./_auth.js";
import { enviar } from "./_push.js";

/**
 * El camino ÚNICO de toda notificación. Un evento notificable llama aquí, no a enviar() directo.
 *
 * Hace DOS cosas, en este orden y por esta razón:
 *   1. Inserta una fila en `notificaciones` — la bandeja persistente. Es la fuente de verdad:
 *      el usuario la verá en la campana aunque el push nunca llegue (claves VAPID, iOS sin
 *      instalar, permiso denegado). Antes, una notificación perdida se perdía de verdad.
 *   2. Intenta el push como EMPUJÓN. Si falla, la fila ya quedó guardada.
 *
 * NUNCA LANZA. Igual que el push (ver _push.js): un aviso que falla no puede tumbar la acción
 * que lo disparó. Si RH aprueba un permiso y esto falla, el permiso queda aprobado igual.
 */
export const notificar = async (empleadoId, { tipo, titulo, cuerpo, url = "/" }) => {
  if (!empleadoId) return;

  try {
    await admin()
      .from("notificaciones")
      .insert({ empleado_id: empleadoId, tipo, titulo, cuerpo, url });
  } catch (e) {
    // La fila es lo importante; si ni eso se pudo, se registra y se sigue. No se corta el push.
    console.error("Error guardando notificación:", e?.message || e);
  }

  await enviar(empleadoId, { titulo, cuerpo, url }).catch(() => {});
};

/**
 * Notifica a TODO el equipo de gestión (rh, admin, psicóloga): una fila por persona + su push.
 *
 * Los avisos "para gestión" —checada sospechosa, rostro registrado— no van a alguien concreto
 * sino al equipo. Se resuelve quiénes son AHORA (no una lista fija): si mañana entra otra
 * persona a gestión, empieza a recibir sin tocar nada. Igual que hacía enviarARH, pero además
 * dejando la fila persistente de cada quien.
 *
 * `url` puede ser un string o un objeto `{admin, rh, psicologa}`: cada rol tiene su prefijo de
 * ruta, así que un solo string no le sirve a los tres.
 */
export const notificarGestion = async ({ tipo, titulo, cuerpo, url }) => {
  const { data: gestion } = await admin()
    .from("usuarios")
    .select("id, role")
    .in("role", ["rh", "admin", "psicologa"])
    .eq("inactivo", false);

  if (!gestion?.length) return;

  const urlPara = (role) => (typeof url === "object" ? url[role] || "/" : url);

  try {
    await admin()
      .from("notificaciones")
      .insert(
        gestion.map((u) => ({ empleado_id: u.id, tipo, titulo, cuerpo, url: urlPara(u.role) }))
      );
  } catch (e) {
    console.error("Error guardando notificaciones de gestión:", e?.message || e);
  }

  await Promise.all(
    gestion.map((u) => enviar(u.id, { titulo, cuerpo, url: urlPara(u.role) }).catch(() => {}))
  );
};
