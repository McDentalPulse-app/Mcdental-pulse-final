import { configOk, admin, quienLlama } from "./_auth.js";
import { notificar } from "./_notificaciones.js";

/**
 * Resolutor único de solicitudes que resuelve RH: vacación, permiso, comisión e intercambio de
 * día. Se consolidan en UN solo endpoint porque en Vercel Hobby hay un tope de 12 funciones
 * serverless y cada archivo de api/ cuenta como una; los cuatro comparten el mismo patrón
 * (verificar gestión → actualizar estado → avisar por push, que se firma con la clave de VAPID
 * que solo vive en el servidor). Despacha por `recurso`. Cada rama conserva su lógica original.
 */

const GESTION = ["admin", "rh"];
const GESTION_AMPLIA = ["admin", "rh", "psicologa"];

const fmt = (f) =>
  new Date(`${f}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "long" });

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido." });
  }
  if (!configOk()) {
    return res.status(500).json({ error: "Supabase no está configurado en el servidor." });
  }

  const quien = await quienLlama(req);
  if (!quien) {
    return res.status(401).json({ error: "Sesión inválida." });
  }

  const { recurso, id, estado, comentario } = req.body || {};
  const supabase = admin();

  switch (recurso) {
    case "vacacion": return resolverVacacion(res, quien, supabase, id, estado, comentario);
    case "permiso": return resolverPermiso(res, quien, supabase, id, estado, comentario);
    case "comision": return resolverComision(res, quien, supabase, id, estado, comentario);
    case "intercambio": return resolverIntercambio(res, quien, supabase, id, estado, comentario);
    default: return res.status(400).json({ error: "Recurso no válido." });
  }
}

async function resolverVacacion(res, quien, supabase, id, estado, comentario) {
  if (!GESTION.includes(quien.role)) {
    return res.status(403).json({ error: "Solo Recursos Humanos puede resolver una solicitud de vacaciones." });
  }
  if (!id || !["aprobado", "rechazado"].includes(estado)) {
    return res.status(400).json({ error: "Faltan datos o el estado no es válido." });
  }

  const { data: vacacion, error } = await supabase
    .from("vacaciones")
    .update({ estado, comentario_rh: comentario || "" })
    .eq("id", id)
    .select("*, usuarios(name, sucursal, puesto)")
    .single();

  if (error) {
    console.error("Error resolviendo la solicitud de vacaciones:", error);
    return res.status(500).json({ error: "No se pudo actualizar la solicitud de vacaciones." });
  }

  await notificar(vacacion.empleado_id, {
    tipo: "vacacion",
    titulo: estado === "aprobado" ? "Vacaciones aprobadas" : "Vacaciones rechazadas",
    cuerpo:
      estado === "aprobado"
        ? `Tus vacaciones del ${fmt(vacacion.fecha_inicio)} al ${fmt(vacacion.fecha_fin)} fueron aprobadas.`
        : `Tus vacaciones del ${fmt(vacacion.fecha_inicio)} al ${fmt(vacacion.fecha_fin)} no fueron aprobadas.${vacacion.comentario_rh ? ` ${vacacion.comentario_rh}` : ""}`,
    url: "/empleado/permisosempleado",
  }).catch(() => {});

  return res.status(200).json({ ok: true, vacacion });
}

async function resolverPermiso(res, quien, supabase, id, estado, comentario) {
  if (!GESTION.includes(quien.role)) {
    return res.status(403).json({ error: "Solo Recursos Humanos puede resolver un permiso." });
  }
  if (!id || !["aprobado", "rechazado"].includes(estado)) {
    return res.status(400).json({ error: "Faltan datos o el estado no es válido." });
  }

  const { data: permiso, error } = await supabase
    .from("permisos")
    .update({ estado, comentario_rh: comentario || "" })
    .eq("id", id)
    .select("*, usuarios(name, sucursal, puesto)")
    .single();

  if (error) {
    console.error("Error resolviendo el permiso:", error);
    return res.status(500).json({ error: "No se pudo actualizar el permiso." });
  }

  await notificar(permiso.empleado_id, {
    tipo: "permiso",
    titulo: estado === "aprobado" ? "Permiso aprobado" : "Permiso rechazado",
    cuerpo:
      estado === "aprobado"
        ? `Tu permiso del ${fmt(permiso.fecha)} fue aprobado.`
        : `Tu permiso del ${fmt(permiso.fecha)} no fue aprobado.${permiso.comentario_rh ? ` ${permiso.comentario_rh}` : ""}`,
    url: "/empleado/permisosempleado",
  }).catch(() => {});

  return res.status(200).json({ ok: true, permiso });
}

async function resolverComision(res, quien, supabase, id, estado, comentario) {
  if (!GESTION_AMPLIA.includes(quien.role)) {
    return res.status(403).json({ error: "Solo Recursos Humanos puede revisar una comisión." });
  }
  if (!id || !["valida", "invalida"].includes(estado)) {
    return res.status(400).json({ error: "Faltan datos o el estado no es válido." });
  }

  const { data: comision, error } = await supabase
    .from("comisiones")
    .update({ estado, comentario_rh: comentario || "", revisado_por: quien.id, revisado_en: new Date().toISOString() })
    .eq("id", id)
    .select("*, usuarios:doctor_id(name)")
    .single();

  if (error) {
    console.error("Error revisando la comisión:", error);
    return res.status(500).json({ error: "No se pudo actualizar la comisión." });
  }

  const valida = estado === "valida";
  const cuerpo = valida
    ? `Tu recibo del ${fmt(comision.fecha)} fue validado.${comision.comentario_rh ? ` ${comision.comentario_rh}` : ""}`
    : `Tu recibo del ${fmt(comision.fecha)} fue rechazado.${comision.comentario_rh ? ` ${comision.comentario_rh}` : ""}`;

  await supabase
    .from("mensajes")
    .insert({ de_id: quien.id, para_id: comision.doctor_id, texto: cuerpo })
    .then(({ error: e }) => { if (e) console.error("Error guardando mensaje de comisión:", e); });

  await notificar(comision.doctor_id, {
    tipo: "comision",
    titulo: valida ? "Comisión validada" : "Comisión rechazada",
    cuerpo,
    url: "/doctor/comisiones",
  }).catch(() => {});

  return res.status(200).json({ ok: true, comision });
}

async function resolverIntercambio(res, quien, supabase, id, estado, comentario) {
  if (!GESTION_AMPLIA.includes(quien.role)) {
    return res.status(403).json({ error: "Solo Recursos Humanos puede resolver un intercambio." });
  }
  if (!id || !["aprobado", "rechazado"].includes(estado)) {
    return res.status(400).json({ error: "Faltan datos o el estado no es válido." });
  }

  const { data: intercambio, error } = await supabase
    .from("intercambios_dia")
    .update({ estado, comentario_rh: comentario || "" })
    .eq("id", id)
    .select("*, usuarios:empleado_id(role)")
    .single();

  if (error) {
    console.error("Error resolviendo el intercambio:", error);
    return res.status(500).json({ error: "No se pudo actualizar la solicitud." });
  }

  const rolSolicitante = intercambio.usuarios?.role === "doctor" ? "doctor" : "empleado";
  const aprobado = estado === "aprobado";

  await notificar(intercambio.empleado_id, {
    tipo: "intercambio",
    titulo: aprobado ? "Intercambio de día aprobado" : "Intercambio de día rechazado",
    cuerpo: aprobado
      ? `Tu intercambio para el ${fmt(intercambio.fecha_destino)} fue aprobado.${intercambio.comentario_rh ? ` ${intercambio.comentario_rh}` : ""}`
      : `Tu intercambio para el ${fmt(intercambio.fecha_destino)} no fue aprobado.${intercambio.comentario_rh ? ` ${intercambio.comentario_rh}` : ""}`,
    url: `/${rolSolicitante}/calendario`,
  }).catch(() => {});

  return res.status(200).json({ ok: true, intercambio });
}
