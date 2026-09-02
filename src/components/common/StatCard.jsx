import Card from "./Card";
import Icon from "../ui/Icon";

// `valueClass` sigue llegando como "admin-stat-value--verde" desde los call sites
// (no se tocaron): el color ya no pinta el número, se lee de ahí para teñir el
// badge del icono, igual que <KPI>.
const StatCard = ({ iconName, value, label, valueClass = "" }) => {
  const variant = valueClass.replace("admin-stat-value--", "");

  return (
    <Card className="admin-stat-card">
      {iconName && (
        <div className={`admin-stat-icon-wrap${variant ? ` admin-stat-icon-wrap--${variant}` : ""}`}>
          <Icon name={iconName} size={20} />
        </div>
      )}
      <div className="admin-stat-value">{value}</div>
      <div className="admin-stat-label">{label}</div>
    </Card>
  );
};

export default StatCard;
