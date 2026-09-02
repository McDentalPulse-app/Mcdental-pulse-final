import { Suspense, lazy, useState, useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { refreshSemana } from "./utils/constants";
import { rutaBaseDe } from "./config/navItems";
import { useAuth } from "./contexts/AuthContext";
import { useGlobal } from "./contexts/GlobalContext";
import { useAppActions } from "./hooks/useAppActions";
import LandingPage from "./components/landing/LandingPage";
import Loader from './components/ui/Loader';
import AvisoModal from "./components/avisos/AvisoModal";
import ForzarNotificaciones from "./components/notificaciones/ForzarNotificaciones";
import ModalActualizacion from "./components/actualizacion/ModalActualizacion";

const AdminLayout = lazy(() => import("./components/layout/AdminLayout"));
const PsicologaLayout = lazy(() => import("./components/layout/PsicologaLayout"));
const HRLayout = lazy(() => import("./components/layout/HRLayout"));
const EmpleadoLayout = lazy(() => import("./components/layout/EmpleadoLayout"));
const DoctorLayout = lazy(() => import("./components/layout/DoctorLayout"));

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

  /**
   * Marca el <body> cuando hay algún modal abierto.
   *
   * En el teléfono, la barra flotante de navegación (`position: fixed`) tapaba los botones de
   * Guardar/Cancelar de los modales, así que el CSS la esconde mientras hay uno abierto. Eso se
   * hacía con `body:has(.mc-modal-overlay)`, y ahí estaba la trampa: `:has()` no existe en iOS
   * Safari anterior a 15.4 ni en Chrome de Android anterior al 105, y un selector que el
   * navegador no entiende se descarta ENTERO y en silencio. En esos teléfonos la barra seguía
   * encima del botón de guardar, sin que nada lo delatara.
   *
   * Un observador aquí cubre todos los modales de la app —los de ahora y los que vengan— sin
   * tener que acordarse en cada componente, y funciona en cualquier navegador. Los modales se
   * abren y cierran de tarde en tarde, así que el coste es irrelevante.
   */
  useEffect(() => {
    const sincronizar = () => {
      document.body.classList.toggle("mc-modal-abierto", !!document.querySelector(".mc-modal-overlay"));
    };
    sincronizar();
    const observador = new MutationObserver(sincronizar);
    observador.observe(document.body, { childList: true, subtree: true });
    return () => {
      observador.disconnect();
      document.body.classList.remove("mc-modal-abierto");
    };
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

  // admin_plus reusa el AdminLayout montado en /admin/* (no hay /admin_plus/* aparte) —
  // sin este caso especial, cada carga redirigiría a /admin_plus y no encontraría ruta.
  //
  // OJO con startsWith a secas: "/admin_plus/modulos".startsWith("/admin") da true (son
  // letras, no segmentos), así que una URL vieja con /admin_plus/... NUNCA se corregía acá
  // y cualquier navegación fallida se quedaba pegada — el propio catch-all de abajo
  // ("Vista en construcción") es lo que se terminaba viendo. Por eso el límite de segmento
  // (== exacto, o empieza con "/base/").
  const rutaBase = rutaBaseDe(user.role);
  if (location.pathname !== `/${rutaBase}` && !location.pathname.startsWith(`/${rutaBase}/`)) {
    return <Navigate to={`/${rutaBase}`} replace />;
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
      {/* La campana de notificaciones ahora vive DENTRO del header (HeaderNav), no flotante. */}
      {/* Empujón obligatorio para activar el push: se muestra a sí mismo solo si hace falta
          (permiso sin conceder), común a los 4 roles. */}
      <ForzarNotificaciones />
      {/* Aviso obligatorio de versión nueva. Va aquí por lo mismo que AvisoModal: es el único
          punto que comparten todos los roles, y se muestra o no según su propio estado. */}
      <ModalActualizacion />
      <Suspense fallback={<Loader />}>
        <Routes>
          {(user.role === 'admin' || user.role === 'admin_plus') && (
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
          {user.role === 'doctor' && (
            <Route path="/doctor/*" element={<DoctorLayout user={user} globals={globals} actions={combinedActions} />} />
          )}

          <Route path="*" element={<div style={{ color:"#9ca3af",padding:40,textAlign:"center" }}>Vista en construcción / No encontrada</div>} />
        </Routes>
      </Suspense>
    </>
  );
}
