import React, { useState } from "react";
import { useGlobal } from "../../contexts/GlobalContext";
import Card from "../common/Card";
import KPI from "../common/KPI";
import Badge from "../common/Badge";
import Avatar from "../ui/Avatar";
import PulseScoreBadge from "../common/PulseScoreBadge";
import RiskBar from "../common/RiskBar";
import { semaforoColor, semaforoBg, semaforoLabel } from "../../config/theme";

import { semanaActual } from "../../utils/constants";
import { calcularAntiguedad } from "../../utils/helpers";
import { calcPulseScore, getPulseStatus, calcRiesgos } from "../../utils/pulseScore";

const PsicologaSeguimiento = ({ encuestas, notas, onUpdateNota }) => {
  const { usuarios: USERS } = useGlobal();

  const empleados = USERS.filter(u => u.role === "empleado");
  const semanaEnc = encuestas.filter(e => e.semana === semanaActual);
  const [nuevaNota, setNuevaNota] = useState({ empId:null,texto:"" });
  const [empleadoDetalle, setEmpleadoDetalle] = useState(null);
  const getUltimoSemaforo = (empId) => { const enc=encuestas.filter(e=>e.empleadoId===empId).sort((a,b)=>b.semana.localeCompare(a.semana)); return enc[0]?.semaforo||"verde"; };
  return (
    <div>
      <h2 style={{ margin:"0 0 20px",fontSize:22,fontWeight:800,color:"#004D40" }}>🎯 Panel de Seguimiento</h2>
      <div style={{ display:"flex",gap:16,flexWrap:"wrap",marginBottom:24 }}>
        <KPI icon="👥" label="Total" value={empleados.length} color="#006D5B" />
        <KPI icon="✅" label="Contestaron" value={new Set(semanaEnc.map(e=>e.empleadoId)).size} sub={semanaActual} color="#0891b2" />
        <KPI icon="⏳" label="Pendientes" value={empleados.length-new Set(semanaEnc.map(e=>e.empleadoId)).size} color="#f59e0b" />
        <KPI icon="🔴" label="Foco Rojo" value={semanaEnc.filter(e=>e.semaforo==="rojo").length} color="#ef4444" />
      </div>
      <Card>
        <div style={{ fontWeight:700,fontSize:14,color:"#004D40",marginBottom:16 }}>Semáforo por Empleado</div>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:12 }}>
          {empleados.map(emp => {
            const sem=getUltimoSemaforo(emp.id); const ps=calcPulseScore(emp.id,encuestas); const contesto=semanaEnc.some(e=>e.empleadoId===emp.id); const notaEmp=notas.find(n=>n.empleadoId===emp.id);
            return (
              <div key={emp.id} onClick={() => setEmpleadoDetalle(emp)} style={{ border: `2px solid ${semaforoColor[sem]}20`, borderRadius: 12, padding: 14, cursor: "pointer"}}
>
                <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:10 }}>
                  <Avatar name={emp.name} size={36} color={semaforoColor[sem]}/>
                  <div style={{ flex:1 }}><div style={{ fontWeight:700,fontSize:14 }}>{emp.name}</div><div style={{ fontSize:12,color:"#6b7280" }}>{emp.sucursal}</div></div>
                  <Badge tipo={sem}/>
                </div>
                <div style={{ marginBottom:8 }}><PulseScoreBadge score={ps.score} nivel={ps.nivel} color={ps.color} tendencia={ps.tendencia} size="sm"/></div>
                <div style={{ fontSize:12,color:contesto?"#22c55e":"#f59e0b",marginBottom:8 }}>{contesto?"✅ Contestó":"⏳ Pendiente"}</div>
                {nuevaNota.empId===emp.id ? (<div onClick={(e) => e.stopPropagation()} style={{ display: "grid", gap: 6 }}> <textarea value={nuevaNota.texto} onClick={(e) => e.stopPropagation()} onChange={e=>setNuevaNota(p=>({...p,texto:e.target.value}))} placeholder="Nota de seguimiento..." rows={2} style={{ width:"100%" }} />

    <button
      onClick={(e) => {
        e.stopPropagation();
        onUpdateNota(emp.id, nuevaNota.texto);
        setNuevaNota({ empId:null, texto:"" });
      }}
      style={{ width:"100%",padding:"6px",background:"#006D5B",color:"#fff",border:"none",borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer" }}
    >
      Guardar nota
    </button>
  </div>
) : (
  <button
    onClick={(e) => {
      e.stopPropagation();
      setNuevaNota({ empId: emp.id, texto: "" });
    }}
    style={{ width:"100%",padding:"6px",background:"#f0fdf4",color:"#006D5B",border:"1px solid #bbf7d0",borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer" }}
  >
    + Agregar nota
  </button>
)}
                {notaEmp&&<div style={{ marginTop:8,background:"#fef3c7",borderRadius:8,padding:"8px 10px",fontSize:11,color:"#92400e" }}>📝 {notaEmp.texto.slice(0,60)}...</div>}
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
    <div
      onClick={() => setEmpleadoDetalle(null)}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.55)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(920px, 96vw)",
          maxHeight: "90vh",
          overflowY: "auto",
          background: "#ffffff",
          borderRadius: 24,
          padding: 28,
          boxShadow: "0 30px 80px rgba(0,0,0,0.25)"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0, color: "#004D40", fontSize: 26 }}>
              {empleadoDetalle.name || empleadoDetalle.nombre}
            </h2>
            <p style={{ margin: "6px 0 0", color: "#64748b" }}>
              {empleadoDetalle.sucursal} · {empleadoDetalle.puesto}
            </p>
          </div>

          <button
            onClick={() => setEmpleadoDetalle(null)}
            style={{
              border: "none",
              background: "#f1f5f9",
              color: "#0f172a",
              width: 38,
              height: 38,
              borderRadius: 999,
              cursor: "pointer",
              fontWeight: 900,
              fontSize: 18
            }}
          >
            ×
          </button>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
          marginBottom: 18
        }}>
          <div style={{
            padding: 18,
            borderRadius: 18,
            background: status.bg,
            border: `1px solid ${status.color}33`,
            textAlign: "center"
          }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: status.color }}>
              PULSE SCORE™
            </div>
            <div style={{ fontSize: 36, fontWeight: 900, color: status.color }}>
              {score}
            </div>
            <div style={{ color: status.color, fontWeight: 900 }}>
              {status.label}
            </div>
          </div>

          <div style={{
            padding: 18,
            borderRadius: 18,
            background: "#f8fafc",
            border: "1px solid #e5e7eb"
          }}>
            <h4 style={{ margin: "0 0 10px", color: "#004D40" }}>Datos generales</h4>
            <div style={{ color: "#334155", lineHeight: 1.8 }}>
              <strong>Sucursal:</strong> {empleadoDetalle.sucursal}<br />
              <strong>Puesto:</strong> {empleadoDetalle.puesto}<br />
              <strong>ID:</strong> {empleadoDetalle.id}<br />
              <strong>Semana actual:</strong> {ultima?.semana || "Sin registro"}
            </div>
          </div>

          <div style={{
            padding: 18,
            borderRadius: 18,
            background: "#f8fafc",
            border: "1px solid #e5e7eb"
          }}>
            <h4 style={{ margin: "0 0 10px", color: "#004D40" }}>Seguimiento</h4>
            <div style={{ color: "#334155", lineHeight: 1.8 }}>
              <strong>Encuestas:</strong> {historial.length}<br />
              <strong>Notas:</strong> {notasEmpleado.length}<br />
              <strong>Último score:</strong> {score} pts<br />
              <strong>Estado:</strong> {status.label}
            </div>
          </div>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr",
          gap: 16
        }}>
          <div style={{
            padding: 18,
            borderRadius: 18,
            background: "#ffffff",
            border: "1px solid #e5e7eb"
          }}>
            <h3 style={{ marginTop: 0, color: "#004D40" }}>Historial reciente</h3>

            {historial.length === 0 ? (
              <p style={{ color: "#64748b" }}>Sin encuestas registradas.</p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {historial.slice(0, 6).map(e => {
                  const s = getPulseStatus(e.score);

                  return (
                    <div
                      key={`${e.empleadoId}-${e.semana}`}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                        padding: 12,
                        borderRadius: 14,
                        background: "#f8fafc",
                        border: "1px solid #e5e7eb"
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 900 }}>{e.semana}</div>
                        <div style={{ color: "#64748b", fontSize: 13 }}>Medición semanal</div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        {Number.isFinite(Number(e.score)) ? Number(e.score) : 50} pts
                        <div style={{ fontSize: 12, color: s.color, fontWeight: 800 }}>
                          {s.label}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{
            padding: 18,
            borderRadius: 18,
            background: "#ffffff",
            border: "1px solid #e5e7eb"
          }}>
            <h3 style={{ marginTop: 0, color: "#004D40" }}>Notas psicológicas</h3>

            {notasEmpleado.length === 0 ? (
              <p style={{ color: "#64748b" }}>
                Sin notas registradas para este colaborador.
              </p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {notasEmpleado.map(n => (
                  <div
                    key={n.id}
                    style={{
                      padding: 12,
                      borderRadius: 14,
                      background: "#fff7ed",
                      border: "1px solid #fed7aa",
                      color: "#7c2d12",
                      lineHeight: 1.5
                    }}
                  >
                    <div style={{ fontWeight: 900, marginBottom: 4 }}>Nota de seguimiento</div>
                    <div>{n.texto}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{
          marginTop: 18,
          padding: 14,
          borderRadius: 16,
          background: "#ecfeff",
          border: "1px solid #bae6fd",
          color: "#004D40",
          fontWeight: 800,
          textAlign: "center"
        }}>
          🔒 Vista privada disponible únicamente para Psicóloga.
        </div>
      </div>
    </div>
  );
})()}
    </div>
  );
};


export default PsicologaSeguimiento;
