import { createSign } from "node:crypto";
import { admin } from "./_auth.js";

/**
 * Push a la app nativa de Android, por Firebase Cloud Messaging (API HTTP v1).
 *
 * El gemelo de Web Push para la app: `_push.js` llama a los dos, y cada notificación le llega a
 * la persona en la web Y en el teléfono. Los tokens están en `push_fcm` (migración 178).
 *
 * SIN `firebase-admin`, a propósito: para mandar un mensaje basta con firmar un JWT con la cuenta
 * de servicio, cambiarlo por un token de acceso y hacer un POST. Son cuarenta líneas con el
 * `crypto` y el `fetch` que ya trae Node, contra una dependencia que arrastra medio SDK de Google
 * a la imagen del API.
 *
 * LA CUENTA DE SERVICIO NO VIVE EN EL REPO, que es público. Llega por la variable
 * FIREBASE_SERVICE_ACCOUNT_B64 (el JSON en base64, en /opt/pulse/api.env): base64 porque el
 * --env-file de Docker no admite valores de varias líneas y la clave privada las tiene. Sin ella,
 * el push nativo no existe pero no se rompe nada.
 */

let cuenta = null;
let leida = false;

const leerCuenta = () => {
  if (leida) return cuenta;
  leida = true;
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!b64) return null;
  try {
    const c = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
    if (c?.project_id && c?.client_email && c?.private_key) cuenta = c;
    else console.error("FIREBASE_SERVICE_ACCOUNT_B64 no parece una cuenta de servicio.");
  } catch (e) {
    console.error("FIREBASE_SERVICE_ACCOUNT_B64 no se pudo leer:", e?.message);
  }
  return cuenta;
};

/** ¿Hay con qué mandar push nativo en este entorno? */
export const fcmDisponible = () => !!leerCuenta();

const b64url = (x) => Buffer.from(x).toString("base64url");

/**
 * El JWT que Google cambia por un token de acceso (flujo de cuenta de servicio, RFC 7523).
 * Exportado para poder probarlo sin red.
 */
export const firmarJwt = (c, ahoraSeg = Math.floor(Date.now() / 1000)) => {
  const cabecera = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const cuerpo = b64url(JSON.stringify({
    iss: c.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: ahoraSeg,
    exp: ahoraSeg + 3600,
  }));
  const firma = createSign("RSA-SHA256").update(`${cabecera}.${cuerpo}`).sign(c.private_key, "base64url");
  return `${cabecera}.${cuerpo}.${firma}`;
};

// El token de acceso dura una hora: se guarda y se renueva cinco minutos antes.
let acceso = null;

const tokenDeAcceso = async (c) => {
  if (acceso && acceso.vence > Date.now() + 5 * 60 * 1000) return acceso.token;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: firmarJwt(c),
    }),
  });
  if (!r.ok) throw new Error(`oauth ${r.status}: ${await r.text()}`);
  const j = await r.json();
  acceso = { token: j.access_token, vence: Date.now() + (j.expires_in || 3600) * 1000 };
  return acceso.token;
};

/**
 * ¿Ese error dice que el token ya no sirve (app desinstalada, datos borrados)? Entonces la fila
 * se borra; cualquier otro error es pasajero y el token se conserva. Exportado para probarlo.
 */
export const tokenMuerto = (status, cuerpo) => {
  if (status === 404) return true;
  const detalles = cuerpo?.error?.details || [];
  if (detalles.some((d) => d?.errorCode === "UNREGISTERED")) return true;
  // INVALID_ARGUMENT con un token que no es un token (no por un fallo nuestro de formato).
  return status === 400 && /registration token/i.test(cuerpo?.error?.message || "");
};

/**
 * El mensaje: la notificación que enseña el sistema, y la `url` en `data` para que la app abra
 * la pantalla que toca al tocarla. El canal `avisos` lo crea la app al arrancar.
 */
export const mensaje = (token, { titulo, cuerpo, url }) => ({
  message: {
    token,
    notification: { title: titulo, body: cuerpo || "" },
    data: { url: url || "/" },
    android: { priority: "HIGH", notification: { channel_id: "avisos" } },
  },
});

/** Manda a todos los teléfonos de esa persona. NUNCA LANZA, igual que el Web Push. */
export const enviarFcm = async (empleadoId, aviso) => {
  const c = leerCuenta();
  if (!c || !empleadoId) return { enviados: 0, limpiados: 0 };
  try {
    const supabase = admin();
    const { data: filas, error } = await supabase
      .from("push_fcm")
      .select("id, token")
      .eq("empleado_id", empleadoId);
    if (error || !filas?.length) return { enviados: 0, limpiados: 0 };

    const acceso = await tokenDeAcceso(c);
    let enviados = 0;
    const muertas = [];
    await Promise.all(
      filas.map(async (f) => {
        const r = await fetch(`https://fcm.googleapis.com/v1/projects/${c.project_id}/messages:send`, {
          method: "POST",
          headers: { Authorization: `Bearer ${acceso}`, "Content-Type": "application/json" },
          body: JSON.stringify(mensaje(f.token, aviso)),
        }).catch((e) => ({ ok: false, status: 0, json: async () => ({ error: { message: e?.message } }) }));
        if (r.ok) {
          enviados += 1;
          return;
        }
        const cuerpo = await r.json().catch(() => null);
        if (tokenMuerto(r.status, cuerpo)) muertas.push(f.id);
        else console.error("Error enviando push nativo:", r.status, cuerpo?.error?.message);
      })
    );
    if (muertas.length) await supabase.from("push_fcm").delete().in("id", muertas);
    return { enviados, limpiados: muertas.length };
  } catch (e) {
    console.error("Error en el push nativo:", e?.message || e);
    return { enviados: 0, limpiados: 0 };
  }
};
