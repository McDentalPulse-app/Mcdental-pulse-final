import { useState, useEffect } from "react";
import { useGlobal } from "../../contexts/GlobalContext";
import { useAuth } from "../../contexts/AuthContext";
import { useNotification } from "../../contexts/NotificationContext";
import { updateUsuario } from "../../services/supabase/usuariosService";
import { getModulosPersonaDe, setModuloPersona } from "../../services/supabase/modulosPersonaService";
import { NAV_ITEMS } from "../../config/navItems";
import { sucursalMatches } from "../../utils/constants";
import Card from "../common/Card";
import PageHeader from "../common/PageHeader";
import FilterBar from "../common/FilterBar";
import Select from "../common/Select";
import Icon from "../ui/Icon";

// Permisos que NO son "esconder un ítem del menú" (no hay una página que apagar), son
// comportamiento aparte — se quedan como sección chica separada, igual que en el panel viejo.
const PERMISOS_APARTE = [
  { campo: "puedeCrearDepartamento", etiqueta: "Crear departamento" },
  { campo: "puedeMarcarSalidaSinGeocerca", etiqueta: "Salida sin geocerca" },
  { campo: "puedeMarcarEntradaLibre", etiqueta: "Entrada libre" },
];

// Los ítems de asistencia/checador y encuestas son los más delicados de apagar: afectan
// cómo se registra asistencia real y el bloqueo de la encuesta semanal.
const PELIGROSOS = new Set(["checador", "encuestas", "encuesta"]);

