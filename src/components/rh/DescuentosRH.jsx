import React, { useState } from "react";
import Card from "../common/Card";
import StatCard from "../common/StatCard";
import SectionTitle from "../common/SectionTitle";
import PageHeader from "../common/PageHeader";
import Icon from "../ui/Icon";
import { normalizeSucursal } from "../../utils/constants";
import { useNotification } from "../../contexts/NotificationContext";
import { esEmpleadoActivo } from "../../utils/helpers";

const DescuentosRH = ({ descuentos, empleados, user, onUpdateEstado, onAddDescuento }) => {
  const { toast } = useNotification();
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const pendientes = descuentos.filter(d => d.estado === "pendiente").length;
  const activos = descuentos.filter(d => d.estado === "activo").length;
  const pagados = descuentos.filter(d => d.estado === "pagado").length;
  const totalActivo = descuentos
    .filter(d => d.estado !== "pagado" && d.estado !== "cancelado")
    .reduce((sum, d) => sum + d.monto, 0);

  const money = (amount) =>
    new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN"
    }).format(amount);

  return (
    <div className="admin-page">
      <PageHeader
        icon="dollar"
        title="Descuentos"
        subtitle="Registro y seguimiento de descuentos administrativos del personal."
      >
        <button
          type="button"
          className="mc-btn-primary mc-btn-with-icon"
          onClick={() => setMostrarFormulario(!mostrarFormulario)}
        >
          <Icon name={mostrarFormulario ? "xCircle" : "plus"} size={16} />
          {mostrarFormulario ? "Cancelar" : "Agregar descuento"}
        </button>
      </PageHeader>

      {mostrarFormulario && (
        <Card className="rh-form-panel">
          <SectionTitle icon="plus">Agregar descuento</SectionTitle>

          <form
            className="mc-form-grid"
            onSubmit={(e) => {
              e.preventDefault();

              const form = e.target;
              const empleadoId = Number(form.empleadoId.value);
              const empleadoSeleccionado = empleados.find(emp => emp.id === empleadoId);

              if (!empleadoSeleccionado) {
                toast.warning("Selecciona un empleado.");
                return;
              }

              const nuevoDescuento = {
                empleadoId: empleadoSeleccionado.id,
                empleado: empleadoSeleccionado.name,
                sucursal: normalizeSucursal(empleadoSeleccionado.sucursal) || "Sin sucursal",
                puesto: empleadoSeleccionado.puesto || empleadoSeleccionado.categoria || "Empleado",
                tipo: form.tipo.value,
                motivo: form.motivo.value,
                observaciones: form.observaciones.value,
                fecha: form.fecha.value,
                monto: Number(form.monto.value),
                responsable: user?.name || "RH"
              };

              onAddDescuento(nuevoDescuento);

              toast.success("Descuento agregado correctamente.");
              form.reset();
              setMostrarFormulario(false);
            }}
          >
            <div className="mc-form-group">
              <label className="mc-form-label" htmlFor="dr-empleado">Empleado</label>
              <select id="dr-empleado" className="mc-form-select" name="empleadoId" required>
                <option value="">Selecciona empleado</option>
                {empleados
                  .filter(esEmpleadoActivo)
                  .map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} - {normalizeSucursal(emp.sucursal)}
                    </option>
                  ))}
              </select>
            </div>

            <div className="mc-form-row-2">
              <div className="mc-form-group">
                <label className="mc-form-label" htmlFor="dr-tipo">Tipo de descuento</label>
                <input id="dr-tipo" className="mc-form-input" name="tipo" placeholder="Ej. Préstamo, Faltante..." required />
              </div>
              <div className="mc-form-group">
                <label className="mc-form-label" htmlFor="dr-motivo">Motivo</label>
                <input id="dr-motivo" className="mc-form-input" name="motivo" placeholder="Motivo del descuento" required />
              </div>
            </div>

            <div className="mc-form-row-2">
              <div className="mc-form-group">
                <label className="mc-form-label" htmlFor="dr-fecha">Fecha</label>
                <input id="dr-fecha" className="mc-form-input" name="fecha" type="date" required />
              </div>
              <div className="mc-form-group">
                <label className="mc-form-label" htmlFor="dr-monto">Monto</label>
                <input id="dr-monto" className="mc-form-input" name="monto" type="number" placeholder="0.00" required />
              </div>
            </div>

            <div className="mc-form-group">
              <label className="mc-form-label" htmlFor="dr-observaciones">Observaciones</label>
              <input id="dr-observaciones" className="mc-form-input" name="observaciones" placeholder="Observaciones opcionales" />
            </div>

            <div className="rh-form-actions">
              <button type="button" className="mc-btn-secondary" onClick={() => setMostrarFormulario(false)}>
                Cancelar
              </button>
              <button type="submit" className="mc-btn-primary mc-btn-with-icon">
                <Icon name="check" size={16} /> Guardar descuento
              </button>
            </div>
          </form>
        </Card>
      )}

      <div className="admin-stat-grid">
        <StatCard iconName="clock" value={pendientes} label="Pendientes" valueClass="admin-stat-value--amber" />
        <StatCard iconName="pin" value={activos} label="Activos" valueClass="admin-stat-value--blue" />
        <StatCard iconName="check" value={pagados} label="Pagados" valueClass="admin-stat-value--green" />
        <StatCard iconName="dollar" value={money(totalActivo)} label="Monto activo" valueClass="admin-stat-value--green" />
      </div>

      <Card>
        <SectionTitle icon="dollar">Registro de descuentos</SectionTitle>

        <div className="rh-data-list">
          {descuentos.map(d => (
            <div key={d.id} className="rh-data-row">
              <div className="rh-data-row-main">
                <div className="rh-data-row-title">{d.empleado}</div>
                <div className="rh-data-row-sub">{normalizeSucursal(d.sucursal)} · {d.puesto}</div>
                <div className="rh-data-row-detail">{d.tipo} · {d.motivo}</div>
                <div className="rh-data-row-note">Observaciones: {d.observaciones}</div>
              </div>

              <div className="rh-data-row-meta">
                <div className="rh-data-row-meta-primary">{d.fecha}</div>
                <div className="rh-data-row-meta-secondary">{money(d.monto)}</div>
                <div className="rh-data-row-note">Responsable: {d.responsable}</div>
              </div>

              <div className="rh-data-row-status">
                <span className={`mc-status-pill mc-status-pill--${d.estado}`}>{d.estado}</span>
              </div>

              <div className="rh-data-row-actions">
                {d.estado !== "pagado" && d.estado !== "cancelado" ? (
                  <>
                    <button
                      type="button"
                      className="mc-btn-primary mc-btn-sm-action"
                      onClick={() => onUpdateEstado(d.id, "pagado")}
                    >
                      <Icon name="check" size={14} /> Marcar pagado
                    </button>
                    <button
                      type="button"
                      className="mc-btn-danger mc-btn-sm-action"
                      onClick={() => onUpdateEstado(d.id, "cancelado")}
                    >
                      <Icon name="xCircle" size={14} /> Cancelar
                    </button>
                  </>
                ) : (
                  <span className="rh-data-row-muted">Sin acciones</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default DescuentosRH;
