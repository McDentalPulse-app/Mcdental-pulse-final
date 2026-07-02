import React, { useState } from "react";
import { useGlobal } from "../../contexts/GlobalContext";
import { useAuth } from "../../contexts/AuthContext";
import { useNotification } from "../../contexts/NotificationContext";
import { updateUsuario, crearUsuario, cambiarUsername } from "../../services/supabase/usuariosService";
import Card from "../common/Card";
import PageHeader from "../common/PageHeader";
import Icon from "../ui/Icon";
import { SUCURSALES, normalizeSucursal, sucursalMatches } from "../../utils/constants";
import { resolveFechaCumpleanos, resolveFechaIngreso, normalizeFechaCumpleanosInput } from "../../utils/helpers";

const DEFAULT_SUCURSAL = SUCURSALES[0];

const GestionUsuarios = () => {
  const { usuarios, setUsuarios } = useGlobal();
  const { user, restablecerPasswordUsuario } = useAuth();
  const { toast, confirm } = useNotification();
  const esAdmin = user?.role === "admin";

  const [busqueda, setBusqueda] = useState("");
  const [filtroSucursal, setFiltroSucursal] = useState("Todas");
  const [mostrarModal, setMostrarModal] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState(null);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    user: "",
    sucursal: DEFAULT_SUCURSAL,
    puesto: "Asistente Dental",
    role: "empleado",
    email: "",
    telefono: "",
    fechaIngreso: "",
    fechaCumpleanos: "",
  });

  const empleados = usuarios.filter(u =>
    u.role !== "admin" &&
    u.name?.toLowerCase().includes(busqueda.toLowerCase()) &&
    (filtroSucursal === "Todas" || sucursalMatches(u.sucursal, filtroSucursal))
  );

  const abrirModal = (empleado = null) => {
    if (empleado) {
      setUsuarioEditando(empleado);
      setFormData({
        name: empleado.name || "",
        user: empleado.user || "",
        sucursal: normalizeSucursal(empleado.sucursal) || DEFAULT_SUCURSAL,
        puesto: empleado.puesto || "Asistente Dental",
        role: empleado.role || "empleado",
        email: empleado.email || "",
        telefono: empleado.telefono || "",
        fechaIngreso: resolveFechaIngreso(empleado),
        fechaCumpleanos: resolveFechaCumpleanos(empleado),
      });
    } else {
      setUsuarioEditando(null);
      setFormData({
        name: "",
        user: "",
        sucursal: DEFAULT_SUCURSAL,
        puesto: "Asistente Dental",
        role: "empleado",
        email: "",
        telefono: "",
        fechaIngreso: "",
        fechaCumpleanos: "",
      });
    }
    setMostrarModal(true);
  };

  const guardarUsuario = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...formData,
        fechaIngreso: formData.fechaIngreso || "",
        fechaCumpleanos: normalizeFechaCumpleanosInput(formData.fechaCumpleanos),
      };

      if (usuarioEditando) {
        // El username es la credencial de login (email sintético en Auth):
        // si cambió, va primero por la edge function que sincroniza Auth + BD.
        const usernameNuevo = (payload.user || "").trim().toLowerCase();
        const usernameCambio = usernameNuevo && usernameNuevo !== (usuarioEditando.user || "").trim().toLowerCase();
        if (usernameCambio) {
          await cambiarUsername(usuarioEditando.id, usernameNuevo);
        }
        const actualizado = await updateUsuario(usuarioEditando.id, payload);
        const conUsername = usernameCambio ? { ...actualizado, user: usernameNuevo } : actualizado;
        setUsuarios(prev => prev.map(u => u.id === usuarioEditando.id ? conUsername : u));
        toast.success(usernameCambio
          ? `Usuario actualizado. Nuevo nombre de acceso: ${usernameNuevo}`
          : "Usuario actualizado con éxito.");
      } else {
        const nuevoUsuario = await crearUsuario(payload);
        setUsuarios(prev => [...prev, nuevoUsuario]);
        toast.success("Usuario creado con éxito. Contraseña inicial: emp123");
      }
      setMostrarModal(false);
    } catch (error) {
      console.error("Error guardando usuario:", error);
      toast.error(error?.message || "Hubo un error al guardar el usuario.");
    } finally {
      setLoading(false);
    }
  };

  const cambiarEstado = async (empleado, estadoActivo) => {
    const confirmar = await confirm({
      title: estadoActivo ? "Activar empleado" : "Desactivar empleado",
      description: `¿Deseas ${estadoActivo ? "activar" : "desactivar"} a ${empleado.name}?`,
      variant: estadoActivo ? "default" : "danger",
      confirmText: estadoActivo ? "Activar" : "Desactivar",
    });
    if (!confirmar) return;

    try {
      await updateUsuario(empleado.id, { inactivo: !estadoActivo });
      setUsuarios(prev => prev.map(u => u.id === empleado.id ? { ...u, inactivo: !estadoActivo } : u));
      toast.success(`Empleado ${estadoActivo ? "activado" : "desactivado"} correctamente.`);
    } catch (error) {
      console.error("Error cambiando estado:", error);
      toast.error("Error al cambiar el estado del usuario.");
    }
  };

  return (
    <div className="list-page gestion-personal-page">
      <PageHeader
        icon="userCog"
        title="Gestión de Personal"
        subtitle="Administra usuarios, roles y accesos del sistema."
      >
        <button type="button" className="mc-btn-primary mc-btn-with-icon" onClick={() => abrirModal()}>
          <Icon name="plus" size={16} /> Añadir empleado
        </button>
      </PageHeader>

      <Card className="gestion-personal-card table-card-body">
        <div className="list-filters-grid list-filters-grid--2col">
          <input
            type="text"
            className="table-search gestion-personal-search"
            placeholder="Buscar empleado por nombre..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <select
            className="list-filter-select"
            value={filtroSucursal}
            onChange={(e) => setFiltroSucursal(e.target.value)}
          >
            <option value="Todas">Todas las sucursales</option>
            {SUCURSALES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="table-scroll-wrap gestion-personal-table-wrap gestion-personal-desktop-only">
          <table className={`mc-table gestion-personal-table${esAdmin ? " gestion-personal-table--admin" : ""}`}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Usuario</th>
                <th>Sucursal</th>
                <th>Rol</th>
                <th>Estado</th>
                <th className="gestion-personal-th-actions gestion-personal-col-actions">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {empleados.map(emp => (
                <tr key={emp.id} className="mc-row-hover">
                  <td className="mc-table-name">{emp.name}</td>
                  <td className="mc-table-muted">{emp.user}</td>
                  <td>{normalizeSucursal(emp.sucursal)}</td>
                  <td>
                    <span className={`mc-tag ${emp.role !== "empleado" ? "mc-tag--role-privileged" : ""}`}>
                      {emp.role}
                    </span>
                  </td>
                  <td>
                    <span className={`mc-status-pill ${emp.inactivo ? "mc-status-pill--inactivo" : "mc-status-pill--activo"}`}>
                      {emp.inactivo ? "Inactivo" : "Activo"}
                    </span>
                  </td>
                  <td className="gestion-personal-col-actions">
                    <div className="user-actions">
                      <button
                        type="button"
                        className="mc-btn-outline mc-btn-outline--edit"
                        onClick={() => abrirModal(emp)}
                      >
                        Editar
                      </button>
                      {esAdmin && (
                        <button
                          type="button"
                          className="mc-btn-outline mc-btn-outline--amber"
                          onClick={() => restablecerPasswordUsuario(emp)}
                        >
                          Contraseña
                        </button>
                      )}
                      {emp.inactivo ? (
                        <button
                          type="button"
                          className="mc-btn-outline mc-btn-outline--edit"
                          onClick={() => cambiarEstado(emp, true)}
                        >
                          Activar
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="mc-btn-outline mc-btn-outline--danger"
                          onClick={() => cambiarEstado(emp, false)}
                        >
                          Desactivar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {empleados.length === 0 && (
                <tr>
                  <td colSpan="6" className="mc-table-empty">No se encontraron empleados.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="gestion-personal-mobile-list">
          {empleados.length === 0 ? (
            <p className="gestion-personal-mobile-empty">No se encontraron empleados.</p>
          ) : (
            empleados.map((emp) => (
              <div key={emp.id} className="gestion-personal-mobile-card mc-row-hover">
                <div className="gestion-personal-mobile-head">
                  <div className="gestion-personal-mobile-main">
                    <div className="gestion-personal-mobile-name">{emp.name}</div>
                    <div className="gestion-personal-mobile-user">@{emp.user}</div>
                  </div>
                  <span className={`mc-status-pill ${emp.inactivo ? "mc-status-pill--inactivo" : "mc-status-pill--activo"}`}>
                    {emp.inactivo ? "Inactivo" : "Activo"}
                  </span>
                </div>
                <div className="gestion-personal-mobile-meta">
                  <span className={`mc-tag ${emp.role !== "empleado" ? "mc-tag--role-privileged" : ""}`}>{emp.role}</span>
                  <span className="gestion-personal-mobile-sucursal">{normalizeSucursal(emp.sucursal)}</span>
                </div>
                <div className="gestion-personal-mobile-actions">
                  <button
                    type="button"
                    className="mc-btn-outline mc-btn-outline--edit"
                    onClick={() => abrirModal(emp)}
                  >
                    Editar
                  </button>
                  {esAdmin && (
                    <button
                      type="button"
                      className="mc-btn-outline mc-btn-outline--amber"
                      onClick={() => restablecerPasswordUsuario(emp)}
                    >
                      Contraseña
                    </button>
                  )}
                  {emp.inactivo ? (
                    <button
                      type="button"
                      className="mc-btn-outline mc-btn-outline--edit"
                      onClick={() => cambiarEstado(emp, true)}
                    >
                      Activar
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="mc-btn-outline mc-btn-outline--danger"
                      onClick={() => cambiarEstado(emp, false)}
                    >
                      Desactivar
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {mostrarModal && (
        <div className="mc-modal-overlay">
          <div
            className="mc-modal gestion-personal-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="gestion-usuarios-modal-title"
          >
            <h2 id="gestion-usuarios-modal-title" className="mc-modal-title">{usuarioEditando ? "Editar Empleado" : "Añadir Empleado"}</h2>
            <form onSubmit={guardarUsuario} className="mc-form-grid">
              <div className="mc-form-group">
                <label className="mc-form-label" htmlFor="gu-name">Nombre Completo</label>
                <input id="gu-name" required type="text" className="mc-form-input" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="mc-form-group">
                <label className="mc-form-label" htmlFor="gu-user">Nombre de Usuario (Para iniciar sesión)</label>
                <input id="gu-user" required type="text" className="mc-form-input" value={formData.user} onChange={(e) => setFormData({...formData, user: e.target.value})} />
              </div>
              <div className="mc-form-row-2">
                <div className="mc-form-group">
                  <label className="mc-form-label" htmlFor="gu-role">Rol</label>
                  <select id="gu-role" className="mc-form-select" value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})}>
                    <option value="empleado">Empleado</option>
                    <option value="rh">Recursos Humanos</option>
                    <option value="psicologa">Psicóloga</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
                <div className="mc-form-group">
                  <label className="mc-form-label" htmlFor="gu-sucursal">Sucursal</label>
                  <select id="gu-sucursal" className="mc-form-select" value={formData.sucursal} onChange={(e) => setFormData({...formData, sucursal: e.target.value})}>
                    {SUCURSALES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mc-form-row-2">
                <div className="mc-form-group">
                  <label className="mc-form-label" htmlFor="gu-telefono">Teléfono</label>
                  <input id="gu-telefono" type="text" className="mc-form-input" value={formData.telefono} onChange={(e) => setFormData({...formData, telefono: e.target.value})} />
                </div>
                <div className="mc-form-group">
                  <label className="mc-form-label" htmlFor="gu-puesto">Puesto</label>
                  <input id="gu-puesto" type="text" className="mc-form-input" value={formData.puesto} onChange={(e) => setFormData({...formData, puesto: e.target.value})} />
                </div>
              </div>
              <div className="mc-form-row-2">
                <div className="mc-form-group">
                  <label className="mc-form-label" htmlFor="gu-fecha-ingreso">Fecha de ingreso</label>
                  <input
                    id="gu-fecha-ingreso"
                    type="date"
                    className="mc-form-input"
                    value={formData.fechaIngreso}
                    onChange={(e) => setFormData({ ...formData, fechaIngreso: e.target.value })}
                  />
                </div>
                <div className="mc-form-group">
                  <label className="mc-form-label" htmlFor="gu-fecha-cumple">Fecha de cumpleaños (MM-DD)</label>
                  <input
                    id="gu-fecha-cumple"
                    type="text"
                    className="mc-form-input"
                    placeholder="08-25"
                    pattern="\d{2}-\d{2}"
                    value={formData.fechaCumpleanos}
                    onChange={(e) => setFormData({ ...formData, fechaCumpleanos: e.target.value })}
                  />
                </div>
              </div>
              <div className="mc-form-actions">
                <button type="button" className="mc-btn-secondary" onClick={() => setMostrarModal(false)}>Cancelar</button>
                <button type="submit" className="mc-btn-primary mc-btn-with-icon" disabled={loading}>
                  <Icon name="check" size={16} />
                  {loading ? "Guardando..." : "Guardar Empleado"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GestionUsuarios;
