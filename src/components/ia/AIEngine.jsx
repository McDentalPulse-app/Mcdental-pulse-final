import React, { useState, useEffect, useRef } from "react";
import { useGlobal } from "../../contexts/GlobalContext";
import Card from "../common/Card";
import StatCard from "../common/StatCard";
import SectionTitle from "../common/SectionTitle";
import Icon from "../ui/Icon";
import Badge from "../common/Badge";
import Avatar from "../ui/Avatar";
import PulseScoreBadge from "../common/PulseScoreBadge";
import RiskBar from "../common/RiskBar";
import { semaforoColor, semaforoBg, semaforoLabel } from "../../config/theme";

import { semanaActual } from "../../utils/constants";
import { calcularAntiguedad } from "../../utils/helpers";
import { calcPulseScore, getPulseStatus, calcRiesgos } from "../../utils/pulseScore";
import { callAI } from "../../utils/analysisEngine";
import { db } from "../../config/firebase";
import { collection, addDoc, getDocs, updateDoc, doc, serverTimestamp } from "firebase/firestore";

const STATUS_SIN_DATOS = {
  label: "Sin datos",
  semaforo: "Sin evaluación",
  color: "#94a3b8",
  bg: "#f1f5f9"
};

const analyzeEmployeeAI = (empleado, encuestas, permisos = [], descuentos = [], reconocimientos = [], reportesConfidenciales = [], USERS = []) => {
  const encuestasEmpleado = encuestas.filter(e => e.empleadoId === empleado.id);
  const encuestasConScore = encuestasEmpleado.filter(e => Number.isFinite(Number(e.score)));
  const permisosEmpleado = permisos.filter(p => p.empleadoId === empleado.id);
  const descuentosEmpleado = descuentos.filter(d => d.empleadoId === empleado.id);
  const reconocimientosEmpleado = reconocimientos.filter(r => r.empleadoId === empleado.id);
  const reportesEmpleado = reportesConfidenciales.filter(r => r.empleadoId === empleado.id);

  const pulseResult = calcPulseScore(empleado.id, encuestas);
  const tieneDatosReales = !pulseResult.sinDatos && Number.isFinite(Number(pulseResult.score));
  const pulse = tieneDatosReales ? pulseResult.score : null;
  const status = tieneDatosReales ? getPulseStatus(pulse) : STATUS_SIN_DATOS;

  const ultimas = encuestasConScore.slice(-3);
  const primera = ultimas[0]?.score ?? null;
  const ultima = ultimas[ultimas.length - 1]?.score ?? null;
  const cambio = tieneDatosReales && primera !== null && ultima !== null ? ultima - primera : 0;

  const riesgos = [];

  if (reportesEmpleado.some(r => r.urgencia === "Alta" || r.urgencia === "Crítica")) {
    riesgos.push({
      tipo: "Reporte confidencial prioritario",
      nivel: "Alta",
      detalle: "Existe un reporte confidencial de urgencia alta o crítica."
    });
  }

  if (!tieneDatosReales) {
    return {
      empleado,
      pulse,
      sinDatos: true,
      status,
      cambio: 0,
      prioridad: "Sin datos",
      riesgos,
      recomendacion: encuestasEmpleado.length
        ? "Encuesta registrada sin score válido. Pendiente de evaluación."
        : "Sin encuestas registradas. Pendiente de evaluación semanal."
    };
  }

  if (pulse < 50) {
    riesgos.push({
      tipo: "Intervención inmediata",
      nivel: "Crítica",
      detalle: "Pulse Score menor a 50. Requiere intervención prioritaria."
    });
  } else if (pulse < 60) {
    riesgos.push({
      tipo: "Riesgo emocional",
      nivel: "Alta",
      detalle: "Pulse Score en zona de riesgo."
    });
  } else if (pulse < 70) {
    riesgos.push({
      tipo: "Atención preventiva",
      nivel: "Media",
      detalle: "Pulse Score en zona de atención."
    });
  }

  if (ultimas.length >= 2 && cambio <= -10) {
    riesgos.push({
      tipo: "Cambio de comportamiento",
      nivel: "Alta",
      detalle: `Disminución de ${Math.abs(cambio)} puntos en sus últimas mediciones.`
    });
  } else if (ultimas.length >= 2 && cambio <= -5) {
    riesgos.push({
      tipo: "Tendencia negativa",
      nivel: "Media",
      detalle: `Baja moderada de ${Math.abs(cambio)} puntos.`
    });
  }

  if (permisosEmpleado.length >= 2) {
    riesgos.push({
      tipo: "Riesgo de ausentismo",
      nivel: "Media",
      detalle: "Presenta varios permisos registrados."
    });
  }

  if (descuentosEmpleado.some(d => d.estado === "activo" || d.estado === "pendiente")) {
    riesgos.push({
      tipo: "Posible presión financiera/administrativa",
      nivel: "Baja",
      detalle: "Tiene descuentos administrativos activos o pendientes."
    });
  }

  if (reconocimientosEmpleado.length === 0 && pulse < 70) {
    riesgos.push({
      tipo: "Desconexión organizacional",
      nivel: "Media",
      detalle: "No tiene reconocimientos registrados y su score requiere atención."
    });
  }

  const prioridad =
    riesgos.some(r => r.nivel === "Crítica") ? "Crítica" :
    riesgos.some(r => r.nivel === "Alta") ? "Alta" :
    riesgos.some(r => r.nivel === "Media") ? "Media" :
    "Baja";

  const recomendacion =
    prioridad === "Crítica" ? "Agendar intervención inmediata con psicóloga y seguimiento directivo." :
    prioridad === "Alta" ? "Programar conversación individual y revisar expediente integral." :
    prioridad === "Media" ? "Monitorear semanalmente y aplicar intervención preventiva." :
    "Mantener seguimiento regular y reforzar reconocimiento positivo.";

  return {
    empleado,
    pulse,
    sinDatos: false,
    status,
    cambio,
    prioridad,
    riesgos,
    recomendacion
  };
};


