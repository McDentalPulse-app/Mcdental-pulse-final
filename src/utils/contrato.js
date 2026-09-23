import { normalizeSucursal } from "./constants";
import { resolveFechaIngreso } from "./helpers";

/**
 * Contrato individual de trabajo, formato México.
 *
 * Estructura y cláusulas basadas en los artículos 20-28 y 25 de la Ley Federal del Trabajo
 * (declaraciones con los datos de ambas partes, objeto, duración, lugar, jornada, salario,
 * descanso, vacaciones/prima vacacional, aguinaldo, capacitación, obligaciones generales del
 * art. 134 y terminación). Es una PLANTILLA para que RH revise y complete antes de firmar, no
 * asesoría legal — los campos sin dato real quedan en blanco (líneas de subrayado) para que se
 * llenen a mano, nunca con un valor inventado.
 */
export const TIPOS_CONTRATO = {
  INDETERMINADO: "indeterminado",
  DETERMINADO: "determinado",
  OBRA: "obra",
};

export const ETIQUETA_TIPO_CONTRATO = {
  [TIPOS_CONTRATO.INDETERMINADO]: "Tiempo indeterminado",
  [TIPOS_CONTRATO.DETERMINADO]: "Tiempo determinado",
  [TIPOS_CONTRATO.OBRA]: "Obra determinada",
};

const RAYA = "________________________";

/** Texto o la raya de "falta llenar" — nunca un dato inventado. */
const campo = (valor) => {
  const v = (valor ?? "").toString().trim();
  return v || RAYA;
};

const money = (n) => {
  const num = Number(n);
  if (!Number.isFinite(num) || num <= 0) return RAYA;
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(num);
};

const formatFechaLarga = (iso) => {
  if (!iso) return RAYA;
  const f = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(f.getTime())) return RAYA;
  return f.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
};

/** El objeto de datos con el que arranca el formulario: solo lo que YA se sabe del empleado. */
export const datosContratoIniciales = (empleado = {}) => ({
  tipoContrato: TIPOS_CONTRATO.INDETERMINADO,
  fechaTermino: "",
  descripcionObra: "",

  razonSocialPatron: "McDental",
  domicilioPatron: "",
  representantePatron: "",

  nombreTrabajador: empleado.name || "",
  puesto: empleado.puesto || "",
  sucursal: normalizeSucursal(empleado.sucursal || "") || "",
  fechaIngreso: resolveFechaIngreso(empleado) || "",
  sueldoSemanal: empleado.sueldoSemanal ?? null,

  // Lo que se intenta llenar con la extracción de INE/CURP/RFC/comprobante (ver
  // GenerarContratoModal.jsx); vacío hasta entonces, nunca un valor de relleno.
  curp: "",
  rfc: "",
  fechaNacimiento: "",
  sexo: "",
  estadoCivil: "",
  nacionalidad: "Mexicana",
  domicilioCalleNumero: "",
  domicilioColonia: "",
  domicilioCP: "",
  domicilioCiudad: "",
  domicilioEstado: "",

  fechaContrato: new Date().toISOString().slice(0, 10),
});

const domicilioTrabajador = (d) => {
  const partes = [d.domicilioCalleNumero, d.domicilioColonia, d.domicilioCP, d.domicilioCiudad, d.domicilioEstado]
    .map((p) => (p || "").trim())
    .filter(Boolean);
  return partes.length ? partes.join(", ") : RAYA;
};

const textoDuracion = (d) => {
  if (d.tipoContrato === TIPOS_CONTRATO.DETERMINADO) {
    return (
      `La relación de trabajo será por TIEMPO DETERMINADO, con vigencia a partir del ` +
      `${formatFechaLarga(d.fechaIngreso)} y hasta el ${formatFechaLarga(d.fechaTermino)}, de conformidad ` +
      `con el artículo 37 de la Ley Federal del Trabajo, en razón de que la naturaleza del trabajo así lo justifica.`
    );
  }
  if (d.tipoContrato === TIPOS_CONTRATO.OBRA) {
    return (
      `La relación de trabajo será POR OBRA DETERMINADA, consistente en: ${campo(d.descripcionObra)}. ` +
      `El contrato concluirá al terminarse dicha obra, de conformidad con el artículo 36 de la Ley Federal del Trabajo.`
    );
  }
  return (
    `La relación de trabajo será por TIEMPO INDETERMINADO, iniciando el ${formatFechaLarga(d.fechaIngreso)}. ` +
    `Los primeros 30 días naturales se consideran periodo a prueba en términos del artículo 39-A de la Ley ` +
    `Federal del Trabajo, al término del cual, de no acreditar "EL TRABAJADOR" satisfacer los requisitos del ` +
    `puesto a juicio de "EL PATRÓN", podrá darse por terminada la relación de trabajo sin responsabilidad ` +
    `para éste último.`
  );
};

