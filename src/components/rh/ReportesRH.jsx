import React from "react";
import Card from "../common/Card";
import StatCard from "../common/StatCard";
import SectionTitle from "../common/SectionTitle";
import Icon from "../ui/Icon";
import { SUCURSALES, normalizeSucursal, sucursalMatches } from "../../utils/constants";

const ReportesRH = ({ vacaciones, permisos, descuentos }) => {
  const totalDescuentosActivos = descuentos
    .filter(d => d.estado !== "pagado" && d.estado !== "cancelado")
    .reduce((sum, d) => sum + d.monto, 0);

  const movimientosPorEmpleado = {};

  [...vacaciones, ...permisos, ...descuentos].forEach(item => {
    if (!movimientosPorEmpleado[item.empleado]) {
      movimientosPorEmpleado[item.empleado] = {
        empleado: item.empleado,
        sucursal: normalizeSucursal(item.sucursal),
        total: 0
      };
    }
    movimientosPorEmpleado[item.empleado].total += 1;
  });

  const ranking = Object.values(movimientosPorEmpleado)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const money = (amount) =>
    new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN"
    }).format(amount);

  const resumenSucursal = SUCURSALES.map(sucursal => ({
    sucursal,
    vacaciones: vacaciones.filter((v) => sucursalMatches(v.sucursal, sucursal)).length,
    permisos: permisos.filter((p) => sucursalMatches(p.sucursal, sucursal)).length,
    descuentos: descuentos.filter((d) => sucursalMatches(d.sucursal, sucursal)).length,
  }));

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">Reportes RH</h1>
        <p className="admin-page-subtitle">
          Resumen administrativo de vacaciones, permisos y descuentos por sucursal y colaborador.
        </p>
      </div>

      <div className="admin-stat-grid">
        <StatCard iconName="vacation" value={vacaciones.length} label="Vacaciones" valueClass="admin-stat-value--blue" />
        <StatCard iconName="clipboard" value={permisos.length} label="Permisos" valueClass="admin-stat-value--amber" />
        <StatCard iconName="dollar" value={money(totalDescuentosActivos)} label="Descuentos activos" valueClass="admin-stat-value--green" />
      </div>

      <div className="rh-report-grid">
        <Card className="rh-report-card">
          <SectionTitle icon="chart">Resumen por sucursal</SectionTitle>
          <div className="rh-sucursal-list rh-report-scroll-list">
            {resumenSucursal.map(s => (
              <div key={s.sucursal} className="rh-sucursal-item">
                <div className="rh-sucursal-name">{normalizeSucursal(s.sucursal)}</div>
                <div className="rh-sucursal-stats">
                  <span className="rh-sucursal-stat"><Icon name="vacation" size={14} /> {s.vacaciones} vacaciones</span>
                  <span className="rh-sucursal-stat"><Icon name="clipboard" size={14} /> {s.permisos} permisos</span>
                  <span className="rh-sucursal-stat"><Icon name="dollar" size={14} /> {s.descuentos} descuentos</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="rh-report-card">
          <SectionTitle icon="users">Empleados con más movimientos</SectionTitle>
          <div className="rh-ranking-list">
            {ranking.map((e, index) => (
              <div key={e.empleado} className="rh-ranking-row">
                <div className="rh-ranking-main">
                  <div className="rh-ranking-name">{index + 1}. {e.empleado}</div>
                  <div className="rh-ranking-sub">{normalizeSucursal(e.sucursal)}</div>
                </div>
                <span className="rh-ranking-badge">{e.total} movimientos</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="rh-report-card rh-report-card--wide">
          <SectionTitle icon="pin">Lectura administrativa</SectionTitle>
          <div className="rh-report-insight">
            <p>
              RH tiene registrados {vacaciones.length} movimientos de vacaciones,
              {` ${permisos.length}`} permisos
              y {` ${descuentos.length}`} descuentos administrativos.
            </p>
            <p>
              El monto activo en descuentos es de <strong>{money(totalDescuentosActivos)}</strong>.
            </p>
            <p>
              Este reporte ayuda a identificar carga administrativa, incidencias recurrentes y seguimiento por sucursal.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ReportesRH;
