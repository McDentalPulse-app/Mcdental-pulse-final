
// El resto de props (`onClick`, `role`, `tabIndex`, `aria-*`...) se reenvían tal cual al <div>:
// deja usar Card como base de una tarjeta clicable (ver StatCard) sin duplicar su estilo base.
const Card = ({ children, style = {}, className = "", ...rest }) => (
  <div
    className={`mc-card ${className}`.trim()}
    style={style}
    {...rest}
  >
    {children}
  </div>
);

export default Card;
