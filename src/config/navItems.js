// Ítems de navegación por rol, organizados en categorías. En el header, cada categoría es un menú
// desplegable con sus páginas; un ítem SIN `group` se pinta como enlace directo en la barra.
// "Cuenta" (perfil) va al menú del usuario, no a la barra.
//
// `mensajes` va sin grupo en los CINCO roles a propósito (2026-07-29): es lo que más se abre y
// estaba enterrado dentro de "Herramientas". Ojo: en la barra los enlaces directos desaparecen
// por debajo de 1100 px, así que sacarlo del menú no basta para que se vea en el celular — el
// botón permanente del header (HeaderNav, junto a la campana) es lo que lo cumple de verdad.
export const NAV_ITEMS = {
  admin: [
    { key: "dashboard", icon: "dashboard", label: "Dashboard" },
    { key: "empleados", icon: "users", label: "Empleados", group: "Equipo" },
    { key: "usuarios", icon: "userCog", label: "Gestión de Personal", group: "Equipo" },
    { key: "expedientes", icon: "folder", label: "Expedientes", group: "Equipo" },
    { key: "reconocimientos", icon: "award", label: "Reconocimientos", group: "Equipo" },
    { key: "eventospersonal", icon: "cake", label: "Cumpleaños y Aniversarios", group: "Equipo" },
    { key: "asistencia", icon: "clock", label: "Asistencia", group: "Asistencia y rostros" },
    { key: "sucursales", icon: "mapPin", label: "Sucursales", group: "Asistencia y rostros" },
    { key: "horarios", icon: "calendarDays", label: "Horarios", group: "Asistencia y rostros" },
    { key: "rostros", icon: "camera", label: "Rostros", group: "Asistencia y rostros" },
    { key: "intercambios", icon: "calendarDays", label: "Intercambios de día", group: "Asistencia y rostros" },
    { key: "encuestas", icon: "clipboard", label: "Encuestas", group: "Encuestas y reportes" },
    { key: "reportes", icon: "trending", label: "Reportes", group: "Encuestas y reportes" },
    { key: "confidenciales", icon: "lock", label: "Reportes Confidenciales", group: "Encuestas y reportes" },
    { key: "ai", icon: "ai", label: "AI Engine", group: "Herramientas" },
    { key: "config", icon: "settings", label: "Config", group: "Herramientas" },
    { key: "avisos", icon: "bell", label: "Avisos", group: "Herramientas" },
    { key: "mensajes", icon: "message", label: "Mensajes" },
    { key: "soporte", icon: "lightbulb", label: "Ideas de mejora", group: "Herramientas" },
    { key: "perfil", icon: "user", label: "Mi perfil", group: "Cuenta" },
  ],
  psicologa: [
    { key: "dashboard", icon: "dashboard", label: "Dashboard" },
    { key: "seguimiento", icon: "target", label: "Seguimiento", group: "Seguimiento" },
    { key: "confidenciales", icon: "lock", label: "Reportes Confidenciales", group: "Seguimiento" },
    { key: "vacaciones", icon: "vacation", label: "Vacaciones", group: "Vacaciones y permisos" },
    { key: "permisos", icon: "clipboardCheck", label: "Permisos", group: "Vacaciones y permisos" },
    { key: "mispermisos", icon: "vacation", label: "Mis vacaciones/permisos", group: "Vacaciones y permisos" },
    { key: "intercambios", icon: "calendarDays", label: "Intercambios de día", group: "Vacaciones y permisos" },
    { key: "comisiones", icon: "dollar", label: "Comisiones", group: "Vacaciones y permisos" },
    { key: "empleados", icon: "users", label: "Empleados", group: "Equipo" },
    { key: "usuarios", icon: "userCog", label: "Gestión de Personal", group: "Equipo" },
    { key: "expedientes", icon: "folder", label: "Expedientes", group: "Equipo" },
    { key: "reconocimientos", icon: "award", label: "Reconocimientos", group: "Equipo" },
    { key: "eventospersonal", icon: "cake", label: "Cumpleaños y Aniversarios", group: "Equipo" },
    { key: "checador", icon: "clock", label: "Checador", group: "Asistencia y rostros" },
    { key: "asistencia", icon: "clock", label: "Asistencia", group: "Asistencia y rostros" },
    { key: "sucursales", icon: "mapPin", label: "Sucursales", group: "Asistencia y rostros" },
    { key: "horarios", icon: "calendarDays", label: "Horarios", group: "Asistencia y rostros" },
    { key: "importar-horarios", icon: "file", label: "Importar horarios", group: "Asistencia y rostros" },
    { key: "calibracion", icon: "shield", label: "Calibración del cotejo", group: "Asistencia y rostros" },
    { key: "rostros", icon: "camera", label: "Rostros", group: "Asistencia y rostros" },
    { key: "encuestas", icon: "clipboard", label: "Encuestas", group: "Encuestas y reportes" },
    { key: "reportes", icon: "trending", label: "Reportes", group: "Encuestas y reportes" },
    { key: "ai", icon: "ai", label: "AI Engine", group: "Herramientas" },
    { key: "config", icon: "settings", label: "Config", group: "Herramientas" },
    { key: "mensajes", icon: "message", label: "Mensajes" },
    { key: "avisos", icon: "bell", label: "Avisos", group: "Herramientas" },
    { key: "soporte", icon: "lightbulb", label: "Ideas de mejora", group: "Herramientas" },
    // Clave distinta de "soporte" a propósito: en gestión esa clave ya está tomada por
    // Ideas de mejora, y la plantilla la usa para Soporte TI. Son dos módulos distintos
    // que conviven, no uno que sustituye al otro.
    { key: "soporteti", icon: "wrench", label: "Soporte TI", group: "Herramientas" },
    { key: "perfil", icon: "user", label: "Mi perfil", group: "Cuenta" },
  ],
  rh: [
    { key: "dashboard", icon: "dashboard", label: "Dashboard RH" },
    { key: "usuarios", icon: "userCog", label: "Gestión de Personal", group: "Personal" },
    { key: "empleados", icon: "users", label: "Empleados", group: "Personal" },
    { key: "expedientes", icon: "folder", label: "Expedientes", group: "Personal" },
    { key: "reconocimientos", icon: "award", label: "Reconocimientos", group: "Personal" },
    { key: "eventospersonal", icon: "cake", label: "Cumpleaños y Aniversarios", group: "Personal" },
    { key: "bolsa", icon: "briefcase", label: "Bolsa de trabajo", group: "Personal" },
    { key: "vacaciones", icon: "vacation", label: "Vacaciones", group: "Vacaciones y permisos" },
    { key: "permisos", icon: "clipboardCheck", label: "Permisos", group: "Vacaciones y permisos" },
    { key: "mispermisos", icon: "vacation", label: "Mis vacaciones/permisos", group: "Vacaciones y permisos" },
    { key: "descuentos", icon: "dollar", label: "Descuentos", group: "RH" },
    { key: "comisiones", icon: "dollar", label: "Comisiones", group: "RH" },
    { key: "calendario", icon: "calendar", label: "Calendario", group: "RH" },
    { key: "intercambios", icon: "calendarDays", label: "Intercambios de día", group: "RH" },
    { key: "reportesrh", icon: "trending", label: "Reportes RH", group: "RH" },
    { key: "checador", icon: "clock", label: "Checador", group: "Asistencia y rostros" },
    { key: "asistencia", icon: "clock", label: "Asistencia", group: "Asistencia y rostros" },
    { key: "horarios", icon: "calendarDays", label: "Horarios", group: "Asistencia y rostros" },
    { key: "calibracion", icon: "shield", label: "Calibración del cotejo", group: "Asistencia y rostros" },
    { key: "rostros", icon: "camera", label: "Rostros", group: "Asistencia y rostros" },
    { key: "sucursales", icon: "mapPin", label: "Sucursales", group: "Asistencia y rostros" },
    { key: "encuestas", icon: "clipboard", label: "Encuestas", group: "Encuestas y reportes" },
    { key: "reportes", icon: "trending", label: "Reportes", group: "Encuestas y reportes" },
    { key: "ai", icon: "ai", label: "AI Engine", group: "Herramientas" },
    { key: "config", icon: "settings", label: "Config", group: "Herramientas" },
    { key: "avisos", icon: "bell", label: "Avisos", group: "Herramientas" },
    { key: "mensajes", icon: "message", label: "Mensajes" },
    { key: "soporte", icon: "lightbulb", label: "Ideas de mejora", group: "Herramientas" },
    { key: "soporteti", icon: "wrench", label: "Soporte TI", group: "Herramientas" },
    { key: "perfil", icon: "user", label: "Mi perfil", group: "Cuenta" },
  ],
  // Empleado y doctor: hasta el 2026-07-29 tenían TODO en dos menús — "Mi trabajo" con 9 ítems
  // y "Herramientas" con 3 — y encontrar algo era leerse la lista entera. Ahora se agrupa por
  // CUÁNDO se usa cada cosa, no por qué tipo de cosa es, y ningún grupo pasa de 3 ítems.
  empleado: [
    { key: "inicio", icon: "home", label: "Inicio" },
    { key: "mensajes", icon: "message", label: "Mensajes" },
    // "Mi rostro" vive en Asistencia porque solo existe para que el checador te reconozca.
    { key: "checador", icon: "clock", label: "Checador", group: "Asistencia" },
    { key: "historial", icon: "history", label: "Historial", group: "Asistencia" },
    { key: "rostro", icon: "camera", label: "Mi rostro", group: "Asistencia" },
    // Solo para quien tenga el permiso (recepción). Ver `requiere` y navItemsPara() abajo.
    { key: "miclinica", icon: "mapPin", label: "Ubicación de mi clínica", group: "Asistencia", requiere: "puedeUbicarSucursal" },
    { key: "permisosempleado", icon: "vacation", label: "Vacaciones", group: "Tiempo libre" },
    { key: "calendario", icon: "calendar", label: "Calendario", group: "Tiempo libre" },
    { key: "encuesta", icon: "clipboardCheck", label: "Mi Encuesta", group: "Bienestar" },
    { key: "reconocimientos", icon: "award", label: "Reconocimientos", group: "Bienestar" },
    { key: "reporteconfidencial", icon: "lock", label: "Reporte Confidencial", group: "Bienestar" },
    { key: "avisos", icon: "bell", label: "Avisos", group: "Ayuda" },
    { key: "soporte", icon: "wrench", label: "Soporte TI", group: "Ayuda" },
    { key: "perfil", icon: "user", label: "Mi perfil", group: "Cuenta" },
  ],
  doctor: [
    { key: "inicio", icon: "home", label: "Inicio" },
    { key: "mensajes", icon: "message", label: "Mensajes" },
    // Comisiones va suelto y no dentro de un grupo: es lo que un doctor abre a diario, y
    // enterrarlo a dos clics es justo lo contrario de lo que se buscaba al reordenar esto.
    { key: "comisiones", icon: "dollar", label: "Comisiones" },
    { key: "checador", icon: "clock", label: "Checador", group: "Asistencia" },
    { key: "historial", icon: "history", label: "Historial", group: "Asistencia" },
    { key: "rostro", icon: "camera", label: "Mi rostro", group: "Asistencia" },
    // También aquí: en una clínica sin recepcionista, quien fija la ubicación es la doctora.
    // El `requiere` lo mantiene oculto para el resto (el permiso se da persona a persona).
    { key: "miclinica", icon: "mapPin", label: "Ubicación de mi clínica", group: "Asistencia", requiere: "puedeUbicarSucursal" },
    { key: "permisosempleado", icon: "vacation", label: "Vacaciones", group: "Tiempo libre" },
    { key: "calendario", icon: "calendar", label: "Calendario", group: "Tiempo libre" },
    { key: "encuesta", icon: "clipboardCheck", label: "Mi Encuesta", group: "Bienestar" },
    { key: "reconocimientos", icon: "award", label: "Reconocimientos", group: "Bienestar" },
    { key: "reporteconfidencial", icon: "lock", label: "Reporte Confidencial", group: "Bienestar" },
    { key: "avisos", icon: "bell", label: "Avisos", group: "Ayuda" },
    { key: "soporte", icon: "wrench", label: "Soporte TI", group: "Ayuda" },
    { key: "perfil", icon: "user", label: "Mi perfil", group: "Cuenta" },
  ],
};