export default function ModulosPanel() {
  const { usuarios, setUsuarios, nombresSucursales } = useGlobal();
  const { user } = useAuth();
  const { toast } = useNotification();
  const [busqueda, setBusqueda] = useState("");
  const [filtroSucursal, setFiltroSucursal] = useState("Todas");
  const [seleccionado, setSeleccionado] = useState(null);
  const [modulosPersona, setModulosPersonaLocal] = useState({});
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(null); // clave en curso

  useEffect(() => {
    if (!seleccionado) return;
    setCargando(true);
    getModulosPersonaDe(seleccionado.id)
      .then(setModulosPersonaLocal)
      .catch((error) => toast.error(error?.message || "No se pudieron cargar sus módulos."))
      .finally(() => setCargando(false));
  }, [seleccionado?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Defensa en profundidad: la RLS/edge functions son el borde real, esto solo evita que
  // alguien llegue por URL directa a una pantalla que no le sirve de nada (verá la lista
  // pero cada guardado sería rechazado igual). Va DESPUÉS de los hooks a propósito — un
  // return antes rompe las reglas de hooks (orden distinto entre renders).
  if (user?.role !== "admin_plus") {
    return (
      <Card className="admin-card">
        <p>No autorizado. Este panel es exclusivo de Admin+.</p>
      </Card>
    );
  }

  // La propia cuenta de Admin+ se excluye a propósito: "Módulos" (este mismo panel) no
  // tiene columna dedicada, así que apagárselo a uno mismo aquí dejaría a Admin+ sin forma
  // de volver a entrar a esta pantalla — hallazgo de la revisión de esta feature.
  const candidatos = usuarios
    .filter((u) => !u.archivado)
    .filter((u) => u.id !== user.id)
    .filter((u) => u.name?.toLowerCase().includes(busqueda.toLowerCase()))
    .filter((u) => filtroSucursal === "Todas" || sucursalMatches(u.sucursal, filtroSucursal))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  const itemsDePersona = NAV_ITEMS[seleccionado?.role] || [];

  const alternarDedicado = async (campo) => {
    const clave = `dedicado:${campo}`;
    setGuardando(clave);
    try {
      const actualizado = await updateUsuario(seleccionado.id, { [campo]: !seleccionado[campo] });
      setUsuarios((prev) => prev.map((u) => (u.id === seleccionado.id ? { ...u, ...actualizado } : u)));
      setSeleccionado((prev) => ({ ...prev, ...actualizado }));
    } catch (error) {
      toast.error(error?.message || "No se pudo guardar el cambio.");
    } finally {
      setGuardando(null);
    }
  };

  const alternarGenerico = async (itemKey) => {
    const clave = `generico:${itemKey}`;
    const nuevoValor = modulosPersona[itemKey] === false;
    setGuardando(clave);
    setModulosPersonaLocal((prev) => ({ ...prev, [itemKey]: nuevoValor }));
    try {
      await setModuloPersona(seleccionado.id, itemKey, nuevoValor);
    } catch (error) {
      setModulosPersonaLocal((prev) => ({ ...prev, [itemKey]: !nuevoValor }));
      toast.error(error?.message || "No se pudo guardar el cambio.");
    } finally {
      setGuardando(null);
    }
  };

  return (
    <div>
      <PageHeader
        icon="shield"
        eyebrow="Admin+"
        title="Módulos"
        subtitle="Buscá a alguien y prendé o apagá cualquiera de sus módulos. Checador y Encuestas están marcados: afectan cómo se registra asistencia y nómina."
      />
      <FilterBar className="list-filters-grid--2col" search={{ value: busqueda, onChange: setBusqueda, placeholder: "Buscar por nombre..." }}>
        <Select value={filtroSucursal} onChange={setFiltroSucursal}>
          <option value="Todas">Todas las sucursales</option>
          {nombresSucursales.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
      </FilterBar>

      {!seleccionado ? (
        <Card className="admin-card" style={{ marginTop: "20px" }}>
          <ul className="emp-list-simple">
            {candidatos.map((u) => (
              <li key={u.id}>
                <button type="button" className="mc-btn-outline" style={{ width: "100%", justifyContent: "flex-start" }} onClick={() => setSeleccionado(u)}>
                  {u.name} <span className="mc-badge-role">{u.role}</span>
                </button>
              </li>
            ))}
            {candidatos.length === 0 && <li>Sin resultados.</li>}
          </ul>
        </Card>
      ) : (
        <>
          <button type="button" className="mc-btn-outline" onClick={() => { setSeleccionado(null); setModulosPersonaLocal({}); }} style={{ marginTop: "20px", marginBottom: "1em" }}>
            <Icon name="arrowLeft" size={15} /> Volver a la lista
          </button>
          <Card className="admin-card">
            <h3>{seleccionado.name} <span className="mc-badge-role">{seleccionado.role}</span></h3>
            {cargando ? (
              <p>Cargando...</p>
            ) : (
              <ul className="emp-list-simple">
                {itemsDePersona.map((item) => {
                  const esDedicado = !!item.requiere;
                  const clave = esDedicado ? `dedicado:${item.requiere}` : `generico:${item.key}`;
                  const activo = esDedicado ? !!seleccionado[item.requiere] : modulosPersona[item.key] !== false;
                  return (
                    <li key={item.key} className="cuenta-switch-row">
                      <span className="cuenta-switch-label">
                        <Icon name={item.icon} size={16} /> {item.label}
                        {PELIGROSOS.has(item.key) && (
                          <Icon name="alert" size={12} title="Apagar esto afecta asistencia/nómina real." />
                        )}
                      </span>
                      <button
                        type="button"
                        className={`cuenta-switch${activo ? " cuenta-switch--on" : ""}`}
                        aria-label={`${item.label} para ${seleccionado.name}`}
                        disabled={guardando === clave}
                        onClick={() => (esDedicado ? alternarDedicado(item.requiere) : alternarGenerico(item.key))}
                      >
                        <span />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card className="admin-card" style={{ marginTop: "1em" }}>
            <h3>Otros permisos</h3>
            <ul className="emp-list-simple">
              {PERMISOS_APARTE.map((p) => (
                <li key={p.campo} className="cuenta-switch-row">
                  <span className="cuenta-switch-label">{p.etiqueta}</span>
                  <button
                    type="button"
                    className={`cuenta-switch${seleccionado[p.campo] ? " cuenta-switch--on" : ""}`}
                    aria-label={`${p.etiqueta} para ${seleccionado.name}`}
                    disabled={guardando === `dedicado:${p.campo}`}
                    onClick={() => alternarDedicado(p.campo)}
                  >
                    <span />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
