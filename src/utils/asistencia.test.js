import { describe, it, expect } from "vitest";
import {
  horaAMinutos,
  minutosLocales,
  diaISO,
  emparejarChecadas,
  minutosTrabajados,
  minutosRetardo,
  clasificarDia,
  rangoDeFechas,
  construirDias,
  claveDe,
  resumen,
  agruparPor,
  requiereRevision,
  detectarDispositivosCompartidos,
  puedeRegistrarSalida,
  horaSalidaAutorizada,
  minutosNoTrabajados,
  formatoDuracion,
  ESTADOS_DIA,
} from "./asistencia";

// Las clínicas están en America/Monterrey (UTC-6 todo el año: México dejó el horario
// de verano en 2022). Así que las 09:00 locales son las 15:00 UTC, y todos los
// timestamps de abajo se escriben en UTC porque es como llegan de Postgres.
const utc = (iso) => iso;

/** Fábrica de checada. Datos inventados: nada de PII real (igual que helpers.test.js). */
const checada = (tipo, marcadaEnUTC, extra = {}) => ({
  id: `${tipo}-${marcadaEnUTC}`,
  tipo,
  marcadaEn: utc(marcadaEnUTC),
  fecha: extra.fecha || marcadaEnUTC.slice(0, 10),
  anulada: false,
  ubicacionEstado: "dentro",
  ...extra,
});

const horarioNormal = { diaSemana: 1, horaEntrada: "09:00:00", horaSalida: "18:00:00", toleranciaMin: 10 };

describe("horaAMinutos", () => {
  it.each([
    ["09:00:00", 540],
    ["09:00", 540],
    ["00:00:00", 0],
    ["23:59:00", 1439],
  ])("%s => %i", (hora, esperado) => {
    expect(horaAMinutos(hora)).toBe(esperado);
  });

  it("devuelve null ante basura, en vez de NaN", () => {
    // NaN se propaga en silencio por toda la aritmética y acaba pintando "NaN min de
    // retardo" en la pantalla de RH. null se puede detectar.
    expect(horaAMinutos(null)).toBeNull();
    expect(horaAMinutos("hola")).toBeNull();
  });
});

describe("minutosLocales", () => {
  // El bug que esto previene: restar marcada_en (UTC) contra horarios.hora_entrada
  // (hora de pared) sin convertir. A las 09:05 de Tampico son las 15:05 UTC; sin la
  // conversión, TODO EL MUNDO llegaría con 6 horas de retardo, todos los días.
  it.each([
    ["2026-07-13T15:05:00Z", 545], // 09:05 en la clínica
    ["2026-07-13T15:00:00Z", 540], // 09:00
    ["2026-07-13T23:30:00Z", 1050], // 17:30
    ["2026-07-14T05:59:00Z", 1439], // 23:59 del día 13
  ])("%s => %i minutos locales", (ts, esperado) => {
    expect(minutosLocales(ts)).toBe(esperado);
  });

  it("medianoche local da 0, no 1440", () => {
    expect(minutosLocales("2026-07-14T06:00:00Z")).toBe(0);
  });
});

describe("diaISO", () => {
  // 1=lunes … 7=domingo, la misma numeración que la columna horarios.dia_semana y que
  // isodow de Postgres. Postgres tiene DOS numeraciones (dow: 0=domingo) y mezclarlas
  // compara el lunes contra el martes.
  it.each([
    ["2026-07-13", 1], // lunes
    ["2026-07-18", 6], // sábado
    ["2026-07-19", 7], // domingo
  ])("%s => día ISO %i", (fecha, esperado) => {
    expect(diaISO(fecha)).toBe(esperado);
  });
});

