import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";

/**
 * Vista previa de un enlace, leyendo sus etiquetas Open Graph.
 *
 * ================== POR QUÉ ESTE ARCHIVO ES TAN DESCONFIADO ==================
 *
 * Aquí un usuario decide a qué dirección hace una petición NUESTRO servidor. Eso es un SSRF
 * de manual, y en esta máquina no es teórico: en la misma red de Docker viven Postgres,
 * Kong, el storage y este propio API. Sin defensas, pegar `http://pulse-kong:8000` o
 * `http://169.254.169.254/` en el chat convierte la vista previa en una ventana para
 * sondear la infraestructura desde dentro — y el resultado volvería pintado en una tarjeta.
 *
 * Tres capas, y ninguna sobra:
 *
 *  1. Solo http/https. Sin esto, `file:///etc/passwd` y `gopher://` entran solos.
 *
 *  2. Se resuelve el nombre y se comprueban TODAS las direcciones. No basta con mirar el
 *     texto del host: `localtest.me` y mil dominios más resuelven a 127.0.0.1, y un nombre
 *     puede devolver varias direcciones de las que solo una sea interna.
 *
 *  3. La comprobación se hace DENTRO del `lookup` de la conexión, no antes de llamar. Es la
 *     diferencia que importa: validar primero y conectar después deja una rendija (DNS
 *     rebinding) en la que el nombre se resuelve una segunda vez, ya con la dirección
 *     interna. Al conectar con nuestro propio `lookup`, la dirección que se valida es
 *     exactamente la que se usa, también en cada redirección.
 * ============================================================================
 */

// Rangos que nunca deben alcanzarse desde aquí.
const esPrivada = (ip) => {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;   // metadatos de la nube
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;                 // multicast y reservados
    return false;
  }
  if (net.isIPv6(ip)) {
    const x = ip.toLowerCase();
    if (x === "::1" || x === "::") return true;
    if (x.startsWith("fc") || x.startsWith("fd")) return true;   // únicas locales
    if (x.startsWith("fe80")) return true;                       // enlace local
    // ::ffff:10.0.0.1 y demás IPv4 disfrazadas de IPv6.
    const v4 = x.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (v4) return esPrivada(v4[1]);
    return false;
  }
  return true;   // lo que no se reconoce, no se visita
};

/** `lookup` para http/https que rechaza cualquier host que resuelva a una dirección interna. */
const lookupSeguro = (hostname, opciones, callback) => {
  dns.lookup(hostname, { all: true, verbatim: true })
    .then((dirs) => {
      // Si UNA sola de las direcciones es interna se rechaza todo el host. Quedarse con las
      // públicas dejaría pasar a un atacante que anuncia las dos y confía en el reintento.
      if (!dirs.length || dirs.some((d) => esPrivada(d.address))) {
        return callback(new Error("Dirección no permitida."));
      }
      const { address, family } = dirs[0];
      callback(null, opciones?.all ? [{ address, family }] : address, family);
    })
    .catch(() => callback(new Error("No se pudo resolver el dominio.")));
};

const MAX_BYTES = 512 * 1024;   // con la cabecera basta; no se descarga la página entera
const MS_TIMEOUT = 3000;        // el envío del mensaje espera a esto: no puede tardar
const MAX_SALTOS = 3;

const pedir = (url, saltos = 0) =>
  new Promise((resolve, reject) => {
    if (saltos > MAX_SALTOS) return reject(new Error("Demasiadas redirecciones."));

    let u;
    try { u = new URL(url); } catch { return reject(new Error("URL inválida.")); }
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return reject(new Error("Solo se admiten enlaces http y https."));
    }

    const cliente = u.protocol === "https:" ? https : http;
    const req = cliente.get(
      u,
      {
        lookup: lookupSeguro,
        timeout: MS_TIMEOUT,
        headers: {
          // Identificarse como navegador: muchos sitios no sirven las etiquetas OG a otra cosa.
          "user-agent": "Mozilla/5.0 (compatible; McDentalPulse/1.0; +vista previa de enlace)",
          accept: "text/html,application/xhtml+xml",
          "accept-language": "es-MX,es;q=0.9",
        },
      },
      (res) => {
        // Las redirecciones se siguen a mano para que cada salto vuelva a pasar por
        // `lookupSeguro`: un sitio público que redirige a 127.0.0.1 es el truco clásico.
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          res.destroy();
          return resolve(pedir(new URL(res.headers.location, u).href, saltos + 1));
        }
        if (res.statusCode !== 200) {
          res.destroy();
          return reject(new Error(`El sitio respondió ${res.statusCode}.`));
        }
        if (!String(res.headers["content-type"] || "").includes("html")) {
          res.destroy();
          return reject(new Error("El enlace no es una página web."));
        }

        let datos = "";
        res.setEncoding("utf8");
        res.on("data", (trozo) => {
          datos += trozo;
          // Cortar en cuanto hay bastante: sin este tope, un archivo enorme servido como
          // html llenaría la memoria del servidor desde el chat.
          if (datos.length > MAX_BYTES) { res.destroy(); }
        });
        res.on("end", () => resolve({ html: datos, url: u.href }));
        res.on("close", () => resolve({ html: datos, url: u.href }));
      }
    );

    req.on("timeout", () => { req.destroy(new Error("El sitio tardó demasiado.")); });
    req.on("error", reject);
  });

const meta = (html, ...nombres) => {
  for (const n of nombres) {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${n}["'][^>]+content=["']([^"']*)["']`, "i"
    );
    const m = html.match(re) || html.match(new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${n}["']`, "i"
    ));
    if (m?.[1]) return m[1].trim();
  }
  return null;
};

const limpiar = (s, max) => {
  if (!s) return null;
  const t = s
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ")
    .trim();
  return t ? t.slice(0, max) : null;
};

/** Primera URL http/https de un texto, o null. */
export const primerEnlace = (texto) => {
  const m = String(texto || "").match(/https?:\/\/[^\s<>"']+/i);
  return m ? m[0].replace(/[.,;:)]+$/, "") : null;
};

/**
 * Devuelve {url, titulo, descripcion, imagen} o null.
 *
 * NUNCA lanza: la vista previa es un adorno y el mensaje tiene que salir igual aunque el
 * sitio no responda, sea privado o devuelva basura.
 */
export const vistaPreviaEnlace = async (url) => {
  try {
    const { html, url: finalUrl } = await pedir(url);
    if (!html) return null;

    const titulo = limpiar(
      meta(html, "og:title", "twitter:title") || html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1],
      160
    );
    const descripcion = limpiar(meta(html, "og:description", "twitter:description", "description"), 240);
    let imagen = meta(html, "og:image", "twitter:image");

    if (imagen) {
      try {
        const abs = new URL(imagen, finalUrl);
        // La imagen la cargará el NAVEGADOR de quien lee, así que aquí solo se admite https:
        // una imagen http en una página https la bloquea el navegador igualmente, y una
        // dirección interna no tendría por qué estar en esta tarjeta.
        imagen = abs.protocol === "https:" ? abs.href.slice(0, 500) : null;
      } catch { imagen = null; }
    }

    if (!titulo && !descripcion && !imagen) return null;
    return { url: finalUrl.slice(0, 500), titulo, descripcion, imagen };
  } catch (error) {
    console.warn("Vista previa no disponible:", url, error?.message);
    return null;
  }
};
