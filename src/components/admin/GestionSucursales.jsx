import { useEffect, useState } from "react";
import PageHeader from "../common/PageHeader";
import Card from "../common/Card";
import Icon from "../ui/Icon";
import { useNotification } from "../../contexts/NotificationContext";
import { getSucursales, updateGeocercaSucursal } from "../../services/supabase/sucursalesService";
import { obtenerUbicacion } from "../../utils/geo";

/**
 * Captura de la geocerca de cada clínica.
 *
 * Las coordenadas se toman ESTANDO en la clínica ("Usar mi ubicación actual"), no
 * sacándolas de un mapa. Una geocerca puesta a ojo desde una vista aérea acaba
 * rechazando a quien sí está en su sitio, y ese error se paga en llamadas a RH a las
 * ocho de la mañana.
 *
 * Mientras una clínica no tenga coordenadas, sus checadas se registran igual, marcadas
 * como 'sin_geocerca'. El checador es útil desde el día 1 y la geocerca se va activando
 * clínica por clínica.
 */
export default function GestionSucursales() {
  const { toast } = useNotification();
  const [sucursales, setSucursales] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(null); // id de la sucursal en curso

  useEffect(() => {
    let activo = true;
    getSucursales()
      .then((rows) => { if (activo) setSucursales(rows); })
      .catch((e) => { if (activo) toast.error(e?.message || "No se pudieron cargar las sucursales."); })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [toast]);

  const usarMiUbicacion = async (sucursal) => {
    setGuardando(sucursal.id);
    try {
      const coords = await obtenerUbicacion();
      if (!coords) {
        toast.error("No se pudo obtener tu ubicación. Revisa el permiso del navegador.");
        return;
      }

      // La precisión del GPS se enseña sin adornos: capturar la geocerca con 300 m de
      // incertidumbre es capturar un punto que no sirve, y más vale saberlo ahora que
      // cuando media plantilla aparezca "fuera de rango".
      if (coords.precision > 100) {
        toast.warning(`Tu GPS solo tiene ${coords.precision} m de precisión. Sal al exterior e inténtalo de nuevo.`);
        return;
      }

      const actualizada = await updateGeocercaSucursal({
        id: sucursal.id,
        lat: coords.lat,
        lng: coords.lng,
        radioM: sucursal.radioM,
      });
      setSucursales((prev) => prev.map((s) => (s.id === actualizada.id ? actualizada : s)));
      toast.success(`Ubicación de ${sucursal.nombre} guardada (±${coords.precision} m).`);
    } catch (e) {
      toast.error(e?.message || "No se pudo guardar la ubicación.");
    } finally {
      setGuardando(null);
    }
  };

  const cambiarRadio = async (sucursal, radioM) => {
    try {
      const actualizada = await updateGeocercaSucursal({
        id: sucursal.id,
        lat: sucursal.lat,
        lng: sucursal.lng,
        radioM,
      });
      setSucursales((prev) => prev.map((s) => (s.id === actualizada.id ? actualizada : s)));
    } catch (e) {
      toast.error(e?.message || "No se pudo guardar el radio.");
    }
  };

  const conGeocerca = sucursales.filter((s) => s.tieneGeocerca).length;

  return (
    <div className="admin-page">
      <PageHeader
        icon="mapPin"
        title="Sucursales"
        subtitle={`${conGeocerca} de ${sucursales.length} clínicas tienen ubicación configurada`}
      />

      <Card>
        <p className="mc-hint">
          <Icon name="alert" size={15} />
          Pulsa <strong>Usar mi ubicación actual</strong> estando dentro de la clínica. Las que no
          tengan ubicación siguen funcionando: sus checadas se registran, pero sin comprobar dónde
          se hicieron.
        </p>
      </Card>

      {cargando ? (
        <Card><p className="mc-empty">Cargando sucursales…</p></Card>
      ) : (
        <Card>
          <div className="asistencia-tabla-wrap">
            <table className="mc-table">
              <thead>
                <tr>
                  <th>Clínica</th>
                  <th>Ubicación</th>
                  <th>Radio</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sucursales.map((s) => (
                  <tr key={s.id}>
                    <td>{s.nombre}</td>
                    <td>
                      {s.tieneGeocerca ? (
                        <span className="mc-status-pill mc-status-pill--aprobado">
                          {s.lat.toFixed(5)}, {s.lng.toFixed(5)}
                        </span>
                      ) : (
                        <span className="mc-status-pill mc-status-pill--pendiente">Sin configurar</span>
                      )}
                    </td>
                    <td>
                      <select
                        value={s.radioM}
                        onChange={(e) => cambiarRadio(s, Number(e.target.value))}
                        disabled={!s.tieneGeocerca}
                      >
                        {[50, 100, 150, 250, 500].map((r) => (
                          <option key={r} value={r}>{r} m</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="mc-btn-outline"
                        onClick={() => usarMiUbicacion(s)}
                        disabled={guardando === s.id}
                      >
                        <Icon name="mapPin" size={15} />
                        {guardando === s.id ? "Obteniendo…" : "Usar mi ubicación actual"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