describe("emparejarChecadas", () => {
  it("toma la PRIMERA entrada y la ÚLTIMA salida", () => {
    // El caso real: sale a comer y vuelve a checar. Su jornada va de la primera entrada
    // a la última salida; las de en medio son ruido que RH puede querer ver, pero que no
    // definen el día.
    const cs = [
      checada("entrada", "2026-07-13T15:00:00Z"),
      checada("salida", "2026-07-13T19:00:00Z"),
      checada("entrada", "2026-07-13T20:00:00Z"),
      checada("salida", "2026-07-14T00:00:00Z"),
    ];
    const { entrada, salida, extras } = emparejarChecadas(cs);
    expect(entrada.marcadaEn).toBe("2026-07-13T15:00:00Z");
    expect(salida.marcadaEn).toBe("2026-07-14T00:00:00Z");
    expect(extras).toHaveLength(2);
  });

  it("ignora las checadas anuladas por RH", () => {
    // Una checada anulada no existe para el cálculo. Si contara, anularla no serviría
    // de nada y el día seguiría saliendo mal.
    const cs = [
      checada("entrada", "2026-07-13T14:00:00Z", { anulada: true }),
      checada("entrada", "2026-07-13T15:00:00Z"),
    ];
    expect(emparejarChecadas(cs).entrada.marcadaEn).toBe("2026-07-13T15:00:00Z");
  });

  it("ordena aunque lleguen desordenadas de la base", () => {
    const cs = [
      checada("salida", "2026-07-13T23:00:00Z"),
      checada("entrada", "2026-07-13T15:00:00Z"),
    ];
    const { entrada, salida } = emparejarChecadas(cs);
    expect(entrada.tipo).toBe("entrada");
    expect(salida.tipo).toBe("salida");
  });

  it("sin checadas devuelve nulls, no revienta", () => {
    expect(emparejarChecadas([])).toEqual({ entrada: null, salida: null, extras: [] });
  });
});

describe("minutosTrabajados", () => {
  it("cuenta la jornada normal", () => {
    const e = checada("entrada", "2026-07-13T15:00:00Z"); // 09:00
    const s = checada("salida", "2026-07-14T00:00:00Z"); // 18:00
    expect(minutosTrabajados(e, s)).toBe(540); // 9 h
  });

  it("resta timestamps, no horas de reloj", () => {
    // Restando las horas de pared (18:00 - 09:00) sale bien por casualidad, pero en
    // cuanto la salida cruza la medianoche daría negativo. Los timestamps absolutos
    // siempre dan el signo correcto.
    const e = checada("entrada", "2026-07-14T04:00:00Z"); // 22:00 local
    const s = checada("salida", "2026-07-14T12:00:00Z"); // 06:00 local del día siguiente
    expect(minutosTrabajados(e, s)).toBe(480); // 8 h, no -16 h
  });

  it("sin salida devuelve null (no 0: son cosas distintas)", () => {
    // 0 minutos significaría "entró y salió al instante". null significa "no se sabe".
    // Sumar 0 al total de horas del mes sería mentir con un número.
    expect(minutosTrabajados(checada("entrada", "2026-07-13T15:00:00Z"), null)).toBeNull();
  });
});

describe("minutosRetardo", () => {
  it("llegar antes de la hora no da retardo negativo", () => {
    // Un "retardo de -15 min" se sumaría al acumulado del mes y le restaría retardos
    // reales a alguien por haber llegado temprano otro día.
    const e = checada("entrada", "2026-07-13T14:45:00Z"); // 08:45
    expect(minutosRetardo(e, horarioNormal)).toBe(0);
  });

  it("cuenta desde la hora de entrada, sin descontar la tolerancia", () => {
    // La tolerancia decide SI es retardo, no CUÁNTO. Si a las 9:20 con 10 min de gracia
    // reportáramos "10 min de retardo", el acumulado del mes saldría corto.
    const e = checada("entrada", "2026-07-13T15:20:00Z"); // 09:20
    expect(minutosRetardo(e, horarioNormal)).toBe(20);
  });
});

