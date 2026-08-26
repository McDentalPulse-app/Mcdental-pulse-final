import { useEffect, useState } from "react";
import Card from "../common/Card";
import SectionTitle from "../common/SectionTitle";
import { getMovimientosInventario } from "../../services/supabase/inventarioService";

const TIPO_LABEL = { entrega: "Entrega", consumo: "Consumo", ajuste: "Ajuste" };

/**
 * "Cuándo se pide y cuándo se entrega" (bitácora que pidió el dueño): no es una tabla propia,
 * es esta vista sobre inventario_movimientos (ver migración 121 y plan de inventario-clinicas).
 * `sucursalId` opcional: sin él muestra las 26 clínicas (admin/bodega).
 */
export default function BitacoraInventario({ sucursalId }) {
  const [movimientos, setMovimientos] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      setCargando(true);
      try {
        setMovimientos(await getMovimientosInventario(sucursalId));
      } catch {
        setMovimientos([]);
      } finally {
        setCargando(false);
      }
    })();
  }, [sucursalId]);

  return (
    <Card>
      <SectionTitle icon="history">Bitácora de inventario</SectionTitle>
      {cargando ? (
        <p className="mc-empty">Cargando…</p>
      ) : movimientos.length === 0 ? (
        <p className="mc-empty">Todavía no hay movimientos.</p>
      ) : (
        <div className="rh-data-list">
          {movimientos.slice(0, 50).map((m) => (
            <div key={m.id} className="rh-data-row">
              <div className="rh-data-row-main">
                <div className="rh-data-row-title">
                  {TIPO_LABEL[m.tipo] || m.tipo}: {m.material}
                  {m.sucursal && !sucursalId ? ` · ${m.sucursal}` : ""}
                </div>
                <div className="rh-data-row-sub">
                  {m.cantidad > 0 ? "+" : ""}{m.cantidad} · {m.registradoPor || "sistema"} ·{" "}
                  {new Date(m.creadaEn).toLocaleString("es-MX")}
                  {m.nota ? ` · "${m.nota}"` : ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
