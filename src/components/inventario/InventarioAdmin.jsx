import { useEffect, useState } from "react";
import PageHeader from "../common/PageHeader";
import Card from "../common/Card";
import SectionTitle from "../common/SectionTitle";
import Select from "../common/Select";
import Badge from "../common/Badge";
import FilterBar from "../common/FilterBar";
import Icon from "../ui/Icon";
import Avatar from "../ui/Avatar";
import { useGlobal } from "../../contexts/GlobalContext";
import { useNotification } from "../../contexts/NotificationContext";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { getMateriales, addMaterial, updateMaterial, eliminarMaterial, subirImagenMaterial } from "../../services/supabase/materialesService";
import { getInventarioTodasSucursales, ajustarInventario } from "../../services/supabase/inventarioService";
import { getPedidos, addPedido } from "../../services/supabase/pedidosService";
import { bloquearNotacionCientifica } from "../../utils/inputNumerico";
import BitacoraInventario from "./BitacoraInventario";
import StockBar from "./StockBar";

const ESTADO_LABEL = { pendiente: "Pendiente", enviado: "Enviado", rechazado: "Rechazado", cancelado: "Cancelado" };
const ESTADO_PILL = { pendiente: "pendiente", enviado: "aprobado", rechazado: "rechazado", cancelado: "cancelado" };
// "unidad", "pqt" y "set" son las que de verdad trae el catálogo importado del Excel
// (32 de 34 materiales) — sin ellas el select de "Editar" no encontraba coincidencia y se
// veía vacío aunque el material sí tenía unidad guardada.
const UNIDADES = ["unidad", "pqt", "set", "pieza", "caja", "paquete", "frasco", "rollo", "kg", "litro"];

const MATERIAL_VACIO = { nombre: "", unidadMedida: UNIDADES[0], umbralStockBajo: "" };
const AJUSTE_VACIO = { sucursal: "", cantidad: "", nota: "" };
const FILAS_POR_PAGINA = 10;

/**
 * Admin: catálogo de materiales de las 26 clínicas (tabla, estilo Gestión de Personal) y
 * pedidos especiales (`origen='admin'`) — bodega los ve marcados "Pedido directo del admin".
 * Ver por clínica, ajustar stock, editar material y subir foto viven en modales — antes eran
 * 6 cards de formulario siempre abiertas.
 */