describe("clasificarDia", () => {
  it("sin horario ese día => descanso, aunque no haya checado", () => {
    // La ausencia de renglón en `horarios` ES el descanso (migración 035). Sin esta
    // regla, cada domingo del año contaría como falta para toda la plantilla.
    const d = clasificarDia({ fecha: "2026-07-19", checadas: [], horario: null });
    expect(d.estado).toBe(ESTADOS_DIA.DESCANSO);
  });

  it("llegar en el minuto EXACTO del límite de tolerancia NO es retardo", () => {
    // El caso frontera que decide si la gente confía en el sistema. 9:00 + 10 de gracia:
    // las 9:10 llegan a tiempo. La comparación tiene que ser estrictamente mayor.
    const e = checada("entrada", "2026-07-13T15:10:00Z"); // 09:10
    const s = checada("salida", "2026-07-14T00:00:00Z");
    const d = clasificarDia({ fecha: "2026-07-13", checadas: [e, s], horario: horarioNormal });
    expect(d.estado).toBe(ESTADOS_DIA.PRESENTE);
    expect(d.minutosRetardo).toBe(10);
  });

  it("un minuto después del límite SÍ es retardo", () => {
    const e = checada("entrada", "2026-07-13T15:11:00Z"); // 09:11
    const s = checada("salida", "2026-07-14T00:00:00Z");
    const d = clasificarDia({ fecha: "2026-07-13", checadas: [e, s], horario: horarioNormal });
    expect(d.estado).toBe(ESTADOS_DIA.RETARDO);
    expect(d.minutosRetardo).toBe(11);
  });

  it("entrada sin salida => incompleto", () => {
    const e = checada("entrada", "2026-07-13T15:00:00Z");
    const d = clasificarDia({ fecha: "2026-07-13", checadas: [e], horario: horarioNormal });
    expect(d.estado).toBe(ESTADOS_DIA.INCOMPLETO);
    expect(d.minutosTrabajados).toBeNull();
  });

  it("sin checadas y sin justificante => falta", () => {
    const d = clasificarDia({ fecha: "2026-07-13", checadas: [], horario: horarioNormal });
    expect(d.estado).toBe(ESTADOS_DIA.FALTA);
  });

  it("un permiso APROBADO convierte la falta en justificada", () => {
    // El motivo entero de derivar el estado en vez de guardarlo: RH aprueba el permiso
    // DESPUÉS de que el día ya pasó, y ese día deja de ser falta solo, sin que nadie
    // tenga que reescribir filas viejas.
    const permisos = [{ estado: "aprobado", fecha: "2026-07-13", fechaFin: null }];
    const d = clasificarDia({ fecha: "2026-07-13", checadas: [], horario: horarioNormal, permisos });
    expect(d.estado).toBe(ESTADOS_DIA.JUSTIFICADO);
    expect(d.justificacion).toBeTruthy();
  });

  it("un permiso PENDIENTE no justifica nada", () => {
    // Si el pendiente justificara, cualquiera evitaría una falta solicitando un permiso
    // que nadie ha aprobado.
    const permisos = [{ estado: "pendiente", fecha: "2026-07-13", fechaFin: null }];
    const d = clasificarDia({ fecha: "2026-07-13", checadas: [], horario: horarioNormal, permisos });
    expect(d.estado).toBe(ESTADOS_DIA.FALTA);
  });

  it("unas vacaciones aprobadas justifican TODOS los días del rango", () => {
    const vacaciones = [{ estado: "aprobado", fechaInicio: "2026-07-13", fechaFin: "2026-07-17" }];
    const d = clasificarDia({ fecha: "2026-07-15", checadas: [], horario: horarioNormal, vacaciones });
    expect(d.estado).toBe(ESTADOS_DIA.JUSTIFICADO);
  });

  it("si vino a trabajar, el permiso aprobado NO borra que vino", () => {
    // Tenía permiso pero se presentó igual. Debe contar como presente: el permiso
    // justifica una AUSENCIA, y aquí no hubo ausencia.
    const permisos = [{ estado: "aprobado", fecha: "2026-07-13", fechaFin: null }];
    const e = checada("entrada", "2026-07-13T15:00:00Z");
    const s = checada("salida", "2026-07-14T00:00:00Z");
    const d = clasificarDia({ fecha: "2026-07-13", checadas: [e, s], horario: horarioNormal, permisos });
    expect(d.estado).toBe(ESTADOS_DIA.PRESENTE);
  });
});

