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
    <div className="list-page">
      <div className="list-page-header">
        <h1 className="list-page-title">Gestión de Personal</h1>
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
                  <td>
                    <button
                      className="mc-btn-sm"
                      onClick={() => abrirModal(emp)}
                      style={{ background: "#f0fdf4", color: "#166534" }}
                    >
                      Editar
                    </button>
                    {user?.role === "admin" && (
                      <button
                        className="mc-btn-sm"
                        onClick={() => restablecerPasswordUsuario(emp)}
                        style={{ background: "#fef3c7", color: "#b45309" }}
                      >
                        Contraseña
                      </button>
                    )}
                    {emp.inactivo ? (
                      <button
                        className="mc-btn-sm"
                        onClick={() => cambiarEstado(emp, true)}
                        style={{ background: "#dcfce7", color: "#166534" }}
                      >
                        Activar
                      </button>
                    ) : (
                      <button
                        className="mc-btn-sm"
                        onClick={() => cambiarEstado(emp, false)}
                        style={{ background: "#fee2e2", color: "#b91c1c" }}
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
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
        }}>
          <div style={{ background: "#fff", padding: 30, borderRadius: 12, width: 500, maxWidth: "90%" }}>
            <h2 style={{ marginTop: 0 }}>{usuarioEditando ? "Editar Empleado" : "Añadir Empleado"}</h2>
            <form onSubmit={guardarUsuario} style={{ display: "grid", gap: 12 }}>
              
              <div>
                <label style={{ display: "block", marginBottom: 4, fontWeight: "bold" }}>Nombre Completo</label>
                <input required type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #ccc" }} />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 4, fontWeight: "bold" }}>Nombre de Usuario (Para iniciar sesión)</label>
                <input required type="text" value={formData.user} onChange={(e) => setFormData({...formData, user: e.target.value})} style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #ccc" }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 4, fontWeight: "bold" }}>Rol</label>
                  <select value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})} style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #ccc" }}>
                    <option value="empleado">Empleado</option>
                    <option value="rh">Recursos Humanos</option>
                    <option value="psicologa">Psicóloga</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 4, fontWeight: "bold" }}>Sucursal</label>
                  <select value={formData.sucursal} onChange={(e) => setFormData({...formData, sucursal: e.target.value})} style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #ccc" }}>
                    <option value="Polanco">Polanco</option>
                    <option value="Roma">Roma</option>
                    <option value="Condesa">Condesa</option>
                    <option value="Coyoacán">Coyoacán</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 4, fontWeight: "bold" }}>Teléfono</label>
                  <input type="text" value={formData.telefono} onChange={(e) => setFormData({...formData, telefono: e.target.value})} style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #ccc" }} />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 4, fontWeight: "bold" }}>Fecha Ingreso (Antigüedad)</label>
                  <input type="date" value={formData.antiguedad} onChange={(e) => setFormData({...formData, antiguedad: e.target.value})} style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #ccc" }} />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                <button type="button" onClick={() => setMostrarModal(false)} style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "#f1f5f9", cursor: "pointer", fontWeight: "bold" }}>
                  Cancelar
                </button>
                <button type="submit" disabled={loading} style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "#006D5B", color: "#fff", cursor: "pointer", fontWeight: "bold" }}>
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
