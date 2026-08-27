import { useEffect, useState } from "react";
import PageHeader from "../common/PageHeader";
import Card from "../common/Card";
import SectionTitle from "../common/SectionTitle";
import Select from "../common/Select";
import FilterBar from "../common/FilterBar";
import Icon from "../ui/Icon";
import Avatar from "../ui/Avatar";
import { useGlobal } from "../../contexts/GlobalContext";
import { useNotification } from "../../contexts/NotificationContext";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { getMateriales } from "../../services/supabase/materialesService";
import { getInventarioSucursal, registrarConsumo, ajustarInventario } from "../../services/supabase/inventarioService";
import { getPedidos, addPedido } from "../../services/supabase/pedidosService";
import { bloquearNotacionCientifica } from "../../utils/inputNumerico";
import BitacoraInventario from "./BitacoraInventario";
import StockBar from "./StockBar";

const ESTADO_LABEL = {
  pendiente: "Pendiente",
  enviado: "Enviado",
  rechazado: "Rechazado",
  cancelado: "Cancelado",
};
// 'enviado' reutiliza el pill verde de "aprobado": no hay una variante propia y decir
// "aprobado" con otro texto encima confundiría más que ayudar.
const ESTADO_PILL = { pendiente: "pendiente", enviado: "aprobado", rechazado: "rechazado", cancelado: "cancelado" };

const MOVIMIENTO_VACIO = { modo: "consumo", materialId: "", cantidad: "", nota: "" };

/**
 * Inventario de la propia clínica (permiso `puedeGestionarInventario`, mig. 120): tabla de
 * stock (estilo Gestión de Personal) + 2 botones que abren modal — Registrar movimiento y
 * Hacer pedido. RLS ya limita todo a la sucursal de quien entra.
 */
