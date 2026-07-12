import { supabase } from "../../config/supabase";
import { fetchAll } from "./fetchAll";

const mapUsuario = (row) =>
  row && {
    id: row.id,
    name: row.name,
    user: row.username,
    role: row.role,
    sucursal: row.sucursal,
    puesto: row.puesto,
    telefono: row.telefono,
    email: row.email,
    fechaIngreso: row.fecha_ingreso,
    fechaCumpleanos: row.fecha_cumpleanos,
    fechaNacimiento: row.fecha_nacimiento,
    inactivo: row.inactivo,
    debeCambiarPassword: row.debe_cambiar_password,
    avatarUrl: row.avatar_url,
  };

export const getUsuarios = async () => {
  try {
    const rows = await fetchAll(() => supabase.from("usuarios").select("*"));
    return rows.map(mapUsuario);
  } catch (error) {
    console.error("Error al obtener usuarios:", error);
    throw new Error("No se pudieron cargar los usuarios.", { cause: error });
  }
};

export const updateUsuario = async (id, updates) => {
  const payload = {};
  if (updates.name !== undefined) payload.name = updates.name;
  // El username NO se actualiza acá a propósito: el login autentica contra el
  // email sintético de auth.users, así que cambiarlo solo en public.usuarios
  // deja al empleado sin poder entrar. Usar cambiarUsername() (edge function).
  if (updates.role !== undefined) payload.role = updates.role;
  if (updates.sucursal !== undefined) payload.sucursal = updates.sucursal;
  if (updates.puesto !== undefined) payload.puesto = updates.puesto;
  if (updates.telefono !== undefined) payload.telefono = updates.telefono;
  if (updates.email !== undefined) payload.email = updates.email;
  if (updates.fechaIngreso !== undefined) payload.fecha_ingreso = updates.fechaIngreso || null;
  if (updates.fechaCumpleanos !== undefined) payload.fecha_cumpleanos = updates.fechaCumpleanos || null;
  if (updates.inactivo !== undefined) payload.inactivo = updates.inactivo;

  const { data, error } = await supabase
    .from("usuarios")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error actualizando usuario:", error);
    throw new Error("No se pudo actualizar el usuario.");
  }
  return mapUsuario(data);
};

// Cambio de nombre de usuario: pasa por la Edge Function admin-update-username,
// que actualiza en un solo paso auth.users.email (la credencial real de login),
// usuarios.username y usuarios.synthetic_email.
export const cambiarUsername = async (usuarioId, nuevoUsername) => {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error("Sesión no válida. Vuelve a iniciar sesión.");

  const { data, error } = await supabase.functions.invoke("admin-update-username", {
    body: { usuarioId, nuevoUsername },
    headers: { Authorization: `Bearer ${token}` },
  });
  if (error) {
    // supabase-js envuelve los 4xx: el detalle real viene en el body.
    const detalle = await error?.context?.json?.().catch(() => null);
    throw new Error(detalle?.error || error.message || "No se pudo cambiar el nombre de usuario.");
  }
  return mapUsuario(data.usuario);
};

// Alta de usuario: la creación pasa por la Edge Function admin-create-usuario
// (usa service_role en el servidor para crear el auth.user + fila usuarios).
export const crearUsuario = async (payload) => {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error("Sesión no válida. Vuelve a iniciar sesión.");

  const { data, error } = await supabase.functions.invoke("admin-create-usuario", {
    body: {
      name: payload.name,
      username: payload.user,
      role: payload.role,
      sucursal: payload.sucursal,
      puesto: payload.puesto,
      telefono: payload.telefono,
      email: payload.email,
      fechaIngreso: payload.fechaIngreso,
      fechaCumpleanos: payload.fechaCumpleanos,
    },
    headers: { Authorization: `Bearer ${token}` },
  });
  if (error) throw error;
  return mapUsuario(data.usuario);
};

export const getEncuestaPreguntas = async () => {
  const { data, error } = await supabase
    .from("encuesta_preguntas")
    .select("*")
    .order("orden", { ascending: true });
  if (error) {
    console.error("Error al obtener preguntas:", error);
    throw new Error("No se pudieron cargar las preguntas.");
  }
  return data.map((row) => ({
    id: row.id,
    texto: row.texto,
    tipo: row.tipo,
    area: row.area,
    opciones: row.opciones,
    orden: row.orden,
    activa: row.activa,
  }));
};
