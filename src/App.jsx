import { Suspense, lazy } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import { useGlobal } from "./contexts/GlobalContext";
import { useAppActions } from "./hooks/useAppActions";
import Login from "./components/auth/Login";
import CambiarPassword from './components/auth/CambiarPassword';
import Loader from './components/ui/Loader';

const AdminLayout = lazy(() => import("./components/layout/AdminLayout"));
const PsicologaLayout = lazy(() => import("./components/layout/PsicologaLayout"));
const HRLayout = lazy(() => import("./components/layout/HRLayout"));
const EmpleadoLayout = lazy(() => import("./components/layout/EmpleadoLayout"));

export default function App() {
  const { 
    user, 
    requiereCambioPassword, 
    cambiarPasswordActual, 
    restablecerPasswordUsuario, 
    inicializarUsuariosPassword 
  } = useAuth();
  
  const globals = useGlobal();
  const actions = useAppActions();
  const location = useLocation();

  if (!user) return <Login />;

  if (requiereCambioPassword) {
    return (
      <CambiarPassword
        user={user}
        onCambiarPassword={cambiarPasswordActual}
      />
    );
  }

  if (!location.pathname.startsWith(`/${user.role}`)) {
    return <Navigate to={`/${user.role}`} replace />;
  }

  const combinedActions = {
    ...actions,
    restablecerPasswordUsuario,
    inicializarUsuariosPassword
  };

  return (
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
  );
}
