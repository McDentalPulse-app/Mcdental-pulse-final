import React from "react";
import Card from "../common/Card";
import StatCard from "../common/StatCard";
import SectionTitle from "../common/SectionTitle";
import PageHeader from "../common/PageHeader";
import Icon from "../ui/Icon";
import { esEmpleadoActivo } from "../../utils/helpers";

const HRDashboard = ({ users }) => {
  const empleados = users.filter(esEmpleadoActivo);

  const stats = [
    { label: "Empleados activos", value: empleados.length, iconName: "users", valueClass: "admin-stat-value--green" },
    { label: "Vacaciones pendientes", value: 3, iconName: "vacation", valueClass: "admin-stat-value--amber" },
    { label: "Retardos registrados", value: 4, iconName: "clock", valueClass: "admin-stat-value--amber" },
    { label: "Descuentos activos", value: 2, iconName: "dollar", valueClass: "admin-stat-value--blue" },
  ];

  const pendientes = [
    { icon: "vacation", text: "Hay solicitudes de vacaciones pendientes de revisión." },
    { icon: "dollar", text: "Luis Torres tiene descuento pendiente de revisión." },
    { icon: "clock", text: "Luis Torres acumula 2 retardos este mes." },
  ];

  return (
    <div className="admin-page dashboard-page">
      <PageHeader
        icon="users"
        eyebrow="McDental Pulse · Recursos Humanos"
        title="Dashboard RH"
        subtitle="Gestión administrativa de vacaciones, descuentos y calendario laboral."
      >
        <span className="dashboard-week-badge">
          <Icon name="users" size={14} />
          {empleados.length} colaboradores
        </span>
      </PageHeader>

      <div className="admin-stat-grid">
        {stats.map((s, i) => (
          <StatCard key={i} iconName={s.iconName} value={s.value} label={s.label} valueClass={s.valueClass} />
        ))}
      </div>

      <Card>
        <SectionTitle icon="pin">Pendientes RH</SectionTitle>
        <div className="rh-pending-list">
          {pendientes.map((p, i) => (
            <div key={i} className="rh-pending-item">
              <span className="rh-pending-icon"><Icon name={p.icon} size={16} /></span>
              <span className="rh-pending-text">{p.text}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default HRDashboard;
