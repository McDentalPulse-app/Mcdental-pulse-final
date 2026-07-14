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
  fotoPurgada: row.foto_purgada,
  deviceId: row.device_id,
  dispositivoNuevo: row.dispositivo_nuevo,
  matchScore: row.match_score,
  rostroVerificado: row.rostro_verificado,
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
 * Va por /api/checar y NO por la RPC, y ese cambio es lo que hace que el cotejo facial
 * bloquee de verdad: el servidor compara la cara ANTES de crear la checada. Mientras la RPC
 * fuera llamable desde el navegador, cualquiera se saltaba el cotejo con dos líneas en la
 * consola — así que se le retiró el permiso al cliente (migración 043).
 *
 * Fíjate en lo que este servicio NO manda: ni la hora, ni la distancia, ni si la ubicación
 * es válida, ni si la cara coincide. Todo eso lo decide el servidor. Si el cliente pudiera
 * mandarlo, bastaría con atrasar el reloj del teléfono para llegar siempre puntual, o con
 * mandar un "cara verificada: sí".
 *
 * Lanza Error si la checada NO se registró (cara que no coincide, doble clic, salida fuera
 * de la ventana). El mensaje ya viene escrito para el usuario.
 */
export const registrarChecada = async ({ tipo, coords = null, selfieBlob = null, empleadoId, deviceId = null }) => {
  let selfiePath = null;

  if (selfieBlob && empleadoId) {
    // El path DEBE empezar por el uuid del empleado: es lo que la policy de storage usa
    // para comprobar que nadie escribe en la carpeta de otro (migración 037).
    const ruta = `${empleadoId}/${Date.now()}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(ruta, selfieBlob, { contentType: "image/jpeg" });

    if (uploadError) {
      console.error("Error subiendo la selfie de la checada:", uploadError);
      // Se sigue sin foto: si el empleado no está enrolado, la checada no se coteja y no
      // tiene sentido impedirle fichar porque se le cayó la red a mitad del upload. Si SÍ
      // está enrolado, el servidor no podrá cotejar y lo tratará como un intento fallido.
    } else {
      selfiePath = ruta;
    }
  }

  const { data: sesion } = await supabase.auth.getSession();
  const token = sesion?.session?.access_token;
  if (!token) throw new Error("Tu sesión expiró. Vuelve a entrar.");

  const respuesta = await fetch("/api/checar", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      tipo,
      selfiePath,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      precision: coords?.precision ?? null,
      deviceId,
    }),
  });

  const cuerpo = await respuesta.json().catch(() => ({}));

  if (!respuesta.ok) {
    const error = new Error(cuerpo.error || "No se pudo registrar tu checada.");
    error.bloqueado = !!cuerpo.bloqueado; // la cara no coincidió: no hay checada
    error.aviso = cuerpo.aviso || null;
    throw error;
  }

  return mapAsistencia(cuerpo.checada);
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
