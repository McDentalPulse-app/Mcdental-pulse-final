import { useEffect } from "react";

// Cierra un modal/panel con la tecla Escape mientras `activo` sea true.
// Es el equivalente de teclado del "click fuera para cerrar" de los overlays:
// sin él, quien navega con teclado no puede cerrar el modal (WCAG 2.1.1).
// ConfirmModal/PromptModal ya lo traían inline; este hook lo comparte para el resto.
export function useEscapeKey(onEscape, activo = true) {
  useEffect(() => {
    if (!activo) return;
    const onKey = (e) => {
      if (e.key === "Escape") onEscape();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onEscape, activo]);
}
