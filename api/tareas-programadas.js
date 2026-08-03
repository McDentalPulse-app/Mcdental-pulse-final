import { admin, configOk } from "./_auth.js";
import { pushDisponible } from "./_push.js";
import { notificar, notificarGestion } from "./_notificaciones.js";

/**
 * Dos tareas de fondo en un solo endpoint, un solo cron diario.
 *
 * POR QUÉ VAN JUNTAS: el plan Hobby de Vercel limita a 12 Serverless Functions por deployment
 * (error `exceeded_serverless_functions_per_deployment` si se pasa). Recordatorio de encuesta y
 * revisión de tickets no comparten nada de lógica, pero las dos son "trabajo de fondo que solo
 * llama el cron, nunca una persona" — fusionarlas en un archivo es gratis en claridad y evita
 * gastar una función completa en algo que de todos modos no tiene UI propia. Si algún día hace
 * falta separarlas (por ejemplo, para darles horarios distintos), es tan simple como partir este
 * archivo en dos otra vez.
 *
 * Corre UNA vez al día (Hobby no admite más). Dentro, el recordatorio de encuesta solo actúa
 * martes/jueves/viernes (hora de México) — el cron llama todos los días, pero el aviso de
 * encuesta no tiene por qué mandarse los otros cuatro.
 */

const MCTIC_API_URL = process.env.MCTIC_API_URL;
const MCTIC_INTEGRATION_KEY = process.env.MCTIC_INTEGRATION_KEY;

// Misma cuenta de semana ISO que src/utils/constants.js (getISOWeek). Se reimplementa aquí
// porque api/ no importa hoy desde src/ — son dos bundles serverless independientes.
const getISOWeek = (d = new Date()) => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
};

// Día ISO (1=lunes...7=domingo) en hora de México, sin depender de ninguna librería.
const diaISOEnMexico = () => {
  const nombre = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Monterrey",
    weekday: "short",
  }).format(new Date());
  return { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[nombre];
};

const DIAS_RECORDATORIO_ENCUESTA = [2, 4, 5]; // martes, jueves, viernes

/** Recordatorio de encuesta semanal sin responder. Como el filtro siempre es "sin encuesta de
 * ESTA semana", en cuanto la persona responde deja de recibir el aviso solo, sin tabla de
 * control aparte. */
const recordatorioEncuestas = async (supabase) => {
  const semana = getISOWeek();

  const { data: empleados, error: errorEmpleados } = await supabase
    .from("usuarios")
    .select("id, name")
    .eq("role", "empleado")
    .eq("inactivo", false);

  if (errorEmpleados) {
    console.error("Error buscando empleados:", errorEmpleados);
    return { avisados: 0, error: "No se pudieron buscar los empleados." };
  }
  if (!empleados?.length) return { avisados: 0 };

  const { data: respondidas, error: errorEncuestas } = await supabase
    .from("encuestas")
    .select("empleado_id")
    .eq("semana", semana);

  if (errorEncuestas) {
    console.error("Error buscando encuestas de la semana:", errorEncuestas);
    return { avisados: 0, error: "No se pudieron buscar las encuestas." };
  }

  const yaRespondieron = new Set((respondidas || []).map((e) => e.empleado_id));
  const pendientes = empleados.filter((u) => !yaRespondieron.has(u.id));

  await Promise.all(
    pendientes.map((u) =>
      notificar(u.id, {
        tipo: "encuesta",
        titulo: "Encuesta semanal pendiente",
        cuerpo: "Todavía no respondes tu encuesta de esta semana. Te toma un par de minutos.",
        url: "/empleado/encuesta",
      }).catch(() => {})
    )
  );

  return { semana, avisados: pendientes.length };
};

const ESTADO_LABEL = {
  ABIERTO: "abierto",
  EN_PROGRESO: "en progreso",
  RESUELTO: "resuelto",
  CERRADO: "cerrado",
};

const RUTA_POR_ROL = {
  empleado: "/empleado/soporte",
  rh: "/rh/soporte",
  psicologa: "/psicologa/soporte",
  admin: "/admin/soporte",
};