/**
 * Los ítems que ESTA persona debe ver.
 *
 * Hasta ahora el menú dependía solo del rol, y con eso bastaba. "Ubicación de mi clínica" rompe
 * esa regla: es para recepción, que son rol `empleado` igual que todos los demás — el mismo caso
 * que `soporte_ti`. En vez de partir el rol en dos, el ítem declara de qué campo del usuario
 * depende (`requiere`) y esto lo filtra.
 *
 * Va aquí y no en cada pantalla porque NAV_ITEMS se lee desde cuatro sitios (header, sidebar,
 * buscador y botón de mensajes): repetir el filtro cuatro veces es garantizar que algún día uno
 * se quede sin él y el ítem se cuele donde no toca.
 */
/**
 * Una línea que dice QUÉ SE HACE en cada página, para el menú desplegable.
 *
 * Van por CLAVE y no repetidas dentro de cada rol: la mayoría de las páginas aparecen en tres o
 * cuatro menús, y escribir la frase cuatro veces es garantizar que dentro de un mes digan cosas
 * distintas. Se redactan en segunda persona y en presente («Revisa…», «Aprueba…»): el menú se lee
 * para decidir a dónde ir, así que lo útil es el verbo, no una definición.
 */
const DESCRIPCIONES = {
  dashboard: "Bienestar de toda la organización, semana a semana.",
  inicio: "Tu resumen: pendientes, avisos y accesos rápidos.",
  mensajes: "Conversaciones con el equipo y con Soporte TI.",

  // Equipo / Personal
  empleados: "Ficha rápida de cada persona y su Pulse Score.",
  usuarios: "Alta, baja y permisos de las cuentas.",
  expedientes: "El historial completo de una persona en un solo sitio.",
  reconocimientos: "Reconoce a alguien del equipo y consulta los ya dados.",
  eventospersonal: "Quién cumple años y quién cumple otro año en la empresa.",
  bolsa: "Vacantes abiertas y candidatos en proceso.",

  // Asistencia
  checador: "Registra tu entrada y tu salida con la cámara.",
  asistencia: "Entradas, salidas, retardos y faltas del periodo.",
  historial: "Tus propias checadas y las horas que llevas.",
  horarios: "El turno de cada persona, día por día.",
  "importar-horarios": "Carga los turnos de muchas personas desde un archivo.",
  sucursales: "Clínicas, su ubicación y su zona horaria.",
  rostros: "Las caras registradas que usa el checador para reconocer.",
  rostro: "Registra o actualiza tu cara para poder checar.",
  miclinica: "Fija dónde está tu clínica para que el checador valide la ubicación.",
  calibracion: "Qué tan exigente es el cotejo de caras, con datos reales.",

  // Tiempo libre
  vacaciones: "Aprueba o rechaza las solicitudes de vacaciones.",
  permisos: "Aprueba o rechaza los permisos del equipo.",
  mispermisos: "Tus solicitudes y en qué estado están.",
  permisosempleado: "Pide vacaciones o un permiso y sigue tu solicitud.",
  calendario: "Festivos, eventos y quién está fuera cada día.",
  intercambios: "Cambios de día entre compañeros pendientes de resolver.",

  // Bienestar
  encuesta: "Contesta la encuesta de la semana. Es confidencial.",
  encuestas: "Las preguntas que se hacen y los bloques que rotan.",
  seguimiento: "Casos que necesitan atención y tus notas de cada uno.",
  reportes: "Tendencias de bienestar por sucursal y por periodo.",
  reportesrh: "Asistencia, permisos y descuentos en números.",
  confidenciales: "Reportes que solo puede leer quien está autorizado.",
  reporteconfidencial: "Cuenta algo delicado. Solo lo lee la psicóloga.",

  // Dinero
  descuentos: "Descuentos aplicados a nómina y su motivo.",
  comisiones: "Lo que llevas ganado y el detalle de cada tratamiento.",

  // Herramientas
  ai: "Preguntale a la IA sobre el bienestar del equipo.",
  config: "Umbrales, avisos y ajustes del sistema.",
  avisos: "Comunicados para toda la empresa o para una sucursal.",
  soporte: "Propón una mejora para la aplicación.",
  soporteti: "Reporta un problema técnico al equipo de sistemas.",
  perfil: "Tu foto, tu color y tu contraseña.",
};

