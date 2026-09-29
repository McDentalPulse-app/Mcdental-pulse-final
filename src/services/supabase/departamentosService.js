import { supabase } from "../../config/supabase";
import { fetchAll } from "./fetchAll";

// Nombres y fotos salen de `usuarios_directorio` (mig. 030/164), NO de un join a `usuarios`:
// la RLS de `usuarios` solo deja a un empleado leer SU PROPIA fila, así que el join devolvía
// null para todos los demás. Un miembro raso veía el feed y las tareas sin un solo nombre, y
// un jefe con rol empleado no encontraba a nadie a quién agregar. El directorio es la vista
// sin datos sensibles que existe justo para esto: legible por cualquier autenticado.
const getPersonas = async (ids) => {
  const unicos = [...new Set(ids.filter(Boolean))];
  if (unicos.length === 0) return new Map();
  const rows = await fetchAll(() =>
    supabase.from("usuarios_directorio").select("id, name, puesto, avatar_url").in("id", unicos)
  );
  return new Map(rows.map((r) => [r.id, { nombre: r.name, puesto: r.puesto, avatarUrl: r.avatar_url }]));
};

const mapDepartamento = (row) => ({
  id: row.id,
  nombre: row.nombre,
  descripcion: row.descripcion,
  color: row.color,
  jefeId: row.jefe_id,
  createdAt: row.created_at,
});

const mapMiembro = (row, personas) => ({
  usuarioId: row.usuario_id,
  nombre: personas.get(row.usuario_id)?.nombre,
  puesto: personas.get(row.usuario_id)?.puesto,
  avatarUrl: personas.get(row.usuario_id)?.avatarUrl,
});

const mapPublicacion = (row, personas = new Map()) => ({
  id: row.id,
  departamentoId: row.departamento_id,
  autorId: row.autor_id,
  autor: personas.get(row.autor_id)?.nombre,
  autorAvatarUrl: personas.get(row.autor_id)?.avatarUrl,
  tipo: row.tipo,
  texto: row.texto,
  createdAt: row.created_at,
});

const mapTarea = (row, personas) => ({
  id: row.id,
  departamentoId: row.departamento_id,
  titulo: row.titulo,
  descripcion: row.descripcion,
  fechaLimite: row.fecha_limite,
  creadoPor: row.creado_por,
  createdAt: row.created_at,
  asignados: (row.departamento_tarea_asignados || []).map((a) => ({
    usuarioId: a.usuario_id,
    nombre: personas.get(a.usuario_id)?.nombre,
    avatarUrl: personas.get(a.usuario_id)?.avatarUrl,
    completada: a.completada,
    completadaEn: a.completada_en,
  })),
});

// RLS ya acota esto a los departamentos donde la persona es jefe o miembro (migración 134).
export const getMisDepartamentos = async () => {
  const rows = await fetchAll(() => supabase.from("departamentos").select("*").order("created_at"));
  return rows.map(mapDepartamento);
};

// Lo que las tarjetas de la lista enseñan sin entrar: quién está (para la fila de caras) y
// cuántas tareas siguen abiertas. Dos consultas para todos los departamentos, no dos por
// tarjeta; RLS ya las acota a los departamentos de la persona (migración 134).
export const getResumenDepartamentos = async (usuarioId) => {
  const [miembros, tareas] = await Promise.all([
    fetchAll(() => supabase.from("departamento_miembros").select("departamento_id, usuario_id")),
    fetchAll(() => supabase.from("departamento_tareas").select("id, departamento_id, departamento_tarea_asignados(usuario_id, completada)")),
  ]);
  const personas = await getPersonas(miembros.map((m) => m.usuario_id));
  const resumen = {};
  const de = (id) => (resumen[id] ||= { miembros: [], tareasAbiertas: 0, misPendientes: 0 });
  for (const m of miembros) {
    const p = personas.get(m.usuario_id);
    de(m.departamento_id).miembros.push({ usuarioId: m.usuario_id, nombre: p?.nombre, avatarUrl: p?.avatarUrl });
  }
  for (const t of tareas) {
    const asignados = t.departamento_tarea_asignados || [];
    if (asignados.some((a) => !a.completada)) de(t.departamento_id).tareasAbiertas += 1;
    if (asignados.some((a) => a.usuario_id === usuarioId && !a.completada)) de(t.departamento_id).misPendientes += 1;
  }
  return resumen;
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
      .select("usuario_id")
      .eq("departamento_id", departamentoId)
  );
  const personas = await getPersonas(rows.map((r) => r.usuario_id));
  return rows.map((r) => mapMiembro(r, personas));
};

// Activos que todavía NO están en este departamento — para el selector del jefe al
// agregar gente. Cruza toda la empresa (un departamento no es cosa de un solo rol).
//
// La lista sale del directorio porque el jefe puede tener rol empleado (el permiso es
// puede_crear_departamento, no el rol). `oculto` no viaja en el directorio: se filtra con lo
// que la RLS de `usuarios` deja ver — todo para admin/RH/psicóloga, solo la propia fila para
// los demás. Es el mismo alcance que ya tenía: `oculto` es un filtro de pantalla (mig. 170).
export const getUsuariosParaAgregar = async (departamentoId) => {
  const [directorio, visibles, miembros] = await Promise.all([
    fetchAll(() => supabase.from("usuarios_directorio").select("id, name, puesto, avatar_url").eq("inactivo", false).order("name")),
    fetchAll(() => supabase.from("usuarios").select("id, oculto").eq("oculto", true)),
    fetchAll(() => supabase.from("departamento_miembros").select("usuario_id").eq("departamento_id", departamentoId)),
  ]);
  const fuera = new Set([...miembros.map((m) => m.usuario_id), ...visibles.map((u) => u.id)]);
  return directorio.filter((u) => !fuera.has(u.id)).map((u) => ({ id: u.id, nombre: u.name, puesto: u.puesto, avatarUrl: u.avatar_url }));
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
      .select("*")
      .eq("departamento_id", departamentoId)
      .order("created_at", { ascending: false })
  );
  const personas = await getPersonas(rows.map((r) => r.autor_id));
  return rows.map((r) => mapPublicacion(r, personas));
};

export const publicar = async (departamentoId, { tipo, texto }) => {
  const { data, error } = await supabase
    .from("departamento_publicaciones")
    .insert({ departamento_id: departamentoId, tipo, texto })
    .select("*")
    .single();
  if (error) {
    console.error("Error publicando en el departamento:", error);
    throw new Error(tipo === "aviso" ? "No se pudo publicar el aviso." : "No se pudo enviar el mensaje.");
  }
  return mapPublicacion(data, await getPersonas([data.autor_id]));
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
      .select("*, departamento_tarea_asignados(usuario_id, completada, completada_en)")
      .eq("departamento_id", departamentoId)
      .order("created_at", { ascending: false })
  );
  const personas = await getPersonas(rows.flatMap((r) => (r.departamento_tarea_asignados || []).map((a) => a.usuario_id)));
  return rows.map((r) => mapTarea(r, personas));
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
