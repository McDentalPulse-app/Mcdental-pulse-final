import React, { useState } from "react";
import { useGlobal } from "../../contexts/GlobalContext";
import { useNotification } from "../../contexts/NotificationContext";
import Card from "../common/Card";
import SectionTitle from "../common/SectionTitle";
import StatCard from "../common/StatCard";
import Icon from "../ui/Icon";
import { normalizeSucursal } from "../../utils/constants";

const ReconocimientosGestion = ({ users, reconocimientos, onAdd, currentUser }) => {
  const { usuarios: USERS } = useGlobal();
  const { toast, confirm } = useNotification();

  const empleados = users.filter((u) => u.role === "empleado");
  const [empleadoId, setEmpleadoId] = useState(empleados[0]?.id || "");
  const [categoria, setCategoria] = useState("Excelente actitud");
  const [comentario, setComentario] = useState("");
  const [diplomaArchivo, setDiplomaArchivo] = useState(null);

  const categorias = [
    "Excelente actitud", "Liderazgo", "Trabajo en equipo", "Innovación",
    "Atención al paciente", "Puntualidad", "Valores McDental"
  ];

  const otorgar = async () => {
    const empleado = empleados.find(e => e.id === Number(empleadoId));
    if (!empleado) { toast.warning("Selecciona un empleado."); return; }
    if (!comentario.trim()) { toast.warning("Escribe un comentario para el reconocimiento."); return; }
    if (diplomaArchivo) {
      const continuar = await confirm({
        title: "Otorgar sin diploma",
        description: "El diploma no se subirá todavía porque Firebase Storage no está activo.\n\n¿Deseas otorgar el reconocimiento sin diploma?",
        variant: "warning",
        confirmText: "Otorgar sin diploma",
      });
      if (!continuar) return;
    }
    onAdd({
      empleadoId: empleado.id, empleado: empleado.name, sucursal: normalizeSucursal(empleado.sucursal),
      puesto: empleado.puesto, categoria, otorgadoPor: currentUser.name, comentario
    });
    setCategoria("Excelente actitud");
    setComentario("");
    setDiplomaArchivo(null);
    toast.success("Reconocimiento otorgado.");
  };

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">Reconocimientos</h1>
        <p className="admin-page-subtitle">
          Otorga y consulta reconocimientos al personal por desempeño, actitud y valores McDental.
        </p>
      </div>

      <div className="admin-stat-grid">
        <StatCard iconName="award" value={reconocimientos.length} label="Reconocimientos totales" valueClass="admin-stat-value--green" />
        <StatCard iconName="users" value={new Set(reconocimientos.map(r => r.empleadoId)).size} label="Empleados reconocidos" valueClass="admin-stat-value--blue" />
      </div>

      <div className="admin-grid-2">
        <Card>
          <SectionTitle icon="plus">Otorgar reconocimiento</SectionTitle>
          <div className="mc-form-grid">
            <div className="mc-form-group">
              <label className="mc-form-label">Empleado</label>
              <select className="mc-form-select" value={empleadoId} onChange={(e) => setEmpleadoId(e.target.value)}>
                {empleados.map(e => (
                  <option key={e.id} value={e.id}>{e.name} · {normalizeSucursal(e.sucursal)} · {e.puesto}</option>
                ))}
              </select>
            </div>
            <div className="mc-form-group">
              <label className="mc-form-label">Categoría</label>
              <select className="mc-form-select" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                {categorias.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="mc-form-group">
              <label className="mc-form-label">Comentario</label>
              <textarea
                className="mc-form-textarea"
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Describe el motivo del reconocimiento..."
                rows={4}
              />
            </div>
            <div className="mc-form-group">
              <label className="mc-form-label">Diploma del reconocimiento</label>
              <label className="mc-file-input-wrap">
                <span className="mc-file-input-icon"><Icon name="paperclip" size={18} /></span>
                <span className="mc-file-input-text">
                  {diplomaArchivo ? diplomaArchivo.name : "Seleccionar diploma (PDF o imagen)"}
                </span>
                <input
                  type="file"
                  accept=".pdf,image/*"
                  className="mc-file-input-overlay"
                  onChange={(e) => setDiplomaArchivo(e.target.files?.[0] || null)}
                />
              </label>
              <div className="mc-form-hint mc-form-hint--warn">
                <Icon name="alert" size={14} />
                <span>Adjunto preparado. La carga del diploma se activará cuando Firebase Storage esté habilitado.</span>
              </div>
            </div>
            <button type="button" className="mc-btn-primary mc-btn-with-icon" onClick={otorgar}>
              <Icon name="award" size={16} /> Otorgar reconocimiento
            </button>
          </div>
        </Card>

        <Card>
          <SectionTitle icon="clipboard">Historial reciente</SectionTitle>
          <div className="admin-list-scroll admin-list-scroll--tall">
            {reconocimientos.slice().reverse().map(r => (
              <div key={r.id} className="admin-list-item">
                <div className="admin-list-item-title">{r.empleado}</div>
                <div className="admin-list-item-meta" style={{ color: "var(--mc-verde-medio)", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon name="award" size={14} /> {r.categoria}
                </div>
                <div className="admin-list-item-meta">{r.fecha} · {normalizeSucursal(r.sucursal)} · Otorgado por {r.otorgadoPor}</div>
                <div className="admin-list-item-body">{r.comentario}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ReconocimientosGestion;
