import { calcPulseScore, getPulseStatus, tieneScoreValido } from "./pulseScore";

// Motor de reglas de riesgo local (sin IA externa): a partir del expediente de
// un empleado deriva prioridad, lista de riesgos y recomendación. Extraído de
// AIEngine.jsx para mantener el componente por debajo del límite de tamaño.

// Sin `color` ni `bg`: los devolvía en hex y nadie los leía ya. El color lo decide el
// CSS a partir de `nivel` (ver DESIGN.md).
const STATUS_SIN_DATOS = {
  label: "Sin datos",
  semaforo: "Sin evaluación",
  nivel: "sin-datos",
};

export const analyzeEmployeeAI = (empleado, encuestas, permisos = [], descuentos = [], reconocimientos = [], reportesConfidenciales = [], USERS = []) => {
  const encuestasEmpleado = encuestas.filter(e => e.empleadoId === empleado.id);
  const encuestasConScore = encuestasEmpleado.filter(e => tieneScoreValido(e.score));
  const permisosEmpleado = permisos.filter(p => p.empleadoId === empleado.id);
  const descuentosEmpleado = descuentos.filter(d => d.empleadoId === empleado.id);
  const reconocimientosEmpleado = reconocimientos.filter(r => r.empleadoId === empleado.id);
  const reportesEmpleado = reportesConfidenciales.filter(r => r.empleadoId === empleado.id);

  const pulseResult = calcPulseScore(empleado.id, encuestas);
  const tieneDatosReales = !pulseResult.sinDatos && tieneScoreValido(pulseResult.score);
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
