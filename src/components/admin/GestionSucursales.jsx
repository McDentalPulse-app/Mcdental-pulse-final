import { useEffect, useState } from "react";
import PageHeader from "../common/PageHeader";
import Card from "../common/Card";
import Icon from "../ui/Icon";
import { useNotification } from "../../contexts/NotificationContext";
import { getSucursales, updateGeocercaSucursal, crearSucursal, eliminarSucursal } from "../../services/supabase/sucursalesService";
import { obtenerUbicacion } from "../../utils/geo";
import { useGlobal } from "../../contexts/GlobalContext";

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
  const { toast, confirm } = useNotification();
  // El estado global también guarda las sucursales (alimenta los desplegables de toda la app):
  // al crear una nueva hay que refrescar AMBAS listas para que aparezca al instante en los selects.
  const { setSucursales: setSucursalesGlobal } = useGlobal();
  const [sucursales, setSucursales] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(null); // id de la sucursal en curso
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [creando, setCreando] = useState(false);
  const [borrando, setBorrando] = useState(null); // id de la sucursal que se está eliminando

  const agregar = async () => {
    const nombre = nuevoNombre.trim();
    if (!nombre) { toast.warning("Escribe el nombre de la sucursal."); return; }
    setCreando(true);
    try {
      const nueva = await crearSucursal({ nombre });
      const ordenar = (lista) => [...lista, nueva].sort((a, b) => a.nombre.localeCompare(b.nombre));
      setSucursales(ordenar);
      setSucursalesGlobal(ordenar);
      setNuevoNombre("");
      toast.success(`Sucursal "${nueva.nombre}" agregada. Configura su ubicación cuando estés ahí.`);
    } catch (e) {
      toast.error(e?.message || "No se pudo crear la sucursal.");
    } finally {
      setCreando(false);
    }
  };

  useEffect(() => {
    let activo = true;
    getSucursales()
      .then((rows) => { if (activo) setSucursales(rows); })
      .catch((e) => { if (activo) toast.error(e?.message || "No se pudieron cargar las sucursales."); })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [toast]);

  // El borrado es de verdad (no un archivado), así que la confirmación nombra la clínica y
  // el servicio aborta si quedan empleados o checadas colgando de ella.
  const eliminar = async (sucursal) => {
    const confirmar = await confirm({
      title: "Eliminar sucursal",
      description: `¿Deseas eliminar "${sucursal.nombre}"? Esta acción no se puede deshacer.`,
      variant: "danger",
      confirmText: "Eliminar",
    });
    if (!confirmar) return;

    setBorrando(sucursal.id);
    try {
      await eliminarSucursal({ id: sucursal.id, nombre: sucursal.nombre });
      const sinElla = (lista) => lista.filter((s) => s.id !== sucursal.id);
      setSucursales(sinElla);
      setSucursalesGlobal(sinElla);
      toast.success(`Sucursal "${sucursal.nombre}" eliminada.`);
    } catch (e) {
      toast.error(e?.message || "No se pudo eliminar la sucursal.");
    } finally {
      setBorrando(null);
    }
  };

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
          <span>
            Pulsa <strong>Usar mi ubicación actual</strong> estando dentro de la clínica. Las que
            no tengan ubicación siguen funcionando: sus checadas se registran, pero sin comprobar
            dónde se hicieron.
          </span>
        </p>
      </Card>

      <Card>
        <div className="mc-form-group">
          <label className="mc-form-label" htmlFor="nueva-sucursal">Agregar sucursal</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              id="nueva-sucursal"
              className="mc-form-input"
              style={{ flex: 1, minWidth: 200 }}
              type="text"
              placeholder="Nombre de la nueva clínica"
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") agregar(); }}
              disabled={creando}
            />
            <button type="button" className="mc-btn-primary mc-btn-with-icon" onClick={agregar} disabled={creando}>
              <Icon name="plus" size={16} /> {creando ? "Agregando…" : "Agregar"}
            </button>
          </div>
        </div>
      </Card>

      {cargando ? (
        <Card><p className="mc-empty">Cargando sucursales…</p></Card>
      ) : (
        // Mismo patrón que Asistencia/Permisos/Vacaciones: rh-data-list/rh-data-row en vez
        // de <table>, que en 25 sucursales solo haría scroll horizontal en el celular.
        <div className="rh-data-list">
          {sucursales.map((s) => (
            <div key={s.id} className="rh-data-row">
              <div className="rh-data-row-main">
                <div className="rh-data-row-title">{s.nombre}</div>
                {s.tieneGeocerca && (
                  <div className="rh-data-row-sub">{s.lat.toFixed(5)}, {s.lng.toFixed(5)}</div>
                )}
              </div>
              <div className="rh-data-row-meta">
                <label className="rh-data-row-meta-secondary" htmlFor={`radio-${s.id}`}>Radio</label>
                <select
                  id={`radio-${s.id}`}
                  className="mc-form-select"
                  value={s.radioM}
                  onChange={(e) => cambiarRadio(s, Number(e.target.value))}
                  disabled={!s.tieneGeocerca}
                >
                  {[5, 10, 15, 20, 50, 100, 150, 250, 500].map((r) => (
                    <option key={r} value={r}>{r} m</option>
                  ))}
                </select>
              </div>
              <div className="rh-data-row-status">
                {s.tieneGeocerca ? (
                  <span className="mc-status-pill mc-status-pill--aprobado">Configurada</span>
                ) : (
                  <span className="mc-status-pill mc-status-pill--pendiente">Sin configurar</span>
                )}
              </div>
              <div className="rh-data-row-actions">
                <button
                  type="button"
                  className="mc-btn-outline"
                  onClick={() => usarMiUbicacion(s)}
                  disabled={guardando === s.id}
                >
                  <Icon name="mapPin" size={15} />
                  {guardando === s.id ? "Obteniendo…" : "Usar mi ubicación actual"}
                </button>
                <button
                  type="button"
                  className="mc-btn-outline mc-btn-outline--danger"
                  onClick={() => eliminar(s)}
                  disabled={borrando === s.id}
                >
                  {borrando === s.id ? "Eliminando…" : "Eliminar"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
