import { useEffect, useState } from "react";
import PageHeader from "../common/PageHeader";
import Card from "../common/Card";
import Icon from "../ui/Icon";
import { useNotification } from "../../contexts/NotificationContext";
import { getSucursales, fijarGeocercaMiSucursal } from "../../services/supabase/sucursalesService";
import { obtenerUbicacion } from "../../utils/geo";

/**
 * Recepción fija la ubicación de su propia clínica.
 *
 * POR QUÉ EXISTE: la ubicación se captura ESTANDO en la clínica, no sacándola de un mapa —
 * una geocerca puesta a ojo desde una vista aérea acaba rechazando a quien sí está en su
 * sitio. Hasta ahora eso solo se podía hacer desde la pantalla de admin, o sea viajando a
 * 25 clínicas. Quien trabaja ahí lo resuelve en diez segundos.
 *
 * LO QUE ESTÁ EN JUEGO, y por eso la pantalla insiste tanto: estar "fuera" BLOQUEA la
 * checada. Una ubicación capturada desde casa o desde el estacionamiento no es un dato
 * impreciso: es toda la clínica sin poder fichar a la mañana siguiente. De ahí que el texto
 * no diga "captura tu ubicación" sino dónde hay que estar parada al hacerlo.
 *
 * El radio NO se toca desde aquí: lo ajusta gestión desde admin.
 */
export default function MiClinica({ user }) {
  const { toast } = useNotification();
  const [sucursal, setSucursal] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let activo = true;
    getSucursales()
      .then((rows) => {
        if (!activo) return;
        // `usuarios.sucursal` es el NOMBRE de la clínica (texto, sin FK), la misma pareja que
        // usa la RPC del servidor para resolverla. Si no empareja, es que a esta persona le
        // falta la sucursal o está mal escrita: se dice, en vez de enseñar una pantalla muda.
        setSucursal(rows.find((s) => s.nombre === user?.sucursal) || null);
      })
      .catch((e) => { if (activo) toast.error(e?.message || "No se pudo cargar tu clínica."); })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [user?.sucursal, toast]);

  const usarMiUbicacion = async () => {
    setGuardando(true);
    try {
      const coords = await obtenerUbicacion();
      if (!coords) {
        toast.error("No se pudo obtener tu ubicación. Revisa el permiso de ubicación del navegador.");
        return;
      }

      // El servidor vuelve a comprobar esto (la RPC rechaza > 100 m). Se comprueba también aquí
      // para no hacerle esperar un viaje de ida y vuelta cuando ya se sabe que va a fallar.
      if (coords.precision > 100) {
        toast.warning(
          `Tu GPS solo tiene ${coords.precision} m de precisión. Acércate a una ventana o sal un momento e inténtalo otra vez.`
        );
        return;
      }

      const actualizada = await fijarGeocercaMiSucursal({
        lat: coords.lat,
        lng: coords.lng,
        precision: coords.precision,
      });
      setSucursal(actualizada);
      toast.success(`Listo. Se guardó la ubicación de ${actualizada.nombre} (±${coords.precision} m).`);
    } catch (e) {
      toast.error(e?.message || "No se pudo guardar la ubicación.");
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <div className="admin-page">
        <PageHeader icon="mapPin" title="Ubicación de mi clínica" />
        <Card><p className="mc-empty">Cargando…</p></Card>
      </div>
    );
  }

  if (!sucursal) {
    return (
      <div className="admin-page">
        <PageHeader icon="mapPin" title="Ubicación de mi clínica" />
        <Card>
          <p className="mc-empty">
            No encontramos tu clínica{user?.sucursal ? ` ("${user.sucursal}")` : ""}. Avisa a
            administración para que revisen tu sucursal asignada.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <PageHeader
        icon="mapPin"
        title="Ubicación de mi clínica"
        subtitle={sucursal.nombre}
      />

      <Card>
        <p className="mc-hint">
          <Icon name="alert" size={15} />
          <span>
            Haz esto <strong>parada dentro de la clínica</strong>, no en la calle ni en el
            estacionamiento. Esta ubicación es la que decide quién puede checar: si se guarda
            desde otro lugar, mañana nadie de tu clínica podrá registrar su entrada.
          </span>
        </p>
      </Card>

      <Card>
        <div className="rh-data-row">
          <div className="rh-data-row-main">
            <div className="rh-data-row-title">{sucursal.nombre}</div>
            {sucursal.tieneGeocerca && (
              <div className="rh-data-row-sub">
                {sucursal.lat.toFixed(5)}, {sucursal.lng.toFixed(5)}
                {sucursal.precisionM != null ? ` · ±${sucursal.precisionM} m` : ""}
              </div>
            )}
          </div>
          <div className="rh-data-row-status">
            {sucursal.tieneGeocerca ? (
              <span className="mc-status-pill mc-status-pill--aprobado">Configurada</span>
            ) : (
              <span className="mc-status-pill mc-status-pill--pendiente">Sin configurar</span>
            )}
          </div>
          <div className="rh-data-row-actions">
            <button
              type="button"
              className="mc-btn-primary mc-btn-with-icon"
              onClick={usarMiUbicacion}
              disabled={guardando}
            >
              <Icon name="mapPin" size={16} />
              {guardando
                ? "Obteniendo…"
                : sucursal.tieneGeocerca
                  ? "Volver a capturar"
                  : "Usar mi ubicación actual"}
            </button>
          </div>
        </div>
      </Card>

      {sucursal.tieneGeocerca && (
        <Card>
          <p className="mc-hint">
            <Icon name="alert" size={15} />
            <span>
              ¿La capturaste sin querer desde otro lugar? Púlsalo otra vez estando dentro de la
              clínica y se corrige. Cada cambio queda registrado.
            </span>
          </p>
        </Card>
      )}
    </div>
  );
}
