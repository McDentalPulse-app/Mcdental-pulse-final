import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import ConfirmModal from "../components/ui/ConfirmModal";
import PromptModal from "../components/ui/PromptModal";
import Toast from "../components/ui/Toast";
import { registerNotificationHandlers } from "../utils/notify";

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const [promptState, setPromptState] = useState(null);
  const confirmResolver = useRef(null);
  const promptResolver = useRef(null);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback((message, type, options) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((prev) => [...prev, { id, message, type, ...options }]);
  }, []);

  const toastApi = useCallback(
    () => ({
      success: (message) => pushToast(message, "success"),
      error: (message) => pushToast(message, "error"),
      warning: (message) => pushToast(message, "warning"),
      info: (message) => pushToast(message, "info"),
      // Persistente (no se autocierra) y con un botón de acción: para avisos que necesitan un
      // click, no que la persona los vea pasar. Único uso hoy: "hay una versión nueva".
      update: (message, action) =>
        pushToast(message, "info", { persistent: true, action }),
    }),
    [pushToast]
  );

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      confirmResolver.current = resolve;
      setConfirmState(options);
    });
  }, []);

  const prompt = useCallback((options) => {
    return new Promise((resolve) => {
      promptResolver.current = resolve;
      setPromptState(options);
    });
  }, []);

  const closeConfirm = useCallback((result) => {
    setConfirmState(null);
    confirmResolver.current?.(result);
    confirmResolver.current = null;
  }, []);

  const closePrompt = useCallback((result) => {
    setPromptState(null);
    promptResolver.current?.(result);
    promptResolver.current = null;
  }, []);

  useEffect(() => {
    const toast = toastApi();
    registerNotificationHandlers({ toast, confirm, prompt });
    return () => {
      registerNotificationHandlers({
        toast: {
          success: () => {},
          error: () => {},
          warning: () => {},
          info: () => {},
        },
        confirm: async () => false,
        prompt: async () => null,
      });
    };
  }, [toastApi, confirm, prompt]);

  // Memoizado: toastApi() (y el objeto value) se llamaban de nuevo en CADA render, así que
  // cualquier pantalla con `toast` en las dependencias de un efecto lo veía "cambiar" siempre.
  // Si ese efecto llamaba a algo que podía fallar (un fetch) y el catch hacía toast.error(...),
  // el error mismo disparaba el loop: toast.error -> nuevo estado de toasts -> re-render ->
  // toast "nuevo" -> el efecto se repetía -> fetch de nuevo -> fallaba -> toast.error otra vez.
  // Reproducido en SoporteTI.jsx: sin credenciales de MCTIC en local, el fetch fallaba y esto
  // mandaba ~40 requests por segundo sin parar.
  const toast = useMemo(() => toastApi(), [toastApi]);
  const value = useMemo(() => ({ toast, confirm, prompt }), [toast, confirm, prompt]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <div className="mc-toast-container" aria-live="polite" aria-atomic="true">
        {toasts.map((t) => (
          <Toast key={t.id} {...t} onDismiss={dismissToast} />
        ))}
      </div>
      {confirmState && (
        <ConfirmModal
          {...confirmState}
          onConfirm={() => closeConfirm(true)}
          onCancel={() => closeConfirm(false)}
        />
      )}
      {promptState && (
        <PromptModal
          {...promptState}
          onConfirm={(val) => closePrompt(val)}
          onCancel={() => closePrompt(null)}
        />
      )}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotification debe usarse dentro de NotificationProvider");
  }
  return ctx;
};
