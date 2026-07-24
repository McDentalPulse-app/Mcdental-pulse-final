import React, { useState, useRef, useEffect } from "react";
import Icon from "../ui/Icon";

const DOW = ["L", "M", "M", "J", "V", "S", "D"];
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const MESES_ABREV = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const pad = (n) => String(n).padStart(2, "0");
const isoYMD = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const parseISO = (s) => new Date(`${s}T00:00:00`);
const formatCorto = (s) => {
  const d = parseISO(s);
  return `${d.getDate()} ${MESES_ABREV[d.getMonth()]}`;
};

// Calendario popover para elegir un rango de fechas (Desde/Hasta), mismo esqueleto que
// <WeekSelect> (botón-trigger + click-fuera/Escape cierran) pero con una rejilla de mes
// en vez de una lista. Primer click fija el inicio, segundo click fija el fin (se
// intercambian solos si el segundo cae antes del primero) y aplica de inmediato — igual
// de directo que los <input type="date"> que reemplaza.
const DateRangePicker = ({ desde, hasta, onChange, max }) => {
  const [open, setOpen] = useState(false);
  const [inicioTemp, setInicioTemp] = useState(desde);
  const [finTemp, setFinTemp] = useState(hasta);
  const [ancla, setAncla] = useState(() => parseISO(desde));
  const ref = useRef(null);

  const abrir = () => {
    setInicioTemp(desde);
    setFinTemp(hasta);
    setAncla(parseISO(desde));
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onEsc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const clickDia = (iso) => {
    if (max && iso > max) return;
    if (finTemp === null) {
      const nuevoInicio = iso < inicioTemp ? iso : inicioTemp;
      const nuevoFin = iso < inicioTemp ? inicioTemp : iso;
      setInicioTemp(nuevoInicio);
      setFinTemp(nuevoFin);
      onChange(nuevoInicio, nuevoFin);
      setOpen(false);
    } else {
      setInicioTemp(iso);
      setFinTemp(null);
    }
  };

  const y = ancla.getFullYear(), m = ancla.getMonth();
  const offset = (new Date(y, m, 1).getDay() + 6) % 7;
  const totalDias = new Date(y, m + 1, 0).getDate();
  const celdas = [...Array(offset).fill(null), ...Array.from({ length: totalDias }, (_, i) => i + 1)];
  const mesSiguienteBloqueado = !!max && new Date(y, m + 1, 1) > parseISO(max);

  return (
    <div className="mc-daterange" ref={ref}>
      <button
        type="button"
        className="mc-daterange-trigger"
        onClick={() => (open ? setOpen(false) : abrir())}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Icon name="calendar" size={14} />
        <span>{desde === hasta ? formatCorto(desde) : `${formatCorto(desde)} – ${formatCorto(hasta)}`}</span>
      </button>

      {open && (
        <div className="mc-daterange-pop" role="dialog" aria-label="Elegir rango de fechas">
          <div className="mc-daterange-nav">
            <button type="button" className="mc-daterange-nav-btn" onClick={() => setAncla(new Date(y, m - 1, 1))} aria-label="Mes anterior">‹</button>
            <strong>{MESES[m]} {y}</strong>
            <button type="button" className="mc-daterange-nav-btn" onClick={() => setAncla(new Date(y, m + 1, 1))} disabled={mesSiguienteBloqueado} aria-label="Mes siguiente">›</button>
          </div>

          <div className="mc-daterange-dow">
            {DOW.map((d, i) => <span key={i}>{d}</span>)}
          </div>

          <div className="mc-daterange-grid">
            {celdas.map((d, i) => {
              if (d === null) return <span key={`v${i}`} />;
              const k = isoYMD(y, m, d);
              const enRango = k >= inicioTemp && k <= (finTemp ?? inicioTemp);
              const esInicio = k === inicioTemp;
              const esFin = finTemp !== null && k === finTemp;
              const deshabilitado = !!max && k > max;
              return (
                <button
                  type="button"
                  key={k}
                  disabled={deshabilitado}
                  className={`mc-daterange-day${enRango ? " mc-daterange-day--rango" : ""}${esInicio || esFin ? " mc-daterange-day--extremo" : ""}`}
                  onClick={() => clickDia(k)}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default DateRangePicker;
