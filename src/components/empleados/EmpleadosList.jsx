import React, { useState } from "react";
import { useGlobal } from "../../contexts/GlobalContext";
import Card from "../common/Card";
import Badge from "../common/Badge";
import KPI from "../common/KPI";
import Avatar from "../ui/Avatar";
import PulseScoreBadge from "../common/PulseScoreBadge";
import { SUCURSALES, semanaActual, normalizeSucursal, sucursalMatches } from "../../utils/constants";

import { calcPulseScore, getPulseStatus } from "../../utils/pulseScore";

import { semaforoColor } from "../../config/theme";
import LineChart from "../common/LineChart";
import RiskBar from "../common/RiskBar";
import { formatAntiguedadEmpleado, resolveFechaIngreso } from "../../utils/helpers";
import Icon from "../ui/Icon";
import { calcRiesgos } from "../../utils/pulseScore";
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

  const [filtroSucursal, setFiltroSucursal] = useState("Todas");
  const [filtroSemaforo, setFiltroSemaforo] = useState("Todos");
  const [busqueda, setBusqueda] = useState("");
  const [selected, setSelected] = useState(null);

  const empleados = USERS.filter(u => u.role === "empleado");
  const puedeRestablecer = currentUser?.role === "admin" && typeof onRestablecerPassword === "function";

  const getUltimoSemaforo = (empId) => {
    const enc = encuestas
      .filter(e => e.empleadoId === empId)
      .sort((a, b) => b.semana.localeCompare(a.semana));

    return enc[0]?.semaforo || "verde";
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

  if (selected) {
    const encEmp = encuestas
      .filter(e => e.empleadoId === selected.id)
      .sort((a, b) => a.semana.localeCompare(b.semana));

    const notasEmp = notas.filter(n => n.empleadoId === selected.id);
    const vacacionesEmp = vacaciones.filter(v => v.empleadoId === selected.id);
    const permisosEmp = permisos.filter(p => p.empleadoId === selected.id);
    const descuentosEmp = descuentos.filter(d => d.empleadoId === selected.id);
    const reconocimientosEmp = reconocimientos.filter(r =>
  Number(r.empleadoId) === Number(selected.id) ||
  r.empleado === selected.name ||
  r.nombre === selected.name
);
    const reportesEmp = reportesConfidenciales.filter(r => r.empleadoId === selected.id);

    const sem = getUltimoSemaforo(selected.id);
    const ps = calcPulseScore(selected.id, encuestas);
    const trend = encEmp.map(e => ({
      label: e.semana.replace("2025-", ""),
      v: e.score
    }));
    const riesgos = calcRiesgos(selected.id, encuestas);

    return (
      <div className="detail-page admin-page">
        <button className="detail-back-btn" onClick={() => setSelected(null)}>
          ← Volver a empleados
        </button>

        <div className="detail-grid-top">
          <Card style={{ flex: 2, minWidth: 280 }}>
            <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 20 }}>
              <Avatar name={selected.name} size={56} color={semaforoColor[sem]} />

              <div>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#004D40" }}>
                  {selected.name}
                </div>

                <div style={{ fontSize: 13, color: "#6b7280" }}>
                  {selected.puesto} · {normalizeSucursal(selected.sucursal)}
                </div>

                {role !== "rh" && (
                  <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Badge tipo={sem} />
                    <PulseScoreBadge
                      score={ps.score}
                      nivel={ps.nivel}
                      color={ps.color}
                      tendencia={ps.tendencia}
                      size="sm"
                    />
                  </div>
                )}
              </div>
            </div>
{puedeRestablecer && (
  <button className="mc-btn-warning" style={{ marginTop: 14, display: "inline-flex", alignItems: "center", gap: 8 }} onClick={() => onRestablecerPassword(selected)}>
    <Icon name="key" size={16} /> Restablecer contraseña
  </button>
)}
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              fontSize: 13,
              marginBottom: 16
            }}>
              <div><span style={{ color: "#9ca3af" }}>Nombre:</span> {selected.name}</div>
              <div><span style={{ color: "#9ca3af" }}>Puesto:</span> {selected.puesto}</div>
              <div><span style={{ color: "#9ca3af" }}>Sucursal:</span> {normalizeSucursal(selected.sucursal)}</div>
              <div><span style={{ color: "#9ca3af" }}>Antigüedad:</span> {formatAntiguedadEmpleado(selected)}</div>
              <div><span style={{ color: "#9ca3af" }}>ID empleado:</span> {selected.id}</div>
              <div><span style={{ color: "#9ca3af" }}>Estado:</span> Activo</div>
            </div>

            {role !== "rh" && (
              <>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3,1fr)",
                  gap: 10,
                  marginBottom: 16
                }}>
                  <div style={{ background: "#f9fafb", padding: 12, borderRadius: 12 }}>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>Promedio</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "#004D40" }}>
                      {encEmp.length
                        ? Math.round(encEmp.reduce((a, e) => a + e.score, 0) / encEmp.length)
                        : 0}
                    </div>
                  </div>

                  <div style={{ background: "#f9fafb", padding: 12, borderRadius: 12 }}>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>Encuestas</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "#004D40" }}>
                      {encEmp.length}
                    </div>
                  </div>

                  <div style={{ background: "#f9fafb", padding: 12, borderRadius: 12 }}>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>Notas</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "#004D40" }}>
                      {notasEmp.length}
                    </div>
                  </div>
                </div>

                <div style={{ fontWeight: 800, fontSize: 14, color: "#004D40", marginBottom: 12 }}>
                  Evolución Pulse
                </div>

                {trend.length > 1 ? (
                  <LineChart data={trend} color={ps.color} />
                ) : (
                  <div style={{ color: "#9ca3af", fontSize: 13 }}>
                    Sin suficientes datos para graficar.
                  </div>
                )}
              </>
            )}
          </Card>

          {role !== "rh" && (
            <Card style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: "#004D40", marginBottom: 14 }}>
                Riesgos IA
              </div>

              <RiskBar
                label="Riesgo Renuncia"
                value={riesgos.renuncia}
                color={riesgos.renuncia > 60 ? "#ef4444" : riesgos.renuncia > 30 ? "#f97316" : "#22c55e"}
              />

              <RiskBar
                label="Riesgo Burnout"
                value={riesgos.burnout}
                color={riesgos.burnout > 60 ? "#ef4444" : riesgos.burnout > 30 ? "#f97316" : "#22c55e"}
              />

              <RiskBar
                label="Riesgo Emocional"
                value={riesgos.emocional}
                color={riesgos.emocional > 60 ? "#ef4444" : riesgos.emocional > 30 ? "#f97316" : "#22c55e"}
              />
            </Card>
          )}
        </div>

        <div className="detail-grid-2">
          {role !== "rh" && (
            <Card>
              <div className="detail-section-title">Historial de encuestas</div>
              <div className="detail-list-scroll">
              {encEmp.length === 0 ? (
                <div style={{ color: "#9ca3af", fontSize: 13 }}>Sin encuestas registradas</div>
              ) : (
                encEmp.map(e => (
                  <div key={e.id} className="detail-list-item">
                    <span>{e.semana}</span>
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
              <div className="detail-section-title">Notas psicológicas</div>
              <div className="detail-list-scroll">
              {notasEmp.length === 0 ? (
                <div style={{ color: "#9ca3af", fontSize: 13 }}>Sin notas registradas</div>
              ) : (
                notasEmp.map(n => (
                  <div key={n.id} className="detail-list-item-block">
                    <div style={{ color: "#374151" }}>{n.texto}</div>
                    <div style={{ color: "#9ca3af", fontSize: 11 }}>{n.fecha}</div>
                  </div>
                ))
              )}
              </div>
            </Card>
          )}
        </div>

        <div className="detail-grid-2">
          <Card>
            <div className="detail-section-title">Vacaciones</div>
            <div className="detail-list-scroll">
            {vacacionesEmp.length === 0 ? (
              <div style={{ color: "#9ca3af", fontSize: 13 }}>Sin vacaciones registradas</div>
            ) : (
              vacacionesEmp.map(v => (
                <div key={v.id} className="detail-list-item-block">
                  <strong>{v.estado}</strong> · {v.fechaInicio || v.inicio || v.desde} al {v.fechaFin || v.fin || v.hasta}
                  <br />
                  <span style={{ color: "#64748b" }}>
                    {v.dias} días · {v.motivo}
                  </span>
                  {v.comentarioRH && (
                    <>
                      <br />
                      <span style={{ color: "#64748b" }}>
                        Comentario RH: {v.comentarioRH}
                      </span>
                    </>
                  )}
                </div>
              ))
            )}
            </div>
          </Card>

          <Card>
            <div className="detail-section-title">Permisos</div>
            <div className="detail-list-scroll">
            {permisosEmp.length === 0 ? (
              <div style={{ color: "#9ca3af", fontSize: 13 }}>Sin permisos registrados</div>
            ) : (
              permisosEmp.map(p => (
                <div key={p.id} className="detail-list-item-block">
                  <strong>{p.estado}</strong> · {p.fecha || p.fechaInicio} {p.hora || ""}
                  <br />
                  <span style={{ color: "#64748b" }}>
                    {p.motivo}
                  </span>
                  {p.comentarioRH && (
                    <>
                      <br />
                      <span style={{ color: "#64748b" }}>
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
              <div className="detail-section-title">Descuentos</div>
              <div className="detail-list-scroll">
              {descuentosEmp.length === 0 ? (
                <div style={{ color: "#9ca3af", fontSize: 13 }}>Sin descuentos</div>
              ) : (
                descuentosEmp.map(d => (
                  <div key={d.id} className="detail-list-item-block">
                    <strong>{d.estado}</strong> · {d.concepto || d.motivo}
                    <br />
                    <span style={{ color: "#64748b" }}>
                      {d.monto ? `$${d.monto}` : ""}
                    </span>
                  </div>
                ))
              )}
              </div>
            </Card>
          )}

          <Card>
            <div className="detail-section-title">Reconocimientos</div>
            <div className="detail-list-scroll">
            {reconocimientosEmp.length === 0 ? (
              <div style={{ color: "#9ca3af", fontSize: 13 }}>Sin reconocimientos</div>
            ) : (
              reconocimientosEmp.map(r => (
                <div key={r.id} className="detail-list-item-block">
                  <strong>{r.titulo || r.tipo || r.categoria}</strong>
<br />
<span style={{ color: "#64748b" }}>
  {r.descripcion || r.motivo || r.comentario}
</span>
{r.otorgadoPor && (
  <>
    <br />
    <span style={{ color: "#9ca3af", fontSize: 12 }}>
      Otorgado por: {r.otorgadoPor}
    </span>
  </>
)}
{r.fecha && (
  <>
    <br />
    <span style={{ color: "#9ca3af", fontSize: 12 }}>
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
              <div className="detail-section-title">Reportes confidenciales</div>
              <div className="detail-list-scroll">
              {reportesEmp.length === 0 ? (
                <div style={{ color: "#9ca3af", fontSize: 13 }}>Sin reportes confidenciales</div>
              ) : (
                reportesEmp.map(r => (
                  <div key={r.id} className="detail-list-item-block">
                    <strong>{r.fecha || "Reporte"}</strong>
                    <br />
                    <span style={{ color: "#64748b" }}>
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
    );
  }

  return (
    <div className="list-page">
      <div className="list-page-header admin-page-header admin-page-header--row">
        <div>
          <h2 className="admin-page-title">Empleados</h2>
          <p className="admin-page-subtitle">Directorio del equipo con bienestar y semáforo por colaborador.</p>
        </div>
      </div>

      <Card className="list-page-sticky list-card-spaced">
        <div className="list-filters-grid">
          <input
            className="list-filter-input"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, puesto o sucursal..."
          />

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
        </div>

        <div className="list-filter-count">
          Mostrando {filtered.length} de {empleados.length} empleados
        </div>
      </Card>

      <div className="list-scroll-body">
        <div className="emp-grid">
        {filtered.map(emp => {
          const sem = getUltimoSemaforo(emp.id);
          const ps = calcPulseScore(emp.id, encuestas);
          const contestoEsta = encuestas.some(e => e.empleadoId === emp.id && e.semana === semanaActual);

          return (
            <div
              key={emp.id}
              className="emp-card-wrap"
              onClick={() => setSelected(emp)}
            >
              <Card>
                <div className="emp-card-top">
                  <Avatar name={emp.name} size={36} color={semaforoColor[sem]} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="emp-card-name">{emp.name}</div>
                    <div className="emp-card-role">{emp.puesto}</div>
                  </div>

                  {role !== "rh" && <Badge tipo={sem} />}
                </div>

                {role !== "rh" && (
                  <div style={{ marginBottom: 6 }}>
                    <PulseScoreBadge
                      score={ps.score}
                      nivel={ps.nivel}
                      color={ps.color}
                      tendencia={ps.tendencia}
                      size="sm"
                    />
                  </div>
                )}

                <div className="emp-card-footer">
                  <span>{normalizeSucursal(emp.sucursal)}</span>
                  {resolveFechaIngreso(emp) ? (
                    <span className="emp-card-antiguedad">{formatAntiguedadEmpleado(emp)}</span>
                  ) : null}
                  {role !== "rh" && (
                    <span className="emp-card-status">
                      {contestoEsta ? (
                        <><Icon name="check" size={12} /> Contestó</>
                      ) : (
                        <><Icon name="clock" size={12} /> Pendiente</>
                      )}
                    </span>
                  )}
                </div>
              </Card>
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
};


export default EmpleadosList;