export default function InventarioClinica({ user }) {
  const { sucursales } = useGlobal();
  const { toast } = useNotification();
  const sucursalId = sucursales.find((s) => s.nombre === user?.sucursal)?.id;

  const [materiales, setMateriales] = useState([]);
  const [inventario, setInventario] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  const [modalMovimiento, setModalMovimiento] = useState(false);
  // Consumo y ajuste comparten un solo formulario (un toggle decide a qué RPC va cada envío):
  // eran dos <Card> casi idénticas, mismo material+cantidad+nota, y competían por atención.
  const [movimiento, setMovimiento] = useState(MOVIMIENTO_VACIO);
  const [guardandoMovimiento, setGuardandoMovimiento] = useState(false);

  const [modalPedido, setModalPedido] = useState(false);
  const [lineasPedido, setLineasPedido] = useState([{ materialId: "", cantidad: "" }]);
  const [comentarioPedido, setComentarioPedido] = useState("");
  const [guardandoPedido, setGuardandoPedido] = useState(false);

  // "Pedir" desde una fila de la tabla: abre el modal con ese material ya elegido, en vez de
  // mandar a buscarlo otra vez en el <select> del formulario en blanco.
  const abrirPedido = (materialId = "") => {
    setLineasPedido([{ materialId, cantidad: "" }]);
    setModalPedido(true);
  };

  useEscapeKey(() => { setModalMovimiento(false); setModalPedido(false); }, modalMovimiento || modalPedido);

  useEffect(() => {
    if (!sucursalId) return;
    (async () => {
      setCargando(true);
      try {
        const [mats, inv, peds] = await Promise.all([
          getMateriales(),
          getInventarioSucursal(sucursalId),
          getPedidos(),
        ]);
        setMateriales(mats.filter((m) => m.activo));
        setInventario(inv);
        setPedidos(peds);
      } catch (error) {
        toast.error(error?.message || "No se pudo cargar el inventario.");
      } finally {
        setCargando(false);
      }
    })();
  }, [sucursalId]); // eslint-disable-line react-hooks/exhaustive-deps

  const cerrarModalMovimiento = () => { setModalMovimiento(false); setMovimiento(MOVIMIENTO_VACIO); };

  const guardarMovimiento = async (e) => {
    e.preventDefault();
    if (!movimiento.materialId || !movimiento.cantidad) {
      toast.warning("Elige un material y una cantidad.");
      return;
    }
    setGuardandoMovimiento(true);
    try {
      if (movimiento.modo === "consumo") {
        await registrarConsumo({
          sucursalId,
          materialId: movimiento.materialId,
          cantidad: Number(movimiento.cantidad),
          nota: movimiento.nota,
          registradoPor: user?.id,
        });
      } else {
        await ajustarInventario({
          sucursalId,
          materialId: movimiento.materialId,
          cantidad: Number(movimiento.cantidad),
          nota: movimiento.nota,
        });
      }
      const inv = await getInventarioSucursal(sucursalId);
      setInventario(inv);
      toast.success(movimiento.modo === "consumo" ? "Consumo registrado." : "Stock ajustado.");
      cerrarModalMovimiento();
    } catch (error) {
      toast.error(error?.message || "No se pudo guardar el movimiento.");
    } finally {
      setGuardandoMovimiento(false);
    }
  };

  const cambiarLinea = (i, campo, valor) =>
    setLineasPedido((prev) => prev.map((l, idx) => (idx === i ? { ...l, [campo]: valor } : l)));
  const agregarLinea = () => setLineasPedido((prev) => [...prev, { materialId: "", cantidad: "" }]);
  const quitarLinea = (i) => setLineasPedido((prev) => prev.filter((_, idx) => idx !== i));

  const cerrarModalPedido = () => {
    setModalPedido(false);
    setLineasPedido([{ materialId: "", cantidad: "" }]);
    setComentarioPedido("");
  };

  const enviarPedido = async (e) => {
    e.preventDefault();
    const items = lineasPedido
      .filter((l) => l.materialId && l.cantidad)
      .map((l) => ({ materialId: l.materialId, cantidad: Number(l.cantidad) }));
    if (!items.length) {
      toast.warning("Agrega al menos un material con cantidad.");
      return;
    }
    setGuardandoPedido(true);
    try {
      await addPedido({ items, comentario: comentarioPedido });
      const peds = await getPedidos();
      setPedidos(peds);
      toast.success("Pedido enviado a bodega.");
      cerrarModalPedido();
    } catch (error) {
      toast.error(error?.message || "No se pudo enviar el pedido.");
    } finally {
      setGuardandoPedido(false);
    }
  };

  const materialesPorId = new Map(materiales.map((m) => [m.id, m]));
  const inventarioFiltrado = inventario.filter((it) =>
    it.material.toLowerCase().includes(busqueda.toLowerCase()),
  );

  if (!sucursalId) {
    return (
      <div className="admin-page">
        <PageHeader icon="package" title="Inventario de mi clínica" />
        <Card><p className="mc-empty">No encontramos tu clínica. Avisa a administración.</p></Card>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <PageHeader icon="package" title="Inventario de mi clínica" subtitle={user?.sucursal}>
        <button type="button" className="mc-btn-outline mc-btn-with-icon" onClick={() => setModalMovimiento(true)}>
          <Icon name="minus" size={16} /> Registrar movimiento
        </button>
        <button type="button" className="mc-btn-primary mc-btn-with-icon" onClick={() => abrirPedido()}>
          <Icon name="package" size={16} /> Hacer pedido
        </button>
      </PageHeader>

      {cargando ? (
        <Card><p className="mc-empty">Cargando…</p></Card>
      ) : (
        <>
          <Card className="table-card-body">
            <FilterBar search={{ value: busqueda, onChange: setBusqueda, placeholder: "Buscar material por nombre..." }} />

            <div className="emp-table-scroll">
              <table className="emp-table">
                <thead>
                  <tr>
                    <th className="emp-table-th emp-table-th--nombre">Material</th>
                    <th className="emp-table-th">Stock</th>
                    <th className="emp-table-th emp-table-th--acciones" />
                  </tr>
                </thead>
                <tbody>
                  {[...inventarioFiltrado]
                    .sort((a, b) => (a.cantidadActual <= a.umbralStockBajo) === (b.cantidadActual <= b.umbralStockBajo)
                      ? 0
                      : a.cantidadActual <= a.umbralStockBajo ? -1 : 1)
                    .map((it) => (
                    <tr key={it.materialId} className="emp-table-row emp-table-row--estatica">
                      <td>
                        <div className="emp-table-nombre">
                          <Avatar name={it.material} photoUrl={materialesPorId.get(it.materialId)?.imagenUrl} size={32} />
                          <span className="emp-table-nombre-texto">{it.material}</span>
                        </div>
                      </td>
                      <td>
                        <StockBar actual={it.cantidadActual} umbral={it.umbralStockBajo} unidad={it.unidadMedida} />
                      </td>
                      <td className="emp-table-acciones">
                        <button
                          type="button"
                          className="emp-table-icon-btn"
                          title="Pedir este material"
                          aria-label={`Pedir ${it.material}`}
                          onClick={() => abrirPedido(it.materialId)}
                        >
                          <Icon name="plus" size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {inventarioFiltrado.length === 0 && (
                    <tr>
                      <td colSpan="3" className="emp-table-vacio">
                        {inventario.length === 0 ? "Todavía no hay movimientos registrados." : "No se encontraron materiales."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <SectionTitle icon="clipboard">Mis pedidos</SectionTitle>
            <div className="rh-data-list">
              {pedidos.length === 0 && <p className="mc-empty">Todavía no has hecho pedidos.</p>}
              {pedidos.map((p) => (
                <div key={p.id} className="rh-data-row">
                  <div className="rh-data-row-main">
                    <div className="rh-data-row-title">
                      {p.items.map((it) => `${it.material} (${it.cantidadSolicitada})`).join(", ")}
                    </div>
                    <div className="rh-data-row-sub">
                      {p.origen === "admin" ? "Pedido especial del admin" : "Pedido de recepción"}
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

          <BitacoraInventario sucursalId={sucursalId} />
        </>
      )}

      {modalMovimiento && (
        <div className="mc-modal-overlay" onClick={cerrarModalMovimiento} role="presentation">
          <div className="mc-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="movimiento-title">
            <h2 id="movimiento-title" className="mc-modal-title mc-btn-with-icon">
              <Icon name="minus" size={20} /> Movimiento de stock
            </h2>
            <div className="cal-toggle" role="tablist" style={{ marginBottom: 12 }}>
              <button
                type="button"
                role="tab"
                aria-selected={movimiento.modo === "consumo"}
                className={`cal-toggle-btn${movimiento.modo === "consumo" ? " cal-toggle-btn--activo" : ""}`}
                onClick={() => setMovimiento((p) => ({ ...p, modo: "consumo" }))}
              >
                Consumo
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={movimiento.modo === "ajuste"}
                className={`cal-toggle-btn${movimiento.modo === "ajuste" ? " cal-toggle-btn--activo" : ""}`}
                onClick={() => setMovimiento((p) => ({ ...p, modo: "ajuste" }))}
              >
                Ajuste manual
              </button>
            </div>
            <p className="mc-hint">
              {movimiento.modo === "consumo"
                ? "Resta lo que se usó del stock de tu clínica."
                : "Para cargar o corregir cantidades directo (conteo físico, error de captura). La cantidad puede ser negativa para restar."}
            </p>
            <form onSubmit={guardarMovimiento} className="mc-form-grid">
              <div className="mc-form-group">
                <label className="mc-form-label" htmlFor="mov-material">Material</label>
                <Select
                  id="mov-material"
                  value={movimiento.materialId}
                  onChange={(v) => setMovimiento((p) => ({ ...p, materialId: v }))}
                >
                  <option value="">Elige…</option>
                  {materiales.map((m) => (
                    <option key={m.id} value={m.id}>{m.nombre}</option>
                  ))}
                </Select>
              </div>
              <div className="mc-form-row-2">
                <div className="mc-form-group">
                  <label className="mc-form-label" htmlFor="mov-cantidad">
                    {movimiento.modo === "consumo" ? "Cantidad usada" : "Cantidad (negativa para restar)"}
                  </label>
                  <input
                    id="mov-cantidad"
                    type="number"
                    min={movimiento.modo === "consumo" ? "0" : undefined}
                    step="any"
                    inputMode="decimal"
                    className="mc-form-input"
                    onKeyDown={bloquearNotacionCientifica}
                    value={movimiento.cantidad}
                    onChange={(e) => setMovimiento((p) => ({ ...p, cantidad: e.target.value }))}
                  />
                </div>
                <div className="mc-form-group">
                  <label className="mc-form-label" htmlFor="mov-nota">Nota (opcional)</label>
                  <input
                    id="mov-nota"
                    type="text"
                    className="mc-form-input"
                    value={movimiento.nota}
                    onChange={(e) => setMovimiento((p) => ({ ...p, nota: e.target.value }))}
                  />
                </div>
              </div>
              <div className="mc-form-actions">
                <button type="button" className="mc-btn-secondary" onClick={cerrarModalMovimiento}>Cancelar</button>
                <button type="submit" className="mc-btn-primary" disabled={guardandoMovimiento}>
                  {guardandoMovimiento
                    ? "Guardando…"
                    : movimiento.modo === "consumo" ? "Registrar consumo" : "Ajustar stock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalPedido && (
        <div className="mc-modal-overlay" onClick={cerrarModalPedido} role="presentation">
          <div className="mc-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="pedido-title">
            <h2 id="pedido-title" className="mc-modal-title mc-btn-with-icon">
              <Icon name="package" size={20} /> Hacer pedido
            </h2>
            <form onSubmit={enviarPedido}>
              {lineasPedido.map((linea, i) => (
                <div key={i} className="mc-form-row-2" style={{ marginBottom: 8 }}>
                  <Select value={linea.materialId} onChange={(v) => cambiarLinea(i, "materialId", v)}>
                    <option value="">Material…</option>
                    {materiales.map((m) => (
                      <option key={m.id} value={m.id}>{m.nombre}</option>
                    ))}
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
                  {guardandoPedido ? "Enviando…" : "Enviar pedido"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
