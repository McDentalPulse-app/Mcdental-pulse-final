import React, { useState } from "react";
import { createPortal } from "react-dom";
import { useGlobal } from "../../contexts/GlobalContext";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import Card from "../common/Card";
import FilterBar from "../common/FilterBar";
import Badge from "../common/Badge";
import KPI from "../common/KPI";
import PageHeader from "../common/PageHeader";
import SectionTitle from "../common/SectionTitle";
import SortableTh from "../common/SortableTh";
import Avatar from "../ui/Avatar";
import PulseScoreBadge from "../common/PulseScoreBadge";
import { normalizeSucursal, sucursalMatches, formatSemanaDisplay } from "../../utils/constants";

import { calcPulseScore, getPulseStatus, calcRiesgos, getEmployeeAverageScore } from "../../utils/pulseScore";
import { nivelColor } from "../../config/theme";
import LineChart from "../common/LineChart";
import RiskBar from "../common/RiskBar";
import { formatAntiguedadEmpleado, resolveFechaIngreso, formatEmpleadoIdForDisplay, formatFechaSolicitud } from "../../utils/helpers";
import Icon from "../ui/Icon";
import { esEmpleadoActivo } from "../../utils/helpers";
import { ETIQUETA_CAUSA } from "../../utils/permisos";
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
  // encuestaPreguntas hace falta para leer la respuesta de riesgo de renuncia: el jsonb
  // `respuestas` se indexa por el id de la pregunta, no por un número fijo.
  const { usuarios: USERS, encuestaPreguntas } = useGlobal();
  const { pedirBaja } = useBajaUsuario();

  const [filtroSucursal, setFiltroSucursal] = useState("Todas");
  const [filtroSemaforo, setFiltroSemaforo] = useState("Todos");
  const [busqueda, setBusqueda] = useState("");
  const [selected, setSelected] = useState(null);
  const [orden, setOrden] = useState({ columna: "name", direccion: "ascending" });
  const [pagina, setPagina] = useState(1);

  const empleados = USERS.filter(esEmpleadoActivo);
  const puedeRestablecer = currentUser?.role === "admin" && typeof onRestablecerPassword === "function";
  const puedeEliminar = currentUser?.role === "admin";

  // El panel se cierra con Escape igual que el resto de los overlays de la app.
  useEscapeKey(() => setSelected(null), !!selected);

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
  let detalle = null;
  if (selected) {
    const encEmp = encuestas
      .filter(e => e.empleadoId === selected.id)
      .sort((a, b) => a.semana.localeCompare(b.semana));

    const notasEmp = notas.filter(n => n.empleadoId === selected.id);
    // Historial de solicitudes: lo más reciente primero, por fecha de PETICIÓN. Ordenar
    // por la fecha del permiso mezclaría lo que se pidió ayer para dentro de un mes con
    // lo que se pidió hace un mes para mañana, y el expediente se lee al revés.
    const porSolicitudDesc = (a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    const vacacionesEmp = vacaciones.filter(v => v.empleadoId === selected.id).sort(porSolicitudDesc);
    const permisosEmp = permisos.filter(p => p.empleadoId === selected.id).sort(porSolicitudDesc);
    const descuentosEmp = descuentos.filter(d => d.empleadoId === selected.id);
    const reconocimientosEmp = reconocimientos.filter(r =>
  r.empleadoId === selected.id ||
  r.empleado === selected.name ||
  r.nombre === selected.name
);
    const reportesEmp = reportesConfidenciales.filter(r => r.empleadoId === selected.id);

    const sem = getUltimoSemaforo(selected.id);
    const ps = calcPulseScore(selected.id, encuestas);
    const promedioScore = getEmployeeAverageScore(selected.id, encuestas);
    const trend = encEmp.map(e => ({
      label: formatSemanaDisplay(e.semana).replace("2026-", ""),
      v: e.score
    }));
    const riesgos = calcRiesgos(selected.id, encuestas, encuestaPreguntas);

    // Portal a <body>: `.app-main` (o alguna de sus capas) crea un stacking context
    // que atrapaba al overlay `position: fixed` y lo dejaba por debajo de la barra
    // de navegación, tapando el botón de cerrar. Sacándolo del árbol del layout no
    // depende de ningún z-index de la página.
    detalle = createPortal(
      <div className="mc-slideout-overlay" onClick={() => setSelected(null)} role="presentation">
        <div
          className="mc-slideout-panel detail-page"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label={`Detalle de ${selected.name}`}
        >
          <button type="button" className="mc-slideout-close" onClick={() => setSelected(null)} aria-label="Cerrar">
            <Icon name="xCircle" size={22} />
          </button>

          <div className="detail-grid-top">
          <Card className="detail-card-main">
            <div className="detail-emp-header">
              <Avatar name={selected.name} size={64} color={nivelColor(sem)} photoUrl={selected.avatarUrl} />

              <div className="detail-emp-header-texto">
                <div className="detail-emp-nombre">{selected.name}</div>
                <div className="detail-emp-meta">{selected.puesto} · {normalizeSucursal(selected.sucursal)}</div>

                {role !== "rh" && (
                  <div className="detail-emp-badges">
                    <Badge tipo={sem} />
                    <PulseScoreBadge
                      score={ps.score}
                      nivel={ps.nivel}
                      slug={ps.slug}
                      tendencia={ps.tendencia}
                      size="sm"
                    />
                  </div>
                )}
              </div>

              {puedeRestablecer && (
                <button className="mc-btn-warning mc-btn-with-icon detail-emp-header-accion" onClick={() => onRestablecerPassword(selected)}>
                  <Icon name="key" size={16} /> Restablecer contraseña
                </button>
              )}
            </div>

            <div className="detail-info-grid">
              <div className="detail-stat-box">
                <div className="detail-stat-label">Puesto</div>
                <div className="detail-stat-value detail-stat-value--sm" title={selected.puesto}>{selected.puesto}</div>
              </div>
              <div className="detail-stat-box">
                <div className="detail-stat-label">Sucursal</div>
                <div className="detail-stat-value detail-stat-value--sm" title={normalizeSucursal(selected.sucursal)}>{normalizeSucursal(selected.sucursal)}</div>
              </div>
              <div className="detail-stat-box">
                <div className="detail-stat-label">Antigüedad</div>
                <div className="detail-stat-value detail-stat-value--sm" title={formatAntiguedadEmpleado(selected)}>{formatAntiguedadEmpleado(selected)}</div>
              </div>
              <div className="detail-stat-box">
                <div className="detail-stat-label">ID empleado</div>
                <div className="detail-stat-value detail-stat-value--sm" title={formatEmpleadoIdForDisplay(selected)}>{formatEmpleadoIdForDisplay(selected)}</div>
              </div>
              <div className="detail-stat-box">
                <div className="detail-stat-label">Estado</div>
                <div className="detail-stat-value detail-stat-value--sm">Activo</div>
              </div>
            </div>

            {role !== "rh" && (
              <>
                <div className="detail-stats-grid">
                  <div className="detail-stat-box">
                    <div className="detail-stat-label">Promedio</div>
                    <div className="detail-stat-value">
                      {promedioScore ?? "—"}
                    </div>
                  </div>

                  <div className="detail-stat-box">
                    <div className="detail-stat-label">Encuestas</div>
                    <div className="detail-stat-value">
                      {encEmp.length}
                    </div>
                  </div>

                  <div className="detail-stat-box">
                    <div className="detail-stat-label">Notas</div>
                    <div className="detail-stat-value">
                      {notasEmp.length}
                    </div>
                  </div>
                </div>

                <SectionTitle icon="trending">Evolución Pulse</SectionTitle>

                {trend.length > 1 ? (
                  <LineChart data={trend} slug={ps.slug} />
                ) : (
                  <div className="detail-vacio">
                    Sin suficientes datos para graficar.
                  </div>
                )}
              </>
            )}
          </Card>

          {role !== "rh" && (
            <Card className="detail-card-side">
              <SectionTitle icon="shield">Riesgos IA</SectionTitle>

              {riesgos.sinDatos ? (
                <p className="admin-empty" style={{ margin: 0, fontSize: 13 }}>
                  Sin datos suficientes para estimar riesgos.
                </p>
              ) : (
                <>
                  <RiskBar
                    label="Riesgo Renuncia"
                    value={riesgos.renuncia}
                    slug={riesgos.renuncia > 60 ? "rojo" : riesgos.renuncia > 30 ? "amarillo" : "verde"}
                  />

                  <RiskBar
                    label="Riesgo Burnout"
                    value={riesgos.burnout}
                    slug={riesgos.burnout > 60 ? "rojo" : riesgos.burnout > 30 ? "amarillo" : "verde"}
                  />

                  <RiskBar
                    label="Riesgo Emocional"
                    value={riesgos.emocional}
                    slug={riesgos.emocional > 60 ? "rojo" : riesgos.emocional > 30 ? "amarillo" : "verde"}
                  />
                </>
              )}
            </Card>
          )}
        </div>

        <div className="detail-grid-2">
          {role !== "rh" && (
            <Card>
              <SectionTitle icon="clipboard">Historial de encuestas</SectionTitle>
              <div className="detail-list-scroll">
              {encEmp.length === 0 ? (
                <div className="detail-vacio">Sin encuestas registradas</div>
              ) : (
                encEmp.map(e => (
                  <div key={e.id} className="detail-list-item">
                    <span>{formatSemanaDisplay(e.semana)}</span>
                    <Badge tipo={e.semaforo} />
                    <span style={{ fontWeight: 800 }}>{e.score}</span>
                  </div>
                ))
              )}
              </div>
            </Card>
          )}

          {role === "psicologa" && (
            <Card>
              <SectionTitle icon="heart">Notas psicológicas</SectionTitle>
              <div className="detail-list-scroll">
              {notasEmp.length === 0 ? (
                <div className="detail-vacio">Sin notas registradas</div>
              ) : (
                notasEmp.map(n => (
                  <div key={n.id} className="detail-list-item-block">
                    <div style={{ color: "var(--mc-texto-titulo)" }}>{n.texto}</div>
                    <div style={{ color: "var(--mc-texto-secundario)", fontSize: 11 }}>{n.fecha}</div>
                  </div>
                ))
              )}
              </div>
            </Card>
          )}
        </div>

        <div className="detail-grid-2">
          <Card>
            <SectionTitle icon="vacation">Vacaciones</SectionTitle>
            <div className="detail-list-scroll">
            {vacacionesEmp.length === 0 ? (
              <div className="detail-vacio">Sin vacaciones registradas</div>
            ) : (
              vacacionesEmp.map(v => (
                <div key={v.id} className="detail-list-item-block">
                  <strong>{v.estado}</strong> · {v.fechaInicio || v.inicio || v.desde} al {v.fechaFin || v.fin || v.hasta}
                  <br />
                  <span style={{ color: "var(--mc-texto-secundario)" }}>
                    {v.dias} días · {v.motivo}
                  </span>
                  {v.createdAt && (
                    <>
                      <br />
                      <span className="detail-solicitud-fecha">
                        Solicitado el {formatFechaSolicitud(v.createdAt)}
                      </span>
                    </>
                  )}
                  {v.comentarioRH && (
                    <>
                      <br />
                      <span style={{ color: "var(--mc-texto-secundario)" }}>
                        Comentario RH: {v.comentarioRH}
                      </span>
                    </>
                  )}
                </div>
              ))
            )}
            </div>
          </Card>

          {/* Permisos: faltaba en el expediente — solo estaban las vacaciones, así que
              gestión no tenía dónde consultar el historial de permisos de una persona
              sin irse a la pantalla de Permisos y filtrar. */}
          <Card>
            <SectionTitle icon="clipboardCheck">Permisos</SectionTitle>
            <div className="detail-list-scroll">
            {permisosEmp.length === 0 ? (
              <div className="detail-vacio">Sin permisos registrados</div>
            ) : (
              permisosEmp.map(p => (
                <div key={p.id} className="detail-list-item-block">
                  <strong>{p.estado}</strong> · {p.fecha}
                  {p.fechaFin && p.fechaFin !== p.fecha ? ` al ${p.fechaFin}` : ""}
                  {p.hora ? ` · ${p.hora}` : ""}
                  <br />
                  <span style={{ color: "var(--mc-texto-secundario)" }}>
                    {/* ETIQUETA_CAUSA y no p.causa a secas: en la base la causa se guarda
                        acotada al catálogo ('tramite_oficial'), y eso es lo que se leería
                        en pantalla si no se traduce. */}
                    {[ETIQUETA_CAUSA[p.causa] || p.causa, p.motivo].filter(Boolean).join(" · ") || "Sin motivo"}
                  </span>
                  {p.createdAt && (
                    <>
                      <br />
                      <span className="detail-solicitud-fecha">
                        Solicitado el {formatFechaSolicitud(p.createdAt)}
                      </span>
                    </>
                  )}
                  {p.comentarioRH && (
                    <>
                      <br />
                      <span style={{ color: "var(--mc-texto-secundario)" }}>
                        Comentario RH: {p.comentarioRH}
                      </span>
                    </>
                  )}
                </div>
              ))
            )}
            </div>
          </Card>

          {role !== "psicologa" && (
            <Card>
              <SectionTitle icon="dollar">Descuentos</SectionTitle>
              <div className="detail-list-scroll">
              {descuentosEmp.length === 0 ? (
                <div className="detail-vacio">Sin descuentos</div>
              ) : (
                descuentosEmp.map(d => (
                  <div key={d.id} className="detail-list-item-block">
                    <strong>{d.estado}</strong> · {d.concepto || d.motivo}
                    <br />
                    <span style={{ color: "var(--mc-texto-secundario)" }}>
                      {d.monto ? `$${d.monto}` : ""}
                    </span>
                  </div>
                ))
              )}
              </div>
            </Card>
          )}

          <Card>
            <SectionTitle icon="award">Reconocimientos</SectionTitle>
            <div className="detail-list-scroll">
            {reconocimientosEmp.length === 0 ? (
              <div className="detail-vacio">Sin reconocimientos</div>
            ) : (
              reconocimientosEmp.map(r => (
                <div key={r.id} className="detail-list-item-block">
                  <strong>{r.titulo || r.tipo || r.categoria}</strong>
<br />
<span style={{ color: "var(--mc-texto-secundario)" }}>
  {r.descripcion || r.motivo || r.comentario}
</span>
{r.otorgadoPor && (
  <>
    <br />
    <span style={{ color: "var(--mc-texto-secundario)", fontSize: 12 }}>
      Otorgado por: {r.otorgadoPor}
    </span>
  </>
)}
{r.fecha && (
  <>
    <br />
    <span style={{ color: "var(--mc-texto-secundario)", fontSize: 12 }}>
      Fecha: {r.fecha}
    </span>
  </>
)}
                </div>
              ))
            )}
            </div>
          </Card>

          {role !== "rh" && (
            <Card>
              <SectionTitle icon="lock">Reportes confidenciales</SectionTitle>
              <div className="detail-list-scroll">
              {reportesEmp.length === 0 ? (
                <div className="detail-vacio">Sin reportes confidenciales</div>
              ) : (
                reportesEmp.map(r => (
                  <div key={r.id} className="detail-list-item-block">
                    <strong>{r.fecha || "Reporte"}</strong>
                    <br />
                    <span style={{ color: "var(--mc-texto-secundario)" }}>
                      {r.resumen || r.texto || r.motivo || r.descripcion}
                    </span>
                  </div>
                ))
              )}
              </div>
            </Card>
          )}
        </div>
        </div>
      </div>,
      document.body
    );
  }

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
          <select
            className="list-filter-select"
            value={filtroSucursal}
            onChange={(e) => setFiltroSucursal(e.target.value)}
          >
            <option value="Todas">Todas las sucursales</option>
            {[...new Set(empleados.map((e) => normalizeSucursal(e.sucursal)))].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select
            className="list-filter-select"
            value={filtroSemaforo}
            onChange={(e) => setFiltroSemaforo(e.target.value)}
          >
            <option value="Todos">Todos los semáforos</option>
            <option value="verde">Verde</option>
            <option value="amarillo">Amarillo</option>
            <option value="rojo">Rojo</option>
          </select>
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
