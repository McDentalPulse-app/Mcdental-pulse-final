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

import { semanaActual, normalizeSucursal, formatSemanaDisplay } from "../../utils/constants";
import { calcularAntiguedad, resolveFechaIngreso } from "../../utils/helpers";
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


// Inline markdown: **negrita**, *cursiva*, `código`.
const parseInlineMD = (text) => {
  const nodes = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0, m, key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith("**")) nodes.push(<strong key={key++}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) nodes.push(<code key={key++} className="ai-md-code">{t.slice(1, -1)}</code>);
    else nodes.push(<em key={key++}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
};

// Render markdown-lite por bloques: encabezados, listas (•/numéricas), párrafos, separadores.
const MarkdownLite = ({ text }) => {
  const blocks = [];
  let list = null;
  const flush = () => { if (list) { blocks.push(list); list = null; } };

  String(text || "").split("\n").forEach(raw => {
    const line = raw.trim();
    if (!line) { flush(); return; }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    const ul = /^[-*]\s+(.*)$/.exec(line);
    const ol = /^\d+[.)]\s+(.*)$/.exec(line);
    if (/^[-*_]{3,}$/.test(line)) { flush(); blocks.push({ type: "hr" }); }
    else if (h) { flush(); blocks.push({ type: "h", level: h[1].length, text: h[2] }); }
    else if (ul) { if (!list || list.type !== "ul") { flush(); list = { type: "ul", items: [] }; } list.items.push(ul[1]); }
    else if (ol) { if (!list || list.type !== "ol") { flush(); list = { type: "ol", items: [] }; } list.items.push(ol[1]); }
    else { flush(); blocks.push({ type: "p", text: line }); }
  });
  flush();

  return (
    <div className="ai-md">
      {blocks.map((b, i) => {
        if (b.type === "hr") return <hr key={i} className="ai-md-hr" />;
        if (b.type === "h") return <p key={i} className={`ai-md-h ai-md-h${b.level}`}>{parseInlineMD(b.text)}</p>;
        if (b.type === "ul") return <ul key={i} className="ai-md-ul">{b.items.map((it, j) => <li key={j}>{parseInlineMD(it)}</li>)}</ul>;
        if (b.type === "ol") return <ol key={i} className="ai-md-ol">{b.items.map((it, j) => <li key={j}>{parseInlineMD(it)}</li>)}</ol>;
        return <p key={i} className="ai-md-p">{parseInlineMD(b.text)}</p>;
      })}
    </div>
  );
};

const AIOutput = ({ text, loading, placeholder }) => {
  if (loading) {
    return (
      <div className="ai-output ai-output--loading">
        <span className="ai-spinner" /> Generando análisis con IA…
      </div>
    );
  }
  if (!text) return <div className="ai-output ai-output--empty">{placeholder}</div>;
  return (
    <div className="ai-output">
      <MarkdownLite text={text} />
    </div>
  );
};

