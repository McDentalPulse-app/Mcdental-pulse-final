/**
 * De una lista plana de mensajes a la lista de conversaciones que ve UNA persona.
 *
 * Vive fuera del componente porque es la parte que decide quién ve qué hilo, y eso hay que
 * poder probarlo sin montar una pantalla de 600 líneas. Ojo con el alcance de lo que garantiza:
 * la confidencialidad REAL la impone la RLS (`mensajes_select_participant`), que no entrega un
 * mensaje a quien no lo escribió, no lo recibió ni atiende su buzón. Un error acá no filtra
 * nada — agrupa mal lo que esa persona ya tenía derecho a leer.
 *
 * Tres tipos de conversación:
 *  - canal 'psicologa': 1 a 1 confidencial.
 *  - un BUZÓN visto por quien REPORTA: el interlocutor no es una persona, va `para: null`.
 *  - un hilo de BUZÓN visto por quien lo ATIENDE: el interlocutor es quien reportó.
 */

// Interlocutor de cada buzón visto por quien reporta. El id no existe en la base a propósito:
// nunca se usa como destinatario, solo para saber qué conversación está abierta.
//
// OJO al agregar un buzón: `icono` TIENE que existir en el ICON_MAP de components/ui/Icon.jsx.
// Un nombre que no está ahí no rompe nada ruidosamente — Icon devuelve null y el avatar del
// chat sale como un círculo VACÍO, sin ícono y sin iniciales. Se ve como un error de carga.
export const BUZONES = {
  soporte: {
    id: "canal-soporte-ti",
    name: "Soporte Sistemas",
    puesto: "Sistemas",
    sucursal: "McDental",
    icono: "wrench",
  },
  mantenimiento: {
    id: "canal-mantenimiento",
    name: "Soporte Mantenimiento",
    puesto: "Mantenimiento",
    sucursal: "McDental",
    icono: "building",
  },
};

export const CANALES_BUZON = Object.keys(BUZONES);
export const esMensajeDeBuzon = (m) => CANALES_BUZON.includes(m.canal);

const ROLES_MANTENIMIENTO = ["admin", "admin_plus", "rh", "psicologa"];
const ROLES_SIN_CANAL_PSICOLOGA = ["admin", "admin_plus", "rh"];

/**
 * Quién atiende cada buzón. Sistemas se distingue por una bandera por persona: los dos
 * encargados son rol `empleado` (mig. 094). Mantenimiento es al revés — quienes lo atienden ya
 * SON esos roles (mig. 155), así que no hace falta bandera.
 */
export const quienAtiende = (user) => ({
  soporte: !!user?.soporteTi,
  mantenimiento: ROLES_MANTENIMIENTO.includes(user?.role),
});

const porTiempo = (a, b) => String(a.fecha || "").localeCompare(String(b.fecha || ""));

const armarConversacion = ({ usuario, canal, para, atendido = false, mensajes, userId }) => {
  const orden = [...mensajes].sort(porTiempo);
  return {
    usuario, canal, para, atendido,
    mensajes: orden,
    ultimo: orden[orden.length - 1],
    // "No leído" = no lo escribí yo y viene dirigido a mí o al buzón compartido (`para` nulo).
    // La segunda mitad es la que hace que el buzón cuente lo que nadie ha atendido todavía.
    noLeidos: orden.filter((m) => !m.leido && m.de !== userId && (m.para === userId || !m.para)).length,
  };
};

