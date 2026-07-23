import React, { useEffect, useState } from 'react';
import { useNotification } from '../../contexts/NotificationContext';
import Card from '../common/Card';
import SectionTitle from '../common/SectionTitle';
import StatCard from '../common/StatCard';
import PageHeader from '../common/PageHeader';
import Icon from '../ui/Icon';
import { SUCURSALES } from '../../utils/constants';
import { useAuth } from '../../contexts/AuthContext';
import { getAjustes, setExigirRostro } from '../../services/supabase/ajustesService';
import { getRostros } from '../../services/supabase/rostrosService';
import { useGlobal } from '../../contexts/GlobalContext';
import { probar as probarPush } from '../../services/pushService';

const Config = () => {
  const { toast, confirm } = useNotification();
  const { user } = useAuth();
  const { usuarios } = useGlobal();
  const [probando, setProbando] = useState(false);

  // Prueba de notificación: se manda un push a uno mismo y se reporta el resultado exacto.
  const enviarPrueba = async () => {
    setProbando(true);
    try {
      const { enviados, motivo } = await probarPush();
      if (enviados > 0) {
        toast.success(`Enviado a ${enviados} ${enviados === 1 ? "dispositivo" : "dispositivos"}. Revisa tu teléfono y la campana.`);
      } else if (motivo) {
        toast.error(`No se pudo: ${motivo}.`);
      } else {
        toast.info("No tienes ningún teléfono suscrito. Abre la app en tu celular y acepta las notificaciones.");
      }
    } catch (e) {
      toast.error(e?.message || "No se pudo enviar la prueba.");
    } finally {
      setProbando(false);
    }
  };

  // El único ajuste de esta pantalla que se persiste de verdad (migración 044). El resto
  // sigue siendo la maqueta que ya estaba.
  const [exigirRostro, setExigir] = useState(false);
  const [rostrosAprobados, setRostrosAprobados] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let activo = true;
    Promise.all([getAjustes(), getRostros().catch(() => [])])
      .then(([a, rs]) => {
        if (!activo) return;
        setExigir(a.exigirRostro);
        setRostrosAprobados(rs.filter((r) => r.estado === "aprobado").length);
      });
    return () => { activo = false; };
  }, []);

  const empleados = usuarios.filter((u) => !u.inactivo && ["empleado", "doctor"].includes(u.role)).length;
  const sinRegistrar = rostrosAprobados === null ? null : Math.max(0, empleados - rostrosAprobados);

  const cambiarExigencia = async (nuevo) => {
    if (nuevo) {
      // Encender esto deja sin fichar a quien no esté registrado. No es un ajuste de
      // decoración, y se le dice a la cara ANTES de encenderlo, con el número exacto.
      const ok = await confirm({
        title: "Exigir rostro para checar",
        description: sinRegistrar
          ? `${sinRegistrar} empleado(s) todavía NO tienen el rostro aprobado. A partir de ahora NO podrán checar hasta que se registren y Recursos Humanos los apruebe. ¿Continuar?`
          : "Todos los empleados tienen su rostro aprobado. A partir de ahora será obligatorio para poder checar.",
        variant: sinRegistrar ? "danger" : "default",
        confirmText: "Activar",
      });
      if (!ok) return;
    }

    setGuardando(true);
    try {
      const a = await setExigirRostro(nuevo, user?.id);
      setExigir(a.exigirRostro);
      toast.success(nuevo ? "El rostro ya es obligatorio para checar." : "Ya se puede checar sin rostro registrado.");
    } catch (e) {
      toast.error(e?.message || "No se pudo guardar el ajuste.");
    } finally {
      setGuardando(false);
    }
  };

  const [verde, setVerde] = useState(70);
  const [amarillo, setAmarillo] = useState(45);
  const [rojo, setRojo] = useState(45);

  const guardarConfig = () => {
    toast.success("Configuración guardada correctamente en modo demo. Estos valores todavía no se persisten por organización.");
  };

  const roles = [
    { nombre: "Admin", acceso: "Acceso total al sistema, reportes y configuración." },
    { nombre: "Psicóloga", acceso: "Acceso a bienestar, seguimiento, reportes confidenciales y mensajes privados." },
    { nombre: "RH", acceso: "Acceso a vacaciones, permisos, descuentos, calendario y reportes RH." },
    { nombre: "Empleado", acceso: "Acceso a encuesta, historial, reconocimientos, reporte confidencial y mensajes con psicóloga." }
  ];

  const privacidad = [
    "Los mensajes privados solo son visibles entre empleado y psicóloga.",
    "RH no puede ver reportes confidenciales ni conversaciones privadas.",
    "Admin puede ver indicadores generales, pero no debe acceder al contenido de mensajes privados.",
    "Los reportes confidenciales son visibles únicamente para psicóloga y admin principal.",
    "Los datos sensibles se protegen con Row Level Security a nivel de base de datos."
  ];

  return (
    <div className="admin-page">
      <PageHeader
        icon="settings"
        title="Configuración"
        subtitle="Parámetros generales de McDental Pulse, roles, privacidad y umbrales de bienestar."
      />

      <Card>
        <SectionTitle icon="camera">Rostro obligatorio para checar</SectionTitle>

        <p className="mc-hint">
          <Icon name="alert" size={15} />
          Mientras esté <strong>apagado</strong>, quien no tenga el rostro registrado puede checar
          igual (sin comprobación). Es lo que hay que hacer al principio: si se exigiera desde el
          primer día, <strong>no podría fichar nadie</strong>. Enciéndelo cuando la plantilla ya esté
          registrada — a partir de ahí, no registrarse deja de ser la forma fácil de esquivar la
          comprobación.
        </p>

        <div className="ajuste-fila">
          <label className="enrolar-consentimiento">
            <input
              type="checkbox"
              checked={exigirRostro}
              disabled={guardando}
              onChange={(e) => cambiarExigencia(e.target.checked)}
            />
            <span>
              <strong>Exigir rostro registrado para poder checar</strong>
              {sinRegistrar !== null && (
                <>
                  <br />
                  {sinRegistrar === 0
                    ? `Los ${empleados} empleados tienen su rostro aprobado.`
                    : `${sinRegistrar} de ${empleados} empleados todavía NO lo tienen aprobado y no podrían checar.`}
                </>
              )}
            </span>
          </label>
        </div>
      </Card>

      <div className="admin-grid-auto">
        <Card className="admin-stat-card">
          <div className="admin-stat-icon-wrap">
            <Icon name="activity" size={20} />
          </div>
          <h3 className="admin-section-title" style={{ marginBottom: 8 }}>McDental Pulse</h3>
          <p className="admin-list-item-meta" style={{ margin: 0 }}>
            Plataforma interna de telemetría avanzada para bienestar, clima laboral,
            seguimiento psicológico y gestión administrativa.
          </p>
        </Card>

        <Card className="admin-stat-card">
          <div className="admin-stat-icon-wrap">
            <Icon name="building" size={20} />
          </div>
          <SectionTitle icon="building" className="config-inline-title">Sucursales activas</SectionTitle>
          <div className="mc-tag-grid">
            {SUCURSALES.map(s => (
              <span key={s} className="mc-tag">{s}</span>
            ))}
          </div>
        </Card>

        <Card className="admin-stat-card">
          <div className="admin-stat-icon-wrap">
            <Icon name="ai" size={20} />
          </div>
          <SectionTitle icon="ai" className="config-inline-title">AI Engine</SectionTitle>
          <p className="admin-list-item-meta" style={{ margin: 0 }}>
            Motor local por reglas activo. No genera costos de API. Preparado para conectar Gemini,
            Groq u OpenRouter más adelante.
          </p>
        </Card>
      </div>

      <Card className="config-panel">
        <SectionTitle icon="stable">Umbrales del semáforo</SectionTitle>
        <p className="config-panel-lead">
          Rangos de Pulse Score para clasificar el bienestar del equipo en verde, amarillo y rojo.
        </p>

        <div className="config-threshold-grid">
          <div className="config-threshold-card config-threshold--verde">
            <label className="mc-form-label config-threshold-label--verde" htmlFor="cfg-verde">
              <Icon name="check" size={14} /> Verde mayor o igual a
            </label>
            <input id="cfg-verde" className="mc-form-input config-threshold-input" value={verde} onChange={(e) => setVerde(e.target.value)} />
          </div>
          <div className="config-threshold-card config-threshold--amarillo">
            <label className="mc-form-label config-threshold-label--amarillo" htmlFor="cfg-amarillo">
              <Icon name="warning" size={14} /> Amarillo mayor o igual a
            </label>
            <input id="cfg-amarillo" className="mc-form-input config-threshold-input" value={amarillo} onChange={(e) => setAmarillo(e.target.value)} />
          </div>
          <div className="config-threshold-card config-threshold--rojo">
            <label className="mc-form-label config-threshold-label--rojo" htmlFor="cfg-rojo">
              <Icon name="critical" size={14} /> Rojo menor a
            </label>
            <input id="cfg-rojo" className="mc-form-input config-threshold-input" value={rojo} onChange={(e) => setRojo(e.target.value)} />
          </div>
        </div>

        <div className="config-panel-footer">
          <button type="button" className="mc-btn-primary mc-btn-with-icon" onClick={guardarConfig}>
            <Icon name="check" size={16} /> Guardar configuración
          </button>
        </div>
      </Card>

      <Card className="config-panel">
        <SectionTitle icon="bell">Notificaciones</SectionTitle>
        <p className="mc-hint">
          <Icon name="alert" size={15} />
          Envíate una notificación de prueba para comprobar que el push llega a tu teléfono.
          Antes, abre la app en tu celular y acepta las notificaciones.
        </p>
        <button type="button" className="mc-btn-primary mc-btn-with-icon" disabled={probando} onClick={enviarPrueba}>
          <Icon name="bell" size={16} />
          {probando ? "Enviando…" : "Enviar notificación de prueba"}
        </button>
      </Card>

      <div className="admin-grid-2 config-info-grid">
        <Card className="config-info-card">
          <SectionTitle icon="users">Roles del sistema</SectionTitle>
          <div className="config-info-list">
            {roles.map(r => (
              <div key={r.nombre} className="config-role-item">
                <div className="config-role-name">{r.nombre}</div>
                <div className="config-role-desc">{r.acceso}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="config-info-card">
          <SectionTitle icon="shield">Privacidad y seguridad</SectionTitle>
          <div className="config-info-list">
            {privacidad.map((p, idx) => (
              <div key={idx} className="config-privacy-item">
                <Icon name="check" size={14} className="config-privacy-check" />
                <span>{p}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Config;
