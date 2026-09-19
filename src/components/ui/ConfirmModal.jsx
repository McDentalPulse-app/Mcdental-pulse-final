import { useEffect, useRef } from "react";
import Icon from "./Icon";

const variantConfig = {
  default: {
    icon: "bell",
    iconClass: "mc-notify-modal-icon--info",
    confirmClass: "mc-btn-primary",
  },
  danger: {
    icon: "critical",
    iconClass: "mc-notify-modal-icon--danger",
    confirmClass: "mc-btn-danger",
  },
  warning: {
    icon: "warning",
    iconClass: "mc-notify-modal-icon--warning",
    confirmClass: "mc-btn-primary mc-btn-warning-action",
  },
};

const ConfirmModal = ({
  title = "Confirmar acción",
  description = "",
  variant = "default",
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  onConfirm,
  onCancel,
  onClose,
}) => {
  const cancelRef = useRef(null);
  const config = variantConfig[variant] || variantConfig.default;
  // Cuando cancelText lleva un significado propio (p.ej. "Solo desactivar" en vez de
  // "Cancelar"), cerrar sin elegir NO puede reusar ese botón: quien pulsa Escape o hace clic
  // fuera para salirse sin querer no está eligiendo esa opción. onClose es ese tercer camino,
  // separado de Cancelar; si no se da (diálogos donde cancelText de verdad es "no hacer nada")
  // cae de vuelta en onCancel, que ahí significa lo mismo.
  const cerrar = onClose || onCancel;

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") cerrar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cerrar]);

  return (
    <div className="mc-modal-overlay mc-notify-overlay" onClick={cerrar} role="presentation">
      <div
        className="mc-modal mc-notify-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
      >
        <button
          type="button"
          className="mc-notify-modal-close"
          onClick={cerrar}
          aria-label="Cerrar"
        >
          <Icon name="close" size={18} />
        </button>
        <div className={`mc-notify-modal-icon ${config.iconClass}`}>
          <Icon name={config.icon} size={22} />
        </div>
        <h2 id="confirm-modal-title" className="mc-notify-modal-title">{title}</h2>
        {description && (
          <p className="mc-notify-modal-desc">{description}</p>
        )}
        <div className="mc-notify-modal-actions">
          <button
            ref={cancelRef}
            type="button"
            className="mc-btn-outline"
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`${config.confirmClass} mc-btn-with-icon`}
            onClick={onConfirm}
          >
            <Icon name="check" size={16} /> {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
