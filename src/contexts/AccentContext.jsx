import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { useNotification } from "./NotificationContext";
import { guardarMiColor } from "../services/supabase/colorService";
import { generarPaleta, PRESETS, SEMILLA_TEAL } from "../utils/accentPalette";

const AccentContext = createContext();

// Cuánto se espera tras el último cambio antes de persistir en la BD. Mover el
// picker o pulsar swatches rápido NO dispara una petición por cada paso: solo se
// guarda el color final, una vez.
const GUARDADO_DEBOUNCE_MS = 450;

// Caché del color a nivel de DISPOSITIVO. El color "de verdad" vive en la BD por
// usuario, pero el login es PRE-autenticación: ahí no hay usuario del que leerlo.
// Guardamos el último color aplicado en este equipo para que la pantalla de login
// (y el primer render) ya se pinten con él, en vez de quedarse en teal.
const CACHE_KEY = "mc-color-acento";
const ES_HEX = /^#[0-9A-Fa-f]{6}$/;

const leerColorCache = () => {
  try {
    const v = localStorage.getItem(CACHE_KEY);
    return v && ES_HEX.test(v) ? v : null;
  } catch {
    return null;
  }
};

// hex → guarda; null → borra (el usuario usa el default y no queremos fijar teal
// como "elección" en el dispositivo).
const escribirColorCache = (hex) => {
  try {
    if (hex) localStorage.setItem(CACHE_KEY, hex);
    else localStorage.removeItem(CACHE_KEY);
  } catch {
    /* almacenamiento no disponible (incógnito estricto): sin caché, se cae a teal */
  }
};

// Aplica la familia de marca generada como variables inline sobre <html>. Es
// barato (escribe ~40 custom properties); el coste real es el repintado de la
// app, por eso NO re-renderizamos el árbol de React al previsualizar.
const aplicarPaleta = (hex) => {
  const paleta = generarPaleta(hex);
  const root = document.documentElement;
  for (const [prop, valor] of Object.entries(paleta)) {
    root.style.setProperty(prop, valor);
  }
};

// Pre-pinta el color cacheado del dispositivo ANTES del primer render de React.
// Se ejecuta al importar este módulo (que main.jsx carga antes de createRoot),
// así el login sale con el color elegido desde el primer frame en vez de
// parpadear de teal. La hidratación posterior por usuario es idempotente.
if (typeof document !== "undefined") {
  aplicarPaleta(leerColorCache() || SEMILLA_TEAL);
}

export const AccentProvider = ({ children }) => {
  const { user } = useAuth();
  const { toast } = useNotification();

  // Color "en vivo" del selector. Estado LOCAL a propósito: cambiarlo solo
  // re-renderiza a los consumidores de este contexto (el selector), no toda la
  // app. Antes esto pasaba por setUser (AuthContext, en la raíz) y cada click
  // re-renderizaba el árbol entero — de ahí el congelamiento al ir rápido.
  // Init: color de BD del usuario si ya hay sesión, si no la caché del dispositivo
  // (para que el login pinte el último color usado aquí), y por último teal.
  const [color, setColorState] = useState(
    () => user?.colorAcento || leerColorCache() || SEMILLA_TEAL
  );

  // Hidratación al cargar/cambiar de usuario (login, restauración, logout).
  // setState-durante-render guardado por el id: el patrón oficial de React para
  // "ajustar estado cuando cambia una prop", sin efecto ni carrera.
  const uidRef = useRef(user?.id);
  if (uidRef.current !== user?.id) {
    uidRef.current = user?.id;
    if (user) {
      // Sesión iniciada: manda el color de BD del usuario (o teal si no eligió).
      // Además refrescamos la caché para que su próximo login lo muestre.
      setColorState(user.colorAcento || SEMILLA_TEAL);
      escribirColorCache(user.colorAcento || null);
    } else {
      // Logout / sin sesión: el login conserva el último color del dispositivo.
      setColorState(leerColorCache() || SEMILLA_TEAL);
    }
  }

  // Repinta las variables CSS cuando cambia el color, coalescido por frame con
  // requestAnimationFrame. Arrastrar el picker dispara onChange muchas veces por
  // segundo; sin esto, la app se repintaría (auroras + blur) en cada paso. Con
  // rAF, como mucho un repintado por frame — que es el máximo que puede pintar
  // el navegador de todos modos.
  const rafRef = useRef(null);
  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => aplicarPaleta(color));
    return () => cancelAnimationFrame(rafRef.current);
  }, [color]);

  // Guardado con debounce: un timer y el último valor pendiente en refs para no
  // recrear setColor ni disparar N peticiones. Solo persiste el color final.
  const timerRef = useRef(null);
  const pendienteRef = useRef(undefined);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const programarGuardado = useCallback((valor) => {
    pendienteRef.current = valor;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        await guardarMiColor(pendienteRef.current);
      } catch (e) {
        toast?.error(e?.message || "No se pudo guardar el color.");
      }
    }, GUARDADO_DEBOUNCE_MS);
  }, [toast]);

  // Cambia el color: aplica la vista previa al instante y agenda el guardado.
  // hex = null → volver al color por defecto (se guarda null para heredar
  // futuros cambios de marca en vez de fijar el teal como elección).
  const setColor = useCallback((hex) => {
    const nuevo = hex ? hex : null;
    setColorState(nuevo || SEMILLA_TEAL);
    // Cachea de inmediato a nivel de dispositivo: así el próximo login ya sale con
    // este color aunque aún no haya llegado el guardado en BD.
    escribirColorCache(nuevo);
    // Sin sesión no hay a quién guardárselo (el selector vive tras el login).
    if (uidRef.current) programarGuardado(nuevo);
  }, [programarGuardado]);

  return (
    <AccentContext.Provider
      value={{ color, setColor, presets: PRESETS, colorPorDefecto: SEMILLA_TEAL }}
    >
      {children}
    </AccentContext.Provider>
  );
};

export const useAccent = () => {
  const context = useContext(AccentContext);
  if (!context) throw new Error("useAccent must be used within an AccentProvider");
  return context;
};