/**
 * Las cláusulas del cuerpo del contrato, ya con los datos interpolados. Un mismo array
 * alimenta tanto la vista previa en pantalla (GenerarContratoModal.jsx) como el PDF
 * (contratoPdf.js), para que nunca puedan decir cosas distintas.
 */
export const clausulasContrato = (d) => [
  {
    titulo: "PRIMERA. Objeto",
    texto:
      `"EL TRABAJADOR" se obliga a prestar a "EL PATRÓN" sus servicios personales subordinados en el ` +
      `puesto de ${campo(d.puesto)}, comprometiéndose a desempeñarlo con esmero, dedicación y eficiencia, ` +
      `así como las demás labores compatibles y conexas que le sean encomendadas por sus superiores.`,
  },
  { titulo: "SEGUNDA. Duración", texto: textoDuracion(d) },
  {
    titulo: "TERCERA. Lugar de prestación de servicios",
    texto:
      `"EL TRABAJADOR" prestará sus servicios en las instalaciones de "EL PATRÓN" ubicadas en ` +
      `${campo(d.domicilioPatron)}, correspondientes a la sucursal ${campo(d.sucursal)}, o en cualquier otro ` +
      `centro de trabajo de "EL PATRÓN" al que sea necesario trasladarlo, previo aviso.`,
  },
  {
    titulo: "CUARTA. Jornada de trabajo",
    texto:
      `"EL TRABAJADOR" prestará sus servicios en el horario que "EL PATRÓN" le asigne conforme a los ` +
      `turnos vigentes de la sucursal, sin exceder los máximos legales establecidos en el artículo 61 de la ` +
      `Ley Federal del Trabajo.`,
  },
  {
    titulo: "QUINTA. Salario",
    texto:
      `"EL PATRÓN" pagará a "EL TRABAJADOR" un salario semanal de ${money(d.sueldoSemanal)}, mismo que se ` +
      `cubrirá en la forma y periodicidad que la empresa tiene establecidas, y que en ningún caso será ` +
      `inferior al salario mínimo general vigente.`,
  },
  {
    titulo: "SEXTA. Día de descanso",
    texto:
      `"EL TRABAJADOR" disfrutará de un día de descanso con goce de salario íntegro por cada seis días de ` +
      `trabajo, conforme a los artículos 69 y 71 de la Ley Federal del Trabajo.`,
  },
  {
    titulo: "SÉPTIMA. Vacaciones y prima vacacional",
    texto:
      `"EL TRABAJADOR" gozará del periodo vacacional y la prima vacacional del 25% que establecen los ` +
      `artículos 76 y 80 de la Ley Federal del Trabajo, conforme a su antigüedad.`,
  },
  {
    titulo: "OCTAVA. Aguinaldo",
    texto:
      `"EL PATRÓN" cubrirá a "EL TRABAJADOR" un aguinaldo anual equivalente a 15 días de salario como mínimo, ` +
      `pagadero antes del 20 de diciembre de cada año, conforme al artículo 87 de la Ley Federal del Trabajo.`,
  },
  {
    titulo: "NOVENA. Capacitación y adiestramiento",
    texto:
      `"EL TRABAJADOR" tiene derecho a que "EL PATRÓN" le proporcione capacitación y adiestramiento en los ` +
      `términos del Capítulo III Bis del Título Cuarto de la Ley Federal del Trabajo.`,
  },
  {
    titulo: "DÉCIMA. Obligaciones generales",
    texto:
      `Ambas partes se sujetan a las obligaciones y prohibiciones que señalan los artículos 134 y 135 de la ` +
      `Ley Federal del Trabajo, así como al Reglamento Interior de Trabajo de "EL PATRÓN".`,
  },
  {
    titulo: "UNDÉCIMA. Terminación de la relación laboral",
    texto:
      `La relación de trabajo podrá darse por terminada por cualquiera de las causas previstas en los ` +
      `artículos 46, 47, 51 y 53 de la Ley Federal del Trabajo, sin más responsabilidad que la ahí señalada.`,
  },
];

export { domicilioTrabajador, formatFechaLarga, campo, money, RAYA };
