
// Segmented control de pills (generalizado de `.asistencia-segmented`, que era
// exclusivo del selector Día/Semana/Mes/Año de Asistencia).
const Tabs = ({ options, value, onChange, ariaLabel }) => (
  <div className="mc-tabs" role="group" aria-label={ariaLabel}>
    {options.map((opt) => (
      <button
        key={opt.value}
        type="button"
        className={`mc-tabs-btn${value === opt.value ? " mc-tabs-btn--activo" : ""}`}
        aria-pressed={value === opt.value}
        onClick={() => onChange(opt.value)}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

export default Tabs;
