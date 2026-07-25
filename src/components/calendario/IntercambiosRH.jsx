import React, { useState } from "react";
import Card from "../common/Card";
import StatCard from "../common/StatCard";
import SectionTitle from "../common/SectionTitle";
import PageHeader from "../common/PageHeader";
import Icon from "../ui/Icon";
import { normalizeSucursal } from "../../utils/constants";
import { useNotification } from "../../contexts/NotificationContext";

const ESTADO_LABEL = { pendiente: "Pendiente", aprobado: "Aprobado", rechazado: "Rechazado" };
const TIPO_FESTIVO = { oficial: "Oficial (no laborable)", empresa: "Empresa (no laborable)", conmemorativo: "Conmemorativo (se trabaja)" };
const legible = (f) =>
  new Date(`${f}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });

const IntercambiosRH = ({ intercambios, festivos, onResolver, onAddFestivo, onDeleteFestivo }) => {
  const { prompt, confirm } = useNotification();

  const pendientes = intercambios.filter((i) => i.estado === "pendiente").length;
  const aprobados = intercambios.filter((i) => i.estado === "aprobado").length;
  const rechazados = intercambios.filter((i) => i.estado === "rechazado").length;

  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevaFecha, setNuevaFecha] = useState("");

  const handleResolver = async (id, estado) => {
    const comentario = await prompt({
      title: estado === "aprobado" ? "Aprobar intercambio" : "Rechazar intercambio",
      description: "Comentario para la persona (opcional):",
      placeholder: "Escribe un comentario (opcional)",
      confirmText: estado === "aprobado" ? "Aprobar" : "Rechazar",
    });
    if (comentario === null) return;
    onResolver(id, estado, comentario || "");
  };

  const agregarFestivo = async () => {
    if (!nuevaFecha || !nuevoNombre.trim()) return;
    const ok = await onAddFestivo({ fecha: nuevaFecha, nombre: nuevoNombre.trim() });
    if (ok) { setNuevaFecha(""); setNuevoNombre(""); }
  };

  const quitarFestivo = async (f) => {
    const ok = await confirm({
      title: "Quitar festivo",
      description: `¿Quitar "${f.nombre}" del ${legible(f.fecha)}?`,
      variant: "danger",
      confirmText: "Quitar",
    });
    if (ok) onDeleteFestivo(f.id);
  };

  return (
    <div className="admin-page">
      <PageHeader
        icon="calendar"
        title="Intercambios de día"
        subtitle="Aprueba o rechaza las solicitudes de intercambio y administra los días festivos de la empresa."
      />

      <div className="admin-stat-grid">
        <StatCard iconName="clock" value={pendientes} label="Pendientes" valueClass="admin-stat-value--amber" />
        <StatCard iconName="check" value={aprobados} label="Aprobados" valueClass="admin-stat-value--green" />
        <StatCard iconName="xCircle" value={rechazados} label="Rechazados" valueClass="admin-stat-value--red" />
      </div>

      <Card>
        <SectionTitle icon="calendar">Solicitudes de intercambio</SectionTitle>
        {intercambios.length === 0 ? (
          <p className="rh-data-row-muted">No hay solicitudes.</p>
        ) : (
          <div className="rh-data-list">
            {[...intercambios]
              .sort((a, b) => (b.estado === "pendiente") - (a.estado === "pendiente"))
              .map((i) => (
                <div key={i.id} className="rh-data-row">
                  <div className="rh-data-row-main">
                    <div className="rh-data-row-title">{i.empleado}</div>
                    <div className="rh-data-row-sub">{normalizeSucursal(i.sucursal)} · {i.puesto}</div>
                    <div className="rh-data-row-note">
                      Trabaja el {legible(i.fechaFestivo)} · quiere libre el {legible(i.fechaDestino)}
                    </div>
                  </div>
                  <div className="rh-data-row-status">
                    <span className={`mc-status-pill mc-status-pill--${i.estado}`}>{ESTADO_LABEL[i.estado]}</span>
                  </div>
                  <div className="rh-data-row-actions">
                    {i.estado === "pendiente" ? (
                      <>
                        <button type="button" className="mc-btn-primary mc-btn-sm-action" onClick={() => handleResolver(i.id, "aprobado")}>
                          <Icon name="check" size={14} /> Aprobar
                        </button>
                        <button type="button" className="mc-btn-danger mc-btn-sm-action" onClick={() => handleResolver(i.id, "rechazado")}>
                          <Icon name="xCircle" size={14} /> Rechazar
                        </button>
                      </>
                    ) : (
                      <span className="rh-data-row-muted">Sin acciones</span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle icon="calendar">Días festivos</SectionTitle>
        <div className="festivo-alta">
          <input
            type="date"
            className="mc-form-input"
            value={nuevaFecha}
            onChange={(e) => setNuevaFecha(e.target.value)}
            aria-label="Fecha del festivo"
          />
          <input
            type="text"
            className="mc-form-input"
            placeholder="Nombre del festivo"
            value={nuevoNombre}
            onChange={(e) => setNuevoNombre(e.target.value)}
            aria-label="Nombre del festivo"
          />
          <button type="button" className="mc-btn-primary mc-btn-sm-action" onClick={agregarFestivo} disabled={!nuevaFecha || !nuevoNombre.trim()}>
            <Icon name="check" size={14} /> Agregar
          </button>
        </div>

        <div className="rh-data-list">
          {[...festivos].sort((a, b) => a.fecha.localeCompare(b.fecha)).map((f) => (
            <div key={f.id} className="rh-data-row">
              <div className="rh-data-row-main">
                <div className="rh-data-row-title">{f.nombre}</div>
                <div className="rh-data-row-sub">{legible(f.fecha)} · {TIPO_FESTIVO[f.tipo] || "Empresa"}</div>
              </div>
              <div className="rh-data-row-actions">
                <button type="button" className="mc-btn-danger mc-btn-sm-action" onClick={() => quitarFestivo(f)}>
                  <Icon name="xCircle" size={14} /> Quitar
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default IntercambiosRH;