/** Detecta cambios de estado en los tickets de soporte (MCTIC) y avisa por push.
 *
 * MCTIC es un sistema externo y no manda webhook: lo único que se puede hacer es preguntarle
 * de vez en cuando y comparar contra la última foto guardada en `soporte_tickets_estado`. La
 * primera vez que se ve un ticket no se avisa, solo se siembra la fila — si no, el primer
 * barrido tras desplegar esto mandaría un push por cada ticket que ya existiera de antes.
 *
 * Solo se consulta a quien PODRÍA recibir el aviso: las personas con al menos una suscripción
 * de push activa. Consultar a todo el mundo sería pegarle a MCTIC por gente que de todos modos
 * no puede recibir nada. */
const revisarTickets = async (supabase) => {
  if (!MCTIC_API_URL || !MCTIC_INTEGRATION_KEY) return { revisados: 0, motivo: "MCTIC no configurado" };

  const { data: subs, error: errorSubs } = await supabase
    .from("push_suscripciones")
    .select("empleado_id");

  if (errorSubs) {
    console.error("Error buscando suscripciones:", errorSubs);
    return { revisados: 0, error: "No se pudieron buscar las suscripciones." };
  }

  const empleadoIds = [...new Set((subs || []).map((s) => s.empleado_id))];
  if (!empleadoIds.length) return { revisados: 0 };

  const { data: usuarios, error: errorUsuarios } = await supabase
    .from("usuarios")
    .select("id, role, synthetic_email")
    .in("id", empleadoIds);

  if (errorUsuarios) {
    console.error("Error buscando usuarios:", errorUsuarios);
    return { revisados: 0, error: "No se pudieron buscar los usuarios." };
  }

  let revisados = 0;
  let avisados = 0;

  await Promise.all(
    (usuarios || []).map(async (u) => {
      if (!u.synthetic_email) return;

      let tickets;
      try {
        const resp = await fetch(
          `${MCTIC_API_URL}/api/v1/integrations/helpdesk/tickets?requester=${encodeURIComponent(u.synthetic_email)}`,
          { headers: { "X-Integration-Key": MCTIC_INTEGRATION_KEY } },
        );
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) return;
        tickets = data?.data ?? [];
      } catch {
        return; // MCTIC caído o inalcanzable en este barrido: se reintenta al día siguiente.
      }

      revisados += 1;
      if (!tickets.length) return;

      const { data: cache } = await supabase
        .from("soporte_tickets_estado")
        .select("ticket_id, status")
        .eq("empleado_id", u.id);

      const estadoPrevio = new Map((cache || []).map((c) => [c.ticket_id, c.status]));

      for (const t of tickets) {
        const ticketId = String(t.id);
        const previo = estadoPrevio.get(ticketId);

        if (previo === undefined) {
          // Primera vez que se ve: se siembra sin avisar.
          await supabase
            .from("soporte_tickets_estado")
            .upsert(
              { empleado_id: u.id, ticket_id: ticketId, status: t.status, actualizado_en: new Date().toISOString() },
              { onConflict: "empleado_id,ticket_id" }
            );
          continue;
        }

        if (previo !== t.status) {
          await supabase
            .from("soporte_tickets_estado")
            .upsert(
              { empleado_id: u.id, ticket_id: ticketId, status: t.status, actualizado_en: new Date().toISOString() },
              { onConflict: "empleado_id,ticket_id" }
            );

          const estadoTexto = ESTADO_LABEL[t.status] || t.status;
          notificar(u.id, {
            tipo: "ticket",
            titulo: "Tu ticket de soporte cambió de estado",
            cuerpo: `#${ticketId} · ${t.subject || "Ticket"} ahora está ${estadoTexto}.`,
            url: RUTA_POR_ROL[u.role] || "/empleado/soporte",
          }).catch(() => {});
          avisados += 1;
        }
      }
    })
  );

  return { revisados, avisados };
};

/** Día ISO (1=lunes … 7=domingo) de una fecha "YYYY-MM-DD", en UTC para que la zona del
 * runtime no corra el día. Misma cuenta que src/utils/asistencia.js (diaISO). */