/**
 * La clave `soporte` significa DOS páginas distintas según el rol: "Ideas de mejora" en gestión y
 * "Soporte TI" en plantilla (ver el comentario de arriba, donde se explica por qué conviven).
 * Una descripción por clave se equivocaría en la mitad de los casos.
 */
const DESCRIPCIONES_POR_ROL = {
  empleado: { soporte: "Reporta un problema técnico al equipo de sistemas." },
  doctor: { soporte: "Reporta un problema técnico al equipo de sistemas." },
};

/** La descripción de una página, o cadena vacía si todavía no se ha escrito. */
export const descripcionDe = (key, role) =>
  DESCRIPCIONES_POR_ROL[role]?.[key] ?? DESCRIPCIONES[key] ?? "";

export const navItemsPara = (user) =>
  (NAV_ITEMS[user?.role] || [])
    .filter((i) => !i.requiere || !!user?.[i.requiere])
    // La descripción se pega aquí y no se escribe en cada ítem: NAV_ITEMS repite las mismas
    // páginas en cinco roles, y el menú se lee desde cuatro sitios.
    .map((i) => ({ ...i, desc: descripcionDe(i.key, user?.role) }));

/**
 * Los 4 ítems que van en la barra inferior del teléfono; el resto cae en la hoja "Más".
 *
 * Se declara APARTE del orden de NAV_ITEMS porque las dos cosas responden a preguntas distintas:
 * NAV_ITEMS ordena y agrupa un menú que se lee, y esto elige los cuatro accesos que se usan sin
 * mirar. Antes esta información era "los 4 primeros del arreglo", y estaba en una copia entera de
 * los menús escrita a mano dentro de Sidebar.jsx: por eso el 2026-07-29 los grupos nuevos y
 * Mensajes llegaron al escritorio y NO al teléfono. Con una sola fuente, eso no puede repetirse.
 *
 * `mensajes` no está en ninguna: en el teléfono es el botón flotante junto a la campana, y en
 * escritorio el botón del header. Está siempre a la vista, así que no gasta un hueco aquí.
 */
