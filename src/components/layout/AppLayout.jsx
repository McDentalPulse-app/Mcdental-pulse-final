import React, { Suspense, useEffect, useState } from "react";
import { Routes } from "react-router-dom";
import Sidebar from "./Sidebar";
import Loader from "../ui/Loader";
import AvisoPush from "../asistencia/AvisoPush";
import { soportado, estadoPermiso, activar } from "../../services/pushService";
import { useNotification } from "../../contexts/NotificationContext";

// Cuánto se espera antes de ofrecer activar avisos, para que no sea un reflejo al arrancar
// (ver services/pushService.js): el shell es común a los 4 roles, y no todos tienen un
// momento contextual propio como la checada del empleado.
const RETRASO_OFERTA_PUSH_MS = 4000;

const AppLayout = ({ children }) => {
  const { toast } = useNotification();
  const [ofrecerPush, setOfrecerPush] = useState(false);

  useEffect(() => {
    if (!soportado() || estadoPermiso() !== "default") return;
    const t = setTimeout(() => setOfrecerPush(true), RETRASO_OFERTA_PUSH_MS);
    return () => clearTimeout(t);
  }, []);

  const activarAvisos = async () => {
    const r = await activar();
    setOfrecerPush(false);
    if (r === "granted") toast.success("Listo, te avisaremos aquí.");
    else if (r === "denied") toast.info("No pasa nada, puedes activarlos luego desde tu perfil.");
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        <div className="app-main-inner">
          {ofrecerPush && (
            <AvisoPush onActivar={activarAvisos} onCerrar={() => setOfrecerPush(false)} />
          )}
          <Suspense fallback={<Loader />}>
            <Routes>{children}</Routes>
          </Suspense>
        </div>
      </main>
    </div>
  );
};

export default AppLayout;
