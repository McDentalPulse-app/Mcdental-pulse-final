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
    archivado: row.archivado,
    debeCambiarPassword: row.debe_cambiar_password,
    avatarUrl: row.avatar_url,
    bannerUrl: row.banner_url,
    // Fija la geocerca de su clínica (recepción, mig. 103). Faltaba en este mapa — hallazgo
    // de la revisión del panel de Módulos: sin esto, "Ubicación de mi clínica" se veía
    // siempre apagado ahí aunque estuviera prendido en la base.
    puedeUbicarSucursal: !!row.puede_ubicar_sucursal,
    // Inventario por clínica (mig. 120): ver el checkbox gemelo en GestionUsuarios.jsx.
    puedeGestionarBodega: !!row.puede_gestionar_bodega,
    puedeGestionarInventario: !!row.puede_gestionar_inventario,
    // Departamentos (mig. 133): puede crear uno propio y liderarlo.
    puedeCrearDepartamento: !!row.puede_crear_departamento,
    // Permiso de fichar en cualquier clínica (mig. 118). Ausente en el directorio sin PII,
    // donde queda undefined como el resto de campos que ahí no viajan.
    puedeMarcarEnCualquierClinica: !!row.puede_marcar_en_cualquier_clinica,
    // Permiso de marcar SALIDA sin geocerca (mig. 127). Independiente del de arriba.
    puedeMarcarSalidaSinGeocerca: !!row.puede_marcar_salida_sin_geocerca,
    // Entrada libre (mig. 135): sin geocerca ni retardo, pero solo cuando la persona
    // prende el interruptor en su Checador — el permiso no basta por sí solo.
    puedeMarcarEntradaLibre: !!row.puede_marcar_entrada_libre,
    // Módulos apagables por persona (mig. 141), gestionados desde ModulosPanel.jsx
    // (Admin+). Default true en la base: nadie pierde acceso al desplegar esto.
    puedeVerComisiones: row.puede_ver_comisiones !== false,
    puedeUsarChecador: row.puede_usar_checador !== false,
    puedeUsarNotas: row.puede_usar_notas !== false,
    puedeVerDepartamentos: row.puede_ver_departamentos !== false,
    puedeVerAvisos: row.puede_ver_avisos !== false,
    puedeVerEncuestas: row.puede_ver_encuestas !== false,
  };

// Fila completa, con PII (teléfono, email, fechas). El RLS de la migración 030 solo
// la deja leer a admin/rh/psicologa; a cualquier otro rol le devolvería únicamente su
// propia fila, así que los demás deben usar getUsuariosDirectorio().
export const getUsuarios = async () => {
  try {
    const rows = await fetchAll(() => supabase.from("usuarios").select("*"));
    return rows.map(mapUsuario);
  } catch (error) {
    console.error("Error al obtener usuarios:", error);
    throw new Error("No se pudieron cargar los usuarios.", { cause: error });
  }
};

