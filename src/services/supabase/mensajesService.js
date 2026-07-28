import { supabase } from "../../config/supabase";
import { fetchAll } from "./fetchAll";
import { comprimirImagen } from "../../utils/imagen";
import { analizarAudio } from "../../utils/audio";

const BUCKET = "mensajes";
const MAX_BYTES = 10 * 1024 * 1024;   // el mismo tope que declara el bucket (migración 086)

// Por encima de esto, una imagen se recomprime antes de subir. Por debajo se sube tal cual:
// recomprimir una captura pequeña solo consigue emborronarle el texto sin ahorrar nada.
const COMPRIMIR_DESDE_BYTES = 1.5 * 1024 * 1024;
const LADO_MAX_IMAGEN = 1600;

const mapMensaje = (row) => ({
  id: row.id,
  de: row.de_id,
  para: row.para_id,
  texto: row.texto,
  leido: row.leido,
  fecha: row.fecha,
  respondeA: row.responde_a || null,
  enlace: row.enlace || null,
  eliminado: !!row.eliminado_en,
  adjunto: row.adjunto_path
    ? {
        path: row.adjunto_path,
        nombre: row.adjunto_nombre,
        mime: row.adjunto_mime,
        bytes: row.adjunto_bytes,
        meta: row.adjunto_meta || {},
      }
    : null,
});

/**
 * Nombre apto para una RUTA de storage. El nombre bonito se guarda aparte, en
 * `adjunto_nombre`, y es el que se muestra y se descarga.
 *
 * Esto no es cosmética: al migrar el storage el 2026-07-27, un expediente llamado
 * "Actividades Erick Torres 29_04 Junio_Julio.pdf" reventó la subida porque el espacio no
 * puede ir en una URL sin escapar. Aquí el problema se corta de raíz.
 */
const rutaSegura = (nombre) =>
  (nombre || "archivo")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")   // fuera acentos (combinantes)
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(-80);                                        // conserva la extensión

/** Ancho y alto reales, para reservar el hueco de la imagen y que el chat no dé un salto. */
const medirImagen = (blob) =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ ancho: img.naturalWidth, alto: img.naturalHeight });
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve({}); };
    img.src = url;
  });

/**
 * Sube un adjunto al bucket privado y devuelve los campos que van en el mensaje.
 *
 * La primera carpeta es SIEMPRE el id de quien sube: es lo que comprueba la política
 * `mensajes_obj_insert_own`, y lo que después permite a `mensajes_obj_select_participante`
 * decidir quién puede volver a abrirlo.
 */
