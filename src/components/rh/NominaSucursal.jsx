import logoMcDental from "../../assets/logos/mcdental-logo.png";
import { money } from "../../utils/nomina";
import Icon from "../ui/Icon";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const formatFecha = (iso) => {
  if (!iso) return "—";
  // Ancla a mediodía: mismo motivo que en AcuerdoConformidad.jsx / ReciboFiniquito.jsx.
  const d = new Date(`${iso}T12:00:00`);
  return `${d.getDate()} de ${MESES[d.getMonth()]}`;
};

/**
 * Hoja de nómina de UNA sucursal: no es un recibo por persona (eso ya lo cubre
 * AcuerdoConformidad.jsx) — es la lista completa de la oficina en una sola hoja, para que
 * RH la revise o la archive de un vistazo.
 *
 * Dos modos, MISMO marcado (mismo componente, mismas clases de App.css) — así lo que se ve
 * en el paso de comentarios es literalmente la misma hoja que sale impresa, no una imitación:
 *  · impresión (por defecto): vive fuera de flujo vía `.nomina-imprimir-area`, solo en el DOM
 *    mientras se imprime (ver Nomina.jsx).
 *  · `editable`: se monta normal, en un modal, y la celda de Comentarios es un <input> en vez
 *    de texto — para escribir el comentario de cada quien viendo ya el mismo diseño del papel.
 */
export default function NominaSucursal({ sucursal, recibos, desde, hasta, comentarios = {}, editable = false, onCambiarComentario, onQuitarEmpleado }) {
  const totalSueldo = recibos.reduce((suma, { recibo }) => suma + (recibo.sinSueldo ? 0 : recibo.sueldo), 0);
  const totalConDescuentos = recibos.reduce((suma, { recibo }) => suma + (recibo.sinSueldo ? 0 : recibo.pagoFinal), 0);
  const anio = desde ? new Date(`${desde}T12:00:00`).getFullYear() : new Date().getFullYear();

  const hoja = (
    <div className="nomina-acuerdo nomina-sucursal-hoja">
      <div className="nomina-sucursal-encabezado">
        <div className="nomina-sucursal-marca">
          <img src={logoMcDental} alt="McDental" />
        </div>
        <div className="nomina-sucursal-titulo">
          <div>Nómina semanal</div>
          <div>Oficina {sucursal}</div>
          <div>RH</div>
          <div>{anio}</div>
        </div>
        <div className="nomina-sucursal-fecha">
          {formatFecha(desde)} – {formatFecha(hasta)}
        </div>
      </div>

      <table className="nomina-sucursal-tabla">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Nómina</th>
            <th>Comentarios</th>
            <th>Descuentos</th>
            <th>Total con descuentos</th>
          </tr>
        </thead>
        <tbody>
          {recibos.map(({ empleado, recibo }) => (
            <tr key={empleado.id}>
              <td>
                {editable ? (
                  <span className="nomina-sucursal-nombre-editable">
                    <span>{empleado.name}</span>
                    <button
                      type="button"
                      className="nomina-sucursal-quitar-btn"
                      onClick={() => onQuitarEmpleado(empleado.id)}
                      title={`Quitar a ${empleado.name} de esta impresión`}
                      aria-label={`Quitar a ${empleado.name} de esta impresión`}
                    >
                      <Icon name="trash" size={13} />
                    </button>
                  </span>
                ) : empleado.name}
              </td>
              <td>{recibo.sinSueldo ? "Sin capturar" : money(recibo.sueldo)}</td>
              <td>
                {editable ? (
                  <input
                    type="text"
                    className="nomina-sucursal-comentario-input"
                    value={comentarios[empleado.id] || ""}
                    onChange={(e) => onCambiarComentario(empleado.id, e.target.value)}
                    aria-label={`Comentario para ${empleado.name}`}
                  />
                ) : (comentarios[empleado.id] || "")}
              </td>
              <td>{recibo.descuento > 0 ? money(recibo.descuento) : "—"}</td>
              <td>{recibo.sinSueldo ? "Sin capturar" : money(recibo.pagoFinal)}</td>
            </tr>
          ))}
          <tr className="nomina-sucursal-totales">
            <td>Total</td>
            <td>{money(totalSueldo)}</td>
            <td></td>
            <td></td>
            <td>{money(totalConDescuentos)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  if (editable) return hoja;
  return <div className="nomina-imprimir-area">{hoja}</div>;
}
