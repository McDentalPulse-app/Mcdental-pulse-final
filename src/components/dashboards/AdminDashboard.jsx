import React, { useState } from "react";
import Card from "../common/Card";
import Badge from "../common/Badge";
import KPI from "../common/KPI";
import MiniBar from "../common/MiniBar";
import LineChart from "../common/LineChart";
import Avatar from "../ui/Avatar";
import { SUCURSALES } from "../../utils/constants";

import { USERS } from "../../data/initialData";
import { calcPulseScore, getPulseStatus } from "../../utils/pulseScore";
import PulseScoreBadge from "../common/PulseScoreBadge";
import { semanaActual } from "../../utils/constants";
const AdminDashboard = ({ encuestas, mensajes }) => {
  const empleados = USERS.filter(u => u.role === "empleado");
const semanaEnc = encuestas.filter(e => e.semana === semanaActual);
const contestaron = new Set(semanaEnc.map(e => e.empleadoId)).size;

const pulsePorEmpleado = empleados.map(emp => {
  const pulse = calcPulseScore(emp.id, encuestas);

  return {
    empleado: emp,
    score: pulse.score,
    sinDatos: pulse.sinDatos,
    pulse,
    status: pulse.sinDatos
      ? {
          label: "Sin datos",
          semaforo: "Sin datos",
          color: "#94a3b8",
          bg: "#f1f5f9"
        }
      : getPulseStatus(pulse.score)
  };
});

const empleadosConDatos = pulsePorEmpleado.filter(
  e => !e.sinDatos && Number.isFinite(Number(e.score))
);

const verdes = empleadosConDatos.filter(e => e.status.semaforo === "Verde").length;
const amarillos = empleadosConDatos.filter(e => e.status.semaforo === "Amarillo").length;
const rojos = empleadosConDatos.filter(e => e.status.semaforo === "Rojo").length;

const tendencia = ["W10","W11","W12","W13","W14"].map(w => {
  const encValidas = encuestas.filter(
    e => e.semana === `2025-${w}` && Number.isFinite(Number(e.score))
  );

  return {
    label: w,
    v: encValidas.length
      ? Math.round(encValidas.reduce((s,e)=>s+Number(e.score),0) / encValidas.length)
      : 0
  };
});

const porSucursal = SUCURSALES.map(s => {
  const emps = empleados.filter(e=>e.sucursal===s).map(e=>e.id);
  const encValidas = semanaEnc.filter(
    e => emps.includes(e.empleadoId) && Number.isFinite(Number(e.score))
  );

  return {
    label: s,
    v: encValidas.length
      ? Math.round(encValidas.reduce((sum,e)=>sum+Number(e.score),0) / encValidas.length)
      : 0
  };
});

const avgPulse = empleadosConDatos.length
  ? Math.round(
      empleadosConDatos.reduce((s,e)=>s+Number(e.score),0) /
      empleadosConDatos.length
    )
  : null;

const avgPulseStatus = avgPulse === null
  ? {
      label: "Sin datos",
      semaforo: "Sin datos",
      color: "#94a3b8",
      bg: "#f1f5f9"
    }
  : getPulseStatus(avgPulse);
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#004D40" }}>Dashboard Global</h2>
        <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 13 }}>Semana {semanaActual}</p>
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <KPI icon="👥" label="Empleados" value={empleados.length} color="#006D5B" />
<KPI icon="✅" label="Contestaron" value={contestaron} sub={`de ${empleados.length}`} color="#0891b2" />
<KPI icon="🟢" label="Verde" value={verdes} color="#22c55e" />
<KPI icon="🟡" label="Amarillo" value={amarillos} color="#f59e0b" />
<KPI icon="🔴" label="Rojo" value={rojos} color="#ef4444" />
        <Card style={{ flex: 1, minWidth: 130, background: "linear-gradient(135deg,#004D40,#0891b2)" }}>
          <div style={{ fontSize: 11, color: "#a7f3d0", fontWeight: 700, marginBottom: 4 }}>PULSE SCORE™</div>
          <div style={{ fontSize: 30, fontWeight: 900, color: "#fff" }}>{avgPulse}</div>
          <div style={{ fontSize: 12, color: "#d1fae5", marginTop: 4 }}>
  {avgPulseStatus.label} · Semáforo {avgPulseStatus.semaforo}
</div>
          <div style={{ fontSize: 11, color: "#a7f3d0" }}>Promedio org.</div>
        </Card>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <Card><div style={{ fontWeight: 700, fontSize: 14, color: "#004D40", marginBottom: 16 }}>📈 Tendencia Semanal</div><LineChart data={tendencia} color="#006D5B" /></Card>
        <Card><div style={{ fontWeight: 700, fontSize: 14, color: "#004D40", marginBottom: 16 }}>🏢 Score por Sucursal</div><MiniBar data={porSucursal} colorFn={d => d.value>=70?"#22c55e":d.value>=45?"#f59e0b":"#ef4444"} /></Card>
      </div>
      <Card>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#004D40", marginBottom: 16 }}>🔴 Empleados en Foco Rojo</div>
        {empleadosConDatos.filter(e=>e.status.semaforo==="Rojo").length===0 ? <div style={{ color: "#9ca3af", fontSize: 13 }}>Sin empleados en foco rojo esta semana ✅</div> :
  empleadosConDatos.filter(e=>e.status.semaforo==="Rojo").map(e => { const emp=e.empleado; const ps=e.pulse; return (
    <div key={emp.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #f3f4f6" }}>
      <Avatar name={emp.name} size={36} color="#ef4444" />
      <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 14 }}>{emp.name}</div><div style={{ fontSize: 12, color: "#6b7280" }}>{emp.sucursal} · {emp.puesto}</div></div>
      <Badge tipo="rojo" />
      <PulseScoreBadge score={ps.score} nivel={ps.nivel} color={ps.color} tendencia={ps.tendencia} size="sm" />
    </div>
  );})
}
      </Card>
    </div>
  );
};


export default AdminDashboard;