export const construirConversaciones = ({ mensajes = [], user, psicologa, empleados = [], getUserById }) => {
  const userId = user?.id;
  const atiende = quienAtiende(user);
  const sinCanalPsicologa = ROLES_SIN_CANAL_PSICOLOGA.includes(user?.role);

  // A qué buzones puede REPORTAR esta persona. Incluye los que ella misma atiende: un admin
  // también necesita avisar que se rompió algo de su oficina, y el plan lo pedía explícito
  // (§1-3, §4.1d, §5.2).
  //
  // La primera versión excluía los que atendía y su hilo propio solo aparecía "cuando ya había
  // escrito" — circular: sin hilo no hay dónde escribir el primero, así que los 4 roles que
  // atienden Mantenimiento se quedaban sin poder reportar nada. Lo cazó la revisión adversarial.
  //
  // Única excepción: la psicóloga NO tiene conversación propia hacia Sistemas. Hoy no la tiene y
  // el dueño pidió dejarlo así (§10.1-P3).
  const buzonesQueReporta = CANALES_BUZON.filter(
    (canal) => !(canal === "soporte" && user?.role === "psicologa"),
  );

  // El canal de la psicóloga excluye explícitamente lo de los buzones: si no, esos hilos
  // aparecerían mezclados en la conversación privada, que es el peor sitio donde podría pasar.
  const conversacionCon = (otro) =>
    armarConversacion({
      usuario: otro,
      canal: "psicologa",
      para: otro.id,
      atendido: user?.role === "psicologa",
      userId,
      mensajes: mensajes.filter(
        (m) => !esMensajeDeBuzon(m) &&
          ((m.de === userId && m.para === otro.id) || (m.de === otro.id && m.para === userId)),
      ),
    });

  // VISTA DE QUIEN ATIENDE: un hilo por persona que haya escrito al buzón. La persona del hilo es
  // quien NO atiende: en el mensaje que entra no hay destinatario (`para` nulo) y lo escribió
  // ella; en la respuesta el destinatario es ella.
  //
  // Se salta el hilo de UNO MISMO: lo propio ya sale en `miHiloHaciaBuzon`, que está siempre
  // presente. Sin esta exclusión, quien atiende y además reportó vería su conversación dos veces.
  const hilosDeBuzon = (canal) => {
    const porPersona = new Map();
    for (const m of mensajes.filter((x) => x.canal === canal)) {
      const personaId = m.para || m.de;
      if (personaId === userId) continue;
      if (!porPersona.has(personaId)) porPersona.set(personaId, []);
      porPersona.get(personaId).push(m);
    }
    return [...porPersona.entries()].map(([personaId, lista]) =>
      armarConversacion({
        usuario: getUserById?.(personaId) || { id: personaId, name: "Empleado" },
        canal,
        para: personaId,
        atendido: true,
        userId,
        mensajes: lista,
      }),
    );
  };

  // VISTA DE QUIEN REPORTA: su propio hilo hacia el buzón. Se filtra por "míos" y no por canal a
  // secas porque quien atiende OTRO buzón sí recibe de la base los mensajes de todos: sin este
  // filtro, un admin vería en su propia conversación lo que reportó la clínica entera.
  const miHiloHaciaBuzon = (canal) =>
    armarConversacion({
      usuario: BUZONES[canal],
      canal,
      para: null,
      atendido: false,
      userId,
      mensajes: mensajes.filter((m) => m.canal === canal && (m.de === userId || m.para === userId)),
    });

  return [
    // 1) El canal confidencial. La psicóloga ve el hilo de cada persona; el resto, el suyo con
    //    ella. Admin/RH no llevan ninguno: para ellos esta pantalla es solo buzones.
    ...(user?.role === "psicologa"
      ? empleados.map(conversacionCon)
      : psicologa && !sinCanalPsicologa ? [conversacionCon(psicologa)] : []),
    // 2) Los buzones que ATIENDE: los hilos de las demás personas (el propio va abajo).
    ...CANALES_BUZON.filter((canal) => atiende[canal]).flatMap(hilosDeBuzon),
    // 3) Su hilo propio hacia cada buzón al que puede reportar. SIEMPRE presente, aunque esté
    //    vacío: es el único sitio desde donde se escribe el primer mensaje.
    ...buzonesQueReporta.map(miHiloHaciaBuzon),
  ];
};

/** Más reciente primero, para las listas de hilos que se atienden. */
export const masRecientePrimero = (a, b) =>
  String(b.ultimo?.fecha || "").localeCompare(String(a.ultimo?.fecha || ""));

/**
 * Las propias van primero y se conservan aunque estén vacías (son suyas, no hilos que atiende:
 * sin ellas no habría dónde empezar a escribir). Debajo, lo que atiende, por recencia — y solo
 * lo que ya tiene mensajes, para no llenar la lista con una fila por cada persona de la empresa.
 */
export const ordenarConversaciones = (conversaciones) => [
  ...conversaciones.filter((c) => !c.atendido),
  ...conversaciones.filter((c) => c.atendido && c.mensajes.length > 0).sort(masRecientePrimero),
];
