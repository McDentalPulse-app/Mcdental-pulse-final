import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
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
// En modo `unico` el día elegido puede caer en el año siguiente (un festivo de enero que
// se pide desde diciembre), así que ahí el año no se puede omitir.
const formatCortoAnio = (s) => `${formatCorto(s)} ${parseISO(s).getFullYear()}`;

// Calendario popover para elegir fechas, mismo esqueleto que <WeekSelect> (botón-trigger +
// click-fuera/Escape cierran) pero con una rejilla de mes en vez de una lista.
//
// Dos modos:
//   - rango (por defecto): primer click fija el inicio, segundo el fin (se intercambian
//     solos si el segundo cae antes) y aplica de inmediato. Llama onChange(desde, hasta).
//   - unico: un solo click elige el día y cierra. Llama onChange(iso). `hasta` se ignora
//     y `desde` puede venir vacío, en cuyo caso el trigger muestra `placeholder`.
//
// `min`/`max` acotan los días elegibles (ISO YYYY-MM-DD); fuera del rango salen deshabilitados.
const DateRangePicker = ({ desde, hasta, onChange, max, min, unico = false, placeholder = "Elige un día", className = "" }) => {
  const [open, setOpen] = useState(false);
  const [inicioTemp, setInicioTemp] = useState(desde);
  const [finTemp, setFinTemp] = useState(hasta);
  const [ancla, setAncla] = useState(() => (desde ? parseISO(desde) : new Date()));
  const ref = useRef(null);
  const popRef = useRef(null);
  const [pos, setPos] = useState(null);

  const abrir = () => {
    setInicioTemp(desde);
    setFinTemp(hasta);
    setAncla(desde ? parseISO(desde) : new Date());
    setOpen(true);
  };

  /**
   * Dónde cae el calendario, en coordenadas de PANTALLA.
   *
   * Va en un portal a <body> porque `position: absolute` lo recortaba el primer ancestro con
   * `overflow: hidden`. Medido el 2026-08-04 dentro de una `.mc-card`: el popover terminaba
   * 237px por debajo del borde de la tarjeta, así que se veía cortado por la mitad. No se
   * notaba antes porque solo se usaba en dos pantallas que no recortan; al llevarlo a los
   * cuatro campos de fecha entró en tarjetas y modales. Mismo remedio que <Select>.
   */
  const situar = useCallback(() => {
    const t = ref.current?.getBoundingClientRect();
    if (!t) return;
    const ALTO = 300, AIRE = 6;
    // La barra flotante del teléfono se mide, no se supone: así vale aunque cambie o no esté.
    const barra = document.querySelector(".mobile-tabbar");
    const suelo = barra ? window.innerHeight - barra.getBoundingClientRect().top + AIRE : 0;
    const debajo = window.innerHeight - t.bottom - AIRE - suelo;
    const arriba = debajo < ALTO && t.top - AIRE > debajo;
    // Anclado a la derecha del campo cuando no cabe por la izquierda, para no salirse.
    const ancho = 260;
    const left = Math.max(8, Math.min(t.left, window.innerWidth - ancho - 8));
    // Los DOS, `top` y `bottom`. Su regla base también trae `top: calc(100% + 6px)`, y en un
    // elemento `fixed` eso son 100vh: al abrir hacia arriba el calendario se iba fuera de la
    // pantalla. Mismo fallo que tuvo <Select>.
    setPos(arriba
      ? { left, top: "auto", bottom: window.innerHeight - t.top + AIRE }
      : { left, top: t.bottom + AIRE, bottom: "auto" });
  }, []);

  useEffect(() => {
    if (!open) return;
    situar();
    const onDoc = (e) => {
      if (ref.current?.contains(e.target)) return;
      if (popRef.current?.contains(e.target)) return;   // el calendario ya no cuelga de `ref`
      setOpen(false);
    };
    const onEsc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    window.addEventListener("scroll", situar, true);
    window.addEventListener("resize", situar);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
      window.removeEventListener("scroll", situar, true);
      window.removeEventListener("resize", situar);
    };
  }, [open, situar]);

  const fueraDeRango = (iso) => (!!max && iso > max) || (!!min && iso < min);

  const clickDia = (iso) => {
    if (fueraDeRango(iso)) return;
    if (unico) {
      onChange(iso);
      setOpen(false);
      return;
    }
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
  const mesAnteriorBloqueado = !!min && new Date(y, m, 0) < parseISO(min);

  const etiquetaTrigger = unico
    ? (desde ? formatCortoAnio(desde) : placeholder)
    : (desde === hasta ? formatCorto(desde) : `${formatCorto(desde)} – ${formatCorto(hasta)}`);

  return (
    <div className={`mc-daterange${className ? ` ${className}` : ""}`} ref={ref}>
      <button
        type="button"
        className={`mc-daterange-trigger${unico && !desde ? " mc-daterange-trigger--vacio" : ""}`}
        onClick={() => (open ? setOpen(false) : abrir())}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Icon name="calendar" size={14} />
        <span>{etiquetaTrigger}</span>
      </button>

      {open && pos && createPortal(
        <div className="mc-daterange-pop" role="dialog" ref={popRef} style={pos || undefined}
             aria-label={unico ? "Elegir un día" : "Elegir rango de fechas"}>
          <div className="mc-daterange-nav">
            <button type="button" className="mc-daterange-nav-btn" onClick={() => setAncla(new Date(y, m - 1, 1))} disabled={mesAnteriorBloqueado} aria-label="Mes anterior">‹</button>
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
              const enRango = unico ? k === desde : (k >= inicioTemp && k <= (finTemp ?? inicioTemp));
              const esExtremo = unico ? k === desde : (k === inicioTemp || (finTemp !== null && k === finTemp));
              return (
                <button
                  type="button"
                  key={k}
                  disabled={fueraDeRango(k)}
                  className={`mc-daterange-day${enRango ? " mc-daterange-day--rango" : ""}${esExtremo ? " mc-daterange-day--extremo" : ""}`}
                  onClick={() => clickDia(k)}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default DateRangePicker;
