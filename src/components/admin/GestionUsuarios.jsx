import React, { useState } from "react";
import { useGlobal } from "../../contexts/GlobalContext";
import { useAuth } from "../../contexts/AuthContext";
import { useNotification } from "../../contexts/NotificationContext";
import { collection, addDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../../config/firebase";
import Card from "../common/Card";
import Icon from "../ui/Icon";
import { SUCURSALES, normalizeSucursal } from "../../utils/constants";
import { resolveFechaCumpleanos, resolveFechaIngreso, normalizeFechaCumpleanosInput, getNextEmpleadoId } from "../../utils/helpers";

const DEFAULT_SUCURSAL = SUCURSALES[0];

const GestionUsuarios = () => {
  const { usuarios, setUsuarios } = useGlobal();
  const { user, restablecerPasswordUsuario } = useAuth();
  const { toast, confirm } = useNotification();
  const esAdmin = user?.role === "admin";

  const [busqueda, setBusqueda] = useState("");
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
    u.name?.toLowerCase().includes(busqueda.toLowerCase())
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
        const docRef = doc(db, "usuarios", usuarioEditando.firebaseId || usuarioEditando.id);
        const newData = { ...payload, updatedAt: serverTimestamp() };
        await updateDoc(docRef, newData);

        setUsuarios(prev => prev.map(u => u.id === usuarioEditando.id ? { ...u, ...newData } : u));
        toast.success("Usuario actualizado con éxito.");
      } else {
        const nuevoId = getNextEmpleadoId(usuarios);
        const newUser = {
          ...payload,
          id: nuevoId,
          idOriginal: nuevoId,
          createdAt: serverTimestamp()
        };

        const docRef = await addDoc(collection(db, "usuarios"), newUser);

        await addDoc(collection(db, "usuariosPassword"), {
          userId: nuevoId,
          usuario: formData.user,
          password: "emp123",
          debeCambiarPassword: true,
          creadoEn: serverTimestamp()
        });

        setUsuarios(prev => [...prev, { ...newUser, firebaseId: docRef.id }]);
        toast.success("Usuario creado con éxito. Contraseña inicial: emp123");
      }
      setMostrarModal(false);
    } catch (error) {
      console.error("Error guardando usuario:", error);
      toast.error("Hubo un error al guardar el usuario en Firebase.");
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
      const docRef = doc(db, "usuarios", empleado.firebaseId || empleado.id);
      await updateDoc(docRef, { inactivo: !estadoActivo });

      setUsuarios(prev => prev.map(u => u.id === empleado.id ? { ...u, inactivo: !estadoActivo } : u));
      toast.success(`Empleado ${estadoActivo ? "activado" : "desactivado"} correctamente.`);
    } catch (error) {
      console.error("Error cambiando estado:", error);
      toast.error("Error al cambiar el estado del usuario.");
    }
  };

  return (
    <div className="list-page gestion-personal-page">
      <div className="gestion-personal-header">
        <div>
          <h1 className="admin-page-title">Gestión de Personal</h1>
          <p className="admin-page-subtitle">Administra usuarios, roles y accesos del sistema.</p>
        </div>
        <button type="button" className="mc-btn-primary mc-btn-with-icon" onClick={() => abrirModal()}>
          <Icon name="plus" size={16} /> Añadir empleado
        </button>
      </div>

      <Card className="gestion-personal-card table-card-body">
        <input
          type="text"
          className="table-search gestion-personal-search"
          placeholder="Buscar empleado por nombre..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />

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
                <tr key={emp.id}>
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
              <div key={emp.id} className="gestion-personal-mobile-card">
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
          <div className="mc-modal gestion-personal-modal">
            <h2 className="mc-modal-title">{usuarioEditando ? "Editar Empleado" : "Añadir Empleado"}</h2>
            <form onSubmit={guardarUsuario} className="mc-form-grid">
              <div className="mc-form-group">
                <label className="mc-form-label">Nombre Completo</label>
                <input required type="text" className="mc-form-input" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="mc-form-group">
                <label className="mc-form-label">Nombre de Usuario (Para iniciar sesión)</label>
                <input required type="text" className="mc-form-input" value={formData.user} onChange={(e) => setFormData({...formData, user: e.target.value})} />
              </div>
              <div className="mc-form-row-2">
                <div className="mc-form-group">
                  <label className="mc-form-label">Rol</label>
                  <select className="mc-form-select" value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})}>
                    <option value="empleado">Empleado</option>
                    <option value="rh">Recursos Humanos</option>
                    <option value="psicologa">Psicóloga</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
                <div className="mc-form-group">
                  <label className="mc-form-label">Sucursal</label>
                  <select className="mc-form-select" value={formData.sucursal} onChange={(e) => setFormData({...formData, sucursal: e.target.value})}>
                    {SUCURSALES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mc-form-row-2">
                <div className="mc-form-group">
                  <label className="mc-form-label">Teléfono</label>
                  <input type="text" className="mc-form-input" value={formData.telefono} onChange={(e) => setFormData({...formData, telefono: e.target.value})} />
                </div>
                <div className="mc-form-group">
                  <label className="mc-form-label">Puesto</label>
                  <input type="text" className="mc-form-input" value={formData.puesto} onChange={(e) => setFormData({...formData, puesto: e.target.value})} />
                </div>
              </div>
              <div className="mc-form-row-2">
                <div className="mc-form-group">
                  <label className="mc-form-label">Fecha de ingreso</label>
                  <input
                    type="date"
                    className="mc-form-input"
                    value={formData.fechaIngreso}
                    onChange={(e) => setFormData({ ...formData, fechaIngreso: e.target.value })}
                  />
                </div>
                <div className="mc-form-group">
                  <label className="mc-form-label">Fecha de cumpleaños (MM-DD)</label>
                  <input
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
