import { ETIQUETA_TIPO_CONTRATO, clausulasContrato, domicilioTrabajador, campo, formatFechaLarga } from "../../utils/contrato";

/**
 * El documento del contrato, ya interpolado con `datos` — el mismo texto que arma
 * contratoPdf.js para el archivo final. Vive dentro de GenerarContratoModal.jsx como vista
 * previa EN VIVO: cada campo que se llena arriba (a mano o por la extracción de IA) se ve
 * reflejado aquí de inmediato, en vez de un formulario aparte que no se parece al resultado
 * (mismo criterio que ya usa NominaSucursal.jsx con la nómina de sucursal).
 */
export default function ContratoLaboral({ datos }) {
  return (
    <div className="nomina-acuerdo contrato-hoja">
      <div className="nomina-acuerdo-header">
        <div className="nomina-acuerdo-titulo">CONTRATO INDIVIDUAL DE TRABAJO</div>
        <div className="nomina-acuerdo-subtitulo">{ETIQUETA_TIPO_CONTRATO[datos.tipoContrato]}</div>
      </div>

      <p className="contrato-parrafo">
        Contrato individual de trabajo que celebran, por una parte {campo(datos.razonSocialPatron)}, representada
        en este acto por {campo(datos.representantePatron)}, a quien en lo sucesivo se le denominará
        &ldquo;EL PATRÓN&rdquo;; y por la otra parte el(la) C. {campo(datos.nombreTrabajador)}, a quien en lo
        sucesivo se le denominará &ldquo;EL TRABAJADOR&rdquo;, quienes convienen en sujetarse al tenor de las
        siguientes declaraciones y cláusulas:
      </p>

      <h3 className="contrato-seccion-titulo">DECLARACIONES</h3>
      <p className="contrato-parrafo">
        I. Declara &ldquo;EL PATRÓN&rdquo;, por conducto de su representante, tener su domicilio en{" "}
        {campo(datos.domicilioPatron)}, y que requiere de los servicios de &ldquo;EL TRABAJADOR&rdquo; para el
        desempeño del puesto que se señala en la cláusula PRIMERA.
      </p>
      <p className="contrato-parrafo">
        II. Declara &ldquo;EL TRABAJADOR&rdquo; llamarse como ha quedado escrito, de nacionalidad{" "}
        {campo(datos.nacionalidad)}, nacido el {formatFechaLarga(datos.fechaNacimiento)}, de sexo{" "}
        {campo(datos.sexo)}, estado civil {campo(datos.estadoCivil)}, con CURP {campo(datos.curp)}, RFC{" "}
        {campo(datos.rfc)}, y con domicilio en {domicilioTrabajador(datos)}; que cuenta con la capacidad y los
        conocimientos necesarios para prestar sus servicios en el puesto materia de este contrato, y que es su
        voluntad obligarse en los términos del mismo.
      </p>

      <h3 className="contrato-seccion-titulo">CLÁUSULAS</h3>
      {clausulasContrato(datos).map((c) => (
        <p key={c.titulo} className="contrato-parrafo">
          <b>{c.titulo}.</b> {c.texto}
        </p>
      ))}

      <p className="contrato-parrafo">
        Leído que fue el presente contrato y enteradas las partes de su contenido y alcance legal, lo firman de
        conformidad en {campo(datos.sucursal)}, a {formatFechaLarga(datos.fechaContrato)}.
      </p>

      <div className="nomina-acuerdo-firmas">
        <div className="nomina-acuerdo-firma">
          <div className="nomina-acuerdo-firma-linea" />
          <span>&ldquo;EL PATRÓN&rdquo; — {campo(datos.representantePatron)}</span>
        </div>
        <div className="nomina-acuerdo-firma">
          <div className="nomina-acuerdo-firma-linea" />
          <span>&ldquo;EL TRABAJADOR&rdquo; — {campo(datos.nombreTrabajador)}</span>
        </div>
      </div>
    </div>
  );
}
