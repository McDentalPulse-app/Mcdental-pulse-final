import React from "react";
import Card from "../common/Card";
import StatCard from "../common/StatCard";
import SectionTitle from "../common/SectionTitle";
import Icon from "../ui/Icon";

const HRDashboard = ({ users }) => {
  const empleados = users.filter(u => u.role === "empleado");

  const stats = [
    { label: "Empleados activos", value: empleados.length, iconName: "users" },
    { label: "Vacaciones pendientes", value: 3, iconName: "vacation" },
    { label: "Retardos registrados", value: 4, iconName: "clock" },
    { label: "Descuentos activos", value: 2, iconName: "dollar" },
  ];

  const pendientes = [
    { icon: "vacation", text: "Ana García solicitó vacaciones del 15 al 19 de julio." },
    { icon: "dollar", text: "Luis Torres tiene descuento pendiente de revisión." },
    { icon: "clock", text: "Luis Torres acumula 2 retardos este mes." },
  ];

  return (
    <div>
      <h1 style={{ margin: "0 0 6px", fontSize: 28, color: "#004D40" }}>
        Dashboard RH
      </h1>
      <p style={{ margin: "0 0 24px", color: "#64748b" }}>
        Gestión administrativa de vacaciones, descuentos y calendario laboral.
      </p>

      <div className="admin-stat-grid">
        {stats.map((s, i) => (
          <StatCard key={i} iconName={s.iconName} value={s.value} label={s.label} valueClass="admin-stat-value--green" />
        ))}
      </div>

      <Card>
        <SectionTitle icon="pin">Pendientes RH</SectionTitle>
        <div style={{ display: "grid", gap: 10 }}>
          {pendientes.map((p, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, color: "#334155" }}>
              <span style={{ marginTop: 2, flexShrink: 0 }}><Icon name={p.icon} size={16} /></span>
              {p.text}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};


export default HRDashboard;
