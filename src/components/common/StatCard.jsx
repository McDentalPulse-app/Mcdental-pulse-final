import Card from "./Card";
import Icon from "../ui/Icon";

// `valueClass` sigue llegando como "admin-stat-value--verde" desde los call sites
// (no se tocaron): el color ya no pinta el número, se lee de ahí para teñir el
// badge del icono, igual que <KPI>.
//
// `onClick` es opcional: cuando se pasa, la tarjeta se vuelve un botón real (foco de teclado,
// Enter/Espacio la activan) que puede usarse para filtrar la lista de abajo por lo que la
// tarjeta representa — p. ej. "Retardos" en Nómina filtra el recibo por persona a quien tenga
// retardos. `activa` la resalta mientras ese filtro está encendido.
const StatCard = ({ iconName, value, label, valueClass = "", onClick, activa = false }) => {
  const variant = valueClass.replace("admin-stat-value--", "");
  const clicable = typeof onClick === "function";

  return (
    <Card
      className={`admin-stat-card${clicable ? " admin-stat-card--clicable" : ""}${activa ? " admin-stat-card--activa" : ""}`}
      {...(clicable
        ? {
            role: "button",
            tabIndex: 0,
            "aria-pressed": activa,
            onClick,
            onKeyDown: (e) => {
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(e); }
            },
          }
        : {})}
    >
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
