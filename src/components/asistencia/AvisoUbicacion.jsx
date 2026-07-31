import React from "react";
import Card from "../common/Card";
import Icon from "../ui/Icon";
import { comoReactivar } from "../../utils/permisosDispositivo";

/**
 * El aviso de ubicación. Dos caras según por qué falta:
 *
 * - 'prompt': nunca se preguntó. Un botón basta.
 * - 'denied': ya se dijo que no, y el navegador NO deja volver a preguntar por código. Un
 *   botón aquí no haría nada, así que se enseña la ruta de los ajustes en su lugar. Poner un
 *   botón que no funciona es peor que no ponerlo: la persona lo pulsa, no pasa nada, y concluye
 *   que la app está rota.
 */
export default function AvisoUbicacion({ estado, onActivar, onCerrar }) {
  const bloqueado = estado === "denied";

  return (
    <Card className="avisopush avisoubicacion">
      <div className="avisopush-head">
        <Icon name="pin" size={20} />
        <strong>{bloqueado ? "Tu ubicación está bloqueada" : "Activa tu ubicación para poder fichar"}</strong>
        <button type="button" className="avisopush-cerrar" onClick={onCerrar} aria-label="Cerrar">
          <Icon name="minus" size={16} />
        </button>
      </div>

      <p className="avisopush-texto">
        {bloqueado
          ? "Sin ubicación, el botón de registrar entrada y salida no se activa. Este navegador la tiene bloqueada, así que hay que reactivarla a mano:"
          : "La app necesita saber que estás en tu clínica para registrar tu entrada y tu salida. Sin este permiso el botón de fichar no se activa."}
      </p>

      {bloqueado ? (
        <p className="avisopush-texto avisoubicacion-ayuda">
          <Icon name="alert" size={14} /> {comoReactivar()}
        </p>
      ) : (
        <button type="button" className="checador-boton checador-boton--entrada" onClick={onActivar}>
          <Icon name="pin" size={18} /> Activar mi ubicación
        </button>
      )}
    </Card>
  );
}
