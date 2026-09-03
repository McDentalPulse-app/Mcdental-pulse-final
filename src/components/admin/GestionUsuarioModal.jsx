import DateRangePicker from "../common/DateRangePicker";
import Select from "../common/Select";
import SectionTitle from "../common/SectionTitle";
import Icon from "../ui/Icon";

// Modal de alta/edición de GestionUsuarios.jsx, separado porque el archivo original
// pasaba las 800 líneas de convención del repo (todo el formulario vivía inline).
// Sin cambio de comportamiento: mismos campos, mismo orden, misma lógica — solo se
// movieron JSX + el sub-componente Campo a su propio archivo.
const GestionUsuarioModal = ({
  usuarioEditando,
  formData,
  errores,
  cambiarCampo,
  guardarUsuario,
  cerrarModal,
  loading,
  esGestion,
  rolesDisponibles,
  rolBloqueado,
  hoyISO,
  loginPrevisto,
  nombresSucursales,
}) => (
  <div className="mc-modal-overlay" onClick={cerrarModal} role="presentation">
    <div
      className="mc-modal gestion-personal-modal"
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="gestion-usuarios-modal-title"
    >
      <h2 id="gestion-usuarios-modal-title" className="mc-modal-title mc-btn-with-icon">
        <Icon name="userCog" size={20} />
        {usuarioEditando ? "Editar empleado" : "Añadir empleado"}
      </h2>

      <form onSubmit={guardarUsuario} className="mc-form-grid" noValidate>
        <SectionTitle icon="user">Datos personales</SectionTitle>

        <Campo id="gu-name" label="Nombre completo" error={errores.name}>
          <input
            id="gu-name"
            type="text"
            autoFocus
            autoComplete="off"
            className={`mc-form-input${errores.name ? " mc-form-input--error" : ""}`}
            value={formData.name}
            onChange={(e) => cambiarCampo("name", e.target.value)}
          />
        </Campo>

        <div className="mc-form-row-2">
          <Campo id="gu-telefono" label="Teléfono" error={errores.telefono} hint="Opcional. Solo números.">
            <input
              id="gu-telefono"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              placeholder="833 123 4567"
              className={`mc-form-input${errores.telefono ? " mc-form-input--error" : ""}`}
              value={formData.telefono}
              onChange={(e) => cambiarCampo("telefono", e.target.value)}
            />
          </Campo>

          <Campo id="gu-email" label="Correo" error={errores.email} hint="Opcional. No es el usuario de acceso.">
            <input
              id="gu-email"
              type="email"
              inputMode="email"
              autoComplete="off"
              placeholder="nombre@correo.com"
              className={`mc-form-input${errores.email ? " mc-form-input--error" : ""}`}
              value={formData.email}
              onChange={(e) => cambiarCampo("email", e.target.value)}
            />
          </Campo>
        </div>

        <div className="mc-form-row-2">
          <Campo id="gu-fecha-ingreso" label="Fecha de ingreso" error={errores.fechaIngreso}>
            <DateRangePicker
              unico
              max={hoyISO}
              desde={formData.fechaIngreso}
              onChange={(iso) => cambiarCampo("fechaIngreso", iso)}
              placeholder="Elige el día"
              className={errores.fechaIngreso ? "mc-daterange--error" : ""}
            />
          </Campo>

          <Campo id="gu-fecha-cumple" label="Cumpleaños" error={errores.fechaCumpleanos} hint="Formato MM-DD.">
            <input
              id="gu-fecha-cumple"
              type="text"
              inputMode="numeric"
              placeholder="08-25"
              maxLength={5}
              className={`mc-form-input${errores.fechaCumpleanos ? " mc-form-input--error" : ""}`}
              value={formData.fechaCumpleanos}
              onChange={(e) => cambiarCampo("fechaCumpleanos", e.target.value)}
            />
          </Campo>
        </div>

        <SectionTitle icon="key">Acceso al sistema</SectionTitle>

        <Campo
          id="gu-user"
          label="Nombre de usuario"
          error={errores.user}
          hint={
            formData.user.trim()
              ? `Va a iniciar sesión con: ${loginPrevisto}`
              : "Con esto inicia sesión. Sin acentos, espacios ni símbolos."
          }
        >
          <input
            id="gu-user"
            type="text"
            autoComplete="off"
            spellCheck={false}
            className={`mc-form-input${errores.user ? " mc-form-input--error" : ""}`}
            value={formData.user}
            onChange={(e) => cambiarCampo("user", e.target.value)}
          />
        </Campo>

        <Campo
          id="gu-role"
          label="Rol"
          error={errores.role}
          hint={rolBloqueado ? "Solo un administrador puede cambiar este rol." : undefined}
        >
          <Select
            id="gu-role"
            value={formData.role}
            disabled={rolBloqueado}
            onChange={(valor) => cambiarCampo("role", valor)}
          >
            {rolesDisponibles.map((r) => (
              <option key={r.valor} value={r.valor}>{r.etiqueta}</option>
            ))}
          </Select>
        </Campo>

        <SectionTitle icon="briefcase">Puesto y sucursal</SectionTitle>

        <div className="mc-form-row-2">
          <Campo id="gu-puesto" label="Puesto" error={errores.puesto}>
            <input
              id="gu-puesto"
              type="text"
              autoComplete="off"
              className={`mc-form-input${errores.puesto ? " mc-form-input--error" : ""}`}
              value={formData.puesto}
              onChange={(e) => cambiarCampo("puesto", e.target.value)}
            />
          </Campo>

          <Campo id="gu-sucursal" label="Sucursal">
            <Select
              id="gu-sucursal"
              value={formData.sucursal}
              onChange={(valor) => cambiarCampo("sucursal", valor)}
            >
              {nombresSucursales.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </Campo>
        </div>

        {/* Accesos de inventario (mig. 120): permisos aparte del rol, activables persona
            por persona. Solo tienen sentido sobre una cuenta que ya existe. */}
        {usuarioEditando && esGestion && (
          <>
            <SectionTitle icon="package">Inventario</SectionTitle>
            <div className="mc-form-row-2">
              <label className="mc-form-check">
                <input
                  type="checkbox"
                  checked={formData.puedeGestionarInventario}
                  onChange={(e) => cambiarCampo("puedeGestionarInventario", e.target.checked)}
                />
                Ve y pide el inventario de su clínica (recepción)
              </label>
              <label className="mc-form-check">
                <input
                  type="checkbox"
                  checked={formData.puedeGestionarBodega}
                  onChange={(e) => cambiarCampo("puedeGestionarBodega", e.target.checked)}
                />
                Procesa pedidos de todas las clínicas (bodega)
              </label>
            </div>
          </>
        )}

        {/* Departamentos (mig. 133): a diferencia de inventario, no se limita a gestión —
            el jefe de un departamento puede ser cualquier rol (un doctor líder de área,
            por ejemplo). Solo tiene sentido al editar una cuenta que ya existe. */}
        {usuarioEditando && (
          <div className="mc-form-group">
            <label className="mc-form-check">
              <input
                type="checkbox"
                checked={formData.puedeCrearDepartamento}
                onChange={(e) => cambiarCampo("puedeCrearDepartamento", e.target.checked)}
              />
              Puede crear y liderar un departamento
            </label>
            <p className="mc-form-hint">
              Va a poder crear su propio departamento, agregar gente, mandar avisos al
              grupo y asignar tareas con fecha límite.
            </p>
          </div>
        )}

        {usuarioEditando && (
          // Solo al editar: quien se da de alta nace sin el permiso, y esto se enciende
          // después, cuando de verdad va a andar rodando entre clínicas.
          <div className="mc-form-group">
            <label className="mc-form-check" htmlFor="gu-cualquier-clinica">
              <input
                id="gu-cualquier-clinica"
                type="checkbox"
                checked={formData.puedeMarcarEnCualquierClinica}
                onChange={(e) => cambiarCampo("puedeMarcarEnCualquierClinica", e.target.checked)}
              />
              <span>Permitir marcar desde cualquier clínica</span>
            </label>
            <p className="mc-form-hint">
              Para quien va a apoyar a otras clínicas. Seguirá necesitando estar dentro del
              área de alguna clínica para poder checar, y su horario se sigue midiendo con
              el de {formData.sucursal || "su sucursal"}.
            </p>
          </div>
        )}
        {usuarioEditando && (
          <div className="mc-form-group">
            <label className="mc-form-check" htmlFor="gu-salida-libre">
              <input
                id="gu-salida-libre"
                type="checkbox"
                checked={formData.puedeMarcarSalidaSinGeocerca}
                onChange={(e) => cambiarCampo("puedeMarcarSalidaSinGeocerca", e.target.checked)}
              />
              <span>Permitir marcar salida sin importar dónde esté</span>
            </label>
            <p className="mc-form-hint">
              Solo afecta su salida — la entrada sigue exigiendo estar en una clínica. Su
              horario se sigue midiendo con el de {formData.sucursal || "su sucursal"}.
            </p>
          </div>
        )}
        {usuarioEditando && (
          <div className="mc-form-group">
            <label className="mc-form-check" htmlFor="gu-entrada-libre">
              <input
                id="gu-entrada-libre"
                type="checkbox"
                checked={formData.puedeMarcarEntradaLibre}
                onChange={(e) => cambiarCampo("puedeMarcarEntradaLibre", e.target.checked)}
              />
              <span>Permitir entrada sin geocerca ni retardo (bajo pedido)</span>
            </label>
            <p className="mc-form-hint">
              No queda siempre encendido: en su Checador va a ver un interruptor que ella
              misma prende antes de marcar, solo cuando lo necesite ese día. Con el
              interruptor prendido, la entrada se registra sin exigir ubicación y sin que
              salga como retardo, sin importar la hora real.
            </p>
          </div>
        )}

        {!usuarioEditando && (
          <p className="mc-form-hint mc-form-hint--warn">
            <Icon name="key" size={14} />
            <span>
              Se crea con la contraseña temporal <strong>emp123</strong>; el empleado tiene que
              cambiarla la primera vez que entre.
            </span>
          </p>
        )}

        <div className="mc-form-actions">
          <button type="button" className="mc-btn-secondary" onClick={cerrarModal}>Cancelar</button>
          <button type="submit" className="mc-btn-primary mc-btn-with-icon" disabled={loading}>
            <Icon name="check" size={16} />
            {loading ? "Guardando..." : usuarioEditando ? "Guardar cambios" : "Crear empleado"}
          </button>
        </div>
      </form>
    </div>
  </div>
);

/** Campo de formulario: etiqueta + control + ayuda/error. Evita repetir el mismo
 *  bloque nueve veces y hace que el error salga siempre en el mismo sitio. */
const Campo = ({ id, label, error, hint, children }) => (
  <div className="mc-form-group">
    <label className="mc-form-label" htmlFor={id}>{label}</label>
    {children}
    {error
      ? <p className="mc-form-hint mc-form-hint--error" role="alert">{error}</p>
      : hint ? <p className="mc-form-hint">{hint}</p> : null}
  </div>
);

export default GestionUsuarioModal;
