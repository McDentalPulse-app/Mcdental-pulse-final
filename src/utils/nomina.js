import { ESTADOS_DIA } from "./asistencia";

/**
 * Nómina: qué se le paga a alguien una semana, después de sus retardos y sus faltas.
 *
 * Todo aquí es puro: entran los días YA clasificados por construirDias() (utils/asistencia.js),
 * el sueldo de la persona y los montos configurados, y sale el desglose. Sin React y sin
 * Supabase, porque es lo único que se puede testear — y esto decide cuánto cobra alguien, así
 * que es justo lo que no puede vivir sin pruebas dentro de un .jsx.
 *
 * LA REGLA DE NEGOCIO (decisión del dueño, 2026-09-10):
 *  · El sueldo capturado es SEMANAL y fijo. No se prorratea por días trabajados.
 *  · Un retardo descuenta un monto fijo. Una falta descuenta otro monto fijo.
 *  · La falta NO resta además el día de sueldo. Se descuenta ese monto y nada más.
 *
 * Lo que NO descuenta, y por qué:
 *  · JUSTIFICADO — hay un permiso o una vacación aprobados. Justificar es precisamente decir
 *    "este día no cuenta en contra"; cobrarlo igual vaciaría de sentido la aprobación.
 *  · DESCANSO — ese día no trabaja. No hay nada que descontar (mig. 035: sin fila de horario,
 *    el día es descanso, no falta).
 *  · PENDIENTE — el día en curso todavía no ha terminado; la persona aún puede llegar.
 *  · PRUEBA — la app no estaba en uso todavía (ver FIN_PERIODO_PRUEBA).
 *  · INCOMPLETO ("sin salida") — entró y no cerró el día. Es un caso que RH tiene que MIRAR,
 *    no un descuento automático: casi siempre es un olvido al checar, y cobrarle a alguien por
 *    un fallo de registro es la forma más rápida de que la plantilla deje de confiar en el
 *    checador. Si además llegó tarde, ese día ya cuenta como retardo por su cuenta.
 */

/** Montos cuando todavía no se ha configurado nada: no descontar. */
export const DESCUENTOS_DEFECTO = { montoRetardo: 0, montoFalta: 0 };

/** Número no negativo, o 0. Un monto en null/undefined/"abc" no puede tumbar el cálculo. */
const monto = (v) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * Pesos, redondeados a centavos.
 *
 * Se redondea en cada paso y no solo al final: sumar flotantes arrastra restos (0.1 + 0.2 =
 * 0.30000000000000004) y una nómina que muestra 1234.5600000001 no la firma nadie.
 */
const pesos = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Lo que descuenta UN día, según cómo quedó clasificado. */
export const descuentoDelDia = (estado, config = DESCUENTOS_DEFECTO) => {
  if (estado === ESTADOS_DIA.RETARDO) return monto(config?.montoRetardo);
  if (estado === ESTADOS_DIA.FALTA) return monto(config?.montoFalta);
  return 0;
};

/**
 * El recibo de una persona en un periodo.
 *
 * `dias` son los que devuelve construirDias(): ya traen estado, entrada, salida y minutos de
 * retardo. Aquí no se vuelve a decidir si alguien llegó tarde — esa lógica vive en un solo
 * sitio (utils/asistencia.js) y duplicarla sería garantizar que un día las dos discrepen.
 *
 * `sueldoSemanal` puede venir null: significa "todavía no se ha capturado", que NO es lo mismo
 * que cero. Se devuelve `sinSueldo: true` para que la pantalla lo diga con esas palabras en vez
 * de enseñar un pago final de $0.00, que parecería un cálculo hecho y da un dato falso.
 */
export const calcularNomina = ({ dias = [], sueldoSemanal = null, config = DESCUENTOS_DEFECTO } = {}) => {
  const detalle = dias.map((d) => ({ ...d, descuento: descuentoDelDia(d.estado, config) }));

  const retardos = detalle.filter((d) => d.estado === ESTADOS_DIA.RETARDO).length;
  const faltas = detalle.filter((d) => d.estado === ESTADOS_DIA.FALTA).length;
  const descuento = pesos(detalle.reduce((suma, d) => suma + d.descuento, 0));

  const bruto = typeof sueldoSemanal === "number" ? sueldoSemanal : Number(sueldoSemanal);
  const sinSueldo = !Number.isFinite(bruto) || bruto <= 0;
  const sueldo = sinSueldo ? 0 : pesos(bruto);

  return {
    detalle,
    retardos,
    faltas,
    sueldo,
    descuento,
    // Nunca negativo: si los descuentos se comen el sueldo, el pago es cero. Un "pago final" en
    // rojo no significa que la persona le deba dinero a la empresa, y presentarlo así invitaría
    // a arrastrar esa cifra a la semana siguiente, que no es lo que nadie acordó.
    pagoFinal: sinSueldo ? 0 : pesos(Math.max(0, sueldo - descuento)),
    sinSueldo,
  };
};

/** "$1,234.56". Para enseñar, no para calcular. */
export const money = (n) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(n) || 0);
