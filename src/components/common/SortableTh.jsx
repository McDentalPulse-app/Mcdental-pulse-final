import Icon from "../ui/Icon";

/**
 * Encabezado de columna ordenable: clic alterna asc/desc, la flecha solo se ve en la
 * columna activa (no hay ícono de "sin ordenar" en el set de íconos del proyecto).
 *
 * Compartido por las tablas de Empleados y Gestión de Personal — antes vivía suelto
 * dentro de EmpleadosList y había que copiarlo para cada tabla nueva.
 *
 * `orden` es `{ columna, direccion }` y `onSort(id)` lo alterna en el componente padre.
 */
const SortableTh = ({ id, label, orden, onSort, className }) => {
  const activo = orden.columna === id;
  return (
    <th
      className={`emp-table-th${className ? ` ${className}` : ""}${activo ? " emp-table-th--activo" : ""}`}
      onClick={() => onSort(id)}
    >
      <span className="emp-table-th-inner">
        {label}
        {activo && (
          <Icon
            name="chevronDown"
            size={13}
            className={`emp-table-th-caret${orden.direccion === "ascending" ? " emp-table-th-caret--asc" : ""}`}
          />
        )}
      </span>
    </th>
  );
};

export default SortableTh;