export const subirAdjunto = async ({ miId, archivo }) => {
  if (!miId || !archivo) throw new Error("Falta el archivo.");
  if (archivo.size > MAX_BYTES) {
    throw new Error("El archivo pesa más de 10 MB. Comprímelo o mándalo por otra vía.");
  }

  const esImagen = (archivo.type || "").startsWith("image/");
  let cuerpo = archivo;
  let mime = archivo.type || "application/octet-stream";
  let meta = {};

  if (esImagen) {
    if (archivo.size > COMPRIMIR_DESDE_BYTES) {
      cuerpo = await comprimirImagen(archivo, LADO_MAX_IMAGEN);
      mime = "image/jpeg";
    }
    meta = await medirImagen(cuerpo);
  } else if (mime.startsWith("audio/")) {
    // La onda se calcula UNA vez, aquí, y viaja en la metadata. Si se dejara para el momento
    // de pintarla, cada persona que abriera la conversación tendría que descargar y decodificar
    // el audio entero solo para dibujar 48 barras.
    meta = await analizarAudio(cuerpo);
  }

  const ruta = `${miId}/${Date.now()}-${rutaSegura(archivo.name)}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(ruta, cuerpo, { upsert: false, contentType: mime });

  if (error) {
    console.error("Error subiendo adjunto:", error);
    throw new Error("No se pudo subir el archivo.");
  }

  return {
    path: ruta,
    nombre: archivo.name,   // el original, con sus espacios y acentos
    mime,
    bytes: cuerpo.size ?? archivo.size,
    meta,
  };
};

/**
 * URL temporal para abrir un adjunto. El bucket es privado, así que no hay URL pública: cada
 * vez que alguien mira la conversación se firma una nueva, y la RLS decide si tiene derecho.
 */
export const getSignedUrlAdjunto = async (path, expiraEnSegundos = 300) => {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiraEnSegundos);
  if (error) {
    console.error("Error firmando la URL del adjunto:", error);
    return null;
  }
  return data?.signedUrl || null;
};

export const getMensajes = async () => {
  try {
    const rows = await fetchAll(() => supabase.from("mensajes").select("*"));
    return rows.map(mapMensaje);
  } catch (error) {
    console.error("Error al obtener mensajes:", error);
    throw new Error("No se pudieron cargar los mensajes.", { cause: error });
  }
};

/**
 * Pasa por el SERVIDOR (api/enviar-mensaje.js), no por un insert directo: es lo que permite
 * avisar por push a quien recibe el mensaje, con la clave privada de VAPID que solo vive ahí.
 */
export const sendMensaje = async ({ para, texto, fecha, adjunto, respondeA }) => {
  const { data: sesion } = await supabase.auth.getSession();
  const token = sesion?.session?.access_token;
  if (!token) throw new Error("Tu sesión expiró. Vuelve a entrar.");

  const r = await fetch("/api/enviar-mensaje", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    // El archivo ya está en el storage cuando esto se llama: aquí solo viaja su ruta y su
    // metadata, nunca los bytes. El servidor comprueba que la ruta sea de quien la manda.
    body: JSON.stringify({ paraId: para, texto, fecha, adjunto, respondeA }),
  });

  const cuerpo = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error("Error guardando mensaje:", cuerpo.error);
    throw new Error(cuerpo.error || "No se pudo enviar el mensaje.");
  }
  return mapMensaje(cuerpo.mensaje);
};

/**
 * Elimina un mensaje para las dos partes. Pasa por el servidor por lo mismo que el envío: la
 * RLS no sabe de columnas, y una política de UPDATE que permitiera borrar permitiría también
 * reescribir el texto sin dejar rastro. Ver api/eliminar-mensaje.js.
 */
export const eliminarMensaje = async (mensajeId) => {
  const { data: sesion } = await supabase.auth.getSession();
  const token = sesion?.session?.access_token;
  if (!token) throw new Error("Tu sesión expiró. Vuelve a entrar.");

  const r = await fetch("/api/eliminar-mensaje", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ mensajeId }),
  });
  const cuerpo = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(cuerpo.error || "No se pudo eliminar el mensaje.");
  return true;
};

/** Reacciones de una conversación, agrupadas por mensaje. */
export const getReacciones = async (ids) => {
  if (!ids?.length) return {};
  const { data, error } = await supabase
    .from("mensaje_reacciones")
    .select("mensaje_id, usuario_id, emoji")
    .in("mensaje_id", ids);
  if (error) {
    console.error("Error al obtener reacciones:", error);
    return {};
  }
  const porMensaje = {};
  for (const r of data || []) {
    (porMensaje[r.mensaje_id] ||= []).push({ usuarioId: r.usuario_id, emoji: r.emoji });
  }
  return porMensaje;
};

/**
 * Pone o quita mi reacción. Es un interruptor: pulsar el mismo emoji dos veces lo retira, que
 * es lo que la gente espera y evita tener que ofrecer un "quitar" aparte.
 *
 * La PK compuesta (mensaje_id, usuario_id, emoji) hace imposible duplicarla en la base, así
 * que no hace falta comprobar antes de insertar.
 */
export const alternarReaccion = async ({ mensajeId, usuarioId, emoji, puesta }) => {
  if (puesta) {
    const { error } = await supabase
      .from("mensaje_reacciones")
      .delete()
      .eq("mensaje_id", mensajeId)
      .eq("usuario_id", usuarioId)
      .eq("emoji", emoji);
    if (error) throw new Error("No se pudo quitar la reacción.");
    return;
  }
  const { error } = await supabase
    .from("mensaje_reacciones")
    .insert({ mensaje_id: mensajeId, usuario_id: usuarioId, emoji });
  if (error) throw new Error("No se pudo reaccionar.");
};

/** Realtime de las reacciones. Mismo criterio que los mensajes: avisa y quien escucha recarga. */
export const subscribeReacciones = (usuarioId, onCambio) => {
  if (!usuarioId) return () => {};
  const channel = supabase
    .channel(`reacciones-${usuarioId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "mensaje_reacciones" }, () => onCambio())
    .subscribe();
  return () => supabase.removeChannel(channel);
};

