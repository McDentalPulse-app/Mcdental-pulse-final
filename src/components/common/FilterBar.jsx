
// Consolida el `<div className="list-filters-grid">` + input de búsqueda que
// GestionUsuarios/EmpleadosList/PsicologaSeguimiento repetían a mano (los tres
// con el mismo texto y las mismas clases). Los <select> de cada página se pasan
// como children tal cual — sus opciones y su lógica no cambian.
const FilterBar = ({ search, className = "", children }) => (
  <div className={`list-filters-grid${className ? ` ${className}` : ""}`}>
    <input
      className="list-filter-input"
      value={search.value}
      onChange={(e) => search.onChange(e.target.value)}
      placeholder={search.placeholder}
    />
    {children}
  </div>
);

export default FilterBar;
