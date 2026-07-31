import React, { useCallback, useEffect, useState } from "react";
import Card from "../common/Card";
import Icon from "../ui/Icon";
import { useNotification } from "../../contexts/NotificationContext";
import {
  PERMISOS,
  consultarTodos,
  pedirPermiso,
  comoReactivar,
} from "../../utils/permisosDispositivo";

const ETIQUETA = {
  granted: { texto: "Activado", variante: "activo" },
  denied: { texto: "Bloqueado", variante: "rechazado" },
  prompt: { texto: "Sin activar", variante: "inactivo" },
  "no-soportado": { texto: "No disponible aquí", variante: "inactivo" },
};

/**
 * Los permisos del dispositivo, en Mi perfil.
 *
 * Existe porque el aviso de push ya prometía "puedes activarlos luego desde tu perfil" y ese
 * sitio no existía. Y sobre todo porque sin el permiso de ubicación el botón de fichar se
 * queda muerto sin decir por qué (ChecadorEmpleado: sin ubicación => sin_gps => bloqueado).
 *
 * Cada estado se lee del navegador, no se guarda: el permiso es del dispositivo, no de la
 * cuenta. La misma persona puede tenerlo dado en su teléfono y no en la computadora de la
 * clínica, y guardarlo en su fila mentiría en una de las dos.
 */
export default function PermisosDispositivo() {
  const { toast } = useNotification();
  const [estados, setEstados] = useState(null);
  const [pidiendo, setPidiendo] = useState(null);

  const refrescar = useCallback(async () => {
    setEstados(await consultarTodos());
  }, []);

  useEffect(() => {
    let vivo = true;
    consultarTodos().then((e) => { if (vivo) setEstados(e); });
    // Al volver de los ajustes del navegador el estado pudo cambiar sin que la página se
    // recargue: se vuelve a mirar cuando la pestaña recupera el foco.
    const alVolver = () => { if (document.visibilityState === "visible") refrescar(); };
    document.addEventListener("visibilitychange", alVolver);
    return () => { vivo = false; document.removeEventListener("visibilitychange", alVolver); };
  }, [refrescar]);

  const activar = async (id) => {
    setPidiendo(id);
    try {
      const resultado = await pedirPermiso(id);
      await refrescar();
      if (resultado === "granted") toast.success(`${PERMISOS[id].nombre}: listo.`);
      else if (resultado === "denied") toast.info(`${PERMISOS[id].nombre} está bloqueado en este navegador. Abajo te digo cómo reactivarlo.`);
    } finally {
      setPidiendo(null);
    }
  };

  if (!estados) return null;

  return (
    <Card className="perfil-info-card">
      <div className="perfil-info-title">
        <Icon name="settings" size={16} />
        <span>Permisos del dispositivo</span>
      </div>
      <p className="perfil-info-note" style={{ marginBottom: 12 }}>
        Son permisos de este navegador, no de tu cuenta: si entras desde otro teléfono o
        computadora, hay que darlos otra vez ahí.
      </p>

      <ul className="permisos-lista">
        {Object.values(PERMISOS).map((permiso) => {
          const estado = estados[permiso.id];
          const etiqueta = ETIQUETA[estado] || ETIQUETA.prompt;
          return (
            <li key={permiso.id} className="permisos-item">
              <span className="permisos-item-icono"><Icon name={permiso.icono} size={18} /></span>

              <div className="permisos-item-texto">
                <div className="permisos-item-nombre">
                  {permiso.nombre}
                  {permiso.bloquea && estado !== "granted" && (
                    <span className="permisos-item-critico">Necesario para fichar</span>
                  )}
                </div>
                <div className="permisos-item-porque">{permiso.porQue}</div>
                {estado === "denied" && (
                  <div className="permisos-item-ayuda">
                    <Icon name="alert" size={13} /> {comoReactivar()}
                  </div>
                )}
              </div>

              <div className="permisos-item-accion">
                <span className={`mc-status-pill mc-status-pill--${etiqueta.variante}`}>
                  {etiqueta.texto}
                </span>
                {estado === "prompt" && (
                  <button
                    type="button"
                    className="perfil-foto-btn perfil-foto-btn--ghost"
                    disabled={pidiendo === permiso.id}
                    onClick={() => activar(permiso.id)}
                  >
                    {pidiendo === permiso.id ? "Pidiendo..." : "Activar"}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