describe("rangoDeFechas", () => {
  it("incluye los dos extremos", () => {
    expect(rangoDeFechas("2026-07-13", "2026-07-15")).toEqual(["2026-07-13", "2026-07-14", "2026-07-15"]);
  });

  it("cruza el cambio de mes", () => {
    expect(rangoDeFechas("2026-07-30", "2026-08-01")).toEqual(["2026-07-30", "2026-07-31", "2026-08-01"]);
  });

  it("cruza el 29 de febrero de un bisiesto", () => {
    expect(rangoDeFechas("2028-02-28", "2028-03-01")).toEqual(["2028-02-28", "2028-02-29", "2028-03-01"]);
  });
});

describe("construirDias", () => {
  it("una falta es un día SIN checadas: hay que recorrer el calendario, no la tabla", () => {
    // El error clásico del reporte de asistencia: iterar sobre las checadas que hay en
    // la base. Los días que faltó no tienen filas, así que las faltas serían invisibles
    // y el reporte diría que todo el mundo vino siempre.
    const horarios = [
      { diaSemana: 1, horaEntrada: "09:00:00", horaSalida: "18:00:00", toleranciaMin: 10 },
      { diaSemana: 2, horaEntrada: "09:00:00", horaSalida: "18:00:00", toleranciaMin: 10 },
    ];
    const checadas = [
      checada("entrada", "2026-07-13T15:00:00Z", { fecha: "2026-07-13" }),
      checada("salida", "2026-07-14T00:00:00Z", { fecha: "2026-07-13" }),
    ];

    // Lunes 13 (vino) y martes 14 (no vino).
    const dias = construirDias({ desde: "2026-07-13", hasta: "2026-07-14", checadas, horarios });

    expect(dias).toHaveLength(2);
    expect(dias[0].estado).toBe(ESTADOS_DIA.PRESENTE);
    expect(dias[1].estado).toBe(ESTADOS_DIA.FALTA);
  });

  it("aplica a cada fecha el horario de SU día de la semana", () => {
    // Sábado corto: mismo empleado, otra hora de salida. Si se aplicara el horario del
    // lunes al sábado, el sábado saldría mal clasificado.
    const horarios = [
      { diaSemana: 1, horaEntrada: "09:00:00", horaSalida: "18:00:00", toleranciaMin: 10 },
      { diaSemana: 6, horaEntrada: "09:00:00", horaSalida: "13:00:00", toleranciaMin: 10 },
    ];
    // 2026-07-19 es domingo: sin horario => descanso.
    const dias = construirDias({ desde: "2026-07-18", hasta: "2026-07-19", checadas: [], horarios });
    expect(dias[0].estado).toBe(ESTADOS_DIA.FALTA); // sábado: sí tenía turno y no vino
    expect(dias[1].estado).toBe(ESTADOS_DIA.DESCANSO); // domingo: no tenía turno
  });
});

