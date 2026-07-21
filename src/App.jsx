import { Suspense, lazy, useState, useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { refreshSemana } from "./utils/constants";
import { useAuth } from "./contexts/AuthContext";
import { useGlobal } from "./contexts/GlobalContext";
import { useAppActions } from "./hooks/useAppActions";
import LandingPage from "./components/landing/LandingPage";
import Loader from './components/ui/Loader';
import AvisoModal from "./components/avisos/AvisoModal";
import CampanaNotificaciones from "./components/notificaciones/CampanaNotificaciones";
import ForzarNotificaciones from "./components/notificaciones/ForzarNotificaciones";

const AdminLayout = lazy(() => import("./components/layout/AdminLayout"));
const PsicologaLayout = lazy(() => import("./components/layout/PsicologaLayout"));
const HRLayout = lazy(() => import("./components/layout/HRLayout"));
const EmpleadoLayout = lazy(() => import("./components/layout/EmpleadoLayout"));

export default function App() {
  const {
    user,
    checkingSession,
    requiereCambioPassword,
    restablecerPasswordUsuario,
  } = useAuth();

  const globals = useGlobal();
  const actions = useAppActions();
  const location = useLocation();

  // Refresca la semana activa al cruzar el lunes 00:00 sin recargar la página.
  const [, setWeekTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      if (refreshSemana()) setWeekTick((t) => t + 1);
    }, 60000);
    return () => clearInterval(id);
  }, []);

  // Mientras se restaura la sesión (al abrir/recargar la app) "user" empieza en
  // null por un instante; sin este guard se ve un flash de la landing/login
  // antes de saltar al dashboard aunque ya haya sesión activa.
  if (checkingSession) {
    return <Loader />;
  }

  // Sin sesión, o con sesión pero pendiente de cambiar contraseña: la landing
  // maneja el panel de cambio de contraseña internamente.
  if (!user || requiereCambioPassword) {
    return <LandingPage />;
  }

  if (!location.pathname.startsWith(`/${user.role}`)) {
    return <Navigate to={`/${user.role}`} replace />;
  }

  const combinedActions = {
    ...actions,
    restablecerPasswordUsuario,
  };

  return (
    <>
      {/* Bloqueante y común a los 4 roles: se monta acá (no en un layout) porque es el
          único punto que todos comparten de verdad, y un overlay fixed se ve igual sin
          importar dónde cuelgue en el árbol. */}
      <AvisoModal
        avisos={globals.avisos}
        avisosLeidos={globals.avisosLeidos}
        onMarcarLeido={actions.marcarAvisoLeido}
        sucursalUsuario={user?.sucursal}
        usuarioId={user?.id}
      />
      {/* Campana global: fija arriba a la derecha, común a los 4 roles (mismo motivo que
          AvisoModal). Es la ventana a la bandeja persistente de notificaciones. */}
      <CampanaNotificaciones user={user} />
      {/* Empujón obligatorio para activar el push: se muestra a sí mismo solo si hace falta
          (permiso sin conceder), común a los 4 roles. */}
      <ForzarNotificaciones />
      <Suspense fallback={<Loader />}>
        <Routes>
          {user.role === 'admin' && (
            <Route path="/admin/*" element={<AdminLayout user={user} globals={globals} actions={combinedActions} />} />
          )}
          {user.role === 'psicologa' && (
            <Route path="/psicologa/*" element={<PsicologaLayout user={user} globals={globals} actions={combinedActions} />} />
          )}
          {user.role === 'rh' && (
            <Route path="/rh/*" element={<HRLayout user={user} globals={globals} actions={combinedActions} />} />
          )}
          {user.role === 'empleado' && (
            <Route path="/empleado/*" element={<EmpleadoLayout user={user} globals={globals} actions={combinedActions} />} />
          )}

          <Route path="*" element={<div style={{ color:"#9ca3af",padding:40,textAlign:"center" }}>Vista en construcción / No encontrada</div>} />
        </Routes>
      </Suspense>
    </>
  );
}
