import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { useGlobal } from "../../contexts/GlobalContext";
import { useNotification } from "../../contexts/NotificationContext";
import Card from "../common/Card";
import StatCard from "../common/StatCard";
import SectionTitle from "../common/SectionTitle";
import Icon from "../ui/Icon";
import Badge from "../common/Badge";
import Avatar from "../ui/Avatar";
import PulseScoreBadge from "../common/PulseScoreBadge";
import RiskBar from "../common/RiskBar";
import { semaforoLabel, nivelColor, nivelTinte } from "../../config/theme";

import { semanaActual, normalizeSucursal, formatSemanaDisplay } from "../../utils/constants";
import { calcularAntiguedad, resolveFechaIngreso } from "../../utils/helpers";
import { calcPulseScore, getPulseStatus, calcRiesgos, tieneScoreValido } from "../../utils/pulseScore";
import { resumenEscalas } from "../../utils/encuestaDetail";
import { callAI } from "../../utils/analysisEngine";
import { analyzeEmployeeAI } from "../../utils/aiRiskEngine";
import MarkdownLite from "../common/MarkdownLite";
import WeekSelect from "../common/WeekSelect";
import PageHeader from "../common/PageHeader";
import "./AIEngine.css";
import { esEmpleadoActivo } from "../../utils/helpers";