describe("claveDe", () => {
  it.each([
    ["2026-07-13", "dia", "2026-07-13"],
    ["2026-07-13", "mes", "2026-07"],
    ["2026-07-13", "anio", "2026"],
    ["2026-07-13", "semana", "2026-W29"],
  ])("%s por %s => %s", (fecha, gran, esperado) => {
    expect(claveDe(fecha, gran)).toBe(esperado);
  });

  it("la semana no se corre por la zona horaria de la máquina", () => {
    // Regresión real (encontrada por este test): getISOWeek() de constants.js lee la
    // fecha con los getters LOCALES (getFullYear/getMonth/getDate). Pasarle un Date
    // creado a medianoche UTC hace que, en cualquier máquina al oeste de Greenwich
    // —México incluido—, esos getters devuelvan el día ANTERIOR: el lunes 13 de julio
    // se convertía en el domingo 12 y la semana salía W28 en vez de W29. Un reporte
    // semanal de asistencia entero, corrido una semana, y en silencio.
    expect(claveDe("2026-07-13", "semana")).toBe("2026-W29"); // lunes: primer día de su semana ISO
    expect(claveDe("2026-07-19", "semana")).toBe("2026-W29"); // domingo: último día de la MISMA semana
    expect(claveDe("2026-07-20", "semana")).toBe("2026-W30"); // lunes siguiente: ya es otra
  });
});

describe("resumen", () => {
  const dia = (estado, extra = {}) => ({ estado, minutosTrabajados: 0, minutosRetardo: 0, ...extra });

  it("cuenta cada estado y suma los minutos", () => {
    const r = resumen([
      dia(ESTADOS_DIA.PRESENTE, { minutosTrabajados: 540 }),
      dia(ESTADOS_DIA.RETARDO, { minutosTrabajados: 500, minutosRetardo: 25 }),
      dia(ESTADOS_DIA.FALTA),
      dia(ESTADOS_DIA.JUSTIFICADO),
      dia(ESTADOS_DIA.DESCANSO),
    ]);
    expect(r.presentes).toBe(1);
    expect(r.retardos).toBe(1);
    expect(r.faltas).toBe(1);
    expect(r.justificados).toBe(1);
    expect(r.descansos).toBe(1);
    expect(r.minutosTrabajados).toBe(1040);
    expect(r.minutosRetardo).toBe(25);
  });

  it("la puntualidad NO castiga por tener vacaciones aprobadas ni descansos", () => {
    // Si los justificados y los descansos entraran en el divisor, alguien que estuvo de
    // vacaciones aprobadas media semana aparecería con una puntualidad ridícula.
    const r = resumen([
      dia(ESTADOS_DIA.PRESENTE),
      dia(ESTADOS_DIA.JUSTIFICADO),
      dia(ESTADOS_DIA.DESCANSO),
    ]);
    expect(r.puntualidad).toBe(100);
  });

  it("un mes entero de vacaciones no divide entre cero", () => {
    const r = resumen([dia(ESTADOS_DIA.JUSTIFICADO), dia(ESTADOS_DIA.DESCANSO)]);
    expect(r.puntualidad).toBe(0);
    expect(Number.isNaN(r.puntualidad)).toBe(false);
  });

  it("mitad presente, mitad retardo => 50%", () => {
    const r = resumen([dia(ESTADOS_DIA.PRESENTE), dia(ESTADOS_DIA.RETARDO)]);
    expect(r.puntualidad).toBe(50);
  });
});

describe("agruparPor", () => {
  const dias = [
    { fecha: "2026-07-13", estado: ESTADOS_DIA.PRESENTE, minutosTrabajados: 540, minutosRetardo: 0 },
    { fecha: "2026-07-14", estado: ESTADOS_DIA.RETARDO, minutosTrabajados: 520, minutosRetardo: 20 },
    { fecha: "2026-08-03", estado: ESTADOS_DIA.FALTA, minutosTrabajados: 0, minutosRetardo: 0 },
  ];

  it("agrupa por mes y resume cada grupo", () => {
    const grupos = agruparPor(dias, "mes");
    expect(grupos.map((g) => g.clave)).toEqual(["2026-07", "2026-08"]);
    expect(grupos[0].resumen.minutosTrabajados).toBe(1060);
    expect(grupos[1].resumen.faltas).toBe(1);
  });

  it("agrupa por año", () => {
    const grupos = agruparPor(dias, "anio");
    expect(grupos).toHaveLength(1);
    expect(grupos[0].clave).toBe("2026");
    expect(grupos[0].resumen.dias).toBe(3);
  });

  it("devuelve los grupos en orden cronológico", () => {
    const desordenados = [dias[2], dias[0], dias[1]];
    expect(agruparPor(desordenados, "mes").map((g) => g.clave)).toEqual(["2026-07", "2026-08"]);
  });
});

