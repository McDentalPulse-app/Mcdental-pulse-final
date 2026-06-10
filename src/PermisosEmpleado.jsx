import React, { useState } from "react";

export default function PermisosEmpleado({
  user,
  vacaciones = [],
  permisos = [],
  onEnviarSolicitudEmpleado
}) {
  const [tipoSeleccionado, setTipoSeleccionado] = useState("");
  const [fechaInicioPreview, setFechaInicioPreview] = useState("");
  const [fechaFinPreview, setFechaFinPreview] = useState("");
  const [diasPreview, setDiasPreview] = useState(0);

  const calcularDias = (inicio, fin) => {
    const fechaInicio = new Date(inicio);
    const fechaFin = new Date(fin);
    return Math.floor((fechaFin - fechaInicio) / (1000 * 60 * 60 * 24)) + 1;
  };

  const handleFechaChange = (inicio, fin) => {
    if (inicio && fin) {
      const dias = calcularDias(inicio, fin);
      setDiasPreview(dias > 0 ? dias : 0);
    } else {
      setDiasPreview(0);
    }
  };

  const solicitudesEmpleado = [
    ...vacaciones
      .filter((v) => v.empleadoId === user?.id)
      .map((v) => ({
        ...v,
        tipo: "Vacaciones"
      })),
    ...permisos
      .filter((p) => p.empleadoId === user?.id)
      .map((p) => ({
        ...p,
        tipo: "Permisos"
      }))
  ].sort((a, b) => Number(b.id) - Number(a.id));

  return (
    <div style={{ padding: 20, textAlign: "center" }}>
      <h2>Permisos - {user?.name || "Empleado"}</h2>

      <form
        onSubmit={(e) => {
          e.preventDefault();

          const form = e.target;
          const tipo = form.tipo.value;
          const fechaInicio = form.fechaInicio.value;
          const fechaFin =
            tipo === "Vacaciones" ? form.fechaFin.value : form.fechaInicio.value;

          if (!tipo) {
            alert("Selecciona un tipo de permiso");
            return;
          }

          if (!fechaInicio) {
            alert("Selecciona la fecha de inicio");
            return;
          }

          if (tipo === "Vacaciones" && !fechaFin) {
            alert("Selecciona la fecha de fin");
            return;
          }

          if (tipo === "Permisos" && !form.hora.value) {
            alert("Selecciona la hora para el permiso");
            return;
          }

          let dias = 1;

          if (tipo === "Vacaciones") {
            dias = calcularDias(fechaInicio, fechaFin);

            if (dias <= 0) {
              alert("La fecha final debe ser igual o posterior a la fecha inicial.");
              return;
            }
          }

          const confirmar = window.confirm(
            `¿Deseas enviar esta solicitud de "${tipo}"?`
          );

          if (!confirmar) return;

          const nuevoPermiso = {
            id: Date.now(),
            tipo,
            empleadoId: user?.id,
            empleado: user?.name || "Empleado",
            nombre: user?.name || "Empleado",
            name: user?.name || "Empleado",
            sucursal: user?.sucursal || "Sin sucursal",
            puesto: user?.puesto || user?.categoria || "Empleado",
            categoria: user?.categoria || user?.puesto || "Empleado",
            fecha: fechaInicio,
            fechaInicio,
            fechaFin,
            inicio: fechaInicio,
            fin: fechaFin,
            desde: fechaInicio,
            hasta: fechaFin,
            hora: tipo === "Permisos" ? form.hora.value : "",
            dias: tipo === "Vacaciones" ? dias : "",
            motivo: form.motivo.value,
            comentario: form.comentario.value,
            estado: "pendiente",
            origen: "empleado"
          };

          if (onEnviarSolicitudEmpleado) {
            onEnviarSolicitudEmpleado(nuevoPermiso);
          }

          alert("Solicitud enviada correctamente a RH.");

          form.reset();
          setTipoSeleccionado("");
          setFechaInicioPreview("");
          setFechaFinPreview("");
          setDiasPreview(0);
        }}
      >
        <select
          name="tipo"
          required
          value={tipoSeleccionado}
          onChange={(e) => {
            setTipoSeleccionado(e.target.value);
            setFechaInicioPreview("");
            setFechaFinPreview("");
            setDiasPreview(0);
          }}
        >
          <option value="">Tipo de permiso</option>
          <option value="Vacaciones">Vacaciones</option>
          <option value="Permisos">Permisos</option>
        </select>

        <input
          name="fechaInicio"
          type="date"
          required
          value={fechaInicioPreview}
          onChange={(e) => {
            setFechaInicioPreview(e.target.value);
            handleFechaChange(e.target.value, fechaFinPreview);
          }}
        />

        {tipoSeleccionado === "Vacaciones" && (
          <input
            name="fechaFin"
            type="date"
            value={fechaFinPreview}
            onChange={(e) => {
              setFechaFinPreview(e.target.value);
              handleFechaChange(fechaInicioPreview, e.target.value);
            }}
          />
        )}

        {tipoSeleccionado === "Permisos" && (
          <input name="hora" type="time" />
        )}

        <input name="motivo" placeholder="Motivo" required />

        <input name="comentario" placeholder="Comentario opcional" />

        {tipoSeleccionado === "Vacaciones" && diasPreview > 0 && (
          <div style={{ marginTop: 8, color: "#006D5B", fontWeight: 700 }}>
            Días solicitados: {diasPreview}
          </div>
        )}

        <button type="submit">Enviar Permiso</button>
      </form>

      <h3>Permisos enviados:</h3>

      <ul>
        {solicitudesEmpleado.map((p) => (
          <li key={p.id}>
            <strong>{p.nombre || p.empleado}</strong> - {p.sucursal} · {p.puesto}
            <br />

            {p.tipo} -{" "}
            {p.tipo === "Vacaciones"
              ? `${p.fechaInicio || p.inicio || p.desde} al ${p.fechaFin || p.fin || p.hasta} - ${p.dias} días`
              : `${p.fecha || p.fechaInicio} ${p.hora || ""}`}
            {" "}
            - {p.motivo}

            {p.comentario ? ` (${p.comentario})` : ""}

            {" "} - {p.estado}

            {p.comentarioRH && (
              <>
                <br />
                <span style={{ color: "#64748b" }}>
                  Comentario RH: {p.comentarioRH}
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}