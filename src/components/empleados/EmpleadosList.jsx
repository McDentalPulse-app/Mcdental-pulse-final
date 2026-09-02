import { useState } from "react";
import Select from "../common/Select";
import { useGlobal } from "../../contexts/GlobalContext";
import FichaEmpleado from "./FichaEmpleado";
import Card from "../common/Card";
import FilterBar from "../common/FilterBar";
import Badge from "../common/Badge";
import PageHeader from "../common/PageHeader";
import SortableTh from "../common/SortableTh";
import Avatar from "../ui/Avatar";
import { normalizeSucursal, sucursalMatches } from "../../utils/constants";

import { nivelColor } from "../../config/theme";
import { formatAntiguedadEmpleado, resolveFechaIngreso } from "../../utils/helpers";
import Icon from "../ui/Icon";
import { esEmpleadoActivo } from "../../utils/helpers";
import { useBajaUsuario } from "../../hooks/useBajaUsuario";

const RANGO_SEMAFORO = { rojo: 0, amarillo: 1, verde: 2, "sin-datos": 3 };
const FILAS_POR_PAGINA = 12;

const EmpleadosList = ({
  encuestas,
  notas,
  role,
  vacaciones = [],
  permisos = [],
  descuentos = [],
  reconocimientos = [],
  reportesConfidenciales = [],
  currentUser,
  onRestablecerPassword
}) => {
  const { usuarios: USERS } = useGlobal();
  const { pedirBaja } = useBajaUsuario();

  const [filtroSucursal, setFiltroSucursal] = useState("Todas");
  const [filtroSemaforo, setFiltroSemaforo] = useState("Todos");
  const [busqueda, setBusqueda] = useState("");
  const [selected, setSelected] = useState(null);
  const [orden, setOrden] = useState({ columna: "name", direccion: "ascending" });
  const [pagina, setPagina] = useState(1);

  const empleados = USERS.filter(esEmpleadoActivo);
  const puedeEliminar = currentUser?.role === "admin" || currentUser?.role === "admin_plus";

  // Sin ninguna encuesta contestada no es "verde" (estable) — es que no hay dato. Antes
  // caía a verde por defecto y se veía igual que alguien que de verdad está bien.
  const getUltimoSemaforo = (empId) => {
    const enc = encuestas
      .filter(e => e.empleadoId === empId)
      .sort((a, b) => b.semana.localeCompare(a.semana));

    return enc[0]?.semaforo || "sin-datos";
  };

  const filtered = empleados.filter(e => {
    const texto = busqueda.toLowerCase();

    const coincideBusqueda =
      e.name.toLowerCase().includes(texto) ||
      e.puesto.toLowerCase().includes(texto) ||
      normalizeSucursal(e.sucursal).toLowerCase().includes(texto);

    const coincideSucursal =
      filtroSucursal === "Todas" || sucursalMatches(e.sucursal, filtroSucursal);

    const coincideSemaforo =
      filtroSemaforo === "Todos" || getUltimoSemaforo(e.id) === filtroSemaforo;

    return coincideBusqueda && coincideSucursal && coincideSemaforo;
  });

  // Orden por columna: strings con localeCompare, antigüedad por la fecha real (no el
  // texto formateado, "2 años" no se puede comparar como string), estado por el rango
  // rojo→amarillo→verde (para poder ver primero a quién le va peor).
  const factorOrden = orden.direccion === "descending" ? -1 : 1;
  const ordenados = [...filtered].sort((a, b) => {
    if (orden.columna === "estado") {
      return (RANGO_SEMAFORO[getUltimoSemaforo(a.id)] - RANGO_SEMAFORO[getUltimoSemaforo(b.id)]) * factorOrden;
    }
    if (orden.columna === "antiguedad") {
      return (resolveFechaIngreso(a) || "").localeCompare(resolveFechaIngreso(b) || "") * factorOrden;
    }
    const campo = orden.columna === "sucursal" ? normalizeSucursal(a.sucursal) : a[orden.columna] || "";
    const campoB = orden.columna === "sucursal" ? normalizeSucursal(b.sucursal) : b[orden.columna] || "";
    return String(campo).localeCompare(String(campoB)) * factorOrden;
  });

  const totalPaginas = Math.max(1, Math.ceil(ordenados.length / FILAS_POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const paginados = ordenados.slice((paginaActual - 1) * FILAS_POR_PAGINA, paginaActual * FILAS_POR_PAGINA);

  const alternarOrden = (columna) => {
    setPagina(1);
    setOrden((prev) =>
      prev.columna === columna
        ? { columna, direccion: prev.direccion === "ascending" ? "descending" : "ascending" }
        : { columna, direccion: "ascending" }
    );
  };

  // Panel de detalle: se calcula solo si hay un empleado elegido, y se desliza desde la
  // derecha por encima de la tabla (que sigue montada atrás) en vez de reemplazar toda
  // la pantalla — así no se pierde el scroll/filtros de la lista al cerrarlo.
  const detalle = (
    <FichaEmpleado
      empleado={selected}
      encuestas={encuestas}
      notas={notas}
      vacaciones={vacaciones}
      permisos={permisos}
      descuentos={descuentos}
      reconocimientos={reconocimientos}
      reportesConfidenciales={reportesConfidenciales}
      role={role}
      currentUser={currentUser}
      onRestablecerPassword={onRestablecerPassword}
      onClose={() => setSelected(null)}
    />
  );

  return (
    <>
    <div className="list-page">
      <PageHeader
        icon="users"
        title="Empleados"
        subtitle="Directorio del equipo con bienestar y semáforo por colaborador."
      />

      <Card className="list-page-sticky list-card-spaced">
        <FilterBar search={{ value: busqueda, onChange: setBusqueda, placeholder: "Buscar por nombre, puesto o sucursal..." }}>
          <Select
            value={filtroSucursal}
            onChange={(valor) => setFiltroSucursal(valor)}
          >
            <option value="Todas">Todas las sucursales</option>
            {[...new Set(empleados.map((e) => normalizeSucursal(e.sucursal)))].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>

          <Select
            value={filtroSemaforo}
            onChange={(valor) => setFiltroSemaforo(valor)}
          >
            <option value="Todos">Todos los semáforos</option>
            <option value="verde">Verde</option>
            <option value="amarillo">Amarillo</option>
            <option value="rojo">Rojo</option>
          </Select>
        </FilterBar>

        <div className="list-filter-count">
          Mostrando {paginados.length} de {ordenados.length} empleados
        </div>
      </Card>

      <Card className="emp-table-card">
        {/* Escritorio: la tabla ordenable. En teléfono se esconde y en su lugar va la
            lista de tarjetas de abajo — la tabla necesitaba 672px de ancho y en una
            pantalla de 390 dejaba fuera el 45% (Puesto, Antigüedad y el botón de baja),
            visibles solo arrastrando de lado y sin ninguna pista de que hubiera más. */}
        <div className="emp-table-scroll gestion-personal-desktop-only">
          <table className="emp-table">
            <thead>
              <tr>
                <SortableTh id="name" label="Nombre" orden={orden} onSort={alternarOrden} className="emp-table-th--nombre" />
                {role !== "rh" && <SortableTh id="estado" label="Estado" orden={orden} onSort={alternarOrden} />}
                <SortableTh id="puesto" label="Puesto" orden={orden} onSort={alternarOrden} />
                <SortableTh id="sucursal" label="Sucursal" orden={orden} onSort={alternarOrden} className="emp-table-th--sucursal" />
                <SortableTh id="antiguedad" label="Antigüedad" orden={orden} onSort={alternarOrden} />
                <th className="emp-table-th emp-table-th--acciones" />
              </tr>
            </thead>
            <tbody>
              {paginados.map((emp) => {
                const sem = getUltimoSemaforo(emp.id);
                return (
                  <tr key={emp.id} className="emp-table-row" onClick={() => setSelected(emp)}>
                    <td>
                      <div className="emp-table-nombre">
                        <Avatar name={emp.name} size={32} color={nivelColor(sem)} photoUrl={emp.avatarUrl} />
                        <span className="emp-table-nombre-texto">{emp.name}</span>
                      </div>
                    </td>
                    {role !== "rh" && (
                      <td><Badge tipo={sem} /></td>
                    )}
                    <td className="emp-table-nowrap">{emp.puesto}</td>
                    <td className="emp-table-nowrap emp-table-th--sucursal">{normalizeSucursal(emp.sucursal)}</td>
                    <td className="emp-table-nowrap">
                      {resolveFechaIngreso(emp) ? formatAntiguedadEmpleado(emp) : "—"}
                    </td>
                    <td className="emp-table-acciones" onClick={(e) => e.stopPropagation()}>
                      {puedeEliminar && (
                        <button
                          type="button"
                          className="emp-table-icon-btn emp-table-icon-btn--danger"
                          title="Dar de baja (desactivar o archivar)"
                          onClick={() => pedirBaja(emp)}
                        >
                          <Icon name="trash" size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {paginados.length === 0 && (
                <tr>
                  <td colSpan={role !== "rh" ? 6 : 5} className="emp-table-vacio">
                    No hay empleados que coincidan con la búsqueda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Teléfono: la misma información en tarjetas. Reusa el chrome de
            .gestion-personal-mobile-* a propósito, para que Empleados y Gestión de
            Personal se vean igual en móvil (es el reflejo de que Gestión de Personal
            ya reusa la tabla .emp-table* de aquí). Tocar la tarjeta abre el detalle,
            igual que tocar la fila en escritorio. */}
        <div className="gestion-personal-mobile-list">
          {paginados.length === 0 ? (
            <p className="gestion-personal-mobile-empty">
              No hay empleados que coincidan con la búsqueda.
            </p>
          ) : (
            paginados.map((emp) => {
              const sem = getUltimoSemaforo(emp.id);
              return (
                <div
                  key={emp.id}
                  className="gestion-personal-mobile-card mc-row-hover"
                  onClick={() => setSelected(emp)}
                >
                  <div className="gestion-personal-mobile-head">
                    <div className="emp-mobile-ident">
                      <Avatar name={emp.name} size={32} color={nivelColor(sem)} photoUrl={emp.avatarUrl} />
                      <div className="gestion-personal-mobile-name">{emp.name}</div>
                    </div>
                    {role !== "rh" && <Badge tipo={sem} />}
                  </div>

                  <div className="gestion-personal-mobile-meta">
                    {emp.puesto && <span className="mc-tag">{emp.puesto}</span>}
                    <span className="gestion-personal-mobile-sucursal">
                      {normalizeSucursal(emp.sucursal)}
                      {resolveFechaIngreso(emp) ? ` · ${formatAntiguedadEmpleado(emp)}` : ""}
                    </span>
                  </div>

                  {puedeEliminar && (
                    <div
                      className="gestion-personal-mobile-actions"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="mc-btn-outline mc-btn-outline--danger"
                        onClick={() => pedirBaja(emp)}
                      >
                        Dar de baja
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {totalPaginas > 1 && (
          <div className="emp-table-paginacion">
            <button type="button" className="mc-btn-outline" disabled={paginaActual === 1} onClick={() => setPagina(paginaActual - 1)}>
              Anterior
            </button>
            <span className="emp-table-paginacion-texto">Página {paginaActual} de {totalPaginas}</span>
            <button type="button" className="mc-btn-outline" disabled={paginaActual === totalPaginas} onClick={() => setPagina(paginaActual + 1)}>
              Siguiente
            </button>
          </div>
        )}
      </Card>
    </div>
    {detalle}
    </>
  );
};

export default EmpleadosList;