describe("puedeRegistrarSalida", () => {
  // El botón de salida aparece en el MISMO sitio donde el empleado acaba de pulsar el de
  // entrada. Sin esta regla, un doble toque en un móvil le cerraba el día con una jornada
  // de 0 minutos. Se ata al horario (y no a un mínimo fijo de N minutos) porque es lo que
  // significa de verdad "ya terminé mi turno": un mínimo arbitrario seguiría permitiendo
  // fichar la jornada entera de golpe a las nueve de la mañana.
  const turno = { horaSalida: "18:00:00" };

  it.each([
    ["2026-07-14T15:00:00Z", false], // 09:00 — acaba de entrar
    ["2026-07-14T23:00:00Z", false], // 17:00 — todavía no
    ["2026-07-14T23:44:00Z", false], // 17:44 — un minuto antes de la ventana
    ["2026-07-14T23:45:00Z", true],  // 17:45 — se abre justo aquí (15 min antes)
    ["2026-07-15T00:00:00Z", true],  // 18:00 — su hora
    ["2026-07-15T02:00:00Z", true],  // 20:00 — se quedó hasta tarde: siempre permitido
  ])("a las %s => permitido: %s", (ts, esperado) => {
    expect(puedeRegistrarSalida(turno, new Date(ts)).permitido).toBe(esperado);
  });

  it("dice desde qué hora podrá, no solo que no puede", () => {
    // Un "no puedes" a secas no le dice qué hacer y acaba en una llamada a RH.
    expect(puedeRegistrarSalida(turno, new Date("2026-07-14T15:00:00Z")).disponibleDesde).toBe("17:45");
  });

  it("sin horario ese día, puede salir a cualquier hora", () => {
    // Alguien cubriendo un turno que no es suyo: no hay hora contra la que comparar, y
    // bloquearlo sería dejarlo sin poder cerrar su jornada.
    expect(puedeRegistrarSalida(null, new Date("2026-07-14T15:00:00Z")).permitido).toBe(true);
  });
});

describe("requiereRevision", () => {
  it.each([
    ["fuera", true],
    ["sin_gps", true],
    ["dentro", false],
    ["sin_geocerca", false],
  ])("ubicacionEstado=%s => %s", (estado, esperado) => {
    // sin_geocerca NO se señala: es culpa nuestra (falta capturar las coordenadas de la
    // clínica), no del empleado. Señalarlo llenaría el panel de RH de ruido que no puede
    // accionar, y el ruido acaba haciendo que nadie mire las señales que sí importan.
    expect(requiereRevision({ ubicacionEstado: estado, anulada: false, selfiePath: "a/1.jpg" })).toBe(esperado);
  });

  it("una checada anulada ya no requiere revisión", () => {
    expect(requiereRevision({ ubicacionEstado: "fuera", anulada: true, selfiePath: "a/1.jpg" })).toBe(false);
  });

  it("una checada SIN FOTO se marca, aunque la ubicación esté bien", () => {
    // El detector de rostro no bloquea si falla (una comprobación caída no puede impedirle
    // a nadie fichar), así que una checada sin selfie es un hueco: se registró sin ninguna
    // evidencia de quién la hizo. Se marca a propósito, y sí, se marcará todos los días de
    // quien deniegue la cámara — que es exactamente lo que hace falta para que RH lo
    // persiga una vez y deje de pasar.
    expect(requiereRevision({ ubicacionEstado: "dentro", anulada: false, selfiePath: null })).toBe(true);
  });

  it("un dispositivo nunca visto se marca", () => {
    expect(
      requiereRevision({ ubicacionEstado: "dentro", anulada: false, selfiePath: "a/1.jpg", dispositivoNuevo: true })
    ).toBe(true);
  });
});

