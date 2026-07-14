import { supabase } from "../../config/supabase";
import { fetchAll } from "./fetchAll";

const BUCKET = "asistencias";
const SELECT_CON_EMPLEADO = "*, usuarios(name, sucursal, puesto)";

const mapAsistencia = (row) => ({
  id: row.id,
  empleadoId: row.empleado_id,
  empleado: row.usuarios?.name,
  sucursal: row.usuarios?.sucursal,
  puesto: row.usuarios?.puesto,
  tipo: row.tipo,
  fecha: row.fecha,
  marcadaEn: row.marcada_en,
  lat: row.lat,
  lng: row.lng,
  precisionM: row.precision_m,
  sucursalId: row.sucursal_id,
  distanciaM: row.distancia_m,
  ubicacionEstado: row.ubicacion_estado,
  selfiePath: row.selfie_path,
  deviceId: row.device_id,
  dispositivoNuevo: row.dispositivo_nuevo,
  origen: row.origen,
  anulada: row.anulada,
  notaRh: row.nota_rh,
  createdAt: row.created_at,
});

/**
 * Checadas en un rango de fechas.
 *
 * SIEMPRE acotado por rango, nunca "tráete todo". Esta tabla crece sin techo (unas
 * 30.000 filas al año con 60 empleados), así que no vive en GlobalContext como el
 * resto de colecciones: la piden las pantallas que la necesitan, con sus fechas.
 */
export const getAsistencias = async ({ desde, hasta, empleadoId } = {}) => {
  try {
    const rows = await fetchAll(() => {
      let q = supabase.from("asistencias").select(SELECT_CON_EMPLEADO);
      if (desde) q = q.gte("fecha", desde);
      if (hasta) q = q.lte("fecha", hasta);
      if (empleadoId) q = q.eq("empleado_id", empleadoId);
      return q.order("marcada_en", { ascending: true });
    });
    return rows.map(mapAsistencia);
  } catch (error) {
    console.error("Error al obtener asistencias:", error);
    throw new Error("No se pudo cargar el registro de asistencia.", { cause: error });
  }
};

/**
 * Registra una checada.
 *
 * La selfie se sube ANTES de llamar a la RPC, y su fallo NO aborta la checada: no
 * vamos a impedirle a alguien fichar su entrada porque la cámara falló o porque se le
 * fue la red a mitad del upload. Se registra sin foto y RH lo ve.
 *
 * Al revés sí importa: si la RPC falla, la selfie queda huérfana en el bucket. Es
 * inofensivo (un objeto de 40 KB que nadie referencia) y es el mismo trade-off que ya
 * acepta subirArchivoExpediente().
 *
 * Fíjate en lo que este servicio NO manda: ni la hora, ni la distancia, ni si la
 * ubicación es válida. Todo eso lo decide el servidor en registrar_checada() — si el
 * cliente pudiera mandarlo, bastaría con atrasar el reloj del teléfono para llegar
 * siempre puntual.
 */
export const registrarChecada = async ({ tipo, coords = null, selfieBlob = null, empleadoId, deviceId = null }) => {
  let selfiePath = null;

  if (selfieBlob && empleadoId) {
    // El path DEBE empezar por el uuid del empleado: es lo que la policy de storage
    // usa para comprobar que nadie escribe en la carpeta de otro (migración 037).
    const ruta = `${empleadoId}/${Date.now()}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(ruta, selfieBlob, { contentType: "image/jpeg" });

    if (uploadError) {
      console.error("Error subiendo la selfie de la checada:", uploadError);
      // Se sigue sin foto, a propósito. Ver el comentario de arriba.
    } else {
      selfiePath = ruta;
    }
  }

  const { data, error } = await supabase.rpc("registrar_checada", {
    p_tipo: tipo,
    p_lat: coords?.lat ?? null,
    p_lng: coords?.lng ?? null,
    p_precision: coords?.precision ?? null,
    p_selfie_path: selfiePath,
    p_device_id: deviceId,
  });

  if (error) {
    console.error("Error registrando la checada:", error);
    // La RPC lanza mensajes ya escritos para el usuario ("Ya registraste tu entrada
    // hace unos segundos", "hoy no tienes una entrada registrada"). Se respetan tal
    // cual en vez de taparlos con un genérico: dicen exactamente qué pasó.
    throw new Error(error.message || "No se pudo registrar tu checada.");
  }

  // La RPC devuelve la fila (returns public.asistencias). PostgREST la entrega como
  // objeto, pero si algún día se cambiara a "returns setof" llegaría como array.
  const row = Array.isArray(data) ? data[0] : data;
  return mapAsistencia(row);
};

/** Alta manual de RH: "se le murió el teléfono y no pudo checar". */
export const addChecadaManual = async ({ empleadoId, tipo, fecha, marcadaEn, notaRh }) => {
  const { data, error } = await supabase
    .from("asistencias")
    .insert({
      empleado_id: empleadoId,
      tipo,
      fecha,
      marcada_en: marcadaEn,
      ubicacion_estado: "sin_gps", // no hubo dispositivo: no hay ubicación que comprobar
      origen: "rh",
      nota_rh: notaRh || "Alta manual de RH",
    })
    .select(SELECT_CON_EMPLEADO)
    .single();

  if (error) {
    console.error("Error en el alta manual de checada:", error);
    throw new Error("No se pudo registrar la checada manual.");
  }
  return mapAsistencia(data);
};

/** Anular una checada errónea. No se borra: es un documento laboral. */
export const anularChecada = async (id, notaRh = "") => {
  const { data, error } = await supabase
    .from("asistencias")
    .update({ anulada: true, nota_rh: notaRh })
    .eq("id", id)
    .select(SELECT_CON_EMPLEADO)
    .single();

  if (error) {
    console.error("Error anulando la checada:", error);
    throw new Error("No se pudo anular la checada.");
  }
  return mapAsistencia(data);
};

/**
 * URL firmada para ver una selfie. El bucket es privado (migración 037): la foto de la
 * cara de alguien, con su hora y su coordenada al lado, no puede quedar colgando de una
 * URL pública permanente. 5 minutos es de sobra para pintarla en pantalla.
 */
export const getSignedUrlSelfie = async (selfiePath, expiresInSeconds = 300) => {
  if (!selfiePath) return null;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(selfiePath, expiresInSeconds);

  if (error) {
    console.error("Error firmando la URL de la selfie:", error);
    throw new Error("No se pudo abrir la foto de la checada.");
  }
  return data.signedUrl;
};

/** Realtime: el panel de RH se pinta solo cuando alguien checa (migración 036). */
export const subscribeAsistencias = (onInsert) => {
  const channel = supabase
    .channel("asistencias-inserts")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "asistencias" },
      (payload) => onInsert(mapAsistencia(payload.new))
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
};
