import React, { useState } from "react";
import { useGlobal } from "../../contexts/GlobalContext";
import { useAuth } from "../../contexts/AuthContext";
import { collection, addDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../../config/firebase";
import Card from "../common/Card";

const GestionUsuarios = () => {
  const { usuarios, setUsuarios } = useGlobal();
  const { user, restablecerPasswordUsuario } = useAuth();
  
  const [busqueda, setBusqueda] = useState("");
  const [mostrarModal, setMostrarModal] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState(null);
  const [loading, setLoading] = useState(false);

  // Formulario
  const [formData, setFormData] = useState({
    name: "",
    user: "",
    sucursal: "Polanco",
    puesto: "Asistente Dental",
    role: "empleado",
    email: "",
    antiguedad: "",
    telefono: ""
  });

  const empleados = usuarios.filter(u => 
    u.role !== "admin" && // Usualmente se ocultan los superadmins, pero dejémoslo libre por ahora o filtramos solo empleados
    u.name?.toLowerCase().includes(busqueda.toLowerCase())
  );

  const abrirModal = (empleado = null) => {
    if (empleado) {
      setUsuarioEditando(empleado);
      setFormData({
        name: empleado.name || "",
        user: empleado.user || "",
        sucursal: empleado.sucursal || "Polanco",
        puesto: empleado.puesto || "Asistente Dental",
        role: empleado.role || "empleado",
        email: empleado.email || "",
        antiguedad: empleado.antiguedad || "",
        telefono: empleado.telefono || ""
      });
    } else {
      setUsuarioEditando(null);
      setFormData({
        name: "",
        user: "",
        sucursal: "Polanco",
        puesto: "Asistente Dental",
        role: "empleado",
        email: "",
        antiguedad: "",
        telefono: ""
      });
    }
    setMostrarModal(true);
  };

  const guardarUsuario = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (usuarioEditando) {
        // ACTUALIZAR
        const docRef = doc(db, "usuarios", usuarioEditando.firebaseId || usuarioEditando.id);
        const newData = { ...formData, updatedAt: serverTimestamp() };
        await updateDoc(docRef, newData);
        
        setUsuarios(prev => prev.map(u => u.id === usuarioEditando.id ? { ...u, ...newData } : u));
        alert("Usuario actualizado con éxito.");
      } else {
        // CREAR
        const nuevoId = Date.now(); // ID numérico para compatibilidad con código anterior
        const newUser = {
          ...formData,
          id: nuevoId,
          createdAt: serverTimestamp()
        };
        
        const docRef = await addDoc(collection(db, "usuarios"), newUser);
        
        // Registrar contraseña inicial por defecto en usuariosPassword
        await addDoc(collection(db, "usuariosPassword"), {
          userId: nuevoId,
          usuario: formData.user,
          password: "emp123",
          debeCambiarPassword: true,
          creadoEn: serverTimestamp()
        });

        setUsuarios(prev => [...prev, { ...newUser, firebaseId: docRef.id }]);
        alert("Usuario creado con éxito. Contraseña inicial: emp123");
      }
      setMostrarModal(false);
    } catch (error) {
      console.error("Error guardando usuario:", error);
      alert("Hubo un error al guardar el usuario en Firebase.");
    } finally {
      setLoading(false);
    }
  };

  const cambiarEstado = async (empleado, estadoActivo) => {
    const confirmar = window.confirm(`¿Deseas ${estadoActivo ? "activar" : "desactivar"} a ${empleado.name}?`);
    if (!confirmar) return;

    try {
      const docRef = doc(db, "usuarios", empleado.firebaseId || empleado.id);
      await updateDoc(docRef, { inactivo: !estadoActivo });
      
      setUsuarios(prev => prev.map(u => u.id === empleado.id ? { ...u, inactivo: !estadoActivo } : u));
    } catch (error) {
      console.error("Error cambiando estado:", error);
      alert("Error al cambiar el estado del usuario.");
    }
  };

  return (
    <div className="list-page admin-page">
      <div className="list-page-header admin-page-header admin-page-header--row">
        <div>
          <h1 className="list-page-title admin-page-title">Gestión de Personal</h1>
          <p className="admin-page-subtitle">Administra usuarios, roles y accesos del sistema.</p>
        </div>
        <button className="mc-btn-primary" onClick={() => abrirModal()}>
          + Añadir Empleado
        </button>
      </div>

      <Card className="list-page-sticky table-card-body">
        <input
          type="text"
          className="table-search"
          placeholder="Buscar empleado por nombre..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />

        <div className="table-scroll-wrap">
          <table className="mc-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Usuario</th>
                <th>Sucursal</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {empleados.map(emp => (
                <tr key={emp.id}>
                  <td className="mc-table-name">{emp.name}</td>
                  <td style={{ color: "#475569" }}>{emp.user}</td>
                  <td>{emp.sucursal}</td>
                  <td>
                    <span style={{
                      background: emp.role === "empleado" ? "#f1f5f9" : "#e0e7ff",
                      padding: "4px 8px", borderRadius: 12, fontSize: 12
                    }}>
                      {emp.role}
                    </span>
                  </td>
                  <td>
                    {emp.inactivo ? (
                      <span style={{ color: "#dc2626", fontWeight: "bold", fontSize: 13 }}>Inactivo</span>
                    ) : (
                      <span style={{ color: "#16a34a", fontWeight: "bold", fontSize: 13 }}>Activo</span>
                    )}
                  </td>
                  <td className="mc-table-actions">
                    <button
                      type="button"
                      className="mc-btn-outline mc-btn-outline--edit"
                      onClick={() => abrirModal(emp)}
                    >
                      Editar
                    </button>
                    {user?.role === "admin" && (
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
      </Card>

      {/* Modal Formulario */}
      {mostrarModal && (
        <div className="mc-modal-overlay">
          <div className="mc-modal">
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
                    <option value="Polanco">Polanco</option>
                    <option value="Roma">Roma</option>
                    <option value="Condesa">Condesa</option>
                    <option value="Coyoacán">Coyoacán</option>
                  </select>
                </div>
              </div>
              <div className="mc-form-row-2">
                <div className="mc-form-group">
                  <label className="mc-form-label">Teléfono</label>
                  <input type="text" className="mc-form-input" value={formData.telefono} onChange={(e) => setFormData({...formData, telefono: e.target.value})} />
                </div>
                <div className="mc-form-group">
                  <label className="mc-form-label">Fecha Ingreso (Antigüedad)</label>
                  <input type="date" className="mc-form-input" value={formData.antiguedad} onChange={(e) => setFormData({...formData, antiguedad: e.target.value})} />
                </div>
              </div>
              <div className="mc-form-actions">
                <button type="button" className="mc-btn-secondary" onClick={() => setMostrarModal(false)}>Cancelar</button>
                <button type="submit" className="mc-btn-primary" disabled={loading}>
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
