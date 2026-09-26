import { money } from "../../utils/nomina";

const TEXTO_CONFORMIDAD =
  'Por medio del presente declaro haber recibido de conformidad la cantidad señalada, por ' +
  "concepto de pago de sueldo del periodo indicado, manifestando estar de acuerdo con el " +
  "monto, los conceptos y las deducciones aplicadas, sin tener nada que reclamar por este " +
  "concepto.";

const formatFecha = (iso) => {
  if (!iso) return "—";
  // Ancla a mediodía: "YYYY-MM-DD" se interpreta como medianoche UTC y en un huso detrás de
  // UTC (todo México) el día se corre uno hacia atrás si no se ancla (mismo motivo que
  // formatFechaIngreso en utils/helpers.js).
  return new Date(`${iso}T12:00:00`).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

/**
 * Recibo de conformidad de pago: NO es un CFDI de nómina (la app no maneja RFC ni timbrado
 * con el SAT — ver openwiki). Es un acuse interno, para que quede constancia firmada de que la
 * persona recibió su pago semanal y está de acuerdo con el monto — sirve como evidencia si
 * algún día hay un conflicto laboral, no sustituye una obligación fiscal.
 *
 * Vive fuera del flujo normal de la pantalla: solo aparece en el DOM (y solo se ve) durante
 * `window.print()`, vía `.nomina-imprimir-area` en App.css (el truco clásico de
 * visibility:hidden en todo excepto este contenedor). Colores fijos en negro sobre blanco a
 * propósito: es un papel que alguien firma a mano, no debe salir con el tema oscuro de la app.
 *
 * `editable`: se monta normal, en un modal (SeleccionarSemanaAcuerdoModal), sin el envoltorio
 * `.nomina-imprimir-area` — mismo componente y mismas clases que el papel real, para que la
 * vista previa de "qué semana imprimir" sea literalmente el mismo diseño y no un resumen aparte.
 */
export default function AcuerdoConformidad({ acuerdos, desde, hasta, editable = false }) {
  const contenido = (
    <>
      {acuerdos.map(({ empleado, recibo }) => {
        // Montos por concepto ya sumados por calcularNomina() (utils/nomina.js): la tasa de
        // retardo cambia por persona y la falta es el sueldo diario de cada quien, así que
        // recalcularlos aquí sería la forma de que el papel y la pantalla discrepen.
        const { montoRetardos, montoFaltas, montoSalidas } = recibo;

        return (
          <div key={empleado.id} className="nomina-acuerdo">
            <div className="nomina-acuerdo-header">
              <div className="nomina-acuerdo-titulo">McDental Pulse</div>
              <div className="nomina-acuerdo-subtitulo">Recibo de conformidad de pago</div>
              <div className="nomina-acuerdo-periodo">
                Periodo del {formatFecha(desde)} al {formatFecha(hasta)}
              </div>
            </div>

            <table className="nomina-acuerdo-datos">
              <tbody>
                <tr>
                  <th>Nombre</th>
                  <td>{empleado.name}</td>
                </tr>
                <tr>
                  <th>Puesto</th>
                  <td>{empleado.puesto || "—"}</td>
                </tr>
                <tr>
                  <th>Sucursal</th>
                  <td>{empleado.sucursal || "—"}</td>
                </tr>
              </tbody>
            </table>

            <table className="nomina-acuerdo-desglose">
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th>Monto</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Sueldo semanal</td>
                  <td>{recibo.sinSueldo ? "Sin capturar" : money(recibo.sueldo)}</td>
                </tr>
                <tr>
                  <td>Descuento por retardos ({recibo.retardos})</td>
                  <td>{montoRetardos > 0 ? `− ${money(montoRetardos)}` : money(0)}</td>
                </tr>
                <tr>
                  <td>Descuento por faltas ({recibo.faltas})</td>
                  <td>{montoFaltas > 0 ? `− ${money(montoFaltas)}` : money(0)}</td>
                </tr>
                <tr>
                  <td>Descuento por salidas anticipadas ({recibo.salidasAnticipadas})</td>
                  <td>{montoSalidas > 0 ? `− ${money(montoSalidas)}` : money(0)}</td>
                </tr>
                <tr className="nomina-acuerdo-total">
                  <td>Pago neto</td>
                  <td>{recibo.sinSueldo ? "Sin capturar" : money(recibo.pagoFinal)}</td>
                </tr>
              </tbody>
            </table>

            <p className="nomina-acuerdo-texto">{TEXTO_CONFORMIDAD}</p>

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
        );
      })}
    </>
  );

  if (editable) return contenido;
  return <div className="nomina-imprimir-area">{contenido}</div>;
}
