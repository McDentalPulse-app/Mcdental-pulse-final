import React from "react";
import Card from "../common/Card";
import StatCard from "../common/StatCard";
import SectionTitle from "../common/SectionTitle";
import Icon from "../ui/Icon";
import { SUCURSALES } from "../../utils/constants";

const ReportesRH = ({ vacaciones, permisos, descuentos }) => {
  const totalDescuentosActivos = descuentos
    .filter(d => d.estado !== "pagado" && d.estado !== "cancelado")
    .reduce((sum, d) => sum + d.monto, 0);

  const movimientosPorEmpleado = {};

  [...vacaciones, ...permisos, ...descuentos].forEach(item => {
    if (!movimientosPorEmpleado[item.empleado]) {
      movimientosPorEmpleado[item.empleado] = {
        empleado: item.empleado,
        sucursal: item.sucursal,
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
    vacaciones: vacaciones.filter(v => v.sucursal === sucursal).length,
    permisos: permisos.filter(p => p.sucursal === sucursal).length,
    descuentos: descuentos.filter(d => d.sucursal === sucursal).length
  }));

  return (
    <div>
      <h1 style={{ margin: "0 0 6px", fontSize: 28, color: "#004D40" }}>
        Reportes RH
      </h1>
      <p style={{ margin: "0 0 24px", color: "#64748b" }}>
        Resumen administrativo de vacaciones, permisos y descuentos.
      </p>

      <div className="admin-stat-grid">
        <StatCard iconName="vacation" value={vacaciones.length} label="Vacaciones" valueClass="admin-stat-value--blue" />
        <StatCard iconName="clipboard" value={permisos.length} label="Permisos" valueClass="admin-stat-value--amber" />
        <StatCard iconName="dollar" value={money(totalDescuentosActivos)} label="Descuentos activos" valueClass="admin-stat-value--green" />
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        gap: 16
      }}>
        <Card>
          <SectionTitle icon="chart">Resumen por sucursal</SectionTitle>
          <div style={{ display: "grid", gap: 10 }}>
            {resumenSucursal.map(s => (
              <div key={s.sucursal} style={{
                padding: 12,
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                background: "#f8fafc"
              }}>
                <div style={{ fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>
                  {s.sucursal}
                </div>
                <div style={{ color: "#64748b", fontSize: 13, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="vacation" size={14} /> {s.vacaciones} vacaciones</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="clipboard" size={14} /> {s.permisos} permisos</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="dollar" size={14} /> {s.descuentos} descuentos</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle icon="users">Empleados con más movimientos</SectionTitle>
          <div style={{ display: "grid", gap: 10 }}>
            {ranking.map((e, index) => (
              <div key={e.empleado} style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 0",
                borderBottom: "1px solid #e5e7eb"
              }}>
                <div>
                  <div style={{ fontWeight: 800, color: "#0f172a" }}>
                    {index + 1}. {e.empleado}
                  </div>
                  <div style={{ color: "#64748b", fontSize: 13 }}>
                    {e.sucursal}
                  </div>
                </div>
                <div style={{
                  background: "#ecfeff",
                  color: "#0e7490",
                  padding: "6px 10px",
                  borderRadius: 999,
                  fontWeight: 800,
                  fontSize: 13
                }}>
                  {e.total} movimientos
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle icon="pin">Lectura administrativa</SectionTitle>
          <div style={{ color: "#334155", lineHeight: 1.7 }}>
            <p>
              RH tiene registrados {vacaciones.length} movimientos de vacaciones,
              {` ${permisos.length}`} permisos
              y {` ${descuentos.length}`} descuentos administrativos.
            </p>
            <p>
              El monto activo en descuentos es de <b>{money(totalDescuentosActivos)}</b>.
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