export default function InventarioAdmin() {
  const { sucursales } = useGlobal();
  const { toast, confirm } = useNotification();

  const [materiales, setMateriales] = useState([]);
  const [inventario, setInventario] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [cargando, setCargando] = useState(true);

  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("activos");
  const [pagina, setPagina] = useState(1);

  // Modal "Agregar/editar material" (crea si materialEditando es null).
  const [modalMaterial, setModalMaterial] = useState(false);
  const [materialEditando, setMaterialEditando] = useState(null);
  const [formMaterial, setFormMaterial] = useState(MATERIAL_VACIO);
  const [guardandoMaterial, setGuardandoMaterial] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  // Modal "Ver por clínica": comparación de stock de UN material en las 26 clínicas.
  const [materialVerClinica, setMaterialVerClinica] = useState(null);

  // Modal "Ajustar stock": material ya viene fijo de la fila que lo abrió.
  const [materialAjustando, setMaterialAjustando] = useState(null);
  const [ajuste, setAjuste] = useState(AJUSTE_VACIO);
  const [guardandoAjuste, setGuardandoAjuste] = useState(false);

  // Modal "Pedido especial".
  const [modalPedido, setModalPedido] = useState(false);
  const [pedidoSucursal, setPedidoSucursal] = useState("");
  const [lineasPedido, setLineasPedido] = useState([{ materialId: "", cantidad: "" }]);
  const [comentarioPedido, setComentarioPedido] = useState("");
  const [guardandoPedido, setGuardandoPedido] = useState(false);

  const algunModalAbierto = modalMaterial || !!materialVerClinica || !!materialAjustando || modalPedido;
  useEscapeKey(() => {
    setModalMaterial(false);
    setMaterialVerClinica(null);
    setMaterialAjustando(null);
    setModalPedido(false);
  }, algunModalAbierto);

  const cargar = async () => {
    setCargando(true);
    try {
      const [mats, inv, peds] = await Promise.all([getMateriales(), getInventarioTodasSucursales(), getPedidos()]);
      setMateriales(mats);
      setInventario(inv);
      setPedidos(peds);
    } catch (error) {
      toast.error(error?.message || "No se pudo cargar el inventario.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { (async () => { await cargar(); })(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Total por material sumando las 26 clínicas — lo que llega en `inventario` es una fila por
  // clínica×material, así que se agrupa acá en vez de pedirle otra vista a la base.
  const stockTotalPorMaterial = new Map();
  for (const it of inventario) {
    const actual = stockTotalPorMaterial.get(it.materialId) ?? 0;
    stockTotalPorMaterial.set(it.materialId, actual + it.cantidadActual);
  }

  const materialesFiltrados = materiales
    .filter((m) => m.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    .filter((m) => (filtroEstado === "todos" ? true : filtroEstado === "activos" ? m.activo : !m.activo))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  const totalPaginas = Math.max(1, Math.ceil(materialesFiltrados.length / FILAS_POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const materialesPaginados = materialesFiltrados.slice(
    (paginaActual - 1) * FILAS_POR_PAGINA,
    paginaActual * FILAS_POR_PAGINA,
  );

  const inventarioDe = (materialId) => inventario.filter((it) => it.materialId === materialId);

  // --- Modal material (crear/editar + foto) ---

  const abrirModalMaterial = (material = null) => {
    setMaterialEditando(material);
    setFormMaterial(
      material
        ? { nombre: material.nombre, unidadMedida: material.unidadMedida, umbralStockBajo: String(material.umbralStockBajo) }
        : MATERIAL_VACIO,
    );
    setModalMaterial(true);
  };
  const cerrarModalMaterial = () => { setModalMaterial(false); setMaterialEditando(null); };

  const guardarMaterial = async (e) => {
    e.preventDefault();
    if (!formMaterial.nombre.trim()) { toast.warning("Escribe el nombre del material."); return; }
    setGuardandoMaterial(true);
    try {
      if (materialEditando) {
        await updateMaterial({
          id: materialEditando.id,
          nombre: formMaterial.nombre,
          unidadMedida: formMaterial.unidadMedida,
          umbralStockBajo: Number(formMaterial.umbralStockBajo) || 0,
        });
        toast.success("Material actualizado.");
      } else {
        await addMaterial({
          nombre: formMaterial.nombre,
          unidadMedida: formMaterial.unidadMedida,
          umbralStockBajo: Number(formMaterial.umbralStockBajo) || 0,
        });
        toast.success("Material agregado al catálogo.");
      }
      setMateriales(await getMateriales());
      cerrarModalMaterial();
    } catch (error) {
      toast.error(error?.message || "No se pudo guardar el material.");
    } finally {
      setGuardandoMaterial(false);
    }
  };

  const handleSubirFoto = async (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = ""; // permite reelegir el mismo archivo luego
    if (!archivo || !materialEditando) return;
    setSubiendoFoto(true);
    try {
      const imagenUrl = await subirImagenMaterial(materialEditando.id, archivo);
      setMateriales(await getMateriales());
      setMaterialEditando((prev) => (prev ? { ...prev, imagenUrl } : prev));
      toast.success("Foto actualizada.");
    } catch (error) {
      toast.error(error?.message || "No se pudo subir la foto.");
    } finally {
      setSubiendoFoto(false);
    }
  };

  // Borrado real, no desactivación (decisión del dueño, 2026-08-26): si el material ya
  // tuvo movimientos de stock, se van con él. Si ya se pidió alguna vez, la base lo rechaza
  // y se muestra el motivo (ver eliminarMaterial en materialesService.js).
  const eliminar = async (material) => {
    const confirmar = await confirm({
      title: "Eliminar material",
      description: `"${material.nombre}" se borra por completo, junto con su stock y movimientos registrados. Esto no se puede deshacer.`,
      variant: "danger",
      confirmText: "Eliminar",
    });
    if (!confirmar) return;
    try {
      await eliminarMaterial(material.id);
      setMateriales(await getMateriales());
      setInventario(await getInventarioTodasSucursales());
      toast.success("Material eliminado.");
    } catch (error) {
      toast.error(error?.message || "No se pudo eliminar el material.");
    }
  };

  // --- Modal ajustar stock (material fijo, viene de la fila) ---

  const abrirAjuste = (material) => { setMaterialAjustando(material); setAjuste(AJUSTE_VACIO); };
  const cerrarAjuste = () => { setMaterialAjustando(null); setAjuste(AJUSTE_VACIO); };

  const guardarAjuste = async (e) => {
    e.preventDefault();
    if (!ajuste.sucursal || !ajuste.cantidad) { toast.warning("Elige clínica y cantidad."); return; }
    setGuardandoAjuste(true);
    try {
      const sucursalId = sucursales.find((s) => s.nombre === ajuste.sucursal)?.id;
      await ajustarInventario({
        sucursalId,
        materialId: materialAjustando.id,
        cantidad: Number(ajuste.cantidad),
        nota: ajuste.nota,
      });
      setInventario(await getInventarioTodasSucursales());
      toast.success("Stock ajustado.");
      cerrarAjuste();
    } catch (error) {
      toast.error(error?.message || "No se pudo ajustar el stock.");
    } finally {
      setGuardandoAjuste(false);
    }
  };

  // --- Modal pedido especial ---

  const cambiarLinea = (i, campo, valor) =>
    setLineasPedido((prev) => prev.map((l, idx) => (idx === i ? { ...l, [campo]: valor } : l)));
  const agregarLinea = () => setLineasPedido((prev) => [...prev, { materialId: "", cantidad: "" }]);
  const quitarLinea = (i) => setLineasPedido((prev) => prev.filter((_, idx) => idx !== i));

  const cerrarModalPedido = () => {
    setModalPedido(false);
    setPedidoSucursal("");
    setLineasPedido([{ materialId: "", cantidad: "" }]);
    setComentarioPedido("");
  };

  const crearPedidoEspecial = async (e) => {
    e.preventDefault();
    if (!pedidoSucursal) { toast.warning("Elige a qué clínica va el pedido."); return; }
    const items = lineasPedido
      .filter((l) => l.materialId && l.cantidad)
      .map((l) => ({ materialId: l.materialId, cantidad: Number(l.cantidad) }));
    if (!items.length) { toast.warning("Agrega al menos un material con cantidad."); return; }

    setGuardandoPedido(true);
    try {
      const sucursalId = sucursales.find((s) => s.nombre === pedidoSucursal)?.id;
      await addPedido({ sucursalId, items, comentario: comentarioPedido });
      setPedidos(await getPedidos());
      toast.success("Pedido especial enviado a bodega.");
      cerrarModalPedido();
    } catch (error) {
      toast.error(error?.message || "No se pudo crear el pedido.");
    } finally {
      setGuardandoPedido(false);
    }
  };

  return (
    <div className="admin-page">
      <PageHeader icon="package" title="Inventario" subtitle="Catálogo y pedidos de las 26 clínicas">
        <button type="button" className="mc-btn-outline mc-btn-with-icon" onClick={() => setModalPedido(true)}>
          <Icon name="shieldAlert" size={16} /> Pedido especial
        </button>
        <button type="button" className="mc-btn-primary mc-btn-with-icon" onClick={() => abrirModalMaterial()}>
          <Icon name="plus" size={16} /> Agregar material
        </button>
      </PageHeader>

      {cargando ? (
        <Card><p className="mc-empty">Cargando…</p></Card>
      ) : (
        <>
          <Card className="table-card-body">
            <FilterBar search={{ value: busqueda, onChange: (v) => { setBusqueda(v); setPagina(1); }, placeholder: "Buscar material por nombre..." }}>
              <Select value={filtroEstado} onChange={(v) => { setFiltroEstado(v); setPagina(1); }}>
                <option value="activos">Activos</option>
                <option value="inactivos">Inactivos</option>
                <option value="todos">Todos</option>
              </Select>
            </FilterBar>

            <div className="list-filter-count">
              Mostrando {materialesPaginados.length} de {materialesFiltrados.length} materiales
            </div>

            <div className="emp-table-scroll">
              <table className="emp-table">
                <thead>
                  <tr>
                    <th className="emp-table-th emp-table-th--nombre">Material</th>
                    <th className="emp-table-th">Unidad</th>
                    <th className="emp-table-th">Umbral aviso</th>
                    <th className="emp-table-th">Stock total</th>
                    <th className="emp-table-th">Estado</th>
                    <th className="emp-table-th emp-table-th--acciones" />
                  </tr>
                </thead>
                <tbody>
                  {materialesPaginados.map((m) => (
                    <tr key={m.id} className="emp-table-row emp-table-row--estatica">
                      <td>
                        <div className="emp-table-nombre">
                          <Avatar name={m.nombre} photoUrl={m.imagenUrl} size={32} />
                          <span className="emp-table-nombre-texto">{m.nombre}</span>
                        </div>
                      </td>
                      <td className="emp-table-nowrap">{m.unidadMedida}</td>
                      <td className="emp-table-nowrap">{m.umbralStockBajo}</td>
                      <td className="emp-table-nowrap">{stockTotalPorMaterial.get(m.id) ?? 0}</td>
                      <td>
                        <Badge variant={m.activo ? "activo" : "inactivo"}>{m.activo ? "Activo" : "Inactivo"}</Badge>
                      </td>
                      <td className="emp-table-acciones">
                        <div className="emp-table-acciones-grupo">
                          <button
                            type="button"
                            className="emp-table-icon-btn"
                            title="Ver por clínica"
                            aria-label={`Ver stock de ${m.nombre} por clínica`}
                            onClick={() => setMaterialVerClinica(m)}
                          >
                            <Icon name="eye" size={15} />
                          </button>
                          <button
                            type="button"
                            className="emp-table-icon-btn"
                            title="Ajustar stock"
                            aria-label={`Ajustar stock de ${m.nombre}`}
                            onClick={() => abrirAjuste(m)}
                          >
                            <Icon name="clipboardCheck" size={15} />
                          </button>
                          <button
                            type="button"
                            className="emp-table-icon-btn"
                            title="Editar"
                            aria-label={`Editar ${m.nombre}`}
                            onClick={() => abrirModalMaterial(m)}
                          >
                            <Icon name="edit" size={15} />
                          </button>
                          <button
                            type="button"
                            className="emp-table-icon-btn emp-table-icon-btn--danger"
                            title="Eliminar"
                            aria-label={`Eliminar ${m.nombre}`}
                            onClick={() => eliminar(m)}
                          >
                            <Icon name="trash" size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {materialesFiltrados.length === 0 && (
                    <tr>
                      <td colSpan="6" className="emp-table-vacio">No se encontraron materiales.</td>
                    </tr>
                  )}
                </tbody>
              </table>
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

          <Card>
            <SectionTitle icon="clipboardCheck">Todos los pedidos</SectionTitle>
            <div className="rh-data-list">
              {pedidos.length === 0 && <p className="mc-empty">Sin pedidos todavía.</p>}
              {pedidos.map((p) => (
                <div key={p.id} className="rh-data-row">
                  <div className="rh-data-row-main">
                    <div className="rh-data-row-title">
                      {p.sucursal} · {p.items.map((it) => it.material).join(", ")}
                    </div>
                    <div className="rh-data-row-sub">
                      {p.origen === "admin" ? "Pedido especial" : `Recepción · ${p.solicitante}`}
                      {p.fechaEstimadaEntrega ? ` · Estimado: ${p.fechaEstimadaEntrega}` : ""}
                    </div>
                  </div>
                  <div className="rh-data-row-status">
                    <span className={`mc-status-pill mc-status-pill--${ESTADO_PILL[p.estado]}`}>
                      {ESTADO_LABEL[p.estado]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <BitacoraInventario />
        </>
      )}

      {modalMaterial && (
        <div className="mc-modal-overlay" onClick={cerrarModalMaterial} role="presentation">
          <div className="mc-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="material-modal-title">
            <h2 id="material-modal-title" className="mc-modal-title mc-btn-with-icon">
              <Icon name="clipboard" size={20} />
              {materialEditando ? "Editar material" : "Agregar material"}
            </h2>
            {materialEditando && (
              <div className="mc-form-group" style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
                <Avatar name={materialEditando.nombre} photoUrl={materialEditando.imagenUrl} size={56} />
                <label className="perfil-foto-btn perfil-foto-btn--primary" aria-disabled={subiendoFoto}>
                  <Icon name={subiendoFoto ? "clock" : "camera"} size={14} />
                  {subiendoFoto ? "Subiendo…" : (materialEditando.imagenUrl ? "Cambiar foto" : "Subir foto")}
                  <input type="file" accept="image/*" hidden disabled={subiendoFoto} onChange={handleSubirFoto} />
                </label>
              </div>
            )}
            <form onSubmit={guardarMaterial} className="mc-form-grid">
              <div className="mc-form-group">
                <label className="mc-form-label" htmlFor="mat-nombre">Nombre</label>
                <input
                  id="mat-nombre"
                  type="text"
                  autoFocus
                  className="mc-form-input"
                  value={formMaterial.nombre}
                  onChange={(e) => setFormMaterial((p) => ({ ...p, nombre: e.target.value }))}
                />
              </div>
              <div className="mc-form-row-2">
                <div className="mc-form-group">
                  <label className="mc-form-label" htmlFor="mat-unidad">Unidad</label>
                  <Select
                    id="mat-unidad"
                    value={formMaterial.unidadMedida}
                    onChange={(v) => setFormMaterial((p) => ({ ...p, unidadMedida: v }))}
                  >
                    {UNIDADES.map((u) => (<option key={u} value={u}>{u}</option>))}
                  </Select>
                </div>
                <div className="mc-form-group">
                  <label className="mc-form-label" htmlFor="mat-umbral">Avisar si quedan menos de</label>
                  <input
                    id="mat-umbral"
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    className="mc-form-input"
                    onKeyDown={bloquearNotacionCientifica}
                    value={formMaterial.umbralStockBajo}
                    onChange={(e) => setFormMaterial((p) => ({ ...p, umbralStockBajo: e.target.value }))}
                  />
                </div>
              </div>
              <div className="mc-form-actions">
                <button type="button" className="mc-btn-secondary" onClick={cerrarModalMaterial}>Cancelar</button>
                <button type="submit" className="mc-btn-primary" disabled={guardandoMaterial}>
                  {guardandoMaterial ? "Guardando…" : materialEditando ? "Guardar cambios" : "Agregar material"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {materialVerClinica && (
        <div className="mc-modal-overlay" onClick={() => setMaterialVerClinica(null)} role="presentation">
          <div className="mc-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="ver-clinica-title">
            <h2 id="ver-clinica-title" className="mc-modal-title mc-btn-with-icon">
              <Icon name="eye" size={20} /> {materialVerClinica.nombre} por clínica
            </h2>
            <div className="rh-data-list">
              {inventarioDe(materialVerClinica.id).length === 0 && <p className="mc-empty">Sin movimientos todavía.</p>}
              {[...inventarioDe(materialVerClinica.id)]
                .sort((a, b) => (a.cantidadActual <= a.umbralStockBajo) === (b.cantidadActual <= b.umbralStockBajo)
                  ? 0
                  : a.cantidadActual <= a.umbralStockBajo ? -1 : 1)
                .map((it) => (
                  <div key={it.sucursalId} className="rh-data-row">
                    <div className="rh-data-row-main">
                      <div className="rh-data-row-title">{sucursales.find((s) => s.id === it.sucursalId)?.nombre}</div>
                    </div>
                    <div className="rh-data-row-status">
                      <StockBar actual={it.cantidadActual} umbral={it.umbralStockBajo} unidad={it.unidadMedida} />
                    </div>
                  </div>
              ))}
            </div>
            <div className="mc-form-actions">
              <button type="button" className="mc-btn-secondary" onClick={() => setMaterialVerClinica(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {materialAjustando && (
        <div className="mc-modal-overlay" onClick={cerrarAjuste} role="presentation">
          <div className="mc-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="ajuste-title">
            <h2 id="ajuste-title" className="mc-modal-title mc-btn-with-icon">
              <Icon name="clipboardCheck" size={20} /> Ajustar stock — {materialAjustando.nombre}
            </h2>
            <p className="mc-hint">
              Carga rápida de stock (conteo inicial) o corrección puntual, sin pasar por pedido.
              Cantidad negativa resta.
            </p>
            <form onSubmit={guardarAjuste} className="mc-form-grid">
              <div className="mc-form-group">
                <label className="mc-form-label" htmlFor="ajuste-suc">Clínica</label>
                <Select id="ajuste-suc" value={ajuste.sucursal} onChange={(v) => setAjuste((p) => ({ ...p, sucursal: v }))}>
                  <option value="">Elige…</option>
                  {sucursales.map((s) => (<option key={s.id} value={s.nombre}>{s.nombre}</option>))}
                </Select>
              </div>
              <div className="mc-form-row-2">
                <div className="mc-form-group">
                  <label className="mc-form-label" htmlFor="ajuste-cantidad">Cantidad (negativa para restar)</label>
                  <input
                    id="ajuste-cantidad"
                    type="number"
                    step="any"
                    inputMode="decimal"
                    className="mc-form-input"
                    onKeyDown={bloquearNotacionCientifica}
                    value={ajuste.cantidad}
                    onChange={(e) => setAjuste((p) => ({ ...p, cantidad: e.target.value }))}
                  />
                </div>
                <div className="mc-form-group">
                  <label className="mc-form-label" htmlFor="ajuste-nota">Nota (opcional)</label>
                  <input
                    id="ajuste-nota"
                    type="text"
                    className="mc-form-input"
                    value={ajuste.nota}
                    onChange={(e) => setAjuste((p) => ({ ...p, nota: e.target.value }))}
                  />
                </div>
              </div>
              <div className="mc-form-actions">
                <button type="button" className="mc-btn-secondary" onClick={cerrarAjuste}>Cancelar</button>
                <button type="submit" className="mc-btn-primary" disabled={guardandoAjuste}>
                  {guardandoAjuste ? "Guardando…" : "Ajustar stock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalPedido && (
        <div className="mc-modal-overlay" onClick={cerrarModalPedido} role="presentation">
          <div className="mc-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="pedido-especial-title">
            <h2 id="pedido-especial-title" className="mc-modal-title mc-btn-with-icon">
              <Icon name="shieldAlert" size={20} /> Pedido especial
            </h2>
            <p className="mc-hint">Bodega lo ve marcado como pedido directo del admin.</p>
            <form onSubmit={crearPedidoEspecial}>
              <div className="mc-form-group" style={{ marginBottom: 12 }}>
                <label className="mc-form-label" htmlFor="pedido-suc">Clínica destino</label>
                <Select id="pedido-suc" value={pedidoSucursal} onChange={setPedidoSucursal}>
                  <option value="">Elige…</option>
                  {sucursales.map((s) => (<option key={s.id} value={s.nombre}>{s.nombre}</option>))}
                </Select>
              </div>
              {lineasPedido.map((linea, i) => (
                <div key={i} className="mc-form-row-2" style={{ marginBottom: 8 }}>
                  <Select value={linea.materialId} onChange={(v) => cambiarLinea(i, "materialId", v)}>
                    <option value="">Material…</option>
                    {materiales.filter((m) => m.activo).map((m) => (<option key={m.id} value={m.id}>{m.nombre}</option>))}
                  </Select>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      className="mc-form-input"
                      placeholder="Cantidad"
                      onKeyDown={bloquearNotacionCientifica}
                      value={linea.cantidad}
                      onChange={(e) => cambiarLinea(i, "cantidad", e.target.value)}
                    />
                    {lineasPedido.length > 1 && (
                      <button type="button" className="mc-btn-outline" onClick={() => quitarLinea(i)}>
                        <Icon name="xCircle" size={15} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <button type="button" className="mc-btn-outline mc-btn-with-icon" onClick={agregarLinea}>
                <Icon name="plus" size={15} /> Agregar material
              </button>
              <div className="mc-form-group" style={{ marginTop: 12 }}>
                <label className="mc-form-label" htmlFor="pedido-comentario">Comentario (opcional)</label>
                <input
                  id="pedido-comentario"
                  type="text"
                  className="mc-form-input"
                  value={comentarioPedido}
                  onChange={(e) => setComentarioPedido(e.target.value)}
                />
              </div>
              <div className="mc-form-actions">
                <button type="button" className="mc-btn-secondary" onClick={cerrarModalPedido}>Cancelar</button>
                <button type="submit" className="mc-btn-primary" disabled={guardandoPedido}>
                  {guardandoPedido ? "Enviando…" : "Enviar pedido especial"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
