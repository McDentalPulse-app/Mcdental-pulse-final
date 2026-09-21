import { money } from "../../utils/nomina";

const TITULO_TIPO = {
  finiquito: "Recibo de Finiquito",
  liquidacion: "Recibo de Liquidación",
  gratificacion: "Recibo de Gratificación (Aguinaldo)",
};

const TEXTO_CONFORMIDAD = {
  finiquito:
    "Por medio del presente declaro haber recibido de conformidad la cantidad señalada, por " +
    "concepto de finiquito de la relación laboral, manifestando estar de acuerdo con el monto, " +
    "los conceptos y las cantidades aquí desglosadas, sin tener nada más que reclamar por este " +
    "concepto ni por la relación de trabajo que aquí termina.",
  liquidacion:
    "Por medio del presente declaro haber recibido de conformidad la cantidad señalada, por " +
    "concepto de liquidación derivada de la terminación de la relación laboral, manifestando " +
    "estar de acuerdo con el monto, los conceptos y las cantidades aquí desglosadas, sin tener " +
    "nada más que reclamar por este concepto ni por la relación de trabajo que aquí termina.",
  gratificacion:
    "Por medio del presente declaro haber recibido de conformidad la cantidad señalada, por " +
    "concepto de gratificación anual (aguinaldo), manifestando estar de acuerdo con el monto y " +
    "el periodo aquí señalados.",
};

const formatFecha = (iso) => {
  if (!iso) return "—";
  // Ancla a mediodía: mismo motivo que AcuerdoConformidad.jsx — "YYYY-MM-DD" a medianoche UTC
  // corre un día hacia atrás en cualquier huso detrás de UTC (todo México).
  return new Date(`${iso}T12:00:00`).toLocaleDateString("es-MX", {
    day: "2-digit", month: "long", year: "numeric",
  });
};

/**
 * Recibo de finiquito / liquidación / gratificación — hermano de AcuerdoConformidad.jsx:
 * mismas clases de impresión (.nomina-imprimir-area, .nomina-acuerdo*), mismo mecanismo de
 * "solo existe para imprimirse". Se reutiliza la infraestructura de impresión ya resuelta ahí
 * (ver App.css, @media print) en vez de duplicarla.
 */
export default function ReciboFiniquito({ empleado, tipo, fecha, resultado, elaboradoPor }) {
  if (!empleado || !resultado) return null;

  const conceptos = [];
  if (tipo === "gratificacion") {
    conceptos.push([
      `Aguinaldo (${resultado.diasAguinaldo} días, proporcional a ${resultado.diasTrabajadosAnio} días trabajados en el año)`,
      money(resultado.montoAguinaldo),
    ]);
  } else {
    conceptos.push([`Días pendientes de pago (${resultado.diasPendientesPago})`, money(resultado.montoDiasPendientes)]);
    conceptos.push([`Vacaciones pendientes (${resultado.diasVacacionesPendientes} días)`, money(resultado.montoVacaciones)]);
    conceptos.push(["Prima vacacional (25%)", money(resultado.montoPrimaVacacional)]);
    conceptos.push([
      `Aguinaldo proporcional (${resultado.diasAguinaldo} días, ${resultado.diasTrabajadosAnio} días trabajados en el año)`,
      money(resultado.montoAguinaldo),
    ]);
    if (tipo === "liquidacion") {
      conceptos.push(["Indemnización constitucional (90 días)", money(resultado.montoIndemnizacion)]);
      conceptos.push([`20 días por año de servicio (${resultado.aniosAntiguedad} años)`, money(resultado.montoVeinteDias)]);
      conceptos.push([
        `Prima de antigüedad (12 días × ${resultado.aniosAntiguedad} años${resultado.primaAntiguedadTopada ? ", topada a 2 salarios mínimos" : ""})`,
        money(resultado.montoPrimaAntiguedad),
      ]);
    }
    if (resultado.otrasPercepciones > 0) {
      conceptos.push(["Otras percepciones", money(resultado.otrasPercepciones)]);
    }
  }

  return (
    <div className="nomina-imprimir-area">
      <div className="nomina-acuerdo recibo-finiquito">
        <div className="nomina-acuerdo-header">
          <div className="nomina-acuerdo-titulo">McDental Pulse</div>
          <div className="nomina-acuerdo-subtitulo">{TITULO_TIPO[tipo]}</div>
          <div className="nomina-acuerdo-periodo">
            {tipo === "gratificacion" ? "Fecha de pago" : "Fecha de salida"}: {formatFecha(fecha)}
          </div>
        </div>

        <table className="nomina-acuerdo-datos">
          <tbody>
            <tr><th>Nombre</th><td>{empleado.name}</td></tr>
            <tr><th>Puesto</th><td>{empleado.puesto || "—"}</td></tr>
            <tr><th>Sucursal</th><td>{empleado.sucursal || "—"}</td></tr>
            <tr><th>Fecha de ingreso</th><td>{formatFecha(empleado.fechaIngreso)}</td></tr>
            {tipo !== "gratificacion" && (
              <tr><th>Salario diario</th><td>{money(resultado.salarioDiario)}</td></tr>
            )}
          </tbody>
        </table>

        <table className="nomina-acuerdo-desglose">
          <thead>
            <tr><th>Concepto</th><th>Monto</th></tr>
          </thead>
          <tbody>
            {conceptos.map(([concepto, valor]) => (
              <tr key={concepto}><td>{concepto}</td><td>{valor}</td></tr>
            ))}
            <tr className="nomina-acuerdo-total">
              <td>Total</td>
              <td>{money(resultado.total ?? resultado.montoAguinaldo)}</td>
            </tr>
          </tbody>
        </table>

        <p className="nomina-acuerdo-texto">{TEXTO_CONFORMIDAD[tipo]}</p>

        <p className="nomina-acuerdo-elaborado">
          Elaborado por: {elaboradoPor || "—"} · {formatFecha(new Date().toISOString().slice(0, 10))}
        </p>

        <div className="nomina-acuerdo-firmas">
          <div className="nomina-acuerdo-firma">
            <div className="nomina-acuerdo-firma-linea" />
            <span>Nombre y firma del trabajador</span>
          </div>
          <div className="nomina-acuerdo-firma nomina-acuerdo-firma--huella">
            <div className="nomina-acuerdo-huella-caja" />
            <span>Huella digital</span>
          </div>
        </div>
      </div>
    </div>
  );
}
