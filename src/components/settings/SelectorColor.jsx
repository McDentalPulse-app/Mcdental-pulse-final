import { useRef } from "react";
import { useAccent } from "../../contexts/AccentContext";
import Card from "../common/Card";
import Icon from "../ui/Icon";

// Selector del color de marca del usuario. Presets (swatches) + color propio
// (<input type="color">). Aplica en vivo vía AccentContext y persiste en la BD.
export default function SelectorColor() {
  const { color, setColor, presets, colorPorDefecto } = useAccent();
  const inputRef = useRef(null);

  const actual = String(color || "").toLowerCase();
  const esPreset = presets.some((p) => p.hex.toLowerCase() === actual);
  const esDefecto = actual === colorPorDefecto.toLowerCase();

  return (
    <Card className="perfil-info-card">
      <div className="perfil-info-title">
        <Icon name="sparkles" size={16} />
        <span>Color de la app</span>
      </div>
      <p className="perfil-info-note" style={{ marginBottom: 14 }}>
        Elige el color con el que ves la app — desde el inicio de sesión hasta cada
        pestaña. Puedes usar una de las paletas o crear la tuya propia.
      </p>

      <div className="color-swatch-grid" role="group" aria-label="Paletas de color">
        {presets.map((p) => {
          const activo = p.hex.toLowerCase() === actual;
          return (
            <button
              key={p.id}
              type="button"
              className={`color-swatch${activo ? " is-active" : ""}`}
              style={{ "--swatch": p.hex }}
              onClick={() => setColor(p.hex)}
              aria-pressed={activo}
              aria-label={`Color ${p.nombre}`}
              title={p.nombre}
            >
              {activo && <Icon name="check" size={16} />}
            </button>
          );
        })}

        {/* Color propio: reutiliza el mismo hueco visual que un swatch. */}
        <button
          type="button"
          className={`color-swatch color-swatch--custom${!esPreset ? " is-active" : ""}`}
          style={!esPreset ? { "--swatch": color } : undefined}
          onClick={() => inputRef.current?.click()}
          aria-label="Personalizar color"
          title="Personalizar"
        >
          {!esPreset ? <Icon name="check" size={16} /> : <Icon name="plus" size={16} />}
          <input
            ref={inputRef}
            type="color"
            className="color-swatch-input"
            value={esPreset ? colorPorDefecto : color}
            onChange={(e) => setColor(e.target.value)}
            tabIndex={-1}
            aria-hidden="true"
          />
        </button>
      </div>

      {!esDefecto && (
        <button
          type="button"
          className="perfil-foto-btn perfil-foto-btn--ghost"
          style={{ marginTop: 14 }}
          onClick={() => setColor(null)}
        >
          <Icon name="refresh" size={15} />
          Restablecer color por defecto
        </button>
      )}
    </Card>
  );
}
