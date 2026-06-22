import React, { useState } from "react";
import { useGlobal } from "../../contexts/GlobalContext";
import Card from "../common/Card";

const ReconocimientosGestion = ({ users, reconocimientos, onAdd, currentUser }) => {
  const { usuarios: USERS } = useGlobal();

  const empleados = users.filter((u) => u.role === "empleado");
  const [empleadoId, setEmpleadoId] = useState(empleados[0]?.id || "");
  const [categoria, setCategoria] = useState("Excelente actitud");
  const [comentario, setComentario] = useState("");
  const [diplomaArchivo, setDiplomaArchivo] = useState(null);

  const categorias = [
    "Excelente actitud", "Liderazgo", "Trabajo en equipo", "Innovación",
    "Atención al paciente", "Puntualidad", "Valores McDental"
  ];

  const otorgar = () => {
    const empleado = empleados.find(e => e.id === Number(empleadoId));
    if (!empleado) { alert("Selecciona un empleado."); return; }
    if (!comentario.trim()) { alert("Escribe un comentario para el reconocimiento."); return; }
    if (diplomaArchivo) {
      const continuar = window.confirm(
        "El diploma no se subirá todavía porque Firebase Storage no está activo.\n\n¿Deseas otorgar el reconocimiento sin diploma?"
      );
      if (!continuar) return;
    }
    onAdd({
      empleadoId: empleado.id, empleado: empleado.name, sucursal: empleado.sucursal,
      puesto: empleado.puesto, categoria, otorgadoPor: currentUser.name, comentario
    });
    setCategoria("Excelente actitud");
    setComentario("");
    setDiplomaArchivo(null);
    alert("Reconocimiento otorgado.");
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
        <Card className="admin-stat-card">
          <div className="admin-stat-icon">🏅</div>
          <div className="admin-stat-value admin-stat-value--green">{reconocimientos.length}</div>
          <div className="admin-stat-label">Reconocimientos totales</div>
        </Card>
        <Card className="admin-stat-card">
          <div className="admin-stat-icon">👥</div>
          <div className="admin-stat-value admin-stat-value--blue">{new Set(reconocimientos.map(r => r.empleadoId)).size}</div>
          <div className="admin-stat-label">Empleados reconocidos</div>
        </Card>
      </div>

      <div className="admin-grid-2">
        <Card>
          <h3 className="admin-section-title">➕ Otorgar reconocimiento</h3>
          <div className="mc-form-grid">
            <div className="mc-form-group">
              <label className="mc-form-label">Empleado</label>
              <select className="mc-form-select" value={empleadoId} onChange={(e) => setEmpleadoId(e.target.value)}>
                {empleados.map(e => (
                  <option key={e.id} value={e.id}>{e.name} · {e.sucursal} · {e.puesto}</option>
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
              <input type="file" accept=".pdf,image/*" className="mc-form-input" onChange={(e) => setDiplomaArchivo(e.target.files?.[0] || null)} />
              {diplomaArchivo && <div className="mc-form-hint">Archivo seleccionado: {diplomaArchivo.name}</div>}
              <div className="mc-form-hint mc-form-hint--warn">
                Adjunto preparado. La carga del diploma se activará cuando Firebase Storage esté habilitado.
              </div>
            </div>
            <button className="mc-btn-primary" onClick={otorgar}>Otorgar reconocimiento</button>
          </div>
        </Card>

        <Card>
          <h3 className="admin-section-title">📋 Historial reciente</h3>
          <div className="admin-list-scroll admin-list-scroll--tall">
            {reconocimientos.slice().reverse().map(r => (
              <div key={r.id} className="admin-list-item">
                <div className="admin-list-item-title">{r.empleado}</div>
                <div className="admin-list-item-meta" style={{ color: "var(--mc-verde-medio)", fontWeight: 700 }}>
                  🏅 {r.categoria}
                </div>
                <div className="admin-list-item-meta">{r.fecha} · {r.sucursal} · Otorgado por {r.otorgadoPor}</div>
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
