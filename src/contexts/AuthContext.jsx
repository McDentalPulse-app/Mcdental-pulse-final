import React, { createContext, useState, useContext, useEffect, useRef } from "react";
import { supabase, usernameToSyntheticEmail } from "../config/supabase";
import { notify } from "../utils/notify";

const VALID_ROLES = new Set(["admin", "rh", "psicologa", "empleado"]);

// Contraseña temporal por defecto (debe coincidir con TEMP_PASSWORD de
// supabase/functions/_shared/username.ts). Entrar con ella siempre fuerza el
// cambio de contraseña, aunque debe_cambiar_password esté apagado en la BD.
const TEMP_PASSWORD = "emp123";

const AuthContext = createContext();

const mapUsuarioRow = (row) =>
  row && {
    id: row.id,
    name: row.name,
    user: row.username,
    role: row.role,
    sucursal: row.sucursal,
    puesto: row.puesto,
    telefono: row.telefono,
    email: row.email,
    fechaIngreso: row.fecha_ingreso,
    fechaCumpleanos: row.fecha_cumpleanos,
    fechaNacimiento: row.fecha_nacimiento,
    inactivo: row.inactivo,
    debeCambiarPassword: row.debe_cambiar_password,
    avatarUrl: row.avatar_url,
  };

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  // loadingAuth: solo el login() activo (botón "Iniciando..." en la landing).
  const [loadingAuth, setLoadingAuth] = useState(false);
  // checkingSession: solo la restauración de sesión al montar la app — separado
  // de loadingAuth para que App.jsx pueda mostrar un loader de pantalla completa
  // mientras se restaura la sesión, sin interrumpir la landing durante un login activo.
  const [checkingSession, setCheckingSession] = useState(true);
  const [requiereCambioPassword, setRequiereCambioPassword] = useState(false);
  // true cuando el login activo se hizo con la contraseña temporal; ref (no
  // state) porque cargarPerfil también corre desde onAuthStateChange y debe
  // leer el valor vigente sin esperar un re-render.
  const loginConTemporalRef = useRef(false);

  const cargarPerfil = async (authUserId) => {
    const { data, error } = await supabase
      .from("usuarios")
      .select("*")
      .eq("auth_user_id", authUserId)
      .single();

    if (error || !data || !VALID_ROLES.has(data.role)) {
      setUser(null);
      setRequiereCambioPassword(false);
      return;
    }

    setUser(mapUsuarioRow(data));
    setRequiereCambioPassword(!!data.debe_cambiar_password || loginConTemporalRef.current);
  };

  useEffect(() => {
    let activo = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!activo) return;
      if (session?.user) {
        cargarPerfil(session.user.id).finally(() => setCheckingSession(false));
      } else {
        setCheckingSession(false);
      }
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        cargarPerfil(session.user.id);
      } else {
        setUser(null);
        setRequiereCambioPassword(false);
      }
    });

    return () => {
      activo = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const login = async (username, password) => {
    setLoadingAuth(true);
    // Se marca antes del signIn: onAuthStateChange dispara cargarPerfil en
    // cuanto la sesión existe y ya debe ver este valor.
    loginConTemporalRef.current = password === TEMP_PASSWORD;
    try {
      const email = usernameToSyntheticEmail(username);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error || !data?.user) {
        // 4xx de Supabase Auth = credenciales inválidas; cualquier otro error
        // (red caída, 5xx) es un problema de conexión, no del usuario.
        const status = error?.status;
        if (error && !(status >= 400 && status < 500)) {
          throw new Error("No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.");
        }
        throw new Error("Usuario o contraseña incorrectos");
      }

      await cargarPerfil(data.user.id);
      return true;
    } finally {
      setLoadingAuth(false);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    loginConTemporalRef.current = false;
    setUser(null);
    setRequiereCambioPassword(false);
  };

  const cambiarPasswordActual = async (nuevaPassword) => {
    try {
      const { error: authError } = await supabase.auth.updateUser({ password: nuevaPassword });
      if (authError) throw authError;

      // usuarios solo tiene UPDATE policy para admin/rh; un usuario normal marca
      // su propia fila vía RPC security definer acotado (ver migración 00000000000020).
      const { error: dbError } = await supabase.rpc("mark_password_changed");
      if (dbError) throw dbError;

      loginConTemporalRef.current = false;
      setUser((prev) => ({ ...prev, debeCambiarPassword: false }));
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

      const confirmar = await notify.confirm({
        title: "Restablecer contraseña",
        description: `¿Deseas restablecer la contraseña de ${empleado.name} a la temporal (emp123)?`,
        variant: "warning",
        confirmText: "Restablecer",
      });
      if (!confirmar) return;

      const { data: sessionData } = await supabase.auth.getSession();
      const { error } = await supabase.functions.invoke("admin-reset-password", {
        body: { usuarioId: empleado.id },
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
      });
      if (error) throw error;

      notify.toast.success(`Contraseña restablecida para ${empleado.name}.`);
    } catch (error) {
      console.error("Error restableciendo contraseña:", error);
      notify.toast.error("Error al restablecer contraseña.");
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        loadingAuth,
        checkingSession,
        setUser,
        requiereCambioPassword,
        cambiarPasswordActual,
        restablecerPasswordUsuario,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
