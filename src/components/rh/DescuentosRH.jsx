import React, { useState, useEffect, useRef } from "react";
import Card from "../common/Card";
import Badge from "../common/Badge";
import Avatar from "../ui/Avatar";
import PulseScoreBadge from "../common/PulseScoreBadge";
import RiskBar from "../common/RiskBar";
import { semaforoColor, semaforoBg, semaforoLabel } from "../../config/theme";
import { USERS } from "../../data/initialData";
import { semanaActual } from "../../utils/constants";
import { calcularAntiguedad } from "../../utils/helpers";
import { calcPulseScore, getPulseStatus, calcRiesgos } from "../../utils/pulseScore";
import { db } from "../../config/firebase";
import { collection, addDoc, getDocs, updateDoc, doc, serverTimestamp } from "firebase/firestore";

const DescuentosRH = ({ descuentos, empleados, user, onUpdateEstado, onAddDescuento }) => {
    const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const pendientes = descuentos.filter(d => d.estado === "pendiente").length;
  const activos = descuentos.filter(d => d.estado === "activo").length;
  const pagados = descuentos.filter(d => d.estado === "pagado").length;
  const totalActivo = descuentos
    .filter(d => d.estado !== "pagado" && d.estado !== "cancelado")
    .reduce((sum, d) => sum + d.monto, 0);

  const badgeStyle = (estado) => ({
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    background:
      estado === "pagado" ? "#dcfce7" :
      estado === "cancelado" ? "#fee2e2" :
      estado === "activo" ? "#dbeafe" :
      "#fef3c7",
    color:
      estado === "pagado" ? "#166534" :
      estado === "cancelado" ? "#991b1b" :
      estado === "activo" ? "#1e40af" :
      "#92400e"
  });

  const money = (amount) =>
    new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN"
    }).format(amount);

  return (
    <div>
      <h1 style={{ margin: "0 0 6px", fontSize: 28, color: "#004D40" }}>
        Descuentos
      </h1>
      <p style={{ margin: "0 0 24px", color: "#64748b" }}>
        Registro y seguimiento de descuentos administrativos del personal.
      </p>

      <button
  onClick={() => setMostrarFormulario(!mostrarFormulario)}
  style={{
    marginBottom: 15,
    padding: "10px 16px",
    borderRadius: 8,
    border: "none",
    background: "#006D5B",
    color: "white",
    fontWeight: 700,
    cursor: "pointer"
  }}
>
  {mostrarFormulario ? "Cancelar" : "+ Agregar descuento"}
</button>
{mostrarFormulario && (
  <Card>
    <h3 style={{ marginTop: 0, color: "#004D40" }}>Agregar descuento</h3>

    <form
      onSubmit={(e) => {
        e.preventDefault();

        const form = e.target;
        const empleadoId = Number(form.empleadoId.value);
        const empleadoSeleccionado = empleados.find(emp => emp.id === empleadoId);

        if (!empleadoSeleccionado) {
          alert("Selecciona un empleado.");
          return;
        }

        const nuevoDescuento = {
          empleadoId: empleadoSeleccionado.id,
          empleado: empleadoSeleccionado.name,
          sucursal: empleadoSeleccionado.sucursal || "Sin sucursal",
          puesto: empleadoSeleccionado.puesto || empleadoSeleccionado.categoria || "Empleado",
          tipo: form.tipo.value,
          motivo: form.motivo.value,
          observaciones: form.observaciones.value,
          fecha: form.fecha.value,
          monto: Number(form.monto.value),
          responsable: user?.name || "RH"
        };

        onAddDescuento(nuevoDescuento);

        alert("Descuento agregado correctamente.");
        form.reset();
        setMostrarFormulario(false);
      }}
    >
      <select name="empleadoId" required>
        <option value="">Selecciona empleado</option>
        {empleados
          .filter(emp => emp.role === "empleado")
          .map(emp => (
            <option key={emp.id} value={emp.id}>
              {emp.name} - {emp.sucursal}
            </option>
          ))}
      </select>

      <input name="tipo" placeholder="Tipo de descuento" required />
      <input name="motivo" placeholder="Motivo" required />
      <input name="observaciones" placeholder="Observaciones" />
      <input name="fecha" type="date" required />
      <input name="monto" type="number" placeholder="Monto" required />

      <button type="submit">
        Guardar descuento
      </button>
    </form>
  </Card>
)}

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 14,
        marginBottom: 22
      }}>
        <Card>
          <div style={{ fontSize: 24 }}>⏳</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: "#f59e0b" }}>{pendientes}</div>
          <div style={{ fontWeight: 700 }}>Pendientes</div>
        </Card>
        <Card>
          <div style={{ fontSize: 24 }}>📌</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: "#2563eb" }}>{activos}</div>
          <div style={{ fontWeight: 700 }}>Activos</div>
        </Card>
        <Card>
          <div style={{ fontSize: 24 }}>✅</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: "#22c55e" }}>{pagados}</div>
          <div style={{ fontWeight: 700 }}>Pagados</div>
        </Card>
        <Card>
          <div style={{ fontSize: 24 }}>💰</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#00897B" }}>{money(totalActivo)}</div>
          <div style={{ fontWeight: 700 }}>Monto activo</div>
        </Card>
      </div>

      <Card>
        <h3 style={{ marginTop: 0, color: "#004D40" }}>💸 Registro de descuentos</h3>

        <div style={{ display: "grid", gap: 12 }}>
          {descuentos.map(d => (
            <div
              key={d.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1.4fr 1fr 1fr auto",
                gap: 12,
                alignItems: "center",
                padding: "14px 0",
                borderBottom: "1px solid #e5e7eb"
              }}
            >
              <div>
                <div style={{ fontWeight: 800, color: "#0f172a" }}>{d.empleado}</div>
                <div style={{ color: "#64748b", fontSize: 13 }}>
                  {d.sucursal} · {d.puesto}
                </div>
                <div style={{ color: "#334155", fontSize: 13, marginTop: 4 }}>
                  {d.tipo} · {d.motivo}
                </div>
                <div style={{ color: "#94a3b8", fontSize: 12 }}>
                  Observaciones: {d.observaciones}
                </div>
              </div>

              <div style={{ color: "#334155", fontSize: 14 }}>
                {d.fecha}
                <div style={{ color: "#64748b", fontSize: 12 }}>{money(d.monto)}</div>
                <div style={{ color: "#94a3b8", fontSize: 12 }}>
                  Responsable: {d.responsable}
                </div>
              </div>

              <div>
                <span style={badgeStyle(d.estado)}>{d.estado}</span>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                {d.estado !== "pagado" && d.estado !== "cancelado" ? (
                  <>
                    <button
                      onClick={() => onUpdateEstado(d.id, "pagado")}
                      style={{
                        border: "none",
                        background: "#00897B",
                        color: "white",
                        padding: "8px 10px",
                        borderRadius: 8,
                        fontWeight: 700,
                        cursor: "pointer"
                      }}
                    >
                      Marcar pagado
                    </button>
                    <button
                      onClick={() => onUpdateEstado(d.id, "cancelado")}
                      style={{
                        border: "none",
                        background: "#ef4444",
                        color: "white",
                        padding: "8px 10px",
                        borderRadius: 8,
                        fontWeight: 700,
                        cursor: "pointer"
                      }}
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <span style={{ color: "#94a3b8", fontSize: 13 }}>Sin acciones</span>
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
