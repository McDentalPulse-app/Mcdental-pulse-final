import { useEffect, useState } from "react";
import PageHeader from "../common/PageHeader";
import Card from "../common/Card";
import SectionTitle from "../common/SectionTitle";
import Icon from "../ui/Icon";
import Select from "../common/Select";
import { useGlobal } from "../../contexts/GlobalContext";
import { useNotification } from "../../contexts/NotificationContext";
import { getInventarioTodasSucursales, ajustarInventario } from "../../services/supabase/inventarioService";
import { getMateriales } from "../../services/supabase/materialesService";
import { getPedidos, procesarPedidoBodega } from "../../services/supabase/pedidosService";
import { bloquearNotacionCientifica } from "../../utils/inputNumerico";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import BitacoraInventario from "./BitacoraInventario";
import StockBar from "./StockBar";

const AJUSTE_VACIO = { sucursal: "", materialId: "", cantidad: "", nota: "" };

/**
 * Bodega (permiso `puedeGestionarBodega`, mig. 120): pedidos pendientes de las 26 clínicas,
 * comparados contra el stock actual de cada una, para decidir cuánto enviar de cada línea.
 */
export default function BodegaPanel() {
  const { sucursales } = useGlobal();
  const { toast, confirm } = useNotification();
  const [pedidos, setPedidos] = useState([]);
  const [materiales, setMateriales] = useState([]);
  const [stockPorClave, setStockPorClave] = useState(new Map());
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(null); // id del pedido en curso
  // Por pedido: { [pedidoItemId]: cantidadEnviada } — arranca en la cantidad solicitada,
  // que es lo que bodega normalmente manda salvo que decida enviar menos.
  const [cantidades, setCantidades] = useState({});
  const [fechaEstimada, setFechaEstimada] = useState({});

  const [modalAjuste, setModalAjuste] = useState(false);
  const [ajuste, setAjuste] = useState(AJUSTE_VACIO);
  const [guardandoAjuste, setGuardandoAjuste] = useState(false);

  useEscapeKey(() => setModalAjuste(false), modalAjuste);

  const cargar = async () => {
    setCargando(true);
    try {
      const [peds, stock, mats] = await Promise.all([getPedidos(), getInventarioTodasSucursales(), getMateriales()]);
      // Más viejo primero: getPedidos() trae todo con lo más reciente arriba (le conviene a
      // Admin/Clínica ver su propio historial así), pero acá es una cola de trabajo — un
      // pedido viejo no se puede quedar hundido al fondo cada vez que entra uno nuevo.
      const pendientes = peds
        .filter((p) => p.estado === "pendiente")
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      setPedidos(pendientes);
      setMateriales(mats.filter((m) => m.activo));
      setStockPorClave(new Map(stock.map((s) => [`${s.sucursalId}:${s.materialId}`, s.cantidadActual])));
      const iniciales = {};
      for (const p of pendientes) {
        for (const it of p.items) iniciales[it.id] = it.cantidadSolicitada;
      }
      setCantidades((prev) => ({ ...iniciales, ...prev }));
    } catch (error) {
      toast.error(error?.message || "No se pudo cargar los pedidos.");
    } finally {
      setCargando(false);
    }
  };

  const guardarAjuste = async (e) => {
    e.preventDefault();
    if (!ajuste.sucursal || !ajuste.materialId || !ajuste.cantidad) {
      toast.warning("Elige clínica, material y cantidad.");
      return;
    }
    setGuardandoAjuste(true);
    try {
      const sucursalId = sucursales.find((s) => s.nombre === ajuste.sucursal)?.id;
      await ajustarInventario({
        sucursalId,
        materialId: ajuste.materialId,
        cantidad: Number(ajuste.cantidad),
        nota: ajuste.nota,
      });
      const stock = await getInventarioTodasSucursales();
      setStockPorClave(new Map(stock.map((s) => [`${s.sucursalId}:${s.materialId}`, s.cantidadActual])));
      toast.success("Stock ajustado.");
      setModalAjuste(false);
      setAjuste(AJUSTE_VACIO);
    } catch (error) {
      toast.error(error?.message || "No se pudo ajustar el stock.");
    } finally {
      setGuardandoAjuste(false);
    }
  };

  useEffect(() => { (async () => { await cargar(); })(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const procesar = async (pedido, estado) => {
    if (estado === "rechazado" || estado === "cancelado") {
      const confirmar = await confirm({
        title: estado === "rechazado" ? "Rechazar pedido" : "Cancelar pedido",
        description: `${pedido.sucursal} se queda sin este pedido. No sube nada de inventario.`,
        variant: "danger",
        confirmText: estado === "rechazado" ? "Rechazar" : "Cancelar",
      });
      if (!confirmar) return;
    }

    setProcesando(pedido.id);
    try {
      await procesarPedidoBodega({
        pedidoId: pedido.id,
        items: pedido.items.map((it) => ({
          pedidoItemId: it.id,
          cantidadEnviada: estado === "enviado" ? Number(cantidades[it.id] ?? it.cantidadSolicitada) : 0,
        })),
        estado,
        fechaEstimada: fechaEstimada[pedido.id] || null,
      });
      toast.success(estado === "enviado" ? "Pedido enviado. Inventario actualizado." : "Pedido actualizado.");
      await cargar();
    } catch (error) {
      toast.error(error?.message || "No se pudo procesar el pedido.");
    } finally {
      setProcesando(null);
    }
  };

  return (
    <div className="admin-page">
      <PageHeader icon="truck" title="Pedidos (Bodega)" subtitle={`${pedidos.length} pendientes`}>
        <button type="button" className="mc-btn-primary mc-btn-with-icon" onClick={() => setModalAjuste(true)}>
          <Icon name="clipboardCheck" size={16} /> Ajustar stock
        </button>
      </PageHeader>

      {cargando ? (
        <Card><p className="mc-empty">Cargando…</p></Card>
      ) : pedidos.length === 0 ? (
        <Card><p className="mc-empty">No hay pedidos pendientes.</p></Card>
      ) : (
        pedidos.map((p) => (
          <Card key={p.id}>
            <SectionTitle icon={p.origen === "admin" ? "shieldAlert" : "package"}>
              {p.sucursal}
              {p.origen === "admin" && (
                <span className="mc-status-pill mc-status-pill--critica" style={{ marginLeft: 8 }}>
                  Pedido directo del admin
                </span>
              )}
            </SectionTitle>
            <p className="mc-hint">
              Pedido por {p.solicitante} · {new Date(p.createdAt).toLocaleDateString("es-MX")}
              {p.comentario ? ` · "${p.comentario}"` : ""}
            </p>

            <div className="rh-data-list">
              {p.items.map((it) => {
                const stockActual = stockPorClave.get(`${p.sucursalId}:${it.materialId}`) ?? 0;
                const umbral = materiales.find((m) => m.id === it.materialId)?.umbralStockBajo ?? 0;
                return (
                  <div key={it.id} className="rh-data-row">
                    <div className="rh-data-row-main">
                      <div className="rh-data-row-title">{it.material}</div>
                      <div className="rh-data-row-sub">
                        Pide {it.cantidadSolicitada} {it.unidadMedida}
                        {it.cantidadSolicitada > stockActual && (
                          <span className="mc-status-pill mc-status-pill--rechazado" style={{ marginLeft: 6 }}>
                            Pide más de lo que tiene
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="rh-data-row-status">
                      <StockBar actual={stockActual} umbral={umbral} unidad={it.unidadMedida} />
                    </div>
                    <div className="rh-data-row-meta">
                      <label className="rh-data-row-meta-secondary">Enviar</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        inputMode="decimal"
                        className="mc-form-input"
                        style={{ width: 90 }}
                        onKeyDown={bloquearNotacionCientifica}
                        value={cantidades[it.id] ?? it.cantidadSolicitada}
                        onChange={(e) => setCantidades((prev) => ({ ...prev, [it.id]: e.target.value }))}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mc-form-row-2" style={{ marginTop: 12 }}>
              <div className="mc-form-group">
                <label className="mc-form-label" htmlFor={`fecha-${p.id}`}>Fecha estimada de entrega</label>
                <input
                  id={`fecha-${p.id}`}
                  type="date"
                  className="mc-form-input"
                  value={fechaEstimada[p.id] || ""}
                  onChange={(e) => setFechaEstimada((prev) => ({ ...prev, [p.id]: e.target.value }))}
                />
              </div>
            </div>

            <div className="mc-form-actions">
              <button
                type="button"
                className="mc-btn-outline mc-btn-outline--danger"
                disabled={procesando === p.id}
                onClick={() => procesar(p, "rechazado")}
              >
                Rechazar
              </button>
              <button
                type="button"
                className="mc-btn-primary"
                disabled={procesando === p.id}
                onClick={() => procesar(p, "enviado")}
              >
                <Icon name="truck" size={16} />
                {procesando === p.id ? "Enviando…" : "Marcar como enviado"}
              </button>
            </div>
          </Card>
        ))
      )}

      <BitacoraInventario />

      {modalAjuste && (
        <div className="mc-modal-overlay" onClick={() => setModalAjuste(false)} role="presentation">
          <div className="mc-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="bodega-ajuste-title">
            <h2 id="bodega-ajuste-title" className="mc-modal-title mc-btn-with-icon">
              <Icon name="clipboardCheck" size={20} /> Ajustar stock
            </h2>
            <p className="mc-hint">
              Carga rápida de stock (conteo inicial) o corrección puntual, sin pasar por pedido.
              Cantidad negativa resta.
            </p>
            <form onSubmit={guardarAjuste} className="mc-form-grid">
              <div className="mc-form-row-2">
                <div className="mc-form-group">
                  <label className="mc-form-label" htmlFor="bodega-ajuste-suc">Clínica</label>
                  <Select id="bodega-ajuste-suc" value={ajuste.sucursal} onChange={(v) => setAjuste((p) => ({ ...p, sucursal: v }))}>
                    <option value="">Elige…</option>
                    {sucursales.map((s) => (<option key={s.id} value={s.nombre}>{s.nombre}</option>))}
                  </Select>
                </div>
                <div className="mc-form-group">
                  <label className="mc-form-label" htmlFor="bodega-ajuste-material">Material</label>
                  <Select
                    id="bodega-ajuste-material"
                    value={ajuste.materialId}
                    onChange={(v) => setAjuste((p) => ({ ...p, materialId: v }))}
                  >
                    <option value="">Elige…</option>
                    {materiales.map((m) => (<option key={m.id} value={m.id}>{m.nombre}</option>))}
                  </Select>
                </div>
              </div>
              <div className="mc-form-row-2">
                <div className="mc-form-group">
                  <label className="mc-form-label" htmlFor="bodega-ajuste-cantidad">Cantidad (negativa para restar)</label>
                  <input
                    id="bodega-ajuste-cantidad"
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
                  <label className="mc-form-label" htmlFor="bodega-ajuste-nota">Nota (opcional)</label>
                  <input
                    id="bodega-ajuste-nota"
                    type="text"
                    className="mc-form-input"
                    value={ajuste.nota}
                    onChange={(e) => setAjuste((p) => ({ ...p, nota: e.target.value }))}
                  />
                </div>
              </div>
              <div className="mc-form-actions">
                <button type="button" className="mc-btn-secondary" onClick={() => setModalAjuste(false)}>Cancelar</button>
                <button type="submit" className="mc-btn-primary" disabled={guardandoAjuste}>
                  {guardandoAjuste ? "Guardando…" : "Ajustar stock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