const AIEngine = ({ encuestas, mensajes, notas, userRole, permisos = [], descuentos = [], reconocimientos = [], reportesConfidenciales = [] }) => {
  const { usuarios: USERS } = useGlobal();
  const [tab, setTab] = useState("resumen");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);

  const empleados = USERS.filter(u => u.role === "empleado");
const analisisIA = empleados.map(emp =>
  analyzeEmployeeAI(
    emp,
    encuestas,
    permisos,
    descuentos,
    reconocimientos,
    reportesConfidenciales,
    USERS
  )
);

const analisisConDatos = analisisIA.filter(a => !a.sinDatos);
const analisisConRiesgo = analisisConDatos.filter(
  a => a.riesgos.some(r => ["Crítica", "Alta", "Media"].includes(r.nivel))
);
const analisisFocoRojo = analisisConDatos.filter(
  a => a.prioridad === "Crítica" || a.status?.semaforo === "Rojo"
);

const prioridadCritica = analisisConDatos.filter(a => a.prioridad === "Crítica").length;
const prioridadAlta = analisisConDatos.filter(a => a.prioridad === "Alta").length;
const prioridadMedia = analisisConDatos.filter(a => a.prioridad === "Media").length;
const cambiosComportamiento = analisisConDatos.filter(a =>
  a.riesgos.some(r => r.tipo === "Cambio de comportamiento" || r.tipo === "Tendencia negativa")
).length;
const pendientesEvaluacion = analisisIA.filter(a => a.sinDatos).length;

