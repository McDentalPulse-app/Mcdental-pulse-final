import React, { createContext, useState, useContext, useEffect } from "react";
import { USERS } from "../data/initialData";
import { getUsuariosPassword } from "../services/firestore/usuariosService";
import { db } from "../config/firebase";
import { collection, getDocs, updateDoc, doc, serverTimestamp, addDoc } from "firebase/firestore";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [usuariosPassword, setUsuariosPassword] = useState([]);
  const [requiereCambioPassword, setRequiereCambioPassword] = useState(false);

  useEffect(() => {
    const cargarUsuariosPassword = async () => {
      try {
        const usuariosPasswordSnapshot = await getDocs(collection(db, "usuariosPassword"));
        const usuariosPasswordData = usuariosPasswordSnapshot.docs.map((docu) => ({
          id: docu.id,
          ...docu.data()
        }));
        setUsuariosPassword(usuariosPasswordData);
      } catch (error) {
        console.error("Error al cargar usuariosPassword:", error);
      }
    };
    cargarUsuariosPassword();
  }, []);

  const login = async (username, password) => {
    setLoadingAuth(true);
    try {
      const usuarioBase = USERS.find((x) => x.user === username);
      if (!usuarioBase) {
        throw new Error("Usuario o contraseña incorrectos");
      }

      const usuariosPasswordList = await getUsuariosPassword();
      const accesoFirebase = usuariosPasswordList.find((x) => x.userId === usuarioBase.id);

      const passwordValida = accesoFirebase
        ? accesoFirebase.password === password
        : usuarioBase.pass === password;

      if (passwordValida) {
        setUser({
          ...usuarioBase,
          accesoFirebase
        });
        
        if (accesoFirebase?.debeCambiarPassword) {
          setRequiereCambioPassword(true);
        } else {
          setRequiereCambioPassword(false);
        }
        
        return true;
      } else {
        throw new Error("Usuario o contraseña incorrectos");
      }
    } catch (error) {
      throw error;
    } finally {
      setLoadingAuth(false);
    }
  };

  const logout = () => {
    setUser(null);
    setRequiereCambioPassword(false);
  };

  const cambiarPasswordActual = async (nuevaPassword) => {
    try {
      if (!user?.accesoFirebase?.id) {
        alert("No se encontró el registro de contraseña del usuario.");
        return;
      }

      await updateDoc(doc(db, "usuariosPassword", user.accesoFirebase.id), {
        password: nuevaPassword,
        debeCambiarPassword: false,
        actualizadoEn: serverTimestamp()
      });

      setUsuariosPassword((prev) =>
        prev.map((item) =>
          item.id === user.accesoFirebase.id
            ? { ...item, password: nuevaPassword, debeCambiarPassword: false }
            : item
        )
      );

      setUser((prev) => ({
        ...prev,
        accesoFirebase: {
          ...prev.accesoFirebase,
          password: nuevaPassword,
          debeCambiarPassword: false
        }
      }));

      setRequiereCambioPassword(false);
      alert("Contraseña actualizada correctamente.");
      return true;
    } catch (error) {
      console.error("Error cambiando contraseña:", error);
      alert("Error al cambiar la contraseña: " + (error?.message || error));
      return false;
    }
  };

  const restablecerPasswordUsuario = async (empleado) => {
    try {
      if (!["admin", "rh", "psicologa"].includes(user?.role)) {
        alert("No tienes permiso para restablecer contraseñas.");
        return;
      }

      const registroPassword = usuariosPassword.find((item) => item.userId === empleado.id);

      if (!registroPassword?.id) {
        alert("No se encontró el registro de contraseña de este usuario.");
        return;
      }

      const confirmar = window.confirm(`¿Deseas restablecer la contraseña de ${empleado.name} a emp123?`);
      if (!confirmar) return;

      await updateDoc(doc(db, "usuariosPassword", registroPassword.id), {
        password: "emp123",
        debeCambiarPassword: true,
        restablecidoEn: serverTimestamp(),
        restablecidoPor: user?.name || "Sistema"
      });

      setUsuariosPassword((prev) =>
        prev.map((item) =>
          item.id === registroPassword.id
            ? {
                ...item,
                password: "emp123",
                debeCambiarPassword: true,
                restablecidoPor: user?.name || "Sistema"
              }
            : item
        )
      );

      alert(`Contraseña restablecida para ${empleado.name}.`);
    } catch (error) {
      console.error("Error restableciendo contraseña:", error);
      alert("Error al restablecer contraseña.");
    }
  };

  const inicializarUsuariosPassword = async () => {
    try {
      for (const empleado of USERS) {
        const existe = usuariosPassword.find((u) => u.userId === empleado.id);
        if (!existe) {
          await addDoc(collection(db, "usuariosPassword"), {
            userId: empleado.id,
            usuario: empleado.user,
            password: empleado.pass,
            debeCambiarPassword: true,
            creadoEn: serverTimestamp()
          });
        }
      }
      alert("Usuarios de contraseña inicializados.");
      // Recargar usuarios
      const usuariosPasswordSnapshot = await getDocs(collection(db, "usuariosPassword"));
      setUsuariosPassword(usuariosPasswordSnapshot.docs.map((docu) => ({ id: docu.id, ...docu.data() })));
    } catch (error) {
      console.error("Error inicializando usuariosPassword:", error);
      alert("Error al inicializar usuarios de contraseña.");
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      logout, 
      loadingAuth, 
      setUser,
      usuariosPassword,
      requiereCambioPassword,
      cambiarPasswordActual,
      restablecerPasswordUsuario,
      inicializarUsuariosPassword
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};