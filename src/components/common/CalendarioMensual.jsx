import { useMemo, useState } from "react";

/**
 * Calendario mensual reutilizable: rejilla de un mes (lunes primero) con puntos de color por
 * evento, navegación de meses y, debajo, los eventos del día seleccionado.
 *
 * Cada evento: { fecha: "YYYY-MM-DD", fechaFin?: "YYYY-MM-DD", titulo, detalle?, color }.
 * `color` es un nombre corto que mapea a una clase `.cal-punto--<color>` (aqua, azul, ambar,
 * verde, rosa, rojo). Los eventos con `fechaFin` se pintan en todos los días del rango.
 */

const DOW = ["L", "M", "M", "J", "V", "S", "D"];
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const pad = (n) => String(n).padStart(2, "0");
const iso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

export default function CalendarioMensual({ eventos = [] }) {
  const hoy = new Date();
  const hoyStr = iso(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

  const [ver, setVer] = useState({ y: hoy.getFullYear(), m: hoy.getMonth() });
  const [sel, setSel] = useState(hoyStr);

  // Eventos indexados por día "YYYY-MM-DD", expandiendo los rangos.
  const porDia = useMemo(() => {
    const map = {};
    for (const e of eventos) {
      if (!e?.fecha) continue;
      const ini = new Date(`${e.fecha}T00:00:00`);
      const fin = new Date(`${e.fechaFin || e.fecha}T00:00:00`);
      if (Number.isNaN(ini.getTime()) || Number.isNaN(fin.getTime())) continue;
      for (const d = new Date(ini); d <= fin; d.setDate(d.getDate() + 1)) {
        const k = iso(d.getFullYear(), d.getMonth(), d.getDate());
        (map[k] ||= []).push(e);
      }
    }
    return map;
  }, [eventos]);

  const { y, m } = ver;
  const offset = (new Date(y, m, 1).getDay() + 6) % 7; // lunes primero
  const totalDias = new Date(y, m + 1, 0).getDate();
  const celdas = [...Array(offset).fill(null), ...Array.from({ length: totalDias }, (_, i) => i + 1)];

  const mover = (delta) =>
    setVer((v) => {
      const nd = new Date(v.y, v.m + delta, 1);
      return { y: nd.getFullYear(), m: nd.getMonth() };
    });

  const eventosSel = porDia[sel] || [];

  return (
    <div className="cal">
      <div className="cal-head">
        <button type="button" className="cal-nav" onClick={() => mover(-1)} aria-label="Mes anterior">‹</button>
        <strong className="cal-titulo">{MESES[m]} {y}</strong>
        <button type="button" className="cal-nav" onClick={() => mover(1)} aria-label="Mes siguiente">›</button>
      </div>

      <div className="cal-grid cal-grid--dow">
        {DOW.map((d, i) => <span key={i} className="cal-dow">{d}</span>)}
      </div>

      <div className="cal-grid">
        {celdas.map((d, i) => {
          if (d === null) return <span key={`v${i}`} className="cal-celda cal-celda--vacia" />;
          const k = iso(y, m, d);
          const evs = porDia[k] || [];
          return (
            <button
              type="button"
              key={k}
              className={`cal-celda${k === hoyStr ? " cal-celda--hoy" : ""}${k === sel ? " cal-celda--sel" : ""}`}
              onClick={() => setSel(k)}
            >
              <span className="cal-num">{d}</span>
              {evs.length > 0 && (
                <span className="cal-puntos">
                  {evs.slice(0, 3).map((e, j) => (
                    <span key={j} className={`cal-punto cal-punto--${e.color || "aqua"}`} />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="cal-dia">
        <span className="cal-dia-label">{sel === hoyStr ? "Hoy" : sel.split("-").reverse().join("/")}</span>
        {eventosSel.length === 0 ? (
          <p className="cal-vacio">Sin eventos este día.</p>
        ) : (
          eventosSel.map((e, i) => (
            <div key={i} className="cal-evento">
              <span className={`cal-punto cal-punto--${e.color || "aqua"}`} />
              <span className="cal-evento-titulo">{e.titulo}</span>
              {e.detalle && <em className="cal-evento-detalle">{e.detalle}</em>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