const AICard = ({ icon = "ai", title, desc, onGenerate, output, loading }) => (
  <Card className="ai-gen-card" style={{ marginTop: 16 }}>
    <div className="ai-gen-head">
      <div className="ai-gen-head-main">
        <SectionTitle icon={icon}>{title}</SectionTitle>
        <p className="ai-gen-desc">{desc}</p>
      </div>
      <button type="button" className="ai-gen-btn" onClick={onGenerate} disabled={loading}>
        <Icon name="sparkles" size={15} /> {loading ? "Generando…" : "Generar con IA"}
      </button>
    </div>
    <AIOutput
      text={output}
      loading={loading}
      placeholder="Pulsa “Generar con IA” para una síntesis redactada por Gemini a partir de los datos actuales."
    />
  </Card>
);

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

  // Filtro por semana (buckets): pre-lanzamiento juntas en "2026-W00", lanzamiento+ "2026-W01"…
  const semanasRaw = [...new Set(
    encuestas.filter(e => Number.isFinite(Number(e.score))).map(e => String(e.semana))
  )];
  const bucketWeeks = {};
  semanasRaw.forEach(w => { (bucketWeeks[formatSemanaDisplay(w)] ||= []).push(w); });
  const labelActual = formatSemanaDisplay(semanaActual);
  const opcionesSemana = [...new Set([labelActual, ...Object.keys(bucketWeeks)])].sort((a, b) => b.localeCompare(a));
  const defaultWeek = bucketWeeks[labelActual] ? labelActual : (opcionesSemana.find(o => bucketWeeks[o]) || labelActual);
  const [weekSel, setWeekSel] = useState(defaultWeek);
  const selRawWeeks = bucketWeeks[weekSel] || (weekSel === labelActual ? [semanaActual] : []);
  const encuestasSemana = encuestas.filter(e => selRawWeeks.includes(String(e.semana)));

  // Al seleccionar un empleado (chip o botón), baja a su tarjeta de expediente.
  useEffect(() => {
    if (tab === "expedientes" && selectedEmp) {
      const el = document.getElementById(`ai-exp-${selectedEmp.id}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [tab, selectedEmp]);

const analisisIA = empleados.map(emp =>
  analyzeEmployeeAI(
    emp,
    encuestasSemana,
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
    const resumen = empleados.map(emp => {
      const pulse = calcPulseScore(emp.id, encuestasSemana);
      const riesgos = calcRiesgos(emp.id, encuestasSemana);
      const enc = encuestasSemana.filter(e => e.empleadoId === emp.id).sort((a,b)=>String(b.semana).localeCompare(String(a.semana))).slice(0,3);
      return `- ${emp.name} (${normalizeSucursal(emp.sucursal)}, ${emp.puesto}): Pulse Score ${pulse.score} (${pulse.nivel}), tendencia ${pulse.tendencia}, riesgo renuncia ${riesgos.renuncia}%, burnout ${riesgos.burnout}%, emocional ${riesgos.emocional}%, últimos scores: ${enc.map(e=>e.score).join(",")}`;
    }).join("\n");
    const msgsRecientes = mensajes.slice(-5).map(m => {
      const de = USERS.find(u=>u.id===m.de);
      return `${de?.name}: "${m.texto.slice(0,80)}"`;
    }).join("\n");
    const contestaronSem = new Set(encuestasSemana.map(e=>e.empleadoId)).size;
    return `DATOS MCDENTAL PULSE - Semana ${weekSel}\nEmpleados: ${empleados.length} | Contestaron: ${contestaronSem}/${empleados.length}\n\nPULSE SCORES Y RIESGOS:\n${resumen}\n\nMENSAJES RECIENTES:\n${msgsRecientes}`;
  };

  const buildEmpContexto = (emp) => {
    const enc = encuestasSemana.filter(e => e.empleadoId === emp.id).sort((a,b)=>String(b.semana).localeCompare(String(a.semana)));
    const pulse = calcPulseScore(emp.id, encuestasSemana);
    const riesgos = calcRiesgos(emp.id, encuestasSemana);
    const notasEmp = notas.filter(n => n.empleadoId === emp.id);
    const msgsEmp = mensajes.filter(m => m.de === emp.id || m.para === emp.id).slice(-6);
    return `EXPEDIENTE: ${emp.name} | ${normalizeSucursal(emp.sucursal)} | ${emp.puesto} | Antigüedad: ${calcularAntiguedad(resolveFechaIngreso(emp))}Tendencia: ${pulse.tendencia}\nRiesgos: Renuncia ${riesgos.renuncia}%, Burnout ${riesgos.burnout}%, Emocional ${riesgos.emocional}%\nEncuestas (${enc.length} semanas): ${enc.slice(0,5).map(e=>`${e.semana}: emocional=${e.respuestas.emocional}, estres=${e.respuestas.estres}, mot=${e.respuestas.motivacion}, score=${e.score}`).join(" | ")}\nNotas psicóloga: ${notasEmp.map(n=>n.texto).join(" | ") || "Ninguna"}\nMensajes: ${msgsEmp.map(m=>{const u=USERS.find(x=>x.id===m.de);return `${u?.name}: "${m.texto.slice(0,60)}"`;}).join(" | ") || "Ninguno"}`;
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
    <div className="admin-page ai-engine-page">
      <div className="ai-engine-header">
        <div className="admin-stat-icon-wrap ai-engine-header-icon">
          <Icon name="ai" size={22} />
        </div>
        <div className="ai-engine-header-main">
          <h1 className="admin-page-title">McDental Pulse AI Engine</h1>
          <p className="admin-page-subtitle">Motor de inteligencia artificial · análisis en tiempo real</p>
        </div>
        <label className="psico-week-select ai-engine-week-select">
          <Icon name="calendar" size={14} />
          <span className="psico-week-select-label">Semana</span>
          <select value={weekSel} onChange={e => setWeekSel(e.target.value)}>
            {opcionesSemana.map(w => (
              <option key={w} value={w}>
                {w}{w === labelActual ? " · actual" : ""}{w === `${w.slice(0, 4)}-W00` ? " · anterior" : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="ai-engine-status-badge">
          <Icon name="sparkles" size={14} /> Activo
        </div>
      </div>
      <div className="admin-stat-grid">
        <StatCard iconName="shieldAlert" value={prioridadCritica} label="Prioridad crítica" valueClass="admin-stat-value--red" />
        <StatCard iconName="critical" value={prioridadAlta} label="Prioridad alta" valueClass="admin-stat-value--red" />
        <StatCard iconName="warning" value={prioridadMedia} label="Prioridad media" valueClass="admin-stat-value--amber" />
        <StatCard iconName="trendingDown" value={cambiosComportamiento} label="Cambios detectados" valueClass="admin-stat-value--blue" />
      </div>
      {/* Pulse Scores resumen */}
      <div className="ai-engine-pulse-chips">
        {USERS.filter(u=>u.role==="empleado").map(emp => {
          const ps = calcPulseScore(emp.id, encuestasSemana);
          if (ps.sinDatos) return null;
          return (
            <button
              key={emp.id}
              type="button"
              className="ai-engine-pulse-chip"
              style={{ borderColor: `${ps.color}40` }}
              onClick={() => { setTab("expedientes"); analizarEmpleado(emp); }}
            >
              <Avatar name={emp.name} size={32} color={ps.color} />
              <div className="ai-engine-pulse-chip-text">
                <div className="ai-engine-pulse-chip-name">{emp.name.split(" ")[0]}</div>
                <PulseScoreBadge score={ps.score} nivel={ps.nivel} color={ps.color} tendencia={ps.tendencia} size="sm" />
              </div>
            </button>
          );
        })}
      </div>

      <div className="ai-engine-tabs">
        {tabs.map(t => (
          <button
            key={t.key}
            type="button"
            className={`ai-engine-tab${tab === t.key ? " ai-engine-tab--active" : ""}`}
            onClick={() => { setTab(t.key); setOutput(""); setSelectedEmp(null); }}
          >
            <Icon name={t.icon} size={14} color={tab === t.key ? "#fff" : undefined} /> {t.label}
          </button>
        ))}
      </div>

      {/* Capa IA (Gemini) — resumen / alertas / predicciones */}
      {["resumen", "alertas", "prediccion"].includes(tab) && (
        <AICard
          icon={tab === "resumen" ? "clipboard" : tab === "alertas" ? "shieldAlert" : "wand"}
          title={tab === "resumen" ? "Resumen ejecutivo IA" : tab === "alertas" ? "Alertas inteligentes IA" : "Predicciones organizacionales IA"}
          desc={
            tab === "resumen" ? "Síntesis semanal del clima organizacional redactada por Gemini."
            : tab === "alertas" ? "Alertas priorizadas con acción recomendada, redactadas por Gemini."
            : "Proyección de renuncia, burnout y ausentismo por Gemini."
          }
          onGenerate={tab === "resumen" ? generarResumen : tab === "alertas" ? generarAlertas : generarPrediccion}
          output={output}
          loading={loading}
        />
      )}

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
                <div className="ai-resumen-meta">{normalizeSucursal(a.empleado.sucursal)} · {a.empleado.puesto}</div>
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
                  {normalizeSucursal(a.empleado.sucursal)} · {a.empleado.puesto}
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
                    {normalizeSucursal(a.empleado.sucursal)} · {a.empleado.puesto}
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
    <p className="ai-gen-desc">
      Pregunta lo que necesites; el copiloto responde con Gemini usando el contexto real del equipo.
    </p>

    <div className="admin-stat-grid" style={{ marginBottom: 16 }}>
      <StatCard iconName="shieldAlert" value={prioridadCritica} label="Casos urgentes" valueClass="admin-stat-value--red" />
      <StatCard iconName="critical" value={prioridadAlta} label="Casos de alta prioridad" valueClass="admin-stat-value--red" />
      <StatCard iconName="clipboard" value={analisisConRiesgo.length} label="Casos con señales" valueClass="admin-stat-value--green" />
    </div>

    <div className="ai-chat">
      <div className="ai-chat-history">
        {chatHistory.length === 0 && !chatLoading && (
          <div className="ai-chat-empty">
            <Icon name="ai" size={22} />
            <span>Empieza la conversación o usa una pregunta sugerida.</span>
          </div>
        )}
        {chatHistory.map((m, i) => (
          <div key={i} className={`ai-chat-msg ai-chat-msg--${m.role}`}>
            {m.role === "ai" ? (
              <div className="ai-output ai-output--chat">
                <MarkdownLite text={m.text} />
              </div>
            ) : (
              <span>{m.text}</span>
            )}
          </div>
        ))}
        {chatLoading && (
          <div className="ai-chat-msg ai-chat-msg--ai">
            <span className="ai-spinner" /> Pensando…
          </div>
        )}
      </div>

      <div className="ai-chat-suggestions">
        {[
          "¿Quiénes necesitan atención prioritaria esta semana?",
          "¿Qué sucursal tiene mayor riesgo y por qué?",
          "Dame 3 acciones concretas para esta semana",
        ].map(q => (
          <button key={q} type="button" className="ai-chip" onClick={() => setChatInput(q)}>
            {q}
          </button>
        ))}
      </div>

      <div className="ai-chat-composer">
        <input
          className="ai-chat-input"
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") sendChat(); }}
          placeholder="Escribe tu pregunta al copiloto…"
        />
        <button
          type="button"
          className="ai-gen-btn"
          onClick={sendChat}
          disabled={chatLoading || !chatInput.trim()}
        >
          <Icon name="message" size={15} /> Enviar
        </button>
      </div>
    </div>

    <p className="ai-copiloto-nota">
      <Icon name="alert" size={13} /> No sustituye el criterio profesional; prioriza señales y sugiere acciones.
    </p>
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
            id={`ai-exp-${a.empleado.id}`}
            className={selectedEmp?.id === a.empleado.id ? "ai-exp-card ai-exp-card--selected" : "ai-exp-card"}
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
                  {normalizeSucursal(a.empleado.sucursal)} · {a.empleado.puesto}
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

            <div className="ai-exp-actions">
              <button
                type="button"
                className="ai-gen-btn ai-gen-btn--sm"
                onClick={() => analizarEmpleado(a.empleado)}
                disabled={loading && selectedEmp?.id === a.empleado.id}
              >
                <Icon name="sparkles" size={14} />
                {loading && selectedEmp?.id === a.empleado.id ? " Generando…" : " Analizar con IA"}
              </button>
            </div>

            {selectedEmp?.id === a.empleado.id && (output || loading) && (
              <AIOutput
                text={output}
                loading={loading}
                placeholder="Pulsa “Analizar con IA” para el diagnóstico de Gemini."
              />
            )}
          </div>
        ))}
    </div>
  </Card>
)}
    </div>
  );
};


export default AIEngine;
