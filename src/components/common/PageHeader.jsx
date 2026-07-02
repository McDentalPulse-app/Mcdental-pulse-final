import React from "react";
import Icon from "../ui/Icon";

// Header premium compartido por todas las pantallas (patrón nacido en AI Engine):
// banner con gradiente de marca + aura animada + icono con glow.
const PageHeader = ({ icon, eyebrow, title, subtitle, children, className = "" }) => (
  <div className={`premium-page-header ${className}`.trim()}>
    <div className="premium-header-bg" aria-hidden="true" />
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
