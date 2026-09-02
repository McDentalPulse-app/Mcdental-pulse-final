import Icon from "../ui/Icon";

// Reemplaza los `<p className="admin-empty">texto</p>` sueltos por un bloque
// consistente (icono + mensaje + acción opcional), estilo Untitled UI.
const EmptyState = ({ icon = "inbox", title, message, action }) => (
  <div className="mc-empty-state">
    <div className="mc-empty-state-icon">
      <Icon name={icon} size={22} />
    </div>
    {title && <div className="mc-empty-state-title">{title}</div>}
    <p className="mc-empty-state-message">{message}</p>
    {action && (
      <button type="button" className="mc-btn-secondary mc-empty-state-action" onClick={action.onClick}>
        {action.label}
      </button>
    )}
  </div>
);

export default EmptyState;