// Directorio sin PII (migración 030): id, nombre, rol, sucursal, puesto, avatar e
// inactivo. Es lo único que un empleado necesita de sus compañeros — pintar a la
// psicóloga en Mensajes y poco más. Los campos ausentes quedan undefined en
// mapUsuario, igual que hoy quedan los nulos.
export const getUsuariosDirectorio = async () => {
  try {
    const rows = await fetchAll(() => supabase.from("usuarios_directorio").select("*"));
    return rows.map(mapUsuario);
  } catch (error) {
    console.error("Error al obtener el directorio de usuarios:", error);
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
  if (updates.archivado !== undefined) payload.archivado = updates.archivado;
  if (updates.puedeUbicarSucursal !== undefined) payload.puede_ubicar_sucursal = !!updates.puedeUbicarSucursal;
  if (updates.puedeGestionarBodega !== undefined) payload.puede_gestionar_bodega = updates.puedeGestionarBodega;
  if (updates.puedeGestionarInventario !== undefined) payload.puede_gestionar_inventario = updates.puedeGestionarInventario;
  if (updates.puedeCrearDepartamento !== undefined) payload.puede_crear_departamento = updates.puedeCrearDepartamento;
  if (updates.puedeMarcarEnCualquierClinica !== undefined) {
    payload.puede_marcar_en_cualquier_clinica = !!updates.puedeMarcarEnCualquierClinica;
  }
  if (updates.puedeMarcarSalidaSinGeocerca !== undefined) {
    payload.puede_marcar_salida_sin_geocerca = !!updates.puedeMarcarSalidaSinGeocerca;
  }
  if (updates.puedeMarcarEntradaLibre !== undefined) {
    payload.puede_marcar_entrada_libre = !!updates.puedeMarcarEntradaLibre;
  }
  if (updates.puedeVerComisiones !== undefined) payload.puede_ver_comisiones = !!updates.puedeVerComisiones;
  if (updates.puedeUsarChecador !== undefined) payload.puede_usar_checador = !!updates.puedeUsarChecador;
  if (updates.puedeUsarNotas !== undefined) payload.puede_usar_notas = !!updates.puedeUsarNotas;
  if (updates.puedeVerDepartamentos !== undefined) payload.puede_ver_departamentos = !!updates.puedeVerDepartamentos;
  if (updates.puedeVerAvisos !== undefined) payload.puede_ver_avisos = !!updates.puedeVerAvisos;
  if (updates.puedeVerEncuestas !== undefined) payload.puede_ver_encuestas = !!updates.puedeVerEncuestas;

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

/**
 * Qué se va a perder si se borra a esta persona. Se le enseña al admin ANTES de confirmar, con
 * números reales: "412 checadas, 38 encuestas" pesa distinto que un "¿seguro?" a secas.
 *
 * Cuenta con `head: true` (solo el contador, sin traer filas) y en paralelo. Son las seis tablas
 * que un humano reconoce; las otras 17 que cascadean son técnicas (dispositivos, suscripciones
 * push, intentos de cotejo…) y enumerarlas solo taparía las que importan.
 *
 * Las tres tablas sensibles son legibles por admin (notas_psicologicas y archivos_expediente por
 * `..._gestion`), así que estos números no mienten por RLS. Si alguna consulta falla, se devuelve
 * null en vez de un cero: mejor decir "no se pudo calcular" que jurar que no había nada.
 */
export const contarHistorialUsuario = async (usuarioId) => {
  const contar = async (tabla, columna = "empleado_id") => {
    const { count, error } = await supabase
      .from(tabla)
      .select("id", { count: "exact", head: true })
      .eq(columna, usuarioId);
    if (error) throw error;
    return count || 0;
  };

  try {
    const [checadas, encuestas, notas, archivos, comisiones, reconocimientos] = await Promise.all([
      contar("asistencias"),
      contar("encuestas"),
      contar("notas_psicologicas"),
      contar("archivos_expediente"),
      contar("comisiones", "doctor_id"), // esta cuelga del doctor, no de `empleado_id`

      contar("reconocimientos"),
    ]);
    return { checadas, encuestas, notas, archivos, comisiones, reconocimientos };
  } catch (error) {
    console.error("No se pudo contar el historial del usuario:", error);
    return null;
  }
};

// Baja definitiva. La baja NORMAL de personal sigue siendo `archivado` (reversible, migración
// 083); esto es el escalón de después, para limpiar cuentas de prueba y bajas que ya no deben
// existir. Desde el 2026-08-07 hay un botón que llama aquí: la papelera que solo ve el ADMIN
// sobre una fila archivada (useBajaUsuario.eliminarDefinitivo).
//
// Pasa por la Edge Function admin-delete-usuario, que vuelve a comprobar que quien llama es
// admin — esconder el botón no impide llamar a la función. Borra auth.users, que en cascada se
// lleva la fila de usuarios y TODO lo que cuelga de ella (asistencias, encuestas, rostros,
// permisos, vacaciones...) — irreversible. El llamador ya tiene que haberle enseñado al admin
// los números de lo que se pierde y haberle hecho teclear el nombre antes de llegar acá.
export const eliminarUsuario = async (usuarioId) => {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error("Sesión no válida. Vuelve a iniciar sesión.");

  const { error } = await supabase.functions.invoke("admin-delete-usuario", {
    body: { usuarioId },
    headers: { Authorization: `Bearer ${token}` },
  });
  if (error) {
    const detalle = await error?.context?.json?.().catch(() => null);
    throw new Error(detalle?.error || error.message || "No se pudo eliminar el usuario.");
  }
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

/**
 * Banco de bloques rotatorios. Qué bloque toca cada quincena NO se guarda: se deriva de la
 * semana en bloqueDeLaSemana() (utils/encuestaBloques.js), así que aquí solo se lee el banco.
 *
 * Se traen también los inactivos: el detalle histórico necesita el nombre de un bloque que
 * quizá ya se apagó, o las respuestas viejas aparecerían sin contexto.
 */
export const getEncuestaBloques = async () => {
  const { data, error } = await supabase
    .from("encuesta_bloques")
    .select("*")
    .order("orden", { ascending: true });

  if (error) {
    console.error("Error al obtener los bloques de encuesta:", error);
    throw new Error("No se pudieron cargar los bloques de la encuesta.");
  }

  return data.map((row) => ({
    id: row.id,
    nombre: row.nombre,
    descripcion: row.descripcion,
    orden: row.orden,
    activo: row.activo,
  }));
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
    // null = pregunta del núcleo (cuenta para el Pulse Score).
    bloqueId: row.bloque_id ?? null,
  }));
};
