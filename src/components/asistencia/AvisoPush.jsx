import { useState } from "react";
import Card from "../common/Card";
import Icon from "../ui/Icon";
import { instalada } from "../../services/pushService";

/**
 * La invitación a activar las notificaciones, y —cuando hace falta— cómo instalar la app.
 *
 * EL OBSTÁCULO QUE ESTA PANTALLA EXISTE PARA RESOLVER: en iPhone, el push SOLO funciona si la app
 * está en la pantalla de inicio. En una pestaña de Safari, la API de push NO EXISTE — no es que
 * el permiso esté denegado, es que el objeto entero falta. No hay nada que el código pueda hacer
 * para saltárselo: el paso de instalar lo tiene que dar la persona.
 *
 * Por eso esto no es un adorno: sin explicar la instalación, en iPhone no llega nunca ningún
 * aviso y nadie entiende por qué. Se detecta si la app está instalada y, si no, se enseña cómo
 * —con pasos distintos para iPhone y Android, porque el gesto es distinto en cada uno—.
 */

const esIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  // El iPad moderno se hace pasar por Mac; se le reconoce porque es un Mac con pantalla táctil.
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export default function AvisoPush({ onActivar, onCerrar }) {
  const [comoInstalar, setComoInstalar] = useState(false);

  // La app NO está instalada: en iPhone el push no existe hasta que lo esté. Antes de ofrecer
  // "activar" (que fallaría en silencio), se explica el paso que falta.
  if (!instalada() && esIOS()) {
    return (
      <Card className="avisopush">
        <div className="avisopush-head">
          <Icon name="bell" size={20} />
          <strong>Recibe tus avisos en el teléfono</strong>
          <button type="button" className="avisopush-cerrar" onClick={onCerrar} aria-label="Cerrar">
            <Icon name="minus" size={16} />
          </button>
        </div>

        <p className="avisopush-texto">
          Para que las notificaciones lleguen a tu iPhone, primero agrega la app a tu pantalla de
          inicio. Es un momento:
        </p>

        {comoInstalar ? (
          <ol className="avisopush-pasos">
            <li>Abre esta página en <strong>Safari</strong> (no en otro navegador).</li>
            <li>Toca el botón <strong>Compartir</strong> (el cuadrito con la flecha hacia arriba, abajo en la pantalla).</li>
            <li>Baja y elige <strong>“Agregar a inicio”</strong>.</li>
            <li>Abre la app desde el ícono nuevo y vuelve aquí.</li>
          </ol>
        ) : (
          <button type="button" className="checador-boton checador-boton--entrada" onClick={() => setComoInstalar(true)}>
            <Icon name="camera" size={18} /> Ver cómo se hace
          </button>
        )}
      </Card>
    );
  }

  // En Android (o iPhone ya instalado), el push funciona: se ofrece activarlo directo.
  return (
    <Card className="avisopush">
      <div className="avisopush-head">
        <Icon name="bell" size={20} />
        <strong>¿Quieres recibir tus avisos aquí?</strong>
        <button type="button" className="avisopush-cerrar" onClick={onCerrar} aria-label="Cerrar">
          <Icon name="minus" size={16} />
        </button>
      </div>

      <p className="avisopush-texto">
        Te avisamos cuando aprueben tu rostro o un permiso, sin que tengas que entrar a revisar.
        {!instalada() && " Si además agregas la app a tu inicio, los avisos son más fiables."}
      </p>

      <button type="button" className="checador-boton checador-boton--entrada" onClick={onActivar}>
        <Icon name="bell" size={18} /> Activar avisos
      </button>
    </Card>
  );
}
