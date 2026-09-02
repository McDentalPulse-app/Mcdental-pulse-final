
const Card = ({ children, style = {}, className = "" }) => (
  <div
    className={`mc-card ${className}`.trim()}
    style={style}
  >
    {children}
  </div>
);

export default Card;
