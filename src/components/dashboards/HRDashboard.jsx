import React, { useState } from "react";
import Card from "../common/Card";
import Badge from "../common/Badge";
import KPI from "../common/KPI";
import MiniBar from "../common/MiniBar";
import LineChart from "../common/LineChart";
import Avatar from "../ui/Avatar";
import { SUCURSALES } from "../../utils/constants";

const HRDashboard = ({ users }) => {
  const empleados = users.filter(u => u.role === "empleado");

  const stats = [
    { label: "Empleados activos", value: empleados.length, icon: "👥" },
    { label: "Vacaciones pendientes", value: 3, icon: "🏖️" },
    { label: "Retardos registrados", value: 4, icon: "⏰" },
    { label: "Descuentos activos", value: 2, icon: "💸" },
  ];

  return (
    <div>
      <h1 style={{ margin: "0 0 6px", fontSize: 28, color: "#004D40" }}>
        Dashboard RH
      </h1>
      <p style={{ margin: "0 0 24px", color: "#64748b" }}>
        Gestión administrativa de vacaciones, descuentos y calendario laboral.
      </p>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 14,
        marginBottom: 22
      }}>
        {stats.map((s, i) => (
          <Card key={i}>
            <div style={{ fontSize: 24 }}>{s.icon}</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: "#00897B", marginTop: 8 }}>
              {s.value}
            </div>
            <div style={{ color: "#0f172a", fontWeight: 700 }}>
              {s.label}
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <h3 style={{ marginTop: 0, color: "#004D40" }}>📌 Pendientes RH</h3>
        <div style={{ display: "grid", gap: 10 }}>
          <div>🏖️ Ana García solicitó vacaciones del 15 al 19 de julio.</div>
          <div>💸 Luis Torres tiene descuento pendiente de revisión.</div>
          <div>⏰ Luis Torres acumula 2 retardos este mes.</div>
        </div>
      </Card>
    </div>
  );
};


export default HRDashboard;