const AIOutput = ({ text, loading, placeholder }) => {
  if (loading) {
    return (
      <div className="ai-output ai-output--loading">
        <span className="ai-loading-head">
          <Icon name="sparkles" size={15} className="ai-spark" /> Generando análisis con IA…
        </span>
        <div className="ai-skeleton" aria-hidden="true">
          <span className="ai-skeleton-line" />
          <span className="ai-skeleton-line" />
          <span className="ai-skeleton-line" />
          <span className="ai-skeleton-line" />
        </div>
      </div>
    );
  }
  if (!text) return <div className="ai-output ai-output--empty">{placeholder}</div>;
  return (
    <div className="ai-output ai-output-reveal">
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
  // encuestaPreguntas hace falta para leer la respuesta de riesgo de renuncia: el jsonb
  // `respuestas` se indexa por el id de la pregunta, no por un número fijo.
  const { usuarios: USERS, encuestaPreguntas } = useGlobal();
  const { toast } = useNotification();
  const reduce = useReducedMotion();
  const pillTransition = reduce ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 32 };
  const [tab, setTab] = useState("resumen");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);

  const empleados = useMemo(() => USERS.filter(esEmpleadoActivo), [USERS]);

  // Filtro por semana (buckets): pre-lanzamiento juntas en "2026-W00", lanzamiento+ "2026-W01"…
  const semanasRaw = [...new Set(
    encuestas.filter(e => tieneScoreValido(e.score)).map(e => String(e.semana))
  )];
  const bucketWeeks = {};
  semanasRaw.forEach(w => { (bucketWeeks[formatSemanaDisplay(w)] ||= []).push(w); });
  const labelActual = formatSemanaDisplay(semanaActual);
  const opcionesSemana = [...new Set([labelActual, ...Object.keys(bucketWeeks)])].sort((a, b) => b.localeCompare(a));
  const defaultWeek = bucketWeeks[labelActual] ? labelActual : (opcionesSemana.find(o => bucketWeeks[o]) || labelActual);
  const [weekSel, setWeekSel] = useState(defaultWeek);
  const selRawWeeks = bucketWeeks[weekSel] || (weekSel === labelActual ? [semanaActual] : []);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- selRawWeeks deriva de encuestas+weekSel
  const encuestasSemana = useMemo(
    () => encuestas.filter(e => selRawWeeks.includes(String(e.semana))),
    [encuestas, weekSel]
  );

  // Al seleccionar un empleado (chip o botón), baja a su tarjeta de expediente.
  useEffect(() => {
    if (tab === "expedientes" && selectedEmp) {
      const el = document.getElementById(`ai-exp-${selectedEmp.id}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [tab, selectedEmp]);

const analisisIA = useMemo(
  () => empleados.map(emp =>
    analyzeEmployeeAI(
      emp,
      encuestasSemana,
      permisos,
      descuentos,
      reconocimientos,
      reportesConfidenciales,
      USERS
    )
  ),
  [empleados, encuestasSemana, permisos, descuentos, reconocimientos, reportesConfidenciales, USERS]
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
      const riesgos = calcRiesgos(emp.id, encuestasSemana, encuestaPreguntas);
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
    const riesgos = calcRiesgos(emp.id, encuestasSemana, encuestaPreguntas);
    const notasEmp = notas.filter(n => n.empleadoId === emp.id);
    const msgsEmp = mensajes.filter(m => m.de === emp.id || m.para === emp.id).slice(-6);
    // Las escalas se leen por el id de la pregunta. Antes se leían con las claves legacy
    // (respuestas.emocional / .estres / .motivacion), que no existen en un jsonb indexado
    // por UUID: el prompt salía con "emocional=undefined, estres=undefined, mot=undefined".
    const escalas = (e) => resumenEscalas(e, encuestaPreguntas) || "sin detalle";
    return `EXPEDIENTE: ${emp.name} | ${normalizeSucursal(emp.sucursal)} | ${emp.puesto} | Antigüedad: ${calcularAntiguedad(resolveFechaIngreso(emp))}Tendencia: ${pulse.tendencia}\nRiesgos: Renuncia ${riesgos.renuncia}%, Burnout ${riesgos.burnout}%, Emocional ${riesgos.emocional}%\nEncuestas (${enc.length} semanas): ${enc.slice(0,5).map(e=>`${e.semana}: ${escalas(e)}, score=${e.score}`).join(" | ")}\nNotas psicóloga: ${notasEmp.map(n=>n.texto).join(" | ") || "Ninguna"}\nMensajes: ${msgsEmp.map(m=>{const u=USERS.find(x=>x.id===m.de);return `${u?.name}: "${m.texto.slice(0,60)}"`;}).join(" | ") || "Ninguno"}`;
  };

  const generarResumen = async () => {
    setLoading(true); setOutput("");
    const ctx = buildContexto();
    const prompt = `${ctx}\n\nGenera un RESUMEN EJECUTIVO SEMANAL completo para la psicóloga y el admin. Incluye:\n1. Estado general de McDental (1-2 oraciones)\n2. Principales alertas y empleados prioritarios (usa nombres reales)\n3. Riesgos detectados por sucursal\n4. Recomendaciones de intervención concretas\n5. Tendencia organizacional\n\nFormato: usa emojis, sé directo y accionable. Máximo 350 palabras.`;
    try {
      const result = await callAI(prompt);
      setOutput(result);
    } catch (error) {
      console.error("Error generando resumen IA:", error);
      toast.error("No se pudo generar el resumen. Revisa la conexión e inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const analizarEmpleado = async (emp) => {
    setSelectedEmp(emp); setLoading(true); setOutput("");
    const ctx = buildEmpContexto(emp);
    const prompt = `${ctx}\n\nComo copiloto de la psicóloga, analiza este expediente y proporciona:\n1. Diagnóstico de bienestar actual (2-3 oraciones)\n2. Cambios de comportamiento detectados\n3. Factores de riesgo específicos\n4. 3 preguntas de seguimiento sugeridas para la próxima sesión\n5. Intervención recomendada (nivel y tipo)\n\nSé empático, preciso y profesional.`;
    try {
      const result = await callAI(prompt);
      setOutput(result);
    } catch (error) {
      console.error("Error analizando empleado con IA:", error);
      toast.error("No se pudo analizar el expediente. Revisa la conexión e inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const generarAlertas = async () => {
    setLoading(true); setOutput("");
    const ctx = buildContexto();
    const prompt = `${ctx}\n\nGenera una lista de ALERTAS AUTOMÁTICAS priorizada. Para cada alerta especifica:\n- Nivel: 🟢 Informativo / 🟡 Atención / 🟠 Riesgo / 🔴 Prioridad Alta\n- Empleado o sucursal afectada\n- Descripción del riesgo detectado\n- Acción recomendada inmediata\n\nGenera entre 5 y 8 alertas ordenadas por prioridad. Usa nombres reales del sistema.`;
    try {
      const result = await callAI(prompt);
      setOutput(result);
    } catch (error) {
      console.error("Error generando alertas IA:", error);
      toast.error("No se pudieron generar las alertas. Revisa la conexión e inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const generarPrediccion = async () => {
    setLoading(true); setOutput("");
    const ctx = buildContexto();
    const prompt = `${ctx}\n\nGenera PREDICCIONES ORGANIZACIONALES para McDental:\n1. Riesgo de renuncia a 30, 60 y 90 días (nombres específicos con % confianza)\n2. Riesgo de burnout colectivo por sucursal\n3. Empleados con mayor probabilidad de ausentismo próximas semanas\n4. Tendencia del clima laboral general\n5. Sucursal con mayor riesgo organizacional\n\nPara cada predicción explica brevemente las variables que usaste. Sé específico con nombres.`;
    try {
      const result = await callAI(prompt);
      setOutput(result);
    } catch (error) {
      console.error("Error generando predicción IA:", error);
      toast.error("No se pudo generar la predicción. Revisa la conexión e inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
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
    try {
      const result = await callAI(prompt);
      setChatHistory(h => [...h, { role: "ai", text: result }]);
    } catch (error) {
      console.error("Error en chat IA:", error);
      setChatHistory(h => [...h, { role: "ai", text: "⚠️ No pude responder ahora. Revisa la conexión e inténtalo de nuevo." }]);
    } finally {
      setChatLoading(false);
    }
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
      <PageHeader
        icon="ai"
        title="McDental Pulse AI Engine"
        subtitle="Motor de inteligencia artificial · análisis en tiempo real"
      >
        <WeekSelect
          className="ai-engine-week-select"
          value={weekSel}
          onChange={setWeekSel}
          options={opcionesSemana.map(w => ({
            value: w,
            label: `${w}${w === labelActual ? " · actual" : ""}${w === `${w.slice(0, 4)}-W00` ? " · anterior" : ""}`,
          }))}
        />
        <div className="ai-engine-status-badge">
          <span className="ai-status-dot" aria-hidden="true" /> Activo
        </div>
      </PageHeader>
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
              style={{ borderColor: nivelTinte(ps.slug, 25) }}
              onClick={() => { setTab("expedientes"); analizarEmpleado(emp); }}
            >
              <Avatar name={emp.name} size={32} slug={ps.slug} photoUrl={emp.avatarUrl} />
              <div className="ai-engine-pulse-chip-text">
                <div className="ai-engine-pulse-chip-name">{emp.name.split(" ")[0]}</div>
                <PulseScoreBadge score={ps.score} nivel={ps.nivel} slug={ps.slug} tendencia={ps.tendencia} size="sm" />
              </div>
            </button>
          );
        })}
      </div>

      <div className="ai-engine-tabs">
        {tabs.map(t => {
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              className={`ai-engine-tab${isActive ? " ai-engine-tab--active" : ""}`}
              onClick={() => { setTab(t.key); setOutput(""); setSelectedEmp(null); }}
            >
              {isActive && (
                <motion.span
                  layoutId="aiTabPill"
                  className="ai-tab-pill"
                  transition={pillTransition}
                  aria-hidden="true"
                />
              )}
              <Icon name={t.icon} size={14} color={isActive ? "var(--brand-950)" : undefined} /> {t.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
      <motion.div
        key={tab}
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      >
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
    <p className="ai-section-hint">
      Alertas generadas automáticamente por el motor local de reglas.
    </p>

    <div className="ai-case-grid">
      {analisisConRiesgo
        .slice()
        .sort((a, b) => {
          const orden = { "Crítica": 0, "Alta": 1, "Media": 2, "Baja": 3 };
          return orden[a.prioridad] - orden[b.prioridad];
        })
        .map((a, i) => {
          const pri = a.prioridad.toLowerCase().replace("í", "i");
          return (
            <div key={a.empleado.id} className={`ai-case-card ai-case-card--${pri}`} style={{ animationDelay: `${i * 0.05}s` }}>
              <div className="ai-case-head">
                <div>
                  <div className="ai-case-name">{a.empleado.name}</div>
                  <div className="ai-case-sub">{normalizeSucursal(a.empleado.sucursal)} · {a.empleado.puesto}</div>
                </div>
                <span className={`ai-priority-pill ai-priority-pill--${pri}`}>{a.prioridad}</span>
              </div>

              <div className="ai-case-score">
                <b>Pulse Score:</b> {a.pulse} · {a.status.label} · Semáforo {a.status.semaforo}
              </div>

              <div className="ai-risk-list">
                {a.riesgos.map((r, idx) => (
                  <div key={idx} className="ai-risk-item">
                    <div className="ai-risk-title"><Icon name="alert" size={14} /> {r.tipo}</div>
                    <div className="ai-risk-nivel">Nivel: {r.nivel}</div>
                    <div className="ai-risk-detalle">{r.detalle}</div>
                  </div>
                ))}
              </div>

              <div className="ai-action-banner">Acción sugerida: {a.recomendacion}</div>
            </div>
          );
        })}

      {analisisConRiesgo.length === 0 && (
        <div className="ai-case-empty">No hay alertas activas por el momento.</div>
      )}
    </div>
  </Card>
)}

     {/* Predicciones */}
{tab === "prediccion" && (
  <Card>
    <SectionTitle icon="wand">Predicciones IA</SectionTitle>
    <p className="ai-section-hint">
      Predicciones generadas localmente a partir de Pulse Score, tendencias, incidencias y señales administrativas.
    </p>

    <div className="ai-case-grid">
      {analisisConDatos
        .slice()
        .sort((a, b) => {
          const orden = { "Crítica": 0, "Alta": 1, "Media": 2, "Baja": 3 };
          return orden[a.prioridad] - orden[b.prioridad];
        })
        .map((a, i) => {
          const pri = a.prioridad.toLowerCase().replace("í", "i");
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
            <div key={a.empleado.id} className={`ai-case-card ai-case-card--${pri}`} style={{ animationDelay: `${i * 0.05}s` }}>
              <div className="ai-case-head">
                <div>
                  <div className="ai-case-name">{a.empleado.name}</div>
                  <div className="ai-case-sub">{normalizeSucursal(a.empleado.sucursal)} · {a.empleado.puesto}</div>
                </div>
                <span className={`ai-priority-pill ai-priority-pill--${pri}`}>Prioridad {a.prioridad}</span>
              </div>

              <div className="ai-pred-grid">
                {predicciones.map(p => (
                  <div key={p.nombre} className="ai-pred-item">
                    <div className="ai-pred-name">{p.nombre}</div>
                    <div className="ai-pred-val">{p.valor}</div>
                    <div className="ai-pred-detalle">{p.detalle}</div>
                  </div>
                ))}
              </div>

              <div className="ai-action-banner">Predicción general: {a.recomendacion}</div>
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
    <p className="ai-section-hint">
      Resumen inteligente por colaborador para acelerar la revisión de casos y expedientes integrales.
    </p>

    <div className="ai-case-grid">
      {analisisConDatos
        .slice()
        .sort((a, b) => {
          const orden = { "Crítica": 0, "Alta": 1, "Media": 2, "Baja": 3 };
          return orden[a.prioridad] - orden[b.prioridad];
        })
        .map((a, i) => {
          const pri = a.prioridad.toLowerCase().replace("í", "i");
          return (
            <div
              key={a.empleado.id}
              id={`ai-exp-${a.empleado.id}`}
              className={`ai-exp-card ai-case-card ai-case-card--${pri}${selectedEmp?.id === a.empleado.id ? " ai-exp-card--selected" : ""}`}
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <div className="ai-case-head">
                <div>
                  <div className="ai-case-name" style={{ fontSize: 18 }}>{a.empleado.name}</div>
                  <div className="ai-case-sub">{normalizeSucursal(a.empleado.sucursal)} · {a.empleado.puesto}</div>
                </div>
                <span className={`ai-priority-pill ai-priority-pill--${pri}`}>Prioridad {a.prioridad}</span>
              </div>

              <div className="ai-exp-metrics">
                <div className="ai-exp-metric">
                  <div className="ai-exp-metric-label">Pulse Score™</div>
                  <div className="ai-exp-metric-value" style={{ color: nivelColor(a.status.nivel) }}>{a.pulse}</div>
                  <div className="ai-exp-metric-sub">{a.status.label}</div>
                </div>
                <div className="ai-exp-metric">
                  <div className="ai-exp-metric-label">Semáforo</div>
                  <div className="ai-exp-metric-value ai-exp-metric-value--sm" style={{ color: nivelColor(a.status.nivel) }}>{a.status.semaforo}</div>
                  <div className="ai-exp-metric-sub">Estado actual</div>
                </div>
                <div className="ai-exp-metric">
                  <div className="ai-exp-metric-label">Señales detectadas</div>
                  <div className="ai-exp-metric-value" style={{ color: "var(--mc-verde)" }}>{a.riesgos.length}</div>
                  <div className="ai-exp-metric-sub">Riesgos / alertas</div>
                </div>
              </div>

              <div className="ai-exp-block">
                <div className="ai-exp-block-title"><Icon name="brain" size={16} /> Resumen IA del expediente</div>
                <div className="ai-exp-text">
                  {a.empleado.name} se encuentra en estado <b>{a.status.label}</b> con semáforo{" "}
                  <b>{a.status.semaforo}</b> y prioridad <b>{a.prioridad}</b>.
                  {a.riesgos.length > 0
                    ? ` El motor detectó ${a.riesgos.length} señal(es) que requieren seguimiento.`
                    : " No se detectan señales críticas en este momento."}
                </div>
              </div>

              <div className="ai-exp-block ai-exp-block--soft">
                <div className="ai-exp-block-title"><Icon name="alert" size={16} /> Riesgos principales</div>
                {a.riesgos.length > 0 ? (
                  <div className="ai-risk-list">
                    {a.riesgos.map((r, idx) => (
                      <div key={idx} className="ai-exp-risk-line">• <b>{r.tipo}</b> ({r.nivel}): {r.detalle}</div>
                    ))}
                  </div>
                ) : (
                  <div className="ai-risk-nivel">Sin riesgos relevantes detectados.</div>
                )}
              </div>

              <div className="ai-action-banner">Recomendación IA: {a.recomendacion}</div>

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
          );
        })}
    </div>
  </Card>
)}
      </motion.div>
      </AnimatePresence>
    </div>
  );
};


export default AIEngine;