describe("detectarDispositivosCompartidos", () => {
  // La señal más fuerte de suplantación que tenemos. Si un compañero checa por ti, lo hace
  // desde SU teléfono: un mismo dispositivo fichando a dos personas distintas el mismo día
  // no tiene una explicación inocente frecuente — al contrario que "dispositivo nuevo", que
  // salta cada vez que alguien cambia de móvil.
  const ch = (id, empleadoId, deviceId, fecha = "2026-07-14", extra = {}) =>
    ({ id, empleadoId, deviceId, fecha, anulada: false, ...extra });

  it("marca las DOS checadas cuando un teléfono ficha a dos empleados el mismo día", () => {
    // Las dos, no solo la segunda: el fraude necesita el par para entenderse, y RH tiene que
    // ver a quién se suplantó además de quién lo hizo.
    const sospechosas = detectarDispositivosCompartidos([
      ch("1", "ana", "tel-A"),
      ch("2", "beto", "tel-A"),
    ]);
    expect(sospechosas.has("1")).toBe(true);
    expect(sospechosas.has("2")).toBe(true);
  });

  it("el mismo empleado checando varias veces desde su teléfono NO se marca", () => {
    // Es el caso normal: entrada y salida desde el mismo móvil, todos los días.
    const sospechosas = detectarDispositivosCompartidos([
      ch("1", "ana", "tel-A"),
      ch("2", "ana", "tel-A"),
    ]);
    expect(sospechosas.size).toBe(0);
  });

  it("el mismo teléfono en DÍAS distintos no es sospechoso", () => {
    // Un móvil reutilizado (alguien se fue, otro heredó el equipo) no es un fraude. La
    // señal solo tiene sentido dentro del mismo día.
    const sospechosas = detectarDispositivosCompartidos([
      ch("1", "ana", "tel-A", "2026-07-13"),
      ch("2", "beto", "tel-A", "2026-07-14"),
    ]);
    expect(sospechosas.size).toBe(0);
  });

  it("las checadas anuladas no cuentan", () => {
    const sospechosas = detectarDispositivosCompartidos([
      ch("1", "ana", "tel-A"),
      ch("2", "beto", "tel-A", "2026-07-14", { anulada: true }),
    ]);
    expect(sospechosas.size).toBe(0);
  });

  it("sin deviceId no se puede decir nada", () => {
    // Incógnito, storage bloqueado: no hay dato. Ausencia de señal no es señal.
    const sospechosas = detectarDispositivosCompartidos([
      ch("1", "ana", null),
      ch("2", "beto", null),
    ]);
    expect(sospechosas.size).toBe(0);
  });
});