export const marcarMensajeLeido = async (id) => {
  const { error } = await supabase.from("mensajes").update({ leido: true }).eq("id", id);
  if (error) {
    console.error("Error marcando mensaje como leído:", error);
    throw new Error("No se pudo marcar el mensaje como leído.");
  }
};

/**
 * Realtime: avisa cuando llega un mensaje o cuando alguien marca uno como leído (para encender
 * el doble check en el aparato de quien lo envió). Igual que subscribeNotificaciones: solo
 * dispara el callback y quien escucha vuelve a consultar, que a este volumen sale más simple
 * que reconciliar cada payload.
 *
 * SIN `filter` A PROPÓSITO. Un mensaje me interesa si soy el que lo manda O el que lo recibe, y
 * el filtro de realtime no admite un OR. No hace falta: realtime aplica la RLS de la tabla al
 * entregar, y `mensajes_select_participant` ya dice exactamente eso — así que el servidor solo
 * me manda los míos, sin que el cliente tenga que pedirlo bien.
 *
 * Requiere `mensajes` en la publicación supabase_realtime (migración 085). Si no lo está, el
 * canal se conecta y no llega nada: no falla, se queda callado.
 */
export const subscribeMensajes = (usuarioId, onCambio) => {
  if (!usuarioId) return () => {};
  const channel = supabase
    .channel(`mensajes-${usuarioId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "mensajes" }, () => onCambio())
    .subscribe();
  return () => supabase.removeChannel(channel);
};

/**
 * Canal de presencia de UNA conversación: sirve para el punto de "está aquí" y para
 * "escribiendo…".
 *
 * Se limita a los dos participantes en vez de un canal global de toda la app: para pintar el
 * punto solo hace falta saber si la otra persona tiene ESTA conversación abierta, y un canal
 * común convertiría el chat en un panel de quién está conectado a qué hora — información que
 * nadie ha pedido y que en un canal de apoyo psicológico es mejor no repartir.
 *
 * Por eso el punto significa "tiene la conversación abierta", no "está en la app".
 *
 * Devuelve { setEscribiendo, cerrar }.
 */
export const canalConversacion = ({ yo, otro, onPresencia }) => {
  if (!yo || !otro) return { setEscribiendo: () => {}, cerrar: () => {} };

  // Mismo nombre de canal desde los dos lados: sin ordenar, cada uno entraría en un canal
  // distinto y no se verían nunca.
  const sala = [yo, otro].sort().join("--");
  let escribiendoActual = false;

  const leerPresencia = (channel) => {
    const estado = channel.presenceState();
    const suyos = Object.values(estado).flat().filter((p) => p.usuario === otro);
    onPresencia({
      presente: suyos.length > 0,
      escribiendo: suyos.some((p) => p.escribiendo),
    });
  };

  const channel = supabase.channel(`chat-${sala}`, { config: { presence: { key: yo } } });

  channel
    .on("presence", { event: "sync" }, () => leerPresencia(channel))
    .subscribe(async (estado) => {
      if (estado === "SUBSCRIBED") await channel.track({ usuario: yo, escribiendo: false });
    });

  return {
    setEscribiendo: (valor) => {
      // Solo se reenvía cuando CAMBIA: `track` en cada tecla pulsada inunda el canal.
      if (valor === escribiendoActual) return;
      escribiendoActual = valor;
      channel.track({ usuario: yo, escribiendo: valor });
    },
    cerrar: () => supabase.removeChannel(channel),
  };
};
