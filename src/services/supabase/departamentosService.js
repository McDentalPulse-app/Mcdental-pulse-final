import { supabase } from "../../config/supabase";
import { fetchAll } from "./fetchAll";

const mapDepartamento = (row) => ({
  id: row.id,
  nombre: row.nombre,
  descripcion: row.descripcion,
  color: row.color,
  jefeId: row.jefe_id,
  createdAt: row.created_at,
});

const mapMiembro = (row) => ({
  usuarioId: row.usuario_id,
  nombre: row.usuarios?.name,
  puesto: row.usuarios?.puesto,
  avatarUrl: row.usuarios?.avatar_url,
});

const mapPublicacion = (row) => ({
  id: row.id,
  departamentoId: row.departamento_id,
  autorId: row.autor_id,
  autor: row.usuarios?.name,
  tipo: row.tipo,
  texto: row.texto,
  createdAt: row.created_at,
});

const mapTarea = (row) => ({
  id: row.id,
  departamentoId: row.departamento_id,
  titulo: row.titulo,
  descripcion: row.descripcion,
  fechaLimite: row.fecha_limite,
  creadoPor: row.creado_por,
  createdAt: row.created_at,
  asignados: (row.departamento_tarea_asignados || []).map((a) => ({
    usuarioId: a.usuario_id,
    nombre: a.usuarios?.name,
    completada: a.completada,
    completadaEn: a.completada_en,
  })),
});

// RLS ya acota esto a los departamentos donde la persona es jefe o miembro (migración 134).
export const getMisDepartamentos = async () => {
  const rows = await fetchAll(() => supabase.from("departamentos").select("*").order("created_at"));
  return rows.map(mapDepartamento);
};

// Crear el departamento y sumarse como miembro son dos pasos separados (no hay RPC): la
// policy de departamento_miembros exige ser jefe de ESE departamento, y para eso el
// departamento ya tiene que existir — el mismo orden que usa Avisos con su video (primero
// existe la fila, después se le agrega lo demás).
export const crearDepartamento = async ({ nombre, descripcion, color }) => {
  const { data: dep, error } = await supabase
    .from("departamentos")
    .insert({ nombre, descripcion: descripcion || null, color })
    .select("*")
    .single();
  if (error) {
    console.error("Error creando departamento:", error);
    throw new Error("No se pudo crear el departamento.");
  }
  const usuarioId = dep.jefe_id;
  const { error: errorMiembro } = await supabase
    .from("departamento_miembros")
    .insert({ departamento_id: dep.id, usuario_id: usuarioId });
  if (errorMiembro) {
    console.error("Error agregando al jefe como miembro:", errorMiembro);
    // El departamento ya existe aunque esto falle — no lo revertimos, no vale la pena una
    // limpieza para un caso que en la práctica no debería pasar (jefe_id lo pone la propia
    // policy de insert de departamentos al usuario actual).
  }
  return mapDepartamento(dep);
};

export const eliminarDepartamento = async (id) => {
  const { error } = await supabase.from("departamentos").delete().eq("id", id);
  if (error) {
    console.error("Error eliminando departamento:", error);
    throw new Error("No se pudo eliminar el departamento.");
  }
};

export const getMiembros = async (departamentoId) => {
  const rows = await fetchAll(() =>
    supabase
      .from("departamento_miembros")
      .select("usuario_id, usuarios(name, puesto, avatar_url)")
      .eq("departamento_id", departamentoId)
  );
  return rows.map(mapMiembro);
};

// Activos que todavía NO están en este departamento — para el selector del jefe al
// agregar gente. Cruza toda la empresa (un departamento no es cosa de un solo rol).
export const getUsuariosParaAgregar = async (departamentoId) => {
  const [usuarios, miembros] = await Promise.all([
    fetchAll(() => supabase.from("usuarios").select("id, name, puesto").eq("inactivo", false)),
    fetchAll(() => supabase.from("departamento_miembros").select("usuario_id").eq("departamento_id", departamentoId)),
  ]);
  const yaDentro = new Set(miembros.map((m) => m.usuario_id));
  return usuarios.filter((u) => !yaDentro.has(u.id)).map((u) => ({ id: u.id, nombre: u.name, puesto: u.puesto }));
};

