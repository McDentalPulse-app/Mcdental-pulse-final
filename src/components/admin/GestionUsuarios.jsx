import { useState } from "react";
import DateRangePicker from "../common/DateRangePicker";
import Select from "../common/Select";
import { useGlobal } from "../../contexts/GlobalContext";
import { useAuth } from "../../contexts/AuthContext";
import { useNotification } from "../../contexts/NotificationContext";
import { updateUsuario, crearUsuario, cambiarUsername } from "../../services/supabase/usuariosService";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { useBajaUsuario } from "../../hooks/useBajaUsuario";
import Card from "../common/Card";
import PageHeader from "../common/PageHeader";
import Badge from "../common/Badge";
import FilterBar from "../common/FilterBar";
import SectionTitle from "../common/SectionTitle";
import SortableTh from "../common/SortableTh";
import Avatar from "../ui/Avatar";
import Icon from "../ui/Icon";
import { SUCURSALES, normalizeSucursal, sucursalMatches } from "../../utils/constants";
import { resolveFechaCumpleanos, resolveFechaIngreso, normalizeFechaCumpleanosInput } from "../../utils/helpers";
import { validarFormularioUsuario, emailDeLogin, normalizarUsername } from "../../utils/validacionUsuario";

const ROLES = [
  { valor: "empleado", etiqueta: "Empleado" },
  { valor: "doctor", etiqueta: "Doctor" },
  { valor: "rh", etiqueta: "Recursos Humanos" },
  { valor: "psicologa", etiqueta: "Psicóloga" },
  { valor: "admin", etiqueta: "Administrador" },
];

// Admin_plus no entra en ROLES arriba: es un nivel aparte, no una opción más del selector de
// gestión — solo aparece para quien YA es admin_plus (ver rolesDisponibles).
const ROL_ADMIN_PLUS = { valor: "admin_plus", etiqueta: "Admin+" };

const DEFAULT_SUCURSAL = SUCURSALES[0];
const FILAS_POR_PAGINA = 12;