const diaISODeFecha = (fecha) => {
  const d = new Date(`${String(fecha).slice(0, 10)}T00:00:00Z`);
  const dow = d.getUTCDay(); // 0=domingo … 6=sábado
  return dow === 0 ? 7 : dow;
};

/**
 * Cierra las jornadas que quedaron abiertas: entrada sí, salida no, de un día que ya pasó.
 *
 * EL PROBLEMA QUE RESUELVE: quien marca entrada y se le olvida marcar salida deja el día
 * "incompleto" para siempre — y no se arregla solo, porque el checador de mañana empieza un
 * día nuevo. Sin esto, se acumulan decenas de días a medio marcar que RH tendría que cerrar
 * a mano uno por uno.
 *
 * CÓMO: a cada entrada huérfana se le pone una salida a la hora en que ESE día terminaba su
 * turno (la de su horario), no la hora del cron — así las horas trabajadas salen razonables y
 * no una jornada de 14 h porque el cron corre a las 7am. Si ese día no tenía horario cargado,
 * se usa una salida por defecto a las 19:00. La salida lleva `origen = 'sistema'` y una nota,
 * para que en el panel se distinga de una salida que la persona sí marcó.
 *
 * Solo toca días ANTERIORES a hoy: el día en curso todavía puede cerrarse solo, la persona
 * aún puede marcar su salida real.
 */
const CIERRE_TZ_OFFSET = "-06:00"; // Monterrey es UTC-6 todo el año (México no aplica horario de verano).
// 19:00 y no 18:00: es la hora a la que termina la jornada entre semana en TODAS las clinicas
// (el sabado son las 14:00, pero ese dia si hay horario cargado y se usa el suyo). Con las
// 18:00 anteriores, los pocos dias sin horario cerraban una hora antes de tiempo y le
// recortaban una hora trabajada a quien ya se habia olvidado de marcar salida.
const HORA_SALIDA_DEFECTO = "19:00:00";

const cerrarJornadasAbiertas = async (supabase) => {
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Monterrey" }).format(new Date());

  // Se acota a la última semana: una entrada huérfana más vieja que eso ya no vale la pena
  // cerrarla (y evita un barrido enorme si alguna vez se re-siembra histórico).
  const hace7 = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Monterrey" })
    .format(new Date(Date.now() - 7 * 86_400_000));

  const { data: entradas, error: errEnt } = await supabase
    .from("asistencias")
    .select("empleado_id, fecha")
    .eq("tipo", "entrada")
    .eq("anulada", false)
    .gte("fecha", hace7)
    .lt("fecha", hoy);

  if (errEnt) {
    console.error("Error buscando entradas abiertas:", errEnt);
    return { cerradas: 0, error: "No se pudieron buscar las entradas." };
  }
  if (!entradas?.length) return { cerradas: 0 };

  const { data: salidas } = await supabase
    .from("asistencias")
    .select("empleado_id, fecha")
    .eq("tipo", "salida")
    .gte("fecha", hace7)
    .lt("fecha", hoy);

  const conSalida = new Set((salidas || []).map((s) => `${s.empleado_id}|${s.fecha}`));
  // Dedup por si un día tuviera dos entradas: una sola salida basta para cerrarlo.
  const huerfanas = new Map();
  for (const e of entradas) {
    const clave = `${e.empleado_id}|${e.fecha}`;
    if (!conSalida.has(clave)) huerfanas.set(clave, e);
  }
  if (!huerfanas.size) return { cerradas: 0 };

  // Horario de quienes tienen jornada huérfana, para saber a qué hora cerraba su turno.
  const empleadoIds = [...new Set([...huerfanas.values()].map((e) => e.empleado_id))];
  const { data: horarios } = await supabase
    .from("horarios")
    .select("empleado_id, dia_semana, hora_salida")
    .in("empleado_id", empleadoIds);

  const horaPorClave = new Map(
    (horarios || []).map((h) => [`${h.empleado_id}|${h.dia_semana}`, h.hora_salida])
  );

  const filas = [...huerfanas.values()].map((e) => {
    const dia = diaISODeFecha(e.fecha);
    const horaSalida = horaPorClave.get(`${e.empleado_id}|${dia}`) || HORA_SALIDA_DEFECTO;
    return {
      empleado_id: e.empleado_id,
      tipo: "salida",
      fecha: e.fecha,
      marcada_en: `${e.fecha}T${horaSalida}${CIERRE_TZ_OFFSET}`,
      ubicacion_estado: "sin_gps",
      origen: "sistema",
      nota_rh: "Salida automática: no marcó salida.",
    };
  });

  const { error: errIns } = await supabase.from("asistencias").insert(filas);
  if (errIns) {
    console.error("Error insertando salidas automáticas:", errIns);
    return { cerradas: 0, error: "No se pudieron cerrar las jornadas." };
  }
  return { cerradas: filas.length };
};

