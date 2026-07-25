import React, { useEffect, useRef } from "react";
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
}) => {
  const cancelRef = useRef(null);
  const config = variantConfig[variant] || variantConfig.default;

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="mc-modal-overlay mc-notify-overlay" onClick={onCancel} role="presentation">
      <div
        className="mc-modal mc-notify-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
      >
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
