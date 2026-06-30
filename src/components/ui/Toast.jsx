import React, { useEffect } from "react";
import Icon from "./Icon";

const toastConfig = {
  success: { icon: "check", className: "mc-toast--success" },
  error: { icon: "critical", className: "mc-toast--error" },
  warning: { icon: "warning", className: "mc-toast--warning" },
  info: { icon: "bell", className: "mc-toast--info" },
};

const Toast = ({ id, message, type = "info", onDismiss }) => {
  const config = toastConfig[type] || toastConfig.info;

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(id), 4200);
    return () => clearTimeout(timer);
  }, [id, onDismiss]);

  return (
    <div className={`mc-toast ${config.className}`} role="status">
      <span className="mc-toast-icon">
        <Icon name={config.icon} size={18} />
      </span>
      <span className="mc-toast-message">{message}</span>
      <button
        type="button"
        className="mc-toast-close"
        onClick={() => onDismiss(id)}
        aria-label="Cerrar notificación"
      >
        <Icon name="xCircle" size={16} />
      </button>
    </div>
  );
};

export default Toast;