/**
 * Vigila que ninguna geocerca esté dejando a una clínica sin poder fichar.
 *
 * Desde la migración 103 son las recepcionistas quienes fijan la ubicación de su clínica. Es
 * mucho mejor que viajar a 25 clínicas, pero abre un fallo nuevo: alguien la captura desde su
 * casa y al día siguiente su clínica entera rebota, porque estar 'fuera' BLOQUEA la checada.
 *
 * El síntoma NO es "muchas checadas fuera": una checada bloqueada responde 403 y no deja fila
 * en ninguna tabla. El síntoma es el silencio. Eso lo detecta `revisar_geocercas` (mig. 104);
 * aquí solo se avisa.
 *
 * Sin esto, el aviso llega por teléfono a las ocho de la mañana y de la peor manera.
 */
/**
 * "Se te olvidó marcar tu salida": un aviso a quien tiene entrada de HOY y todavía no ha salido,
 * poco después de su hora.
 *
 * EL PROBLEMA, medido: en 7 días, 70 de 426 checadas —una de cada seis— las tuvo que cerrar el
 * sistema al día siguiente, repartidas entre 56 personas distintas. No es un despiste de dos o
 * tres: es que a las siete de la tarde nadie se acuerda del teléfono. Y una salida puesta por el
 * cron es una hora estimada, no la real: quien se fue a las 19:40 queda registrado a las 19:00.
 *
 * Por eso el aviso llega a los 10 MINUTOS de su hora y no a la hora en punto: a la hora en punto
 * la persona está todavía recogiendo y el aviso se pierde entre lo que está haciendo. Diez
 * minutos después ya va de salida, que es justo cuando puede actuar.
 *
 * LA VENTANA (de +10 a +70 min) es lo que permite que el MISMO endpoint sirva para los dos
 * horarios de la clínica —19:00 entre semana y 14:00 el sábado— con dos entradas de cron y sin
 * ninguna lógica de calendario: cada llamada avisa solo a quien acaba de pasarse de su hora. El
 * de las 14:10 no molesta a quien sale a las 19:00, y el de las 19:10 no vuelve a avisar al que
 * salía a las 14:00 hace cinco horas.
 */
const MARGEN_AVISO_SALIDA_MIN = 10;
const VENTANA_AVISO_SALIDA_MIN = 60;