const GestionUsuarios = () => {
  const { usuarios, setUsuarios, nombresSucursales } = useGlobal();
  const { user, restablecerPasswordUsuario } = useAuth();
  const { toast } = useNotification();
  const { pedirBaja, restaurar, activar, eliminarDefinitivo } = useBajaUsuario();
  // Antes era `esAdmin` y valía solo para 'admin'. Con la paridad rh/psicologa = admin
  // (decisión del dueño, 2026-07-30; ver migración 099) los tres roles de gestión pueden
  // lo mismo, así que el nombre pasa a decir lo que de verdad comprueba.
  const esGestion = ["admin", "rh", "psicologa", "admin_plus"].includes(user?.role);
  // El borrado definitivo se queda FUERA de esa paridad: "rh y psico solo archivan, admin borra
  // definitivamente" (dueño, 2026-08-07). Esconder el botón no basta como seguridad — la Edge
  // Function admin-delete-usuario comprueba lo mismo—, pero es donde se ve la regla.
  const esAdmin = user?.role === "admin";
  // Admin+: nivel aparte de la paridad de gestión de arriba — ve/edita cuentas admin y
  // admin_plus, que para todos los demás (incluido admin normal) están fuera de esta
  // pantalla (mig. 140).
  const esAdminPlus = user?.role === "admin_plus";

  const [busqueda, setBusqueda] = useState("");
  const [filtroSucursal, setFiltroSucursal] = useState("Todas");
  const [filtroEstado, setFiltroEstado] = useState("vigentes");
  const [mostrarModal, setMostrarModal] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState(null);
  const [loading, setLoading] = useState(false);
  const [orden, setOrden] = useState({ columna: "name", direccion: "ascending" });
  const [pagina, setPagina] = useState(1);
  const [errores, setErrores] = useState({});

  const cerrarModal = () => { setMostrarModal(false); setErrores({}); };
  useEscapeKey(cerrarModal, mostrarModal);

  // Los usernames que ya están tomados (la columna tiene unique en la BD). Se excluye
  // el del usuario que se está editando, o "no cambiar nada" daría duplicado.
  const usernamesTomados = usuarios
    .filter((u) => u.id !== usuarioEditando?.id)
    .map((u) => u.user)
    .filter(Boolean);

  const [formData, setFormData] = useState({
    name: "",
    user: "",
    sucursal: DEFAULT_SUCURSAL,
    puesto: "Asistente Dental",
    role: "empleado",
    email: "",
    telefono: "",
    fechaIngreso: "",
    fechaCumpleanos: "",
    puedeGestionarBodega: false,
    puedeGestionarInventario: false,
    puedeCrearDepartamento: false,
    puedeMarcarEnCualquierClinica: false,
    puedeMarcarSalidaSinGeocerca: false,
    puedeMarcarEntradaLibre: false,
  });

  // Gestión (admin/rh/psicologa) puede asignar cualquier rol; el resto solo "empleado".
  // Antes esto era exclusivo de admin y lo respaldaba la edge function admin-create-usuario
  // con un 403; esa guarda se retiró en la migración 099. Al editar se conserva el rol
  // actual como opción, para no degradar a un doctor por no tener ese valor en la lista.
  const rolesDisponibles = esGestion
    ? (esAdminPlus ? [...ROLES, ROL_ADMIN_PLUS] : ROLES)
    : ROLES.filter((r) => r.valor === "empleado" || r.valor === formData.role);
  const rolBloqueado = !esGestion && formData.role !== "empleado";

  const hoyISO = new Date().toISOString().slice(0, 10);
  const loginPrevisto = emailDeLogin(formData.user);

  const cambiarCampo = (campo, valor) => {
    setFormData((prev) => ({ ...prev, [campo]: valor }));
    // El error se limpia al corregir, no al re-enviar: quedarse con el mensaje viejo
    // mientras ya se está escribiendo la corrección es ruido.
    setErrores((prev) => (prev[campo] ? { ...prev, [campo]: undefined } : prev));
  };

  // Los archivados no se mezclan con los vigentes: hay que pedirlos con el filtro.
  // Así una baja no ensucia la lista del día a día, pero tampoco se pierde.
  const coincideEstado = (u) => {
    if (filtroEstado === "archivados") return !!u.archivado;
    if (filtroEstado === "inactivos") return !u.archivado && !!u.inactivo;
    if (filtroEstado === "activos") return !u.archivado && !u.inactivo;
    return !u.archivado; // "vigentes": activos + inactivos, sin archivados
  };

  // admin y admin_plus quedan fuera de esta pantalla para todos MENOS admin_plus (mig. 140):
  // ni un admin normal puede ver o tocar a otro admin aquí.
  const esRolProtegido = (rol) => rol === "admin" || rol === "admin_plus";

  const empleados = usuarios.filter(u =>
    (esAdminPlus || !esRolProtegido(u.role)) &&
    u.name?.toLowerCase().includes(busqueda.toLowerCase()) &&
    (filtroSucursal === "Todas" || sucursalMatches(u.sucursal, filtroSucursal)) &&
    coincideEstado(u)
  );

  const archivadosTotal = usuarios.filter((u) => (esAdminPlus || !esRolProtegido(u.role)) && u.archivado).length;

  // Orden por columna: todo texto salvo "estado", que ordena por el booleano
  // `inactivo` para poder juntar arriba a los activos (o a los de baja).
  const factorOrden = orden.direccion === "descending" ? -1 : 1;
  const ordenados = [...empleados].sort((a, b) => {
    if (orden.columna === "estado") {
      return (Number(!!a.inactivo) - Number(!!b.inactivo)) * factorOrden;
    }
    const campoA = orden.columna === "sucursal" ? normalizeSucursal(a.sucursal) : a[orden.columna] || "";
    const campoB = orden.columna === "sucursal" ? normalizeSucursal(b.sucursal) : b[orden.columna] || "";
    return String(campoA).localeCompare(String(campoB)) * factorOrden;
  });

  const totalPaginas = Math.max(1, Math.ceil(ordenados.length / FILAS_POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const paginados = ordenados.slice((paginaActual - 1) * FILAS_POR_PAGINA, paginaActual * FILAS_POR_PAGINA);

  const alternarOrden = (columna) => {
    setPagina(1);
    setOrden((prev) =>
      prev.columna === columna
        ? { columna, direccion: prev.direccion === "ascending" ? "descending" : "ascending" }
        : { columna, direccion: "ascending" }
    );
  };

  const abrirModal = (empleado = null) => {
    setErrores({});
    if (empleado) {
      setUsuarioEditando(empleado);
      setFormData({
        name: empleado.name || "",
        user: empleado.user || "",
        sucursal: normalizeSucursal(empleado.sucursal) || DEFAULT_SUCURSAL,
        puesto: empleado.puesto || "Asistente Dental",
        role: empleado.role || "empleado",
        email: empleado.email || "",
        telefono: empleado.telefono || "",
        fechaIngreso: resolveFechaIngreso(empleado),
        fechaCumpleanos: resolveFechaCumpleanos(empleado),
        puedeGestionarBodega: !!empleado.puedeGestionarBodega,
        puedeGestionarInventario: !!empleado.puedeGestionarInventario,
        puedeCrearDepartamento: !!empleado.puedeCrearDepartamento,
        puedeMarcarEnCualquierClinica: !!empleado.puedeMarcarEnCualquierClinica,
        puedeMarcarSalidaSinGeocerca: !!empleado.puedeMarcarSalidaSinGeocerca,
        puedeMarcarEntradaLibre: !!empleado.puedeMarcarEntradaLibre,
      });
    } else {
      setUsuarioEditando(null);
      setFormData({
        name: "",
        user: "",
        sucursal: DEFAULT_SUCURSAL,
        puesto: "Asistente Dental",
        role: "empleado",
        email: "",
        telefono: "",
        fechaIngreso: "",
        fechaCumpleanos: "",
        puedeGestionarBodega: false,
        puedeGestionarInventario: false,
        puedeCrearDepartamento: false,
        puedeMarcarEnCualquierClinica: false,
        puedeMarcarSalidaSinGeocerca: false,
        puedeMarcarEntradaLibre: false,
      });
    }
    setMostrarModal(true);
  };

  const guardarUsuario = async (e) => {
    e.preventDefault();

    const encontrados = validarFormularioUsuario(formData, {
      existentes: usernamesTomados,
      hoyISO,
    });
    if (Object.keys(encontrados).length > 0) {
      setErrores(encontrados);
      toast.error("Revisá los campos marcados.");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        ...formData,
        // Se manda ya normalizado: el backend lo sanea igual, pero borrando los acentos
        // en vez de convertirlos, y el usuario acabaría con un login que no es el que
        // se ve en pantalla.
        user: normalizarUsername(formData.user),
        name: formData.name.trim(),
        puesto: formData.puesto.trim(),
        email: formData.email.trim(),
        telefono: formData.telefono.trim(),
        fechaIngreso: formData.fechaIngreso || "",
        fechaCumpleanos: normalizeFechaCumpleanosInput(formData.fechaCumpleanos),
      };

      if (usuarioEditando) {
        // El username es la credencial de login (email sintético en Auth):
        // si cambió, va primero por la edge function que sincroniza Auth + BD.
        // Las dos mitades de la comparación tienen que estar normalizadas. `payload.user`
        // ya pasó por normalizarUsername() (espacios -> puntos, sin acentos), pero el
        // username GUARDADO no: la migración de Firestore dejó 101 de 106 con espacio
        // ("maria treto"), y su correo de acceso ya era el normalizado
        // ("maria.treto@mcdental.internal"). Comparar uno contra otro daba SIEMPRE
        // "cambió" al abrir y guardar cualquiera de esos 101, sin tocar el campo:
        //   - psicologa -> 403 "No tienes permiso para cambiar nombres de usuario"
        //   - rh/admin  -> pasaba, y RENOMBRABA la credencial en silencio
        // Normalizando ambos lados, un cambio real se sigue detectando y uno inventado no.
        const usernameNuevo = normalizarUsername(payload.user || "");
        const usernameCambio = usernameNuevo && usernameNuevo !== normalizarUsername(usuarioEditando.user || "");
        if (usernameCambio) {
          await cambiarUsername(usuarioEditando.id, usernameNuevo);
        }
        const actualizado = await updateUsuario(usuarioEditando.id, payload);
        const conUsername = usernameCambio ? { ...actualizado, user: usernameNuevo } : actualizado;
        setUsuarios(prev => prev.map(u => u.id === usuarioEditando.id ? conUsername : u));
        toast.success(usernameCambio
          ? `Usuario actualizado. Nuevo nombre de acceso: ${usernameNuevo}`
          : "Usuario actualizado con éxito.");
      } else {
        const nuevoUsuario = await crearUsuario(payload);
        setUsuarios(prev => [...prev, nuevoUsuario]);
        toast.success("Usuario creado con éxito. Contraseña inicial: emp123");
      }
      cerrarModal();
    } catch (error) {
      console.error("Error guardando usuario:", error);
      toast.error(error?.message || "Hubo un error al guardar el usuario.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="list-page gestion-personal-page">
      <PageHeader
        icon="userCog"
        title="Gestión de Personal"
        subtitle="Administra usuarios, roles y accesos del sistema."
      >
        <button type="button" className="mc-btn-primary mc-btn-with-icon" onClick={() => abrirModal()}>
          <Icon name="plus" size={16} /> Añadir empleado
        </button>
      </PageHeader>

      <Card className="gestion-personal-card table-card-body">
        <FilterBar
          search={{ value: busqueda, onChange: setBusqueda, placeholder: "Buscar empleado por nombre..." }}
        >
          <Select
            value={filtroSucursal}
            onChange={(valor) => { setFiltroSucursal(valor); setPagina(1); }}
          >
            <option value="Todas">Todas las sucursales</option>
            {nombresSucursales.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>

          <Select
            value={filtroEstado}
            onChange={(valor) => { setFiltroEstado(valor); setPagina(1); }}
          >
            <option value="vigentes">Vigentes (activos e inactivos)</option>
            <option value="activos">Solo activos</option>
            <option value="inactivos">Solo inactivos</option>
            <option value="archivados">Archivados{archivadosTotal ? ` (${archivadosTotal})` : ""}</option>
          </Select>
        </FilterBar>

        <div className="list-filter-count">
          Mostrando {paginados.length} de {ordenados.length} empleados
          {filtroEstado === "archivados" && " archivados"}
        </div>

        {/* Misma tabla que /empleados (clases .emp-table*, compartidas): encabezados
            ordenables, avatar en la fila y acciones como botones de ícono. */}
        <div className="emp-table-scroll gestion-personal-desktop-only">
          <table className="emp-table">
            <thead>
              <tr>
                <SortableTh id="name" label="Nombre" orden={orden} onSort={alternarOrden} className="emp-table-th--nombre" />
                <SortableTh id="user" label="Usuario" orden={orden} onSort={alternarOrden} />
                <SortableTh id="sucursal" label="Sucursal" orden={orden} onSort={alternarOrden} className="emp-table-th--sucursal" />
                <SortableTh id="role" label="Rol" orden={orden} onSort={alternarOrden} />
                <SortableTh id="estado" label="Estado" orden={orden} onSort={alternarOrden} />
                <th className="emp-table-th emp-table-th--acciones" />
              </tr>
            </thead>
            <tbody>
              {paginados.map(emp => (
                <tr key={emp.id} className="emp-table-row emp-table-row--estatica">
                  <td>
                    <div className="emp-table-nombre">
                      <Avatar name={emp.name} size={32} photoUrl={emp.avatarUrl} />
                      <span className="emp-table-nombre-texto">{emp.name}</span>
                    </div>
                  </td>
                  <td className="emp-table-nowrap">@{emp.user}</td>
                  <td className="emp-table-nowrap emp-table-th--sucursal">{normalizeSucursal(emp.sucursal)}</td>
                  <td>
                    <span className={`mc-tag ${!["empleado", "doctor"].includes(emp.role) ? "mc-tag--role-privileged" : ""}`}>
                      {emp.role}
                    </span>
                  </td>
                  <td>
                    <Badge variant={emp.archivado ? "rechazado" : emp.inactivo ? "inactivo" : "activo"}>
                      {emp.archivado ? "Archivado" : emp.inactivo ? "Inactivo" : "Activo"}
                    </Badge>
                  </td>
                  <td className="emp-table-acciones">
                    <div className="emp-table-acciones-grupo">
                      <button
                        type="button"
                        className="emp-table-icon-btn"
                        title="Editar"
                        aria-label={`Editar a ${emp.name}`}
                        onClick={() => abrirModal(emp)}
                      >
                        <Icon name="userCog" size={15} />
                      </button>
                      {esGestion && (
                        <button
                          type="button"
                          className="emp-table-icon-btn emp-table-icon-btn--amber"
                          title="Restablecer contraseña"
                          aria-label={`Restablecer contraseña de ${emp.name}`}
                          onClick={() => restablecerPasswordUsuario(emp)}
                        >
                          <Icon name="key" size={15} />
                        </button>
                      )}
                      {emp.archivado ? (
                        <>
                          <button
                            type="button"
                            className="emp-table-icon-btn emp-table-icon-btn--ok"
                            title="Restaurar"
                            aria-label={`Restaurar a ${emp.name}`}
                            onClick={() => restaurar(emp)}
                          >
                            <Icon name="refresh" size={15} />
                          </button>
                          {(esAdmin || esAdminPlus) && (
                            // Icono distinto al de "dar de baja" a propósito: ese trash significa
                            // algo reversible, y quien lo tenga aprendido no debe leer lo mismo aquí.
                            <button
                              type="button"
                              className="emp-table-icon-btn emp-table-icon-btn--danger"
                              title="Borrar definitivamente"
                              aria-label={`Borrar definitivamente a ${emp.name}`}
                              onClick={() => eliminarDefinitivo(emp)}
                            >
                              <Icon name="xCircle" size={15} />
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          {emp.inactivo && (
                            <button
                              type="button"
                              className="emp-table-icon-btn emp-table-icon-btn--ok"
                              title="Activar"
                              aria-label={`Activar a ${emp.name}`}
                              onClick={() => activar(emp)}
                            >
                              <Icon name="check" size={15} />
                            </button>
                          )}
                          <button
                            type="button"
                            className="emp-table-icon-btn emp-table-icon-btn--danger"
                            title="Dar de baja (desactivar o archivar)"
                            aria-label={`Dar de baja a ${emp.name}`}
                            onClick={() => pedirBaja(emp)}
                          >
                            <Icon name="trash" size={15} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {paginados.length === 0 && (
                <tr>
                  <td colSpan="6" className="emp-table-vacio">No se encontraron empleados.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="gestion-personal-mobile-list">
          {paginados.length === 0 ? (
            <p className="gestion-personal-mobile-empty">No se encontraron empleados.</p>
          ) : (
            paginados.map((emp) => (
              <div key={emp.id} className="gestion-personal-mobile-card mc-row-hover">
                <div className="gestion-personal-mobile-head">
                  <div className="gestion-personal-mobile-main">
                    <div className="gestion-personal-mobile-name">{emp.name}</div>
                    <div className="gestion-personal-mobile-user">@{emp.user}</div>
                  </div>
                  <Badge variant={emp.archivado ? "rechazado" : emp.inactivo ? "inactivo" : "activo"}>
                    {emp.archivado ? "Archivado" : emp.inactivo ? "Inactivo" : "Activo"}
                  </Badge>
                </div>
                <div className="gestion-personal-mobile-meta">
                  <span className={`mc-tag ${!["empleado", "doctor"].includes(emp.role) ? "mc-tag--role-privileged" : ""}`}>{emp.role}</span>
                  <span className="gestion-personal-mobile-sucursal">{normalizeSucursal(emp.sucursal)}</span>
                </div>
                <div className="gestion-personal-mobile-actions">
                  <button
                    type="button"
                    className="mc-btn-outline mc-btn-outline--edit"
                    onClick={() => abrirModal(emp)}
                  >
                    Editar
                  </button>
                  {esGestion && (
                    <button
                      type="button"
                      className="mc-btn-outline mc-btn-outline--amber"
                      onClick={() => restablecerPasswordUsuario(emp)}
                    >
                      Contraseña
                    </button>
                  )}
                  {emp.archivado ? (
                    <>
                      <button
                        type="button"
                        className="mc-btn-outline mc-btn-outline--edit"
                        onClick={() => restaurar(emp)}
                      >
                        Restaurar
                      </button>
                      {(esAdmin || esAdminPlus) && (
                        <button
                          type="button"
                          className="mc-btn-outline mc-btn-outline--danger"
                          onClick={() => eliminarDefinitivo(emp)}
                        >
                          Borrar
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      {emp.inactivo && (
                        <button
                          type="button"
                          className="mc-btn-outline mc-btn-outline--edit"
                          onClick={() => activar(emp)}
                        >
                          Activar
                        </button>
                      )}
                      <button
                        type="button"
                        className="mc-btn-outline mc-btn-outline--danger"
                        onClick={() => pedirBaja(emp)}
                      >
                        Dar de baja
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {totalPaginas > 1 && (
          <div className="emp-table-paginacion">
            <button type="button" className="mc-btn-outline" disabled={paginaActual === 1} onClick={() => setPagina(paginaActual - 1)}>
              Anterior
            </button>
            <span className="emp-table-paginacion-texto">Página {paginaActual} de {totalPaginas}</span>
            <button type="button" className="mc-btn-outline" disabled={paginaActual === totalPaginas} onClick={() => setPagina(paginaActual + 1)}>
              Siguiente
            </button>
          </div>
        )}
      </Card>

      {mostrarModal && (
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
      )}
    </div>
  );
};

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

export default GestionUsuarios;
