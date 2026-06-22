import React from "react";
import { useGlobal } from "../../contexts/GlobalContext";
import Card from "../common/Card";
import Badge from "../common/Badge";
import KPI from "../common/KPI";
import MiniBar from "../common/MiniBar";
import LineChart from "../common/LineChart";
import Avatar from "../ui/Avatar";
import { SUCURSALES } from "../../utils/constants";
import { calcPulseScore, getPulseStatus } from "../../utils/pulseScore";
import PulseScoreBadge from "../common/PulseScoreBadge";
import { semanaActual } from "../../utils/constants";

const AdminDashboard = ({ encuestas, mensajes }) => {
  const { usuarios: USERS } = useGlobal();

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
        ? { label: "Sin datos", semaforo: "Sin datos", color: "#94a3b8", bg: "#f1f5f9" }
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
    ? { label: "Sin datos", semaforo: "Sin datos", color: "#94a3b8", bg: "#f1f5f9" }
    : getPulseStatus(avgPulse);

  const enFocoRojo = empleadosConDatos.filter(e => e.status.semaforo === "Rojo");

  return (
    <div className="admin-page dashboard-page">
      <div className="admin-page-header dashboard-header">
        <div>
          <h1 className="admin-page-title dashboard-title">Dashboard Global</h1>
          <p className="admin-page-subtitle dashboard-subtitle">Visión ejecutiva del bienestar organizacional</p>
        </div>
        <span className="dashboard-week-badge">📅 Semana {semanaActual}</span>
      </div>

      <div className="kpi-row">
        <KPI icon="👥" label="Empleados" value={empleados.length} color="#006D5B" />
        <KPI icon="✅" label="Contestaron" value={contestaron} sub={`de ${empleados.length}`} color="#0891b2" />
        <KPI icon="🟢" label="Verde" value={verdes} color="#22c55e" />
        <KPI icon="🟡" label="Amarillo" value={amarillos} color="#f59e0b" />
        <KPI icon="🔴" label="Rojo" value={rojos} color="#ef4444" />
        <Card className="pulse-hero-card" style={{ minWidth: 160 }}>
          <div className="pulse-hero-label">PULSE SCORE™</div>
          <div className="pulse-hero-value">{avgPulse ?? "—"}</div>
          <div className="pulse-hero-meta">
            {avgPulseStatus.label} · Semáforo {avgPulseStatus.semaforo}
          </div>
          <div className="pulse-hero-sub">Promedio organizacional</div>
        </Card>
      </div>

      <div className="dashboard-grid-2">
        <Card>
          <div className="dashboard-section-title">📈 Tendencia Semanal</div>
          <LineChart data={tendencia} color="#006D5B" />
        </Card>
        <Card>
          <div className="dashboard-section-title">🏢 Score por Sucursal</div>
          <MiniBar
            data={porSucursal}
            colorFn={d => {
              const val = d.value ?? d.v ?? 0;
              return val >= 70 ? "#22c55e" : val >= 45 ? "#f59e0b" : "#ef4444";
            }}
          />
        </Card>
      </div>

      <Card>
        <div className="dashboard-section-title">🔴 Empleados en Foco Rojo</div>
        {enFocoRojo.length === 0 ? (
          <div className="dashboard-empty">Sin empleados en foco rojo esta semana ✅</div>
        ) : (
          enFocoRojo.map(e => {
            const emp = e.empleado;
            const ps = e.pulse;
            return (
              <div key={emp.id} className="dashboard-employee-row">
                <Avatar name={emp.name} size={40} color="#ef4444" />
                <div className="dashboard-employee-info">
                  <div className="dashboard-employee-name">{emp.name}</div>
                  <div className="dashboard-employee-meta">{emp.sucursal} · {emp.puesto}</div>
                </div>
                <Badge tipo="rojo" />
                <PulseScoreBadge score={ps.score} nivel={ps.nivel} color={ps.color} tendencia={ps.tendencia} size="sm" />
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
};

export default AdminDashboard;