const recordarSalidaPendiente = async (supabase) => {
  const enClinica = (fmt, d = new Date()) =>
    new Intl.DateTimeFormat(fmt.locale, { timeZone: "America/Monterrey", ...fmt.opts }).format(d);

  const hoy = enClinica({ locale: "en-CA", opts: {} });
  const [hh, mm] = enClinica({ locale: "en-GB", opts: { hour: "2-digit", minute: "2-digit", hour12: false } })
    .split(":");
  const ahoraMin = Number(hh) * 60 + Number(mm);

  const { data: entradas, error } = await supabase
    .from("asistencias")
    .select("empleado_id")
    .eq("tipo", "entrada")
    .eq("anulada", false)
    .eq("fecha", hoy);

  if (error) {
    console.error("Error buscando entradas de hoy:", error);
    return { avisados: 0, error: "No se pudieron buscar las entradas de hoy." };
  }
  if (!entradas?.length) return { avisados: 0 };

  const { data: salidas } = await supabase
    .from("asistencias")
    .select("empleado_id")
    .eq("tipo", "salida")
    .eq("fecha", hoy);

  const yaSalieron = new Set((salidas || []).map((s) => s.empleado_id));
  const abiertos = [...new Set(entradas.map((e) => e.empleado_id))].filter((id) => !yaSalieron.has(id));
  if (!abiertos.length) return { avisados: 0 };

  const dia = diaISODeFecha(hoy);
  const { data: horarios } = await supabase
    .from("horarios")
    .select("empleado_id, hora_salida")
    .eq("dia_semana", dia)
    .in("empleado_id", abiertos);

  const horaPorEmpleado = new Map((horarios || []).map((h) => [h.empleado_id, h.hora_salida]));

  // Quien ya recibió el aviso hoy no lo recibe otra vez. La ventana de arriba ya lo hace casi
  // imposible, pero esto es lo que impide que añadir una tercera entrada de cron mañana
  // convierta el recordatorio en spam sin que nadie lo note.
  const { data: avisadosHoy } = await supabase
    .from("notificaciones")
    .select("empleado_id")
    .eq("tipo", "salida_pendiente")
    .gte("created_at", `${hoy}T00:00:00${CIERRE_TZ_OFFSET}`);

  const yaAvisados = new Set((avisadosHoy || []).map((n) => n.empleado_id));

  const pendientes = abiertos.filter((id) => {
    if (yaAvisados.has(id)) return false;
    const hora = horaPorEmpleado.get(id) || HORA_SALIDA_DEFECTO;
    const [h, m] = String(hora).split(":");
    const salidaMin = Number(h) * 60 + Number(m);
    if (!Number.isFinite(salidaMin)) return false;
    const pasados = ahoraMin - salidaMin;
    return pasados >= MARGEN_AVISO_SALIDA_MIN && pasados <= VENTANA_AVISO_SALIDA_MIN;
  });

  if (!pendientes.length) return { fecha: hoy, abiertos: abiertos.length, avisados: 0 };

  // La ruta se arma con el ROL de cada quien y no se escribe fija.
  //
  // El checador vive bajo cuatro prefijos (/empleado, /doctor, /rh, /psicologa) y App.jsx rebota
  // a su portada a quien pida uno que no le toca. Una URL fija a /empleado/checador mandaría a
  // los doctores a otra pantalla — que es exactamente el fallo que se arregló el 2026-08-01 en
  // los botones del propio checador. No conviene volver a introducirlo por la puerta del cron.
  const { data: personas } = await supabase
    .from("usuarios")
    .select("id, role")
    .in("id", pendientes);

  const rolPorId = new Map((personas || []).map((u) => [u.id, u.role]));

  await Promise.all(
    pendientes.map((id) => {
      const rol = rolPorId.get(id);
      // Sin rol conocido no se inventa una ruta: la campana lleva a la portada y desde ahí la
      // persona llega al checador. Mejor eso que un enlace que rebota.
      const url = rol ? `/${rol}/checador` : "/";
      return notificar(id, {
        tipo: "salida_pendiente",
        titulo: "No has marcado tu salida",
        cuerpo: "Antes de irte, registra tu salida en el checador. Si no, la cerramos nosotros a tu hora de turno.",
        url,
      }).catch(() => {});
    })
  );

  return { fecha: hoy, abiertos: abiertos.length, avisados: pendientes.length };
};

