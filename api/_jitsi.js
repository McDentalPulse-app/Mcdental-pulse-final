import crypto from "node:crypto";

/**
 * Firma de los tokens de acceso a las salas de Jitsi.
 *
 * ESTE ARCHIVO ES LA PUERTA. Prosody está configurado con `authentication = "token"` y
 * `allow_empty_token = false`, así que a una sala solo entra quien traiga un JWT válido. La
 * lista de invitados que se ve en la interfaz es informativa; lo que de verdad decide quién
 * puede entrar es a quién se le firma un token aquí.
 *
 * Se firma a mano con node:crypto en vez de traer una librería de JWT: HS256 son tres líneas
 * (base64url de cabecera y cuerpo, y un HMAC), y una dependencia menos en un sitio donde toda
 * la seguridad depende de que el secreto no se filtre.
 */

const APP_ID = process.env.JITSI_APP_ID || "pulse";
const SECRETO = process.env.JITSI_APP_SECRET;
const DOMINIO_XMPP = "meet.jitsi";

// Vida corta a propósito: el token sirve para ENTRAR, no para quedarse. Si alguien lo
// reenvía, deja de valer en un rato. Quien siga dentro de la reunión no se cae — Jitsi
// comprueba el token al entrar, no cada minuto.
const VIDA_SEGUNDOS = 2 * 60 * 60;

export const jitsiConfigurado = () => !!SECRETO;

const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/**
 * Token para UNA persona en UNA sala.
 *
 * El claim `room` es lo que impide que un token sirva para otra reunión: prosody lo compara
 * con la sala a la que se intenta entrar. Sin él (o con "*"), el token de la reunión de
 * cualquiera abriría la sesión de psicología de cualquier otro.
 */
export const firmarTokenJitsi = ({ sala, usuario, esAnfitrion = false }) => {
  if (!SECRETO) throw new Error("Falta JITSI_APP_SECRET en el servidor.");
  if (!sala || !usuario?.id) throw new Error("Faltan datos para firmar el token.");

  const ahora = Math.floor(Date.now() / 1000);
  const cabecera = { alg: "HS256", typ: "JWT" };
  const cuerpo = {
    aud: "jitsi",
    iss: APP_ID,
    sub: DOMINIO_XMPP,
    room: sala,
    // 10 segundos de margen hacia atrás: el reloj del servidor y el del navegador rara vez
    // coinciden al segundo, y un token "del futuro" se rechaza sin explicación útil.
    nbf: ahora - 10,
    exp: ahora + VIDA_SEGUNDOS,
    context: {
      user: {
        id: usuario.id,
        name: usuario.name || "Invitado",
        avatar: usuario.avatarUrl || undefined,
        // Solo quien convoca modera (silenciar, expulsar, terminar). El resto entra como
        // participante: en una reunión con la psicóloga, que cualquiera pueda expulsar a
        // otro no es una función, es un problema.
        moderator: esAnfitrion ? "true" : "false",
      },
    },
  };

  const partes = `${b64url(JSON.stringify(cabecera))}.${b64url(JSON.stringify(cuerpo))}`;
  const firma = b64url(crypto.createHmac("sha256", SECRETO).update(partes).digest());
  return `${partes}.${firma}`;
};

/**
 * Identificador de sala: aleatorio y opaco.
 *
 * Nunca derivado del título. En Jitsi el nombre de la sala ES la dirección, así que una sala
 * llamada "revision-desempeno-erick" se adivina desde fuera — y aunque el token impida
 * entrar, el propio nombre ya cuenta algo que no debería contarse.
 */
export const nuevaSala = () => crypto.randomBytes(16).toString("hex");
