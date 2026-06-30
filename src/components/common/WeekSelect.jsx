import React, { useState, useRef, useEffect } from "react";
import Icon from "../ui/Icon";

// Desplegable propio (no nativo) para elegir semana. Se renderiza en la página,
// así aparece en el lugar correcto también en la vista móvil/emulada.
export default function WeekSelect({ value, options, onChange, className = "" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onEsc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const current = options.find((o) => o.value === value);

  return (
    <div className={`week-select${className ? ` ${className}` : ""}`} ref={ref}>
      <button
        type="button"
        className="week-select-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Icon name="calendar" size={14} />
        <span className="week-select-value">{current?.label || value}</span>
        <span className={`week-select-caret${open ? " week-select-caret--open" : ""}`} />
      </button>

      {open && (
        <ul className="week-select-menu" role="listbox">
          {options.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                role="option"
                aria-selected={o.value === value}
                className={`week-select-option${o.value === value ? " week-select-option--active" : ""}`}
                onClick={() => { onChange(o.value); setOpen(false); }}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
