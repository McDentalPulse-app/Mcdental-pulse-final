import React, { useState } from "react";
import Card from "../common/Card";
import Badge from "../common/Badge";
import KPI from "../common/KPI";
import MiniBar from "../common/MiniBar";
import LineChart from "../common/LineChart";
import Avatar from "../ui/Avatar";
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

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 14,
        marginBottom: 22
      }}>
        <Card>
          <div style={{ fontSize: 24 }}>🏖️</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: "#0891b2" }}>{vacaciones.length}</div>
          <div style={{ fontWeight: 700 }}>Vacaciones</div>
        </Card>

        <Card>
          <div style={{ fontSize: 24 }}>📝</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: "#f59e0b" }}>{permisos.length}</div>
          <div style={{ fontWeight: 700 }}>Permisos</div>
        </Card>

        <Card>
          <div style={{ fontSize: 24 }}>💰</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#00897B" }}>{money(totalDescuentosActivos)}</div>
          <div style={{ fontWeight: 700 }}>Descuentos activos</div>
        </Card>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        gap: 16
      }}>
        <Card>
          <h3 style={{ marginTop: 0, color: "#004D40" }}>📊 Resumen por sucursal</h3>
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
                <div style={{ color: "#64748b", fontSize: 13 }}>
                  🏖️ {s.vacaciones} vacaciones · 📝 {s.permisos} permisos · 💸 {s.descuentos} descuentos
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h3 style={{ marginTop: 0, color: "#004D40" }}>👥 Empleados con más movimientos</h3>
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
          <h3 style={{ marginTop: 0, color: "#004D40" }}>📌 Lectura administrativa</h3>
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