const revisarGeocercas = async (supabase) => {
  const { data, error } = await supabase.rpc("revisar_geocercas");
  if (error) {
    console.error("Error revisando geocercas:", error);
    return { error: "No se pudieron revisar las geocercas." };
  }

  const hallazgos = data || [];
  const alarmas = hallazgos.filter((h) => h.motivo === "muda" || h.motivo === "lejos");
  // Las propuestas no se notifican: son clínicas SIN geocerca, o sea que nadie está bloqueado.
  // Avisar a diario de algo que no urge es la forma más rápida de que se ignoren las que sí.
  const propuestas = hallazgos.filter((h) => h.motivo === "propuesta");

  // Una clínica muda sigue muda mañana. Sin este freno, la misma alarma llegaría cada día hasta
  // que alguien la arregle, y a la tercera ya nadie la lee.
  const hace48h = new Date(Date.now() - 48 * 3_600_000).toISOString();
  const { data: recientes } = await supabase
    .from("notificaciones")
    .select("titulo")
    .eq("tipo", "geocerca")
    .gte("creada_en", hace48h);
  const yaAvisado = new Set((recientes || []).map((n) => n.titulo));

  const urlSucursales = {
    admin: "/admin/sucursales",
    rh: "/rh/sucursales",
    psicologa: "/psicologa/sucursales",
  };

  let avisadas = 0;
  for (const a of alarmas) {
    const titulo =
      a.motivo === "muda"
        ? `Nadie puede fichar en ${a.nombre}`
        : `Revisa la ubicación de ${a.nombre}`;
    if (yaAvisado.has(titulo)) continue;
    await notificarGestion({ tipo: "geocerca", titulo, cuerpo: a.detalle, url: urlSucursales });
    avisadas += 1;
  }

  return {
    alarmas: alarmas.length,
    avisadas,
    propuestas: propuestas.map((p) => p.nombre),
  };
};

export default async function handler(req, res) {
  if (!configOk()) {
    return res.status(500).json({ error: "Supabase no está configurado en el servidor." });
  }

  // Mismo candado que api/limpiar-fotos.js: sin esto, cualquiera podría disparar el barrido.
  const secreto = process.env.CRON_SECRET;
  if (!secreto) {
    console.error("CRON_SECRET no configurado: rechazando por seguridad.");
    return res.status(500).json({ error: "Tarea no configurada." });
  }
  if (req.headers.authorization !== `Bearer ${secreto}`) {
    return res.status(401).json({ error: "No autorizado." });
  }

  const supabase = admin();
  const resultado = {};

  // Una tarea con horario PROPIO, en el mismo endpoint.
  //
  // El recordatorio de salida tiene que sonar a las 19:10 y a las 14:10, no a las 07:00 con el
  // resto. Lo natural sería un archivo aparte, pero cada archivo en api/ es una Serverless
  // Function y el plan Hobby admite 12 (ver la cabecera de este archivo; el repo ya va por 19,
  // que es justamente por lo que los despliegues de Vercel fallan hoy). Así que el cron lo pide
  // por `?tarea=salidas` y este endpoint hace SOLO eso: nada de cerrar jornadas ni purgar la
  // bandeja dos veces al día.
  if ((req.query?.tarea || "") === "salidas") {
    resultado.salidasPendientes = await recordarSalidaPendiente(supabase);
    return res.status(200).json(resultado);
  }

  // Cierre de jornadas abiertas: corre SIEMPRE, no depende del push — es higiene de datos, no
  // un aviso. Sin esto, las entradas sin salida se acumulan como días "incompletos".
  resultado.jornadasCerradas = await cerrarJornadasAbiertas(supabase);

  // Corre SIEMPRE y no depende del push: aunque el push esté caído, la fila queda en la campana
  // y el resultado del cron. Una clínica bloqueada no puede esperar a que se arregle otra cosa.
  resultado.geocercas = await revisarGeocercas(supabase);

  if (pushDisponible()) {
    if (DIAS_RECORDATORIO_ENCUESTA.includes(diaISOEnMexico())) {
      resultado.encuestas = await recordatorioEncuestas(supabase);
    }
    resultado.tickets = await revisarTickets(supabase);
  } else {
    resultado.motivo = "push no configurado";
  }

  // Purga de la bandeja: leídas > 30 días, no leídas > 90 días. Corre SIEMPRE, no depende del
  // push — es limpieza de la tabla que la campana consulta, para que no crezca sin techo.
  const hace = (dias) => new Date(Date.now() - dias * 86_400_000).toISOString();
  const { count: leidasViejas } = await supabase
    .from("notificaciones")
    .delete({ count: "exact" })
    .eq("leida", true)
    .lt("creada_en", hace(30));
  const { count: noLeidasViejas } = await supabase
    .from("notificaciones")
    .delete({ count: "exact" })
    .eq("leida", false)
    .lt("creada_en", hace(90));
  resultado.notificacionesPurgadas = (leidasViejas || 0) + (noLeidasViejas || 0);

  return res.status(200).json(resultado);
}
