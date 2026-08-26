/**
 * Barra de nivel de stock vs. umbral de aviso. Reemplaza el pill "Stock bajo" (binario, solo
 * color) por una lectura de un vistazo — y mantiene texto ("· Bajo") además del color, para no
 * depender solo del color (daltonismo).
 */
export default function StockBar({ actual, umbral, unidad }) {
  const cantidad = Number(actual) || 0;
  const tieneUmbral = Number(umbral) > 0;
  // Sin umbral (catálogo recién cargado, todavía en default 0) no hay referencia de "bajo/alto":
  // se muestra la barra llena en gris neutro, no roja ni verde inventadas.
  const tope = tieneUmbral ? Number(umbral) * 2 : Math.max(cantidad, 1);
  const porcentaje = Math.min(100, Math.max(0, (cantidad / tope) * 100));
  const nivel = !tieneUmbral
    ? "neutral"
    : cantidad <= umbral
      ? "bajo"
      : cantidad <= umbral * 1.5
        ? "medio"
        : "alto";

  return (
    <div className="mc-stock-bar">
      <div className="mc-stock-bar-track">
        <div className={`mc-stock-bar-fill mc-stock-bar-fill--${nivel}`} style={{ width: `${porcentaje}%` }} />
      </div>
      <span className="mc-stock-bar-texto">
        {cantidad} {unidad}
        {nivel === "bajo" && <strong className="mc-stock-bar-alerta"> · Bajo</strong>}
      </span>
    </div>
  );
}
