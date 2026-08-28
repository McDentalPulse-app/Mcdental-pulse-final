import React, { createContext, useState, useContext, useEffect, useRef } from "react";
import { supabase, usernameToSyntheticEmail } from "../config/supabase";
import { notify } from "../utils/notify";
import { mensajeDeFallo } from "../utils/errores";

const VALID_ROLES = new Set(["admin", "rh", "psicologa", "empleado", "doctor"]);

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
    // Atiende el buzón de Soporte TI (mig. 094). Es un permiso aparte del rol: quienes lo tienen
    // son rol `empleado`, así que sin este campo la app no podría distinguirlos.
    soporteTi: !!row.soporte_ti,
    // Puede fijar la geocerca de su clínica (recepción, mig. 103). Igual que soporteTi, es un
    // permiso aparte del rol: quienes lo tienen son rol `empleado` como todos los demás.
    puedeUbicarSucursal: !!row.puede_ubicar_sucursal,
    // Inventario por clínica (mig. 120): dos permisos aparte del rol, activables persona por
    // persona desde GestionUsuarios. Bodega ve/procesa pedidos de todas las clínicas;
    // inventario ve/pide solo la suya. Una persona puede tener uno, otro, los dos o ninguno.
    puedeGestionarBodega: !!row.puede_gestionar_bodega,
    puedeGestionarInventario: !!row.puede_gestionar_inventario,
    // Departamentos (mig. 133): puede crear uno propio y liderarlo.
    puedeCrearDepartamento: !!row.puede_crear_departamento,
    // Puede fichar dentro del área de cualquier clínica, no solo la suya (mig. 118). Para quien
    // va a apoyar a otras sucursales y se quedaba sin poder marcar.
    puedeMarcarEnCualquierClinica: !!row.puede_marcar_en_cualquier_clinica,
    // Puede marcar SALIDA sin geocerca — solo la salida, la entrada sigue exigiendo estar en
    // una clínica (mig. 127). Independiente del permiso de arriba.
    puedeMarcarSalidaSinGeocerca: !!row.puede_marcar_salida_sin_geocerca,
    // Entrada libre (mig. 135): sin geocerca ni retardo, pero solo cuando la persona
    // prende el interruptor en su Checador — el permiso no basta por sí solo.
    puedeMarcarEntradaLibre: !!row.puede_marcar_entrada_libre,
    debeCambiarPassword: row.debe_cambiar_password,
    avatarUrl: row.avatar_url,
    bannerUrl: row.banner_url,
    colorAcento: row.color_acento,
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
  // true mientras cambiarPasswordActual está en vuelo. Existe por una carrera que dejó
  // gente fuera de la app: ver el comentario de cargarPerfil.
  const cambiandoPasswordRef = useRef(false);

  const cargarPerfil = async (authUserId) => {
    const { data, error } = await supabase
      .from("usuarios")
      .select("*")
      .eq("auth_user_id", authUserId)
      .single();

    if (error || !data || !VALID_ROLES.has(data.role)) {
      setUser(null);
      setRequiereCambioPassword(false);
      return null;
    }

    // Empleado dado de baja: se cierra la sesión de Auth y no entra. Cubre
    // tanto el login activo como la restauración de sesión al abrir la app.
    if (data.inactivo) {
      await supabase.auth.signOut();
      setUser(null);
      setRequiereCambioPassword(false);
      return { inactivo: true };
    }

    setUser(mapUsuarioRow(data));

    // Este SELECT puede haber salido ANTES de que mark_password_changed apagara el flag y
    // llegar DESPUÉS. Si en ese caso volviéramos a levantar requiereCambioPassword, el panel
    // de "cambia tu contraseña" reaparecería con la contraseña YA cambiada: la persona cree
    // que falló, reescribe la misma, y Auth contesta 422 "New password should be different".
    // Ahí se rinde y vuelve a entrar con emp123 —que ya no existe— y se queda fuera.
    // Eso es exactamente lo que les pasó a los usuarios nuevos del 2026-07-30.
    if (cambiandoPasswordRef.current) return { inactivo: false };

    setRequiereCambioPassword(!!data.debe_cambiar_password || loginConTemporalRef.current);
    return { inactivo: false };
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

    const { data: subscription } = supabase.auth.onAuthStateChange((evento, session) => {
      // USER_UPDATED lo emite auth.updateUser(), o sea el propio cambio de contraseña. Ahí
      // no cambió nada de la fila de `usuarios`, así que recargar el perfil no aporta y sí
      // arrastra la carrera descrita en cargarPerfil. Se ignora a propósito.
      if (evento === "USER_UPDATED") return;

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

      const perfil = await cargarPerfil(data.user.id);
      if (perfil?.inactivo) {
        throw new Error("Tu cuenta está desactivada. Contacta a administración.");
      }
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
    cambiandoPasswordRef.current = true;
    try {
      const { error: authError } = await supabase.auth.updateUser({ password: nuevaPassword });

      // `same_password` NO es un fallo: significa que esa contraseña ya está puesta, o sea
      // que un intento anterior sí funcionó aunque la pantalla dijera lo contrario. Tratarlo
      // como error es lo que dejaba a la gente dándole a Guardar contra un muro. Se sigue
      // adelante como si acabara de cambiarla, que para el caso es lo mismo.
      const yaEraSuPassword =
        authError && (authError.code === "same_password" || authError.status === 422);
      if (authError && !yaEraSuPassword) throw authError;

      // usuarios solo tiene UPDATE policy para admin/rh; un usuario normal marca
      // su propia fila vía RPC security definer acotado (ver migración 00000000000020).
      const { error: dbError } = await supabase.rpc("mark_password_changed");

      // Si esto falla, la contraseña YA cambió en Auth. Decirle "error al cambiar la
      // contraseña" sería mentirle y mandarlo a intentar con la vieja, que ya no sirve. Se
      // deja pasar y solo se avisa de la consecuencia real: que se lo vuelvan a pedir.
      if (dbError) {
        console.error("La contraseña cambió pero no se pudo apagar debe_cambiar_password:", dbError);
        notify.toast.info(
          "Tu contraseña ya quedó cambiada. Puede que te la volvamos a pedir la próxima vez que entres."
        );
      } else {
        notify.toast.success("Contraseña actualizada correctamente.");
      }

      loginConTemporalRef.current = false;
      setUser((prev) => ({ ...prev, debeCambiarPassword: false }));
      setRequiereCambioPassword(false);
      return true;
    } catch (error) {
      console.error("Error cambiando contraseña:", error);
      notify.toast.error(mensajeDeFallo("No se pudo cambiar la contraseña.", error));
      return false;
    } finally {
      cambiandoPasswordRef.current = false;
    }
  };

  const restablecerPasswordUsuario = async (empleado) => {
    try {
      // psicologa entra aquí desde la paridad de la migración 099. Se había quedado fuera
      // de esta guarda aunque la edge function ya la aceptaba: el botón le respondía "no
      // tienes permiso" sin llegar a llamar a nadie.
      if (!["admin", "rh", "psicologa", "recursos humanos"].includes(user?.role)) {
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
      if (error) {
        // supabase-js ENVUELVE los 4xx de una edge function: error.message dice
        // "Edge Function returned a non-2xx status code" y el motivo real viaja en el
        // cuerpo, dentro de error.context. Sin desenvolverlo, mostrar error.message es
        // tan inútil como el texto fijo que había antes. Mismo patrón que usuariosService.
        const detalle = await error?.context?.json?.().catch(() => null);
        throw new Error(detalle?.error || error.message);
      }

      notify.toast.success(`Contraseña restablecida para ${empleado.name}.`);
    } catch (error) {
      console.error("Error restableciendo contraseña:", error);
      notify.toast.error(mensajeDeFallo("Error al restablecer contraseña.", error));
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