describe("salida anticipada", () => {
  // Irse antes de la hora, con permiso APROBADO de RH (migración 045). No se inventó un
  // mecanismo nuevo: se reusa el módulo de permisos, que ya tenía solicitud, aprobación,
  // estado, causa y una columna `hora` sin usar esperando exactamente esto.
  const turno = { horaSalida: "18:00:00" };
  const permiso = (extra) => ({
    empleadoId: "ana", estado: "aprobado", causa: "salida_anticipada",
    hora: "15:00", fecha: "2026-07-14", fechaFin: null, ...extra,
  });

  it("un permiso aprobado ADELANTA la ventana de salida", () => {
    // Autorizado a las 15:00 -> puede checar desde las 14:45, no desde las 17:45.
    const r = puedeRegistrarSalida(turno, new Date("2026-07-14T20:45:00Z"), "15:00"); // 14:45 local
    expect(r.permitido).toBe(true);
    expect(r.autorizada).toBe(true);
    expect(r.horaAutorizada).toBe("15:00");
  });

  it("antes de la hora autorizada sigue bloqueado", () => {
    const r = puedeRegistrarSalida(turno, new Date("2026-07-14T20:00:00Z"), "15:00"); // 14:00 local
    expect(r.permitido).toBe(false);
    expect(r.disponibleDesde).toBe("14:45");
  });

  it("un permiso con hora POSTERIOR a su turno se ignora", () => {
    // Un permiso mal capturado con hora 20:00 no puede dejar a alguien sin poder fichar a su
    // hora normal: solo puede ADELANTAR la salida, nunca retrasarla.
    const r = puedeRegistrarSalida(turno, new Date("2026-07-14T23:55:00Z"), "20:00"); // 17:55 local
    expect(r.permitido).toBe(true);   // manda su turno (17:45), no el permiso
    expect(r.autorizada).toBe(false);
  });
});

describe("horaSalidaAutorizada", () => {
  const base = { empleadoId: "ana", causa: "salida_anticipada", hora: "15:00", fecha: "2026-07-14", fechaFin: null };

  it("solo cuenta el permiso APROBADO", () => {
    // Si el pendiente contara, pedir permiso sería lo mismo que tomárselo.
    expect(horaSalidaAutorizada([{ ...base, estado: "pendiente" }], "2026-07-14")).toBeNull();
    expect(horaSalidaAutorizada([{ ...base, estado: "rechazado" }], "2026-07-14")).toBeNull();
    expect(horaSalidaAutorizada([{ ...base, estado: "aprobado" }], "2026-07-14")).toBe("15:00");
  });

  it("ignora los permisos de OTRAS causas", () => {
    // Una cita médica aprobada no autoriza a irse antes: son cosas distintas.
    expect(horaSalidaAutorizada([{ ...base, estado: "aprobado", causa: "cita_medica" }], "2026-07-14")).toBeNull();
  });

  it("ignora los permisos de otro día", () => {
    expect(horaSalidaAutorizada([{ ...base, estado: "aprobado" }], "2026-07-15")).toBeNull();
  });

  it("con varios, se queda con la hora MÁS TEMPRANA", () => {
    // Es la que más le beneficia. No hay motivo para aplicarle la más restrictiva de dos
    // autorizaciones que él pidió y RH aprobó.
    const r = horaSalidaAutorizada([
      { ...base, estado: "aprobado", hora: "16:00" },
      { ...base, estado: "aprobado", hora: "14:30" },
    ], "2026-07-14");
    expect(r).toBe("14:30");
  });
});

describe("minutosNoTrabajados", () => {
  // Lo que se le descuenta por salir antes: SOLO las horas que deja de trabajar, no el día
  // entero. Y se le dice ANTES de pedirlo — enterarse en la nómina de que salir dos horas
  // antes costó dinero es la peor forma posible de descubrir una regla.
  const turno = { horaSalida: "18:00:00" };

  it.each([
    ["15:00", 180], // sale 3 h antes
    ["17:30", 30],
    ["18:00", 0],   // sale a su hora: no se descuenta nada
    ["19:00", 0],   // se queda de más: tampoco se le descuenta (ni se le paga aquí)
  ])("salir a las %s => %i minutos", (hora, esperado) => {
    expect(minutosNoTrabajados(hora, turno)).toBe(esperado);
  });

  it("sin turno ese día no hay nada que descontar", () => {
    expect(minutosNoTrabajados("15:00", null)).toBe(0);
  });
});

describe("formatoDuracion", () => {
  it.each([
    [180, "3 h"],
    [210, "3 h 30 min"],
    [45, "45 min"],
    [0, "0 min"],
  ])("%i min => %s", (min, esperado) => {
    expect(formatoDuracion(min)).toBe(esperado);
  });
});
