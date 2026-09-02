import Icon from "../ui/Icon";

// Header plano compartido por todas las pantallas, estilo Untitled UI
// (título + subtítulo a la izquierda, acciones a la derecha, borde inferior).
const PageHeader = ({ icon, eyebrow, title, subtitle, children, className = "" }) => (
  <div className={`premium-page-header ${className}`.trim()}>
    {icon && (
      <div className="admin-stat-icon-wrap premium-header-icon">
        <Icon name={icon} size={22} />
      </div>
    )}
    <div className="premium-header-main">
      {eyebrow && <span className="premium-header-eyebrow">{eyebrow}</span>}
      <h1 className="admin-page-title">{title}</h1>
      {subtitle && <p className="admin-page-subtitle">{subtitle}</p>}
    </div>
    {children && <div className="premium-header-actions">{children}</div>}
  </div>
);

export default PageHeader;
