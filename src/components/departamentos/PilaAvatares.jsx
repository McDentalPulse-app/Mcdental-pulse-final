import Avatar from "../ui/Avatar";

/**
 * Caras encimadas, estilo Teams/Slack: las primeras `max` personas y un "+N" con el resto.
 * Sin zoom: casi siempre vive dentro de un botón (la tarjeta del departamento), y un
 * botón dentro de otro es HTML inválido — ver el comentario de `zoom` en Avatar.jsx.
 */
export default function PilaAvatares({ personas, max = 4, size = 28 }) {
  const visibles = personas.slice(0, max);
  const resto = personas.length - visibles.length;
  return (
    <span className="departamento-pila" style={{ "--pila-size": `${size}px` }}>
      {/* La primera cara va encima de la siguiente, no debajo: si no, cada círculo tapa las
          iniciales del anterior y la fila se lee como manchas del mismo color. */}
      {visibles.map((p, i) => (
        <span key={p.usuarioId} className="departamento-pila-item" title={p.nombre} style={{ zIndex: visibles.length - i }}>
          <Avatar name={p.nombre} photoUrl={p.avatarUrl} size={size} zoom={false} />
        </span>
      ))}
      {resto > 0 && <span className="departamento-pila-item departamento-pila-mas">+{resto}</span>}
    </span>
  );
}
