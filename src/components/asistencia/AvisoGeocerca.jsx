import React from "react";
import { useNavigate } from "react-router-dom";
import Card from "../common/Card";
import Icon from "../ui/Icon";

/**
 * El aviso de "tu clínica todavía no tiene ubicación", para recepción.
 *
 * Sin botón de cerrar, a diferencia de AvisoPush y AvisoUbicacion: aquellos ofrecen algo que
 * mejora la experiencia de quien los ve, y negarse es una respuesta legítima. Este no va de
 * ella — va de que las checadas de toda su clínica se están guardando sin ubicación. Cerrarlo
 * no cambiaría el hecho, solo lo escondería.
 *
 * El texto repite DÓNDE hay que estar al pulsarlo porque es el error caro: una ubicación
 * capturada desde casa deja a la clínica entera sin poder fichar al día siguiente.
 */
// `ruta` viene del layout y no se deduce aquí: la misma pantalla vive en /empleado/miclinica y
// en /doctor/miclinica, y adivinarla mandaría a la doctora a una ruta que no existe para ella.
export default function AvisoGeocerca({ nombreClinica, ruta }) {
  const navigate = useNavigate();

  return (
    <Card className="avisopush avisogeocerca">
      <div className="avisopush-head">
        <Icon name="mapPin" size={20} />
        <strong>Falta registrar la ubicación de {nombreClinica || "tu clínica"}</strong>
      </div>

      <p className="avisopush-texto">
        Mientras no esté registrada, las checadas de tu clínica se guardan sin ubicación. Es una
        sola vez y toma un minuto — pero hay que pulsarlo <strong>estando dentro de la clínica</strong>:
        si se guarda desde otro lugar, mañana nadie de aquí podrá checar.
      </p>

      <button
        type="button"
        className="checador-boton checador-boton--entrada"
        onClick={() => navigate(ruta)}
      >
        <Icon name="mapPin" size={18} /> Registrar la ubicación
      </button>
    </Card>
  );
}
