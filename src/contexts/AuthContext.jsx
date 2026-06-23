import React, { createContext, useState, useContext, useEffect } from "react";
import { getUsuariosPassword, getUsuarios } from "../services/firestore/usuariosService";
import { db } from "../config/firebase";
import { collection, getDocs, updateDoc, doc, serverTimestamp, addDoc } from "firebase/firestore";
import { notify } from "../utils/notify";

const SESSION_STORAGE_KEY = "mcdental_current_user";
const VALID_ROLES = new Set(["admin", "rh", "psicologa", "empleado"]);

const pickSessionUser = (usuario) => ({
  id: usuario.id,
  name: usuario.name,
  user: usuario.user,
  role: usuario.role,
  sucursal: usuario.sucursal,
  puesto: usuario.puesto,
  ...(usuario.firebaseId ? { firebaseId: usuario.firebaseId } : {}),
  ...(usuario.idOriginal != null ? { idOriginal: usuario.idOriginal } : {}),
});

const readStoredSession = () => {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.id || !data?.user || !VALID_ROLES.has(data.role)) return null;
    return data;
  } catch {
    return null;
  }
};

const persistSession = (usuario) => {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(pickSessionUser(usuario)));
};

const clearStoredSession = () => {
  localStorage.removeItem(SESSION_STORAGE_KEY);
};

const sanitizeAccesoFirebase = (accesoFirebase) => {
  if (!accesoFirebase) return undefined;
  return {
    id: accesoFirebase.id,
    userId: accesoFirebase.userId,
    debeCambiarPassword: !!accesoFirebase.debeCambiarPassword,
  };
};

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => readStoredSession());
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

  useEffect(() => {
    if (!user?.id || usuariosPassword.length === 0) return;

    const accesoFirebase = usuariosPassword.find(
      (item) => item.userId === user.id || item.userId === user.idOriginal
    );
    if (!accesoFirebase) return;

    setUser((prev) => {
      if (!prev) return prev;
      const sanitized = sanitizeAccesoFirebase(accesoFirebase);
      if (prev.accesoFirebase?.id === sanitized?.id) return prev;
      return { ...prev, accesoFirebase: sanitized };
    });

    setRequiereCambioPassword(!!accesoFirebase.debeCambiarPassword);
  }, [user?.id, user?.idOriginal, usuariosPassword]);

  const login = async (username, password) => {
    setLoadingAuth(true);
    try {
      const allUsuarios = await getUsuarios();
      const usuarioBase = allUsuarios.find((x) => x.user === username);
      
      if (!usuarioBase) {
        throw new Error("Usuario o contraseña incorrectos");
      }

      const usuariosPasswordList = await getUsuariosPassword();
      const accesoFirebase = usuariosPasswordList.find((x) => x.userId === usuarioBase.id);

      const passwordValida = accesoFirebase
        ? accesoFirebase.password === password
        : usuarioBase.pass === password;

      if (passwordValida) {
        const sessionUser = {
          ...usuarioBase,
          accesoFirebase: sanitizeAccesoFirebase(accesoFirebase),
        };
        setUser(sessionUser);
        persistSession(usuarioBase);
        
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
    clearStoredSession();
  };

  const cambiarPasswordActual = async (nuevaPassword) => {
    try {
      if (!user?.accesoFirebase?.id) {
        notify.toast.error("No se encontró el registro de contraseña del usuario.");
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

      setUser((prev) => {
        const updated = {
          ...prev,
          accesoFirebase: {
            ...prev.accesoFirebase,
            debeCambiarPassword: false,
          },
        };
        if (prev?.id) persistSession(updated);
        return updated;
      });

      setRequiereCambioPassword(false);
      notify.toast.success("Contraseña actualizada correctamente.");
      return true;
    } catch (error) {
      console.error("Error cambiando contraseña:", error);
      notify.toast.error("Error al cambiar la contraseña: " + (error?.message || error));
      return false;
    }
  };

  const restablecerPasswordUsuario = async (empleado) => {
    try {
      if (!["admin", "rh", "recursos humanos"].includes(user?.role)) {
        notify.toast.error("No tienes permiso para restablecer contraseñas.");
        return;
      }

      const registroPassword = usuariosPassword.find((item) => item.userId === empleado.id);

      if (!registroPassword?.id) {
        notify.toast.error("No se encontró el registro de contraseña de este usuario.");
        return;
      }

      const confirmar = await notify.confirm({
        title: "Restablecer contraseña",
        description: `¿Deseas restablecer la contraseña de ${empleado.name} a emp123?`,
        variant: "warning",
        confirmText: "Restablecer",
      });
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

      notify.toast.success(`Contraseña restablecida para ${empleado.name}.`);
    } catch (error) {
      console.error("Error restableciendo contraseña:", error);
      notify.toast.error("Error al restablecer contraseña.");
    }
  };

  const inicializarUsuariosPassword = async () => {
    try {
      const allUsuarios = await getUsuarios();
      for (const empleado of allUsuarios) {
        const existe = usuariosPassword.find((u) => u.userId === empleado.idOriginal);
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
      notify.toast.success("Usuarios de contraseña inicializados.");
      // Recargar usuarios
      const usuariosPasswordSnapshot = await getDocs(collection(db, "usuariosPassword"));
      setUsuariosPassword(usuariosPasswordSnapshot.docs.map((docu) => ({ id: docu.id, ...docu.data() })));
    } catch (error) {
      console.error("Error inicializando usuariosPassword:", error);
      notify.toast.error("Error al inicializar usuarios de contraseña.");
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