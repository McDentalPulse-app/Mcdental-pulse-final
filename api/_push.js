import webpush from "web-push";
import { admin } from "./_auth.js";

/**
 * El emisor de notificaciones push. Una sola función: enviar(empleadoId, aviso).
 *
 * QUÉ HACE Y QUÉ NO. Manda un aviso a TODOS los aparatos donde esa persona lo aceptó. No decide
 * cuándo ni por qué — eso lo saben los endpoints que lo llaman (rostro aprobado, permiso
 * aprobado, checada sospechosa). Aquí solo se cifra el mensaje y se entrega.
 *
 * POR QUÉ VIVE EN EL SERVIDOR Y NO PUEDE ESTAR EN OTRO SITIO: el envío se firma con la clave
 * PRIVADA de VAPID. Esa clave es la que le demuestra a Apple y a Google que el aviso viene de
 * nuestro servidor y no de un impostor. Si saliera al navegador, cualquiera podría mandar
 * notificaciones en nombre de la clínica. Por eso nunca se importa desde el cliente.
 */

let configurado = false;

/** Se configura una vez, y solo si hay claves: sin ellas el push no existe, pero no se rompe nada. */
const asegurarConfig = () => {
  if (configurado) return true;

  const publica = process.env.VITE_VAPID_PUBLIC_KEY;
  const privada = process.env.VAPID_PRIVATE_KEY;
  // El "subject" es un contacto (mailto: o una URL) que exige el estándar: es a quién avisaría
  // Apple/Google si nuestros envíos dieran problemas. Sin un valor válido, algunos push rebotan.
  const subject = process.env.VAPID_SUBJECT || "mailto:soporte@mcdental.mx";

  if (!publica || !privada) return false;

  webpush.setVapidDetails(subject, publica, privada);
  configurado = true;
  return true;
};

/** ¿Está el push configurado en este entorno? Los endpoints lo consultan para no intentar en vano. */
export const pushDisponible = () => asegurarConfig();

/**
 * Avisa a todo el equipo de gestión (RH, admin y psicóloga) a la vez.
 *
 * Los avisos "para RH" —alguien registró su rostro, una checada sospechosa— no van a una persona
 * concreta sino al equipo: quien lo vea primero, lo atiende. Se resuelve aquí quiénes son ahora
 * mismo, no con una lista fija: si mañana entra otra persona a gestión, empieza a recibir sin
 * tocar nada. Incluye psicologa desde la paridad de roles del 2026-07-15 (migraciones 050/052):
 * ella también aprueba rostros y ve asistencia, así que también debe enterarse.
 *
 * `url` puede ser un string (misma URL para todos) o un objeto `{admin, rh, psicologa}`: cada
 * rol tiene su propio prefijo de ruta (/admin, /rh, /psicologa), así que un solo string no le
 * sirve a los tres a la vez.
 */
export const enviarARH = async ({ titulo, cuerpo, url }) => {
  if (!asegurarConfig()) return;

  const { data: rh } = await admin()
    .from("usuarios")
    .select("id, role")
    .in("role", ["rh", "admin", "psicologa"])
    .eq("inactivo", false);

  if (!rh?.length) return;

  const urlPara = (role) => (typeof url === "object" ? url[role] || "/" : url);
  await Promise.all(rh.map((u) => enviar(u.id, { titulo, cuerpo, url: urlPara(u.role) })));
};

/**
 * Envía un aviso a todos los aparatos de un empleado.
 *
 * NUNCA LANZA. Un push que falla no puede tumbar la acción que lo disparó: si RH aprueba un
 * permiso y el envío del aviso falla, el permiso QUEDA APROBADO igual. La notificación es un
 * extra amable, no parte de la transacción. Por eso todo va envuelto y los errores se tragan
 * (registrándolos), y por eso el que llama no necesita await si no quiere.
 *
 * LIMPIA LO MUERTO. Si Apple/Google responden 404 o 410, esa suscripción ya no existe (la app se
 * desinstaló, el permiso se revocó) y se BORRA. Sin esto, la tabla se llena de teléfonos
 * fantasma y cada envío se hace más lento arrastrando direcciones que no van a ninguna parte.
 */
export const enviar = async (empleadoId, { titulo, cuerpo, url = "/" }) => {
  if (!asegurarConfig() || !empleadoId) return { enviados: 0, limpiados: 0 };

  const supabase = admin();

  const { data: subs, error } = await supabase
    .from("push_suscripciones")
    .select("id, endpoint, p256dh, auth")
    .eq("empleado_id", empleadoId);

  if (error || !subs?.length) return { enviados: 0, limpiados: 0 };

  const carga = JSON.stringify({ titulo, cuerpo, url });
  let enviados = 0;
  const muertas = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          carga
        );
        enviados += 1;
      } catch (e) {
        // 404 = el endpoint ya no existe · 410 = "gone", la suscripción caducó. En los dos casos
        // la fila es basura y se borra. Cualquier otro error (red, 5xx de Apple) es transitorio:
        // NO se borra, o perderíamos una suscripción buena por un fallo de un momento.
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          muertas.push(s.id);
        } else {
          console.error("Error enviando push:", e?.statusCode, e?.body || e?.message);
        }
      }
    })
  );

  if (muertas.length) {
    await supabase.from("push_suscripciones").delete().in("id", muertas);
  }

  return { enviados, limpiados: muertas.length };
};