const RESUMEN_LIMITE = 8;
  const buildContexto = () => {
    const semanaEnc = encuestas.filter(e => e.semana === semanaActual);
    const resumen = empleados.map(emp => {
      const pulse = calcPulseScore(emp.id, encuestas);
      const riesgos = calcRiesgos(emp.id, encuestas);
      const enc = encuestas.filter(e => e.empleadoId === emp.id).sort((a,b)=>b.semana.localeCompare(a.semana)).slice(0,3);
      return `- ${emp.name} (${emp.sucursal}, ${emp.puesto}): Pulse Score ${pulse.score} (${pulse.nivel}), tendencia ${pulse.tendencia}, riesgo renuncia ${riesgos.renuncia}%, burnout ${riesgos.burnout}%, emocional ${riesgos.emocional}%, últimos scores: ${enc.map(e=>e.score).join(",")}`;
    }).join("\n");
    const msgsRecientes = mensajes.slice(-5).map(m => {
      const de = USERS.find(u=>u.id===m.de);
      return `${de?.name}: "${m.texto.slice(0,80)}"`;
    }).join("\n");
    return `DATOS MCDENTAL PULSE - Semana ${semanaActual}\nEmpleados: ${empleados.length} | Contestaron esta semana: ${new Set(semanaEnc.map(e=>e.empleadoId)).size}/${empleados.length}\n\nPULSE SCORES Y RIESGOS:\n${resumen}\n\nMENSAJES RECIENTES:\n${msgsRecientes}`;
  };

  const buildEmpContexto = (emp) => {
    const enc = encuestas.filter(e => e.empleadoId === emp.id).sort((a,b)=>b.semana.localeCompare(a.semana));
    const pulse = calcPulseScore(emp.id, encuestas);
    const riesgos = calcRiesgos(emp.id, encuestas);
    const notasEmp = notas.filter(n => n.empleadoId === emp.id);
    const msgsEmp = mensajes.filter(m => m.de === emp.id || m.para === emp.id).slice(-6);
    return `EXPEDIENTE: ${emp.name} | ${emp.sucursal} | ${emp.puesto} | Antigüedad: ${calcularAntiguedad(emp.fechaIngreso)}Tendencia: ${pulse.tendencia}\nRiesgos: Renuncia ${riesgos.renuncia}%, Burnout ${riesgos.burnout}%, Emocional ${riesgos.emocional}%\nEncuestas (${enc.length} semanas): ${enc.slice(0,5).map(e=>`${e.semana}: emocional=${e.respuestas.emocional}, estres=${e.respuestas.estres}, mot=${e.respuestas.motivacion}, score=${e.score}`).join(" | ")}\nNotas psicóloga: ${notasEmp.map(n=>n.texto).join(" | ") || "Ninguna"}\nMensajes: ${msgsEmp.map(m=>{const u=USERS.find(x=>x.id===m.de);return `${u?.name}: "${m.texto.slice(0,60)}"`;}).join(" | ") || "Ninguno"}`;
  };

  const generarResumen = async () => {
    setLoading(true); setOutput("");
    const ctx = buildContexto();
    const prompt = `${ctx}\n\nGenera un RESUMEN EJECUTIVO SEMANAL completo para la psicóloga y el admin. Incluye:\n1. Estado general de McDental (1-2 oraciones)\n2. Principales alertas y empleados prioritarios (usa nombres reales)\n3. Riesgos detectados por sucursal\n4. Recomendaciones de intervención concretas\n5. Tendencia organizacional\n\nFormato: usa emojis, sé directo y accionable. Máximo 350 palabras.`;
    const result = await callAI(prompt);
    setOutput(result); setLoading(false);
  };

  const analizarEmpleado = async (emp) => {
    setSelectedEmp(emp); setLoading(true); setOutput("");
    const ctx = buildEmpContexto(emp);
    const prompt = `${ctx}\n\nComo copiloto de la psicóloga, analiza este expediente y proporciona:\n1. Diagnóstico de bienestar actual (2-3 oraciones)\n2. Cambios de comportamiento detectados\n3. Factores de riesgo específicos\n4. 3 preguntas de seguimiento sugeridas para la próxima sesión\n5. Intervención recomendada (nivel y tipo)\n\nSé empático, preciso y profesional.`;
    const result = await callAI(prompt);
    setOutput(result); setLoading(false);
  };

  const generarAlertas = async () => {
    setLoading(true); setOutput("");
    const ctx = buildContexto();
    const prompt = `${ctx}\n\nGenera una lista de ALERTAS AUTOMÁTICAS priorizada. Para cada alerta especifica:\n- Nivel: 🟢 Informativo / 🟡 Atención / 🟠 Riesgo / 🔴 Prioridad Alta\n- Empleado o sucursal afectada\n- Descripción del riesgo detectado\n- Acción recomendada inmediata\n\nGenera entre 5 y 8 alertas ordenadas por prioridad. Usa nombres reales del sistema.`;
    const result = await callAI(prompt);
    setOutput(result); setLoading(false);
  };

  const generarPrediccion = async () => {
    setLoading(true); setOutput("");
    const ctx = buildContexto();
    const prompt = `${ctx}\n\nGenera PREDICCIONES ORGANIZACIONALES para McDental:\n1. Riesgo de renuncia a 30, 60 y 90 días (nombres específicos con % confianza)\n2. Riesgo de burnout colectivo por sucursal\n3. Empleados con mayor probabilidad de ausentismo próximas semanas\n4. Tendencia del clima laboral general\n5. Sucursal con mayor riesgo organizacional\n\nPara cada predicción explica brevemente las variables que usaste. Sé específico con nombres.`;
    const result = await callAI(prompt);
    setOutput(result); setLoading(false);
  };

  const sendChat = async () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput;
    setChatInput("");
    setChatHistory(h => [...h, { role: "user", text: userMsg }]);
    setChatLoading(true);
    const ctx = buildContexto();
    const historial = chatHistory.slice(-6).map(m => `${m.role === "user" ? "Usuario" : "IA"}: ${m.text}`).join("\n");
    const prompt = `CONTEXTO DEL SISTEMA:\n${ctx}\n\nHISTORIAL:\n${historial}\n\nPREGUNTA ACTUAL: ${userMsg}\n\nResponde como copiloto de la psicóloga/admin de McDental Pulse. Sé conciso y accionable.`;
    const result = await callAI(prompt);
    setChatHistory(h => [...h, { role: "ai", text: result }]);
    setChatLoading(false);
  };

  const tabs = [
    { key: "resumen", label: "Resumen Semanal", icon: "clipboard" },
    { key: "alertas", label: "Alertas IA", icon: "shieldAlert" },
    { key: "prediccion", label: "Predicciones", icon: "wand" },
    { key: "copiloto", label: "Copiloto", icon: "ai" },
    { key: "expedientes", label: "Expedientes IA", icon: "folderSearch" },
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <div className="admin-stat-icon-wrap" style={{ width: 44, height: 44, borderRadius: 12, background: "var(--mc-verde-claro)" }}>
          <Icon name="ai" size={22} />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#004D40" }}>McDental Pulse AI Engine</h2>
          <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>Motor de Inteligencia Artificial · Análisis en tiempo real</p>
        </div>
        <div style={{ marginLeft: "auto", background: "var(--mc-verde-oscuro)", color: "#fff", padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Icon name="sparkles" size={14} color="#fff" /> ACTIVO
        </div>
      </div>
      <div className="admin-stat-grid">
        <StatCard iconName="shieldAlert" value={prioridadCritica} label="Prioridad crítica" valueClass="admin-stat-value--red" />
        <StatCard iconName="critical" value={prioridadAlta} label="Prioridad alta" valueClass="admin-stat-value--red" />
        <StatCard iconName="warning" value={prioridadMedia} label="Prioridad media" valueClass="admin-stat-value--amber" />
        <StatCard iconName="trendingDown" value={cambiosComportamiento} label="Cambios detectados" valueClass="admin-stat-value--blue" />
      </div>
      {/* Pulse Scores resumen */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
        {USERS.filter(u=>u.role==="empleado").map(emp => {
          const ps = calcPulseScore(emp.id, encuestas);
          if (ps.sinDatos) return null;
          return (
            <div key={emp.id} style={{ background: "#fff", borderRadius: 12, padding: "10px 14px", border: `1.5px solid ${ps.color}30`, display: "flex", alignItems: "center", gap: 10, cursor: "pointer", minWidth: 180 }}
              onClick={() => { setTab("expedientes"); analizarEmpleado(emp); }}>
              <Avatar name={emp.name} size={32} color={ps.color} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>{emp.name.split(" ")[0]}</div>
                <PulseScoreBadge score={ps.score} nivel={ps.nivel} color={ps.color} tendencia={ps.tendencia} size="sm" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setOutput(""); setSelectedEmp(null); }} style={{
            padding: "8px 14px", borderRadius: 20, border: "1.5px solid",
            borderColor: tab === t.key ? "#006D5B" : "#e5e7eb",
            background: tab === t.key ? "#006D5B" : "#fff",
            color: tab === t.key ? "#fff" : "#374151",
            fontSize: 12, fontWeight: 600, cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: 6
          }}><Icon name={t.icon} size={14} color={tab === t.key ? "#fff" : undefined} /> {t.label}</button>
        ))}
      </div>

      {/* Resumen Semanal */}
     {tab === "resumen" && (
  <Card style={{ marginTop: 16 }}>
    <SectionTitle icon="brain">Análisis local por reglas</SectionTitle>
    <p className="ai-resumen-hint">
      Solo se listan colaboradores con Pulse Score real y señales de riesgo verificadas.
      {pendientesEvaluacion > 0 && (
        <span> · {pendientesEvaluacion} pendiente(s) de evaluación sin datos.</span>
      )}
    </p>

    {analisisConRiesgo.length === 0 ? (
      <div className="dashboard-empty dashboard-empty--ok ai-resumen-empty">
        <Icon name="check" size={18} />
        Sin empleados con señales de riesgo esta semana
      </div>
    ) : (
      <div className="admin-list-scroll ai-resumen-scroll">
        {analisisConRiesgo
          .slice()
          .sort((a, b) => {
            const orden = { "Crítica": 0, "Alta": 1, "Media": 2, "Baja": 3, "Sin datos": 4 };
            return orden[a.prioridad] - orden[b.prioridad];
          })
          .slice(0, RESUMEN_LIMITE)
          .map(a => (
          <div
            key={a.empleado.id}
            className={`ai-resumen-item ai-resumen-item--${a.prioridad.toLowerCase().replace("í", "i")}`}
          >
            <div className="ai-resumen-item-head">
              <div>
                <div className="ai-resumen-name">{a.empleado.name}</div>
                <div className="ai-resumen-meta">{a.empleado.sucursal} · {a.empleado.puesto}</div>
              </div>
              <span className={`ai-priority-pill ai-priority-pill--${a.prioridad.toLowerCase().replace("í", "i")}`}>
                {a.prioridad}
              </span>
            </div>

            <div className="ai-resumen-score">
              <b>Pulse Score:</b> {a.pulse} · {a.status.label} · Semáforo {a.status.semaforo}
            </div>

            {a.riesgos.length > 0 && (
              <div className="ai-resumen-risks">
                {a.riesgos.map((r, idx) => (
                  <div key={idx} className="ai-resumen-risk-line">
                    <Icon name="alert" size={14} /> <b>{r.tipo}</b> — {r.detalle}
                  </div>
                ))}
              </div>
            )}

            <div className="ai-resumen-rec">Recomendación: {a.recomendacion}</div>
          </div>
        ))}
        {analisisConRiesgo.length > RESUMEN_LIMITE && (
          <p className="ai-resumen-more">
            Mostrando {RESUMEN_LIMITE} de {analisisConRiesgo.length} casos con señales. Revise expedientes para el detalle completo.
          </p>
        )}
      </div>
    )}
  </Card>
)}
    {/* Alertas */}
{tab === "alertas" && (
  <Card>
    <SectionTitle icon="shieldAlert">Alertas IA</SectionTitle>
    <p style={{ color: "#64748b", marginTop: 0 }}>
      Alertas generadas automáticamente por el motor local de reglas.
    </p>

    <div style={{ display: "grid", gap: 12 }}>
      {analisisConRiesgo
        .slice()
        .sort((a, b) => {
          const orden = { "Crítica": 0, "Alta": 1, "Media": 2, "Baja": 3 };
          return orden[a.prioridad] - orden[b.prioridad];
        })
        .map(a => (
          <div
            key={a.empleado.id}
            style={{
              padding: 16,
              borderRadius: 14,
              border: "1px solid #e5e7eb",
              background:
                a.prioridad === "Crítica" ? "#fef2f2" :
                a.prioridad === "Alta" ? "#fff7ed" :
                a.prioridad === "Media" ? "#fffbeb" :
                "#f8fafc"
            }}
          >
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "flex-start",
              marginBottom: 10
            }}>
              <div>
                <div style={{ fontWeight: 900, color: "#0f172a", fontSize: 17 }}>
                  {a.empleado.name}
                </div>
                <div style={{ color: "#64748b", fontSize: 13 }}>
                  {a.empleado.sucursal} · {a.empleado.puesto}
                </div>
              </div>

              <div style={{
                padding: "6px 10px",
                borderRadius: 999,
                fontWeight: 900,
                fontSize: 13,
                background:
                  a.prioridad === "Crítica" ? "#fee2e2" :
                  a.prioridad === "Alta" ? "#ffedd5" :
                  a.prioridad === "Media" ? "#fef3c7" :
                  "#dcfce7",
                color:
                  a.prioridad === "Crítica" ? "#991b1b" :
                  a.prioridad === "Alta" ? "#c2410c" :
                  a.prioridad === "Media" ? "#92400e" :
                  "#166534"
              }}>
                {a.prioridad}
              </div>
            </div>

            <div style={{ marginBottom: 10, color: "#334155" }}>
              <b>Pulse Score:</b> {a.pulse} · {a.status.label} · Semáforo {a.status.semaforo}
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              {a.riesgos.map((r, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: 10,
                    borderRadius: 10,
                    background: "#fff",
                    border: "1px solid #e5e7eb"
                  }}
                >
                  <div style={{ fontWeight: 900, color: "#0f172a" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="alert" size={14} /> {r.tipo}</span>
                  </div>
                  <div style={{ color: "#64748b", fontSize: 13 }}>
                    Nivel: {r.nivel}
                  </div>
                  <div style={{ color: "#334155", marginTop: 4 }}>
                    {r.detalle}
                  </div>
                </div>
              ))}
            </div>

            <div style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 12,
              background: "#ecfeff",
              color: "#004D40",
              fontWeight: 900
            }}>
              Acción sugerida: {a.recomendacion}
            </div>
          </div>
        ))}

      {analisisConRiesgo.length === 0 && (
        <div style={{ color: "#64748b", textAlign: "center", padding: 30 }}>
          No hay alertas activas por el momento.
        </div>
      )}
    </div>
  </Card>
)}

     {/* Predicciones */}
{tab === "prediccion" && (
  <Card>
    <SectionTitle icon="wand">Predicciones IA</SectionTitle>
    <p style={{ color: "#64748b", marginTop: 0 }}>
      Predicciones generadas localmente a partir de Pulse Score, tendencias, incidencias y señales administrativas.
    </p>

    <div style={{ display: "grid", gap: 12 }}>
      {analisisConDatos
        .slice()
        .sort((a, b) => {
          const orden = { "Crítica": 0, "Alta": 1, "Media": 2, "Baja": 3 };
          return orden[a.prioridad] - orden[b.prioridad];
        })
        .map(a => {
          const tieneAusentismo = a.riesgos.some(r => r.tipo === "Riesgo de ausentismo");
          const tieneCambio = a.riesgos.some(r => r.tipo === "Cambio de comportamiento" || r.tipo === "Tendencia negativa");
          const tieneEmocional = a.riesgos.some(r => r.tipo === "Riesgo emocional" || r.tipo === "Intervención inmediata" || r.tipo === "Atención preventiva");
          const tieneDesconexion = a.riesgos.some(r => r.tipo === "Desconexión organizacional");
          const tieneFinanciero = a.riesgos.some(r => r.tipo === "Posible presión financiera/administrativa");

          const predicciones = [
            {
              nombre: "Riesgo emocional",
              valor: tieneEmocional ? "Elevado" : a.pulse < 75 ? "Moderado" : "Bajo",
              detalle: tieneEmocional
                ? "El Pulse Score y las señales recientes sugieren necesidad de seguimiento emocional."
                : "No se observan señales críticas, mantener monitoreo semanal."
            },
            {
              nombre: "Riesgo de ausentismo",
              valor: tieneAusentismo ? "Elevado" : "Bajo",
              detalle: tieneAusentismo
                ? "Presenta permisos recurrentes."
                : "No hay patrón relevante de ausentismo en los datos actuales."
            },
            {
              nombre: "Cambio de comportamiento",
              valor: tieneCambio ? "Detectado" : "Sin cambio fuerte",
              detalle: tieneCambio
                ? "La tendencia reciente muestra disminución relevante del score."
                : "No se detectan caídas significativas recientes."
            },
            {
              nombre: "Desconexión organizacional",
              valor: tieneDesconexion ? "Posible" : "Baja",
              detalle: tieneDesconexion
                ? "Bajo score y ausencia de reconocimientos sugieren posible desconexión."
                : "No hay señales fuertes de desconexión con la información actual."
            },
            {
              nombre: "Presión administrativa",
              valor: tieneFinanciero ? "Presente" : "Baja",
              detalle: tieneFinanciero
                ? "Tiene descuentos administrativos activos o pendientes."
                : "No se observan señales administrativas relevantes."
            }
          ];

          return (
            <div
              key={a.empleado.id}
              style={{
                padding: 16,
                borderRadius: 14,
                border: "1px solid #e5e7eb",
                background: "#f8fafc"
              }}
            >
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "flex-start",
                marginBottom: 12
              }}>
                <div>
                  <div style={{ fontWeight: 900, color: "#0f172a", fontSize: 17 }}>
                    {a.empleado.name}
                  </div>
                  <div style={{ color: "#64748b", fontSize: 13 }}>
                    {a.empleado.sucursal} · {a.empleado.puesto}
                  </div>
                </div>

                <div style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  fontWeight: 900,
                  fontSize: 13,
                  background:
                    a.prioridad === "Crítica" ? "#fee2e2" :
                    a.prioridad === "Alta" ? "#ffedd5" :
                    a.prioridad === "Media" ? "#fef3c7" :
                    "#dcfce7",
                  color:
                    a.prioridad === "Crítica" ? "#991b1b" :
                    a.prioridad === "Alta" ? "#c2410c" :
                    a.prioridad === "Media" ? "#92400e" :
                    "#166534"
                }}>
                  Prioridad {a.prioridad}
                </div>
              </div>

              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 10
              }}>
                {predicciones.map(p => (
                  <div
                    key={p.nombre}
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      background: "white",
                      border: "1px solid #e5e7eb"
                    }}
                  >
                    <div style={{ fontWeight: 900, color: "#004D40", marginBottom: 4 }}>
                      {p.nombre}
                    </div>
                    <div style={{ fontWeight: 900, color: "#0f172a", marginBottom: 6 }}>
                      {p.valor}
                    </div>
                    <div style={{ color: "#64748b", fontSize: 13, lineHeight: 1.5 }}>
                      {p.detalle}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 12,
                background: "#ecfeff",
                color: "#004D40",
                fontWeight: 900
              }}>
                Predicción general: {a.recomendacion}
              </div>
            </div>
          );
        })}
    </div>
  </Card>
)}

      {/* Copiloto */}
{tab === "copiloto" && (
  <Card>
    <SectionTitle icon="ai">Copiloto de Bienestar Organizacional</SectionTitle>
    <p style={{ color: "#64748b", marginTop: 0 }}>
      Recomendaciones automáticas para priorizar seguimiento humano, psicológico y organizacional.
    </p>

    <div className="admin-stat-grid" style={{ marginBottom: 18 }}>
      <StatCard iconName="shieldAlert" value={prioridadCritica} label="Casos urgentes" valueClass="admin-stat-value--red" />
      <StatCard iconName="critical" value={prioridadAlta} label="Casos de alta prioridad" valueClass="admin-stat-value--red" />
      <StatCard iconName="clipboard" value={analisisConRiesgo.length} label="Casos con señales" valueClass="admin-stat-value--green" />
    </div>

    <div style={{ display: "grid", gap: 14 }}>
      <div style={{
        padding: 16,
        borderRadius: 14,
        background: "#ecfeff",
        border: "1px solid #bae6fd"
      }}>
        <h4 style={{ margin: "0 0 10px", color: "#004D40", display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="target" size={16} /> Prioridad de atención esta semana
        </h4>

        {analisisConRiesgo.length === 0 ? (
          <p style={{ color: "#64748b", margin: 0 }}>Sin empleados en foco rojo esta semana.</p>
        ) : analisisConRiesgo
          .slice()
          .sort((a, b) => {
            const orden = { "Crítica": 0, "Alta": 1, "Media": 2, "Baja": 3 };
            return orden[a.prioridad] - orden[b.prioridad];
          })
          .slice(0, 3)
          .map((a, idx, arr) => (
            <div
              key={a.empleado.id}
              style={{
                padding: "10px 0",
                borderBottom: idx < arr.length - 1 ? "1px solid #bae6fd" : "none"
              }}
            >
              <div style={{ fontWeight: 900, color: "#0f172a" }}>
                {idx + 1}. {a.empleado.name} — Prioridad {a.prioridad}
              </div>
              <div style={{ color: "#475569", fontSize: 13 }}>
                {a.empleado.sucursal} · {a.empleado.puesto} · Pulse Score {a.pulse}
              </div>
              <div style={{ color: "#004D40", fontWeight: 800, marginTop: 4 }}>
                {a.recomendacion}
              </div>
            </div>
          ))}
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
        gap: 14
      }}>
        <div style={{
          padding: 16,
          borderRadius: 14,
          background: "#f8fafc",
          border: "1px solid #e5e7eb"
        }}>
          <h4 style={{ margin: "0 0 10px", color: "#004D40", display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="message" size={16} /> Preguntas sugeridas para seguimiento
          </h4>

          <ul style={{ color: "#334155", lineHeight: 1.8, margin: 0, paddingLeft: 20 }}>
            <li>¿Cómo te has sentido emocionalmente durante las últimas semanas?</li>
            <li>¿Hay alguna situación laboral o personal que esté afectando tu desempeño?</li>
            <li>¿Sientes apoyo suficiente de tu equipo y supervisor?</li>
            <li>¿Qué cambio ayudaría a mejorar tu bienestar en la sucursal?</li>
            <li>¿Hay algo que prefieras comunicar de forma confidencial?</li>
          </ul>
        </div>

        <div style={{
          padding: 16,
          borderRadius: 14,
          background: "#f8fafc",
          border: "1px solid #e5e7eb"
        }}>
          <h4 style={{ margin: "0 0 10px", color: "#004D40", display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="wrench" size={16} /> Acciones recomendadas
          </h4>

          <ul style={{ color: "#334155", lineHeight: 1.8, margin: 0, paddingLeft: 20 }}>
            <li>Revisar primero los casos críticos y altos.</li>
            <li>Consultar expediente integral antes de hablar con el colaborador.</li>
            <li>Registrar nota privada después de cada seguimiento.</li>
            <li>Dar reconocimiento positivo a empleados con mejora o estabilidad.</li>
            <li>Escalar a dirección solo los casos con riesgo alto sostenido.</li>
          </ul>
        </div>
      </div>

      <div style={{
        padding: 16,
        borderRadius: 14,
        background: "#fff7ed",
        border: "1px solid #fed7aa"
      }}>
        <h4 style={{ margin: "0 0 10px", color: "#9a3412", display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="alert" size={16} /> Nota del Copiloto
        </h4>
        <p style={{ color: "#7c2d12", lineHeight: 1.7, margin: 0 }}>
          Este análisis no sustituye el criterio humano ni profesional. Su función es priorizar señales,
          organizar información y sugerir acciones preventivas para que la psicóloga, RH o dirección
          tomen mejores decisiones.
        </p>
      </div>
    </div>
  </Card>
)}

 {/* Expedientes IA */}
{tab === "expedientes" && (
  <Card>
    <SectionTitle icon="folderSearch">Expedientes IA</SectionTitle>
    <p style={{ color: "#64748b", marginTop: 0 }}>
      Resumen inteligente por colaborador para acelerar la revisión de casos y expedientes integrales.
    </p>

    <div style={{ display: "grid", gap: 14 }}>
      {analisisConDatos
        .slice()
        .sort((a, b) => {
          const orden = { "Crítica": 0, "Alta": 1, "Media": 2, "Baja": 3 };
          return orden[a.prioridad] - orden[b.prioridad];
        })
        .map(a => (
          <div
            key={a.empleado.id}
            style={{
              padding: 16,
              borderRadius: 14,
              border: "1px solid #e5e7eb",
              background:
                a.prioridad === "Crítica" ? "#fef2f2" :
                a.prioridad === "Alta" ? "#fff7ed" :
                a.prioridad === "Media" ? "#fffbeb" :
                "#f8fafc"
            }}
          >
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "flex-start",
              marginBottom: 12
            }}>
              <div>
                <div style={{ fontWeight: 900, color: "#0f172a", fontSize: 18 }}>
                  {a.empleado.name}
                </div>
                <div style={{ color: "#64748b", fontSize: 13 }}>
                  {a.empleado.sucursal} · {a.empleado.puesto}
                </div>
              </div>

              <div style={{
                padding: "6px 10px",
                borderRadius: 999,
                fontWeight: 900,
                fontSize: 13,
                background:
                  a.prioridad === "Crítica" ? "#fee2e2" :
                  a.prioridad === "Alta" ? "#ffedd5" :
                  a.prioridad === "Media" ? "#fef3c7" :
                  "#dcfce7",
                color:
                  a.prioridad === "Crítica" ? "#991b1b" :
                  a.prioridad === "Alta" ? "#c2410c" :
                  a.prioridad === "Media" ? "#92400e" :
                  "#166534"
              }}>
                Prioridad {a.prioridad}
              </div>
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 10,
              marginBottom: 12
            }}>
              <div style={{
                padding: 12,
                borderRadius: 12,
                background: "white",
                border: "1px solid #e5e7eb",
                textAlign: "center"
              }}>
                <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>
                  Pulse Score™
                </div>
                <div style={{ fontSize: 26, fontWeight: 900, color: a.status.color }}>
                  {a.pulse}
                </div>
                <div style={{ color: "#334155", fontSize: 13 }}>
                  {a.status.label}
                </div>
              </div>

              <div style={{
                padding: 12,
                borderRadius: 12,
                background: "white",
                border: "1px solid #e5e7eb",
                textAlign: "center"
              }}>
                <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>
                  Semáforo
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: a.status.color }}>
                  {a.status.semaforo}
                </div>
                <div style={{ color: "#334155", fontSize: 13 }}>
                  Estado actual
                </div>
              </div>

              <div style={{
                padding: 12,
                borderRadius: 12,
                background: "white",
                border: "1px solid #e5e7eb",
                textAlign: "center"
              }}>
                <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>
                  Señales detectadas
                </div>
                <div style={{ fontSize: 26, fontWeight: 900, color: "#00897B" }}>
                  {a.riesgos.length}
                </div>
                <div style={{ color: "#334155", fontSize: 13 }}>
                  Riesgos / alertas
                </div>
              </div>
            </div>

            <div style={{
              padding: 12,
              borderRadius: 12,
              background: "white",
              border: "1px solid #e5e7eb",
              marginBottom: 12
            }}>
              <div style={{ fontWeight: 900, color: "#004D40", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                <Icon name="brain" size={16} /> Resumen IA del expediente
              </div>

              <div style={{ color: "#334155", lineHeight: 1.7 }}>
                {a.empleado.name} se encuentra en estado <b>{a.status.label}</b> con semáforo{" "}
                <b>{a.status.semaforo}</b> y prioridad <b>{a.prioridad}</b>.
                {a.riesgos.length > 0
                  ? ` El motor detectó ${a.riesgos.length} señal(es) que requieren seguimiento.`
                  : " No se detectan señales críticas en este momento."}
              </div>
            </div>

            <div style={{
              padding: 12,
              borderRadius: 12,
              background: "#f8fafc",
              border: "1px solid #e5e7eb",
              marginBottom: 12
            }}>
              <div style={{ fontWeight: 900, color: "#004D40", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                <Icon name="alert" size={16} /> Riesgos principales
              </div>

              {a.riesgos.length > 0 ? (
                <div style={{ display: "grid", gap: 6 }}>
                  {a.riesgos.map((r, idx) => (
                    <div key={idx} style={{ color: "#475569", fontSize: 13 }}>
                      • <b>{r.tipo}</b> ({r.nivel}): {r.detalle}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: "#64748b", fontSize: 13 }}>
                  Sin riesgos relevantes detectados.
                </div>
              )}
            </div>

            <div style={{
              padding: 12,
              borderRadius: 12,
              background: "#ecfeff",
              color: "#004D40",
              fontWeight: 900
            }}>
              Recomendación IA: {a.recomendacion}
            </div>
          </div>
        ))}
    </div>
  </Card>
)}
    </div>
  );
};


export default AIEngine;
