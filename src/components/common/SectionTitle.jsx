import React from "react";
import Icon from "../ui/Icon";

const SectionTitle = ({ icon, children, className = "" }) => (
  <h3 className={`admin-section-title ${className}`.trim()}>
    {icon && <Icon name={icon} size={18} className="admin-section-title-icon" />}
    {children}
  </h3>
);

export default SectionTitle;
