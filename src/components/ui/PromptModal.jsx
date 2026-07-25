import React, { useEffect, useRef, useState } from "react";
import Icon from "./Icon";

const PromptModal = ({
  title = "Ingresa un valor",
  description = "",
  placeholder = "",
  defaultValue = "",
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  onConfirm,
  onCancel,
}) => {
  const inputRef = useRef(null);
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const submit = (e) => {
    e.preventDefault();
    onConfirm(value);
  };

  return (
    <div className="mc-modal-overlay mc-notify-overlay" onClick={onCancel} role="presentation">
      <div
        className="mc-modal mc-notify-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="prompt-modal-title"
      >
        <div className="mc-notify-modal-icon mc-notify-modal-icon--info">
          <Icon name="note" size={22} />
        </div>
        <h2 id="prompt-modal-title" className="mc-notify-modal-title">{title}</h2>
        {description && (
          <p className="mc-notify-modal-desc">{description}</p>
        )}
        <form onSubmit={submit} className="mc-notify-prompt-form">
          <input
            ref={inputRef}
            type="text"
            className="mc-form-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
          />
          <div className="mc-notify-modal-actions">
            <button type="button" className="mc-btn-outline" onClick={onCancel}>
              {cancelText}
            </button>
            <button type="submit" className="mc-btn-primary mc-btn-with-icon">
              <Icon name="check" size={16} /> {confirmText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PromptModal;
