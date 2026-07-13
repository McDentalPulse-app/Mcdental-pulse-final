import React, { useState } from "react";
import { useGlobal } from "../../contexts/GlobalContext";
import Card from "../common/Card";
import StatCard from "../common/StatCard";
import SectionTitle from "../common/SectionTitle";
import PageHeader from "../common/PageHeader";
import Icon from "../ui/Icon";
import Badge from "../common/Badge";
import Avatar from "../ui/Avatar";
import PulseScoreBadge from "../common/PulseScoreBadge";
import { nivelColor, nivelBadgeBg, nivelTinte } from "../../config/theme";
import { semanaActual, normalizeSucursal, sucursalMatches, isSemanaActual, formatSemanaDisplay } from "../../utils/constants";
import { calcPulseScore, getPulseStatus, tieneScoreValido } from "../../utils/pulseScore";
import { esEmpleadoActivo } from "../../utils/helpers";

const PsicologaSeguimiento = ({ encuestas, notas, onUpdateNota }) => {
  const { usuarios: USERS } = useGlobal();

  const empleados = USERS.filter(esEmpleadoActivo);
  const semanaEnc = encuestas.filter(e => isSemanaActual(e.semana));
  const [nuevaNota, setNuevaNota] = useState({ empId: null, texto: "" });
  const [empleadoDetalle, setEmpleadoDetalle] = useState(null);
  const [filtroSucursal, setFiltroSucursal] = useState("Todas");
  const [filtroSemaforo, setFiltroSemaforo] = useState("Todos");
  const [busqueda, setBusqueda] = useState("");

  const getUltimoSemaforo = (empId) => {
    const enc = encuestas.filter(e => e.empleadoId === empId).sort((a, b) => b.semana.localeCompare(a.semana));
    return String(enc[0]?.semaforo || "verde").toLowerCase();
  };

  const contestaron = new Set(semanaEnc.map(e => e.empleadoId)).size;
  // Cuenta empleados en rojo (mismo criterio que las tarjetas del grid), no filas de encuesta.
  const focoRojo = empleados.filter(emp => getUltimoSemaforo(emp.id) === "rojo").length;

  // Filtros (mismo patrón que /psicologa/empleados): texto, sucursal y semáforo.
  const filtered = empleados.filter(emp => {
    const texto = busqueda.toLowerCase();
    const coincideBusqueda =
      emp.name.toLowerCase().includes(texto) ||
      String(emp.puesto || "").toLowerCase().includes(texto) ||
      normalizeSucursal(emp.sucursal).toLowerCase().includes(texto);
    const coincideSucursal = filtroSucursal === "Todas" || sucursalMatches(emp.sucursal, filtroSucursal);
    const coincideSemaforo = filtroSemaforo === "Todos" || getUltimoSemaforo(emp.id) === filtroSemaforo;
    return coincideBusqueda && coincideSucursal && coincideSemaforo;
  });

  return (
    <div className="admin-page psico-seguimiento-page">
      <PageHeader
        icon="heart"
        title="Seguimiento psicológico"
        subtitle="Panel confidencial de bienestar, semáforo y notas clínicas por colaborador."
      />

      <div className="admin-stat-grid">
        <StatCard iconName="users" value={empleados.length} label="Total colaboradores" valueClass="admin-stat-value--green" />
        <StatCard iconName="check" value={contestaron} label="Contestaron" valueClass="admin-stat-value--blue" />
        <StatCard iconName="clock" value={empleados.length - contestaron} label="Pendientes" valueClass="admin-stat-value--amber" />
        <StatCard iconName="critical" value={focoRojo} label="Foco rojo" valueClass="admin-stat-value--red" />
      </div>

      <Card>
        <SectionTitle icon="users">Semáforo por colaborador</SectionTitle>

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
            {[...new Set(empleados.map((e) => normalizeSucursal(e.sucursal)))].sort().map((s) => (
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
          Mostrando {filtered.length} de {empleados.length} colaboradores
        </div>

        <div className="psico-emp-grid">
          {filtered.length === 0 ? (
            <p className="admin-empty">Ningún colaborador coincide con los filtros.</p>
          ) : filtered.map(emp => {
            const sem = getUltimoSemaforo(emp.id);
            const ps = calcPulseScore(emp.id, encuestas);
            const contesto = semanaEnc.some(e => e.empleadoId === emp.id);
            const notaEmp = notas.find(n => n.empleadoId === emp.id);

            return (
              <div
                key={emp.id}
                className={`psico-emp-card psico-emp-card--${sem}`}
                onClick={() => setEmpleadoDetalle(emp)}
              >
                <div className="psico-emp-top">
                  <Avatar name={emp.name} size={36} color={nivelColor(sem)} photoUrl={emp.avatarUrl} />
                  <div className="psico-emp-info">
                    <div className="psico-emp-name">{emp.name}</div>
                    <div className="psico-emp-meta">{normalizeSucursal(emp.sucursal)}</div>
                  </div>
                  <Badge tipo={sem} />
                </div>

                <div className="psico-emp-score">
                  <PulseScoreBadge score={ps.score} nivel={ps.nivel} slug={ps.slug} tendencia={ps.tendencia} size="sm" />
                </div>

                <div className={`psico-emp-status ${contesto ? "psico-emp-status--ok" : "psico-emp-status--pending"}`}>
                  <Icon name={contesto ? "check" : "clock"} size={14} />
                  {contesto ? "Contestó" : "Pendiente"}
                </div>

                {nuevaNota.empId === emp.id ? (
                  <div className="psico-nota-form" onClick={(e) => e.stopPropagation()}>
                    <textarea
                      className="mc-form-textarea psico-nota-textarea"
                      value={nuevaNota.texto}
                      onClick={(e) => e.stopPropagation()}
                      onChange={e => setNuevaNota(p => ({ ...p, texto: e.target.value }))}
                      placeholder="Nota de seguimiento confidencial..."
                      rows={2}
                    />
                    <button
                      type="button"
                      className="mc-btn-primary mc-btn-with-icon psico-nota-save"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateNota(emp.id, nuevaNota.texto);
                        setNuevaNota({ empId: null, texto: "" });
                      }}
                    >
                      <Icon name="lock" size={14} /> Guardar nota
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="mc-btn-outline mc-btn-outline--edit psico-nota-add"
                    onClick={(e) => {
                      e.stopPropagation();
                      setNuevaNota({ empId: emp.id, texto: "" });
                    }}
                  >
                    <Icon name="plus" size={14} /> Agregar nota
                  </button>
                )}

                {notaEmp && (
                  <div className="psico-nota-preview">
                    <Icon name="note" size={12} />
                    <span>{notaEmp.texto.slice(0, 60)}...</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {empleadoDetalle && (() => {
        const historial = encuestas
          .filter(e => e.empleadoId === empleadoDetalle.id)
          .slice()
          .sort((a, b) => b.semana.localeCompare(a.semana));

        const ultima = historial[0];
        const score = ultima?.score || 0;
        const status = getPulseStatus(score);
        const notasEmpleado = notas.filter(n => n.empleadoId === empleadoDetalle.id);

        return (
          <div className="mc-modal-overlay psico-detail-overlay" onClick={() => setEmpleadoDetalle(null)}>
            <div className="mc-modal psico-detail-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="psico-detail-modal-title">
              <div className="psico-detail-header">
                <div>
                  <h2 id="psico-detail-modal-title" className="mc-modal-title">{empleadoDetalle.name || empleadoDetalle.nombre}</h2>
                  <p className="admin-page-subtitle psico-detail-sub">
                    {normalizeSucursal(empleadoDetalle.sucursal)} · {empleadoDetalle.puesto}
                  </p>
                </div>
                <button type="button" className="psico-detail-close" aria-label="Cerrar" onClick={() => setEmpleadoDetalle(null)}>
                  <Icon name="xCircle" size={20} />
                </button>
              </div>

              <div className="psico-detail-kpis">
                <div className="psico-detail-pulse" style={{ background: nivelBadgeBg(status.nivel), borderColor: nivelTinte(status.nivel, 20) }}>
                  <div className="psico-detail-pulse-label" style={{ color: nivelColor(status.nivel) }}>Pulse Score</div>
                  <div className="psico-detail-pulse-value" style={{ color: nivelColor(status.nivel) }}>{score}</div>
                  <div className="psico-detail-pulse-status" style={{ color: nivelColor(status.nivel) }}>{status.label}</div>
                </div>

                <div className="psico-detail-panel">
                  <h4 className="psico-detail-panel-title">Datos generales</h4>
                  <div className="psico-detail-panel-body">
                    <div><strong>Sucursal:</strong> {normalizeSucursal(empleadoDetalle.sucursal)}</div>
                    <div><strong>Puesto:</strong> {empleadoDetalle.puesto}</div>
                    <div><strong>ID:</strong> {empleadoDetalle.id}</div>
                    <div><strong>Semana actual:</strong> {formatSemanaDisplay(ultima?.semana) || "Sin registro"}</div>
                  </div>
                </div>

                <div className="psico-detail-panel">
                  <h4 className="psico-detail-panel-title">Seguimiento</h4>
                  <div className="psico-detail-panel-body">
                    <div><strong>Encuestas:</strong> {historial.length}</div>
                    <div><strong>Notas:</strong> {notasEmpleado.length}</div>
                    <div><strong>Último score:</strong> {score} pts</div>
                    <div><strong>Estado:</strong> {status.label}</div>
                  </div>
                </div>
              </div>

              <div className="psico-detail-grid">
                <div className="psico-detail-panel">
                  <h3 className="psico-detail-section-title">Historial reciente</h3>
                  {historial.length === 0 ? (
                    <p className="admin-empty">Sin encuestas registradas.</p>
                  ) : (
                    <div className="psico-history-list">
                      {historial.slice(0, 6).map(e => {
                        const s = getPulseStatus(e.score);
                        return (
                          <div key={`${e.empleadoId}-${e.semana}`} className="psico-history-item">
                            <div>
                              <div className="psico-history-week">{formatSemanaDisplay(e.semana)}</div>
                              <div className="psico-history-label">Medición semanal</div>
                            </div>
                            <div className="psico-history-score">
                              <div>{tieneScoreValido(e.score) ? `${Number(e.score)} pts` : "— pts"}</div>
                              <div style={{ color: s.color }}>{s.label}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="psico-detail-panel psico-detail-panel--notes">
                  <h3 className="psico-detail-section-title">Notas psicológicas</h3>
                  {notasEmpleado.length === 0 ? (
                    <p className="admin-empty">Sin notas registradas para este colaborador.</p>
                  ) : (
                    <div className="psico-notes-list">
                      {notasEmpleado.map(n => (
                        <div key={n.id} className="psico-note-item">
                          <div className="psico-note-title">
                            <Icon name="lock" size={12} /> Nota de seguimiento
                          </div>
                          <div>{n.texto}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="psico-confidential-banner">
                <Icon name="lock" size={16} />
                Vista privada disponible únicamente para Psicóloga.
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default PsicologaSeguimiento;
