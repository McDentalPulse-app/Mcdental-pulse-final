import { useMemo, useState } from "react";
import Icon from "../ui/Icon";

/**
 * Calendario mensual reutilizable: rejilla de un mes (lunes primero) con los eventos DENTRO de
 * cada día y, debajo, el detalle del día seleccionado.
 *
 * Cada evento: { fecha: "YYYY-MM-DD", fechaFin?, titulo, detalle?, color, icono?, etiqueta?,
 * esFestivo? }. Los eventos con `fechaFin` se pintan en todos los días del rango.
 *   - `color`   → clase `.cal-punto--<color>` / `.cal-chip--<color>` (aqua, azul, ambar, verde,
 *                 rosa, rojo).
 *   - `icono`   → nombre de ícono (SVG lucide vía <Icon>) para el chip y el detalle.
 *   - `etiqueta`→ texto breve del chip (p. ej. el nombre). Si falta, usa `titulo`.
 *   - `esFestivo` → el día completo se resalta (aplica a toda la clínica), no como un chip más.
 *
 * Responsivo: en escritorio los eventos son "chips" con ícono + texto; en móvil (celda chica) se
 * colapsan a puntos de color y el texto completo aparece en el detalle al tocar el día.
 */

const DOW = ["L", "M", "M", "J", "V", "S", "D"];
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const pad = (n) => String(n).padStart(2, "0");
const iso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

const MAX_CHIPS = 2;  // chips visibles por día en escritorio antes del "+N"
const MAX_PUNTOS = 3; // puntos visibles por día en móvil

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
          const festivo = evs.find((e) => e.esFestivo);
          const otros = evs.filter((e) => !e.esFestivo);
          const restantes = otros.length - MAX_CHIPS;

          return (
            <button
              type="button"
              key={k}
              className={`cal-celda${k === hoyStr ? " cal-celda--hoy" : ""}${k === sel ? " cal-celda--sel" : ""}${festivo ? " cal-celda--festivo" : ""}`}
              onClick={() => setSel(k)}
            >
              <span className="cal-num">{d}</span>

              {festivo && (
                <span className="cal-festivo" title={festivo.titulo}>
                  <span className="cal-festivo-ico"><Icon name={festivo.icono || "partyPopper"} size={11} /></span>
                  <span className="cal-festivo-nom">{festivo.titulo}</span>
                </span>
              )}

              {otros.length > 0 && (
                <>
                  {/* Escritorio: chips con ícono + texto. */}
                  <span className="cal-chips">
                    {otros.slice(0, MAX_CHIPS).map((e, j) => (
                      <span key={j} className={`cal-chip cal-chip--${e.color || "aqua"}`} title={e.titulo}>
                        {e.icono && <span className="cal-chip-ico"><Icon name={e.icono} size={11} /></span>}
                        <span className="cal-chip-txt">{e.etiqueta || e.titulo}</span>
                      </span>
                    ))}
                    {restantes > 0 && <span className="cal-chip cal-chip--mas">+{restantes} más</span>}
                  </span>

                  {/* Móvil: puntos de color (el detalle completo sale al tocar el día). */}
                  <span className="cal-puntos">
                    {otros.slice(0, MAX_PUNTOS).map((e, j) => (
                      <span key={j} className={`cal-punto cal-punto--${e.color || "aqua"}`} />
                    ))}
                  </span>
                </>
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
              {e.icono
                ? <span className={`cal-evento-ico cal-ico--${e.color || "aqua"}`} aria-hidden="true"><Icon name={e.icono} size={15} /></span>
                : <span className={`cal-punto cal-punto--${e.color || "aqua"}`} />}
              <span className="cal-evento-titulo">{e.titulo}</span>
              {e.detalle && <em className="cal-evento-detalle">{e.detalle}</em>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