export const TABS_MOVIL = {
  admin: ["dashboard", "ai", "empleados", "usuarios"],
  psicologa: ["dashboard", "checador", "ai", "seguimiento"],
  rh: ["dashboard", "checador", "usuarios", "empleados"],
  // El checador va en la posición 2 a propósito: es lo único de la lista que se usa todos los
  // días, dos veces.
  empleado: ["inicio", "checador", "encuesta", "historial"],
  doctor: ["inicio", "checador", "comisiones", "encuesta"],
};

// Icono de cada categoría, para el desplegable del header. Vive aquí y no en cada ítem porque
// el grupo es solo una cadena repetida en los ítems: sin este mapa, la barra tendría que
// adivinar un icono a partir del texto.
export const GROUP_ICONS = {
  "Equipo": "users",
  "Personal": "users",
  "Asistencia": "clock",
  "Tiempo libre": "vacation",
  "Bienestar": "heart",
  "Ayuda": "wrench",
  "RH": "briefcase",
  "Seguimiento": "target",
  "Vacaciones y permisos": "vacation",
  "Asistencia y rostros": "clock",
  "Encuestas y reportes": "clipboard",
  "Herramientas": "wrench",
  "Cuenta": "user",
};

// Agrupa una lista de ítems por su campo `group`, preservando el orden de aparición del grupo.
export const agruparPorCampo = (lista) => {
  const grupos = [];
  const indice = new Map();
  for (const item of lista) {
    const g = item.group || null;
    if (!indice.has(g)) { indice.set(g, grupos.length); grupos.push({ nombre: g, items: [] }); }
    grupos[indice.get(g)].items.push(item);
  }
  return grupos;
};