export const agregarMiembro = async (departamentoId, usuarioId) => {
  const { error } = await supabase
    .from("departamento_miembros")
    .insert({ departamento_id: departamentoId, usuario_id: usuarioId });
  if (error) {
    console.error("Error agregando miembro:", error);
    throw new Error("No se pudo agregar a esa persona.");
  }
};

export const quitarMiembro = async (departamentoId, usuarioId) => {
  const { error } = await supabase
    .from("departamento_miembros")
    .delete()
    .eq("departamento_id", departamentoId)
    .eq("usuario_id", usuarioId);
  if (error) {
    console.error("Error quitando miembro:", error);
    throw new Error("No se pudo quitar a esa persona.");
  }
};

export const getPublicaciones = async (departamentoId) => {
  const rows = await fetchAll(() =>
    supabase
      .from("departamento_publicaciones")
      .select("*, usuarios(name)")
      .eq("departamento_id", departamentoId)
      .order("created_at", { ascending: false })
  );
  return rows.map(mapPublicacion);
};

export const publicar = async (departamentoId, { tipo, texto }) => {
  const { data, error } = await supabase
    .from("departamento_publicaciones")
    .insert({ departamento_id: departamentoId, tipo, texto })
    .select("*, usuarios(name)")
    .single();
  if (error) {
    console.error("Error publicando en el departamento:", error);
    throw new Error(tipo === "aviso" ? "No se pudo publicar el aviso." : "No se pudo enviar el mensaje.");
  }
  return mapPublicacion(data);
};

export const subscribePublicaciones = (departamentoId, onInsert) => {
  const channel = supabase
    .channel(`departamento-publicaciones-${departamentoId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "departamento_publicaciones", filter: `departamento_id=eq.${departamentoId}` },
      (payload) => onInsert(mapPublicacion(payload.new))
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
};

export const getTareas = async (departamentoId) => {
  const rows = await fetchAll(() =>
    supabase
      .from("departamento_tareas")
      .select("*, departamento_tarea_asignados(usuario_id, completada, completada_en, usuarios(name))")
      .eq("departamento_id", departamentoId)
      .order("created_at", { ascending: false })
  );
  return rows.map(mapTarea);
};

export const crearTarea = async ({ departamentoId, titulo, descripcion, fechaLimite, asignados }) => {
  const { data: tarea, error } = await supabase
    .from("departamento_tareas")
    .insert({ departamento_id: departamentoId, titulo, descripcion: descripcion || null, fecha_limite: fechaLimite || null })
    .select("*")
    .single();
  if (error) {
    console.error("Error creando tarea:", error);
    throw new Error("No se pudo crear la tarea.");
  }
  if (asignados?.length) {
    const filas = asignados.map((usuario_id) => ({ tarea_id: tarea.id, usuario_id }));
    const { error: errorAsignados } = await supabase.from("departamento_tarea_asignados").insert(filas);
    if (errorAsignados) {
      console.error("Error asignando la tarea:", errorAsignados);
      throw new Error("La tarea se creó, pero no se pudo asignar a todos.");
    }
  }
  return tarea.id;
};

export const marcarTareaCompletada = async (tareaId, usuarioId, completada) => {
  const { error } = await supabase
    .from("departamento_tarea_asignados")
    .update({ completada, completada_en: completada ? new Date().toISOString() : null })
    .eq("tarea_id", tareaId)
    .eq("usuario_id", usuarioId);
  if (error) {
    console.error("Error actualizando la tarea:", error);
    throw new Error("No se pudo actualizar la tarea.");
  }
};
