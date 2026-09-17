import { useState } from "react";
import { useGlobal } from "../../contexts/GlobalContext";
import { formatClabe, formatTarjeta, tieneDatosBancarios, LEYENDA_RESPONSABILIDAD } from "../../utils/bancos";
import { formatFechaHoraClinica } from "../../utils/helpers";
import SectionTitle from "../common/SectionTitle";
import Icon from "../ui/Icon";

// Quién ve los datos bancarios en la ficha (decisión D2 del dueño, ver
// plans/plan-datos-bancarios.md). La psicóloga VE pero no edita — que no edite lo garantiza el
// trigger de la migración 163, no esta lista; aquí solo se decide qué se pinta.
//
// Esto es la segunda de dos barreras, no la única: un empleado o un doctor leen a sus
// compañeros por `usuarios_directorio`, que NO trae estas columnas, así que aunque este
// componente se montara para ellos no habría nada que enseñar. La comprobación de rol está
// para que la respuesta no dependa de recordar ese detalle.
const ROLES_QUE_VEN = ["admin", "admin_plus", "rh", "psicologa"];

const Campo = ({ label, valor, copiable }) => {
  const [copiado, setCopiado] = useState(false);

  // Copiar en vez de teclear: son 18 dígitos y el destino es una transferencia de dinero.
  // Teclearlos a mano es justo donde se cuela el error que nadie nota hasta el día de pago.
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(copiable);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      // navigator.clipboard no existe fuera de https ni en algunos navegadores viejos. No es
      // un error que merezca molestar: el número está a la vista y se puede seleccionar.
      setCopiado(false);
    }
  };

  return (
    <div className="banco-ficha-campo">
      <span className="banco-ficha-label">{label}</span>
      <span className="banco-ficha-valor">
        {valor}
        {copiable && (
          <button
            type="button"
            className="banco-ficha-copiar"
            onClick={copiar}
            title={`Copiar ${label.toLowerCase()}`}
            aria-label={`Copiar ${label.toLowerCase()}`}
          >
            <Icon name={copiado ? "check" : "clipboard"} size={14} />
          </button>
        )}
      </span>
    </div>
  );
};

/**
 * Datos bancarios del empleado dentro de su ficha (mig. 163). Solo lectura: quien los cambia
 * es la propia persona desde Mi perfil, y por eso la leyenda de responsabilidad se repite
 * aquí — es lo que RH necesita poder señalar cuando un depósito sale mal.
 */
export default function DatosBancariosFicha({ empleado, role }) {
  // La lista completa de usuarios ya está cargada en esta pantalla, así que resolver el uuid
  // del autor a un nombre no cuesta ninguna consulta.
  const { usuarios } = useGlobal();

  if (!ROLES_QUE_VEN.includes(role)) return null;

  const hay = tieneDatosBancarios(empleado);

  // El autor puede no resolverse: la columna es un uuid sin FK a propósito (ver mig. 163), así
  // que sobrevive a que esa persona se dé de baja. Cuando pasa, se dice — callarse el «por
  // quién» haría parecer que el cambio no tuvo autor, que es peor que decir que ya no está.
  const idAutor = empleado.datosBancariosActualizadoPor;
  const autor = idAutor ? usuarios.find((u) => u.id === idAutor) : null;
  const textoAutor = !idAutor ? "" : ` · por ${autor ? autor.name : "un usuario dado de baja"}`;

  return (
    <>
      <SectionTitle icon="dollar">Datos bancarios</SectionTitle>

      {!hay ? (
        <div className="detail-vacio">
          Sin capturar. Los captura la propia persona desde «Mi perfil».
        </div>
      ) : (
        <div className="banco-ficha">
          <Campo label="Banco" valor={empleado.banco || "Sin capturar"} />
          <Campo
            label="CLABE"
            valor={empleado.clabe ? formatClabe(empleado.clabe) : "Sin capturar"}
            copiable={empleado.clabe || null}
          />
          <Campo
            label="Tarjeta"
            valor={empleado.tarjeta ? formatTarjeta(empleado.tarjeta) : "Sin capturar"}
            copiable={empleado.tarjeta || null}
          />

          {/* D3/D4: el sello lo pone el trigger, así que esto es de fiar — el cliente no puede
              escribirlo. Se enseña el QUIÉN además del cuándo porque es la mitad útil del
              rastro: que la cuenta cambiara ayer importa poco; que la cambiara alguien que no
              es el titular lo es todo. Va con hora, no solo día, porque al revisar un depósito
              que salió mal lo que se busca es si fue antes o después de dispersar. */}
          {empleado.datosBancariosActualizadoEn && (
            <div className="banco-ficha-sello">
              <Icon name="clock" size={13} />
              Último cambio: {formatFechaHoraClinica(empleado.datosBancariosActualizadoEn)}
              {textoAutor}
            </div>
          )}

          <p className="banco-leyenda">
            <Icon name="alert" size={14} />
            <span>{LEYENDA_RESPONSABILIDAD}</span>
          </p>
        </div>
      )}
    </>
  );
}
