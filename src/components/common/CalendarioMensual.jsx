import { useMemo, useState } from "react";
import Icon from "../ui/Icon";

/**
 * Calendario de eventos reutilizable con 3 vistas (Mes / Semana / Día) y un toggle para cambiar
 * entre ellas — estilo inspirado en los "event calendars" de Untitled UI (celdas aireadas, chips
 * con punto de color, cabecera limpia). Implementación propia; no usa código de terceros.
 *
 * Cada evento: { fecha:"YYYY-MM-DD", fechaFin?, titulo, detalle?, color, icono?, etiqueta?, esFestivo? }.
 *   - color   → clase de color (aqua, azul, ambar, verde, rosa, rojo).
 *   - icono   → nombre de ícono SVG (<Icon>).
 *   - etiqueta→ texto breve del chip (si falta, usa titulo).
 *   - esFestivo → el día completo se resalta (aplica a todos), no es un chip más.
 *
 * `vistas`: qué vistas ofrecer. Por defecto solo "mes" (sin toggle). RH pasa ["mes","semana","dia"].
 * Como nuestros eventos son por DÍA (no por hora), Semana/Día son en formato agenda, no rejilla horaria.
 */

const DOW = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const DOW_MIN = ["L", "M", "M", "J", "V", "S", "D"];
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const LABEL_VISTA = { mes: "Mes", semana: "Semana", dia: "Día" };
const MAX_CHIPS = 3; // chips por día (vista mes, escritorio) antes del "+N"
const MAX_PUNTOS = 3;

const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const isoYMD = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const inicioSemana = (d) => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); x.setHours(0, 0, 0, 0); return x; };
const sumarDias = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const capitalizar = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export default function CalendarioMensual({ eventos = [], vistas = ["mes"] }) {
  const hoy = new Date();
  const hoyStr = isoYMD(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

  const [vista, setVista] = useState(vistas[0] || "mes");
  const [ancla, setAncla] = useState(() => new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()));
  const [sel, setSel] = useState(hoyStr);

  // Eventos indexados por día "YYYY-MM-DD", expandiendo los rangos (fechaFin).
  const porDia = useMemo(() => {
    const map = {};
    for (const e of eventos) {
      if (!e?.fecha) continue;
      const ini = new Date(`${e.fecha}T00:00:00`);
      const fin = new Date(`${e.fechaFin || e.fecha}T00:00:00`);
      if (Number.isNaN(ini.getTime()) || Number.isNaN(fin.getTime())) continue;
      for (const d = new Date(ini); d <= fin; d.setDate(d.getDate() + 1)) {
        (map[isoYMD(d.getFullYear(), d.getMonth(), d.getDate())] ||= []).push(e);
      }
    }
    return map;
  }, [eventos]);

  const mover = (dir) => setAncla((a) => {
    const x = new Date(a);
    if (vista === "mes") x.setMonth(x.getMonth() + dir);
    else if (vista === "semana") x.setDate(x.getDate() + 7 * dir);
    else x.setDate(x.getDate() + dir);
    return x;
  });
  const irHoy = () => { setAncla(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())); setSel(hoyStr); };

  const titulo = (() => {
    if (vista === "mes") return `${capitalizar(MESES[ancla.getMonth()])} ${ancla.getFullYear()}`;
    if (vista === "dia") return capitalizar(ancla.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
    const ini = inicioSemana(ancla); const fin = sumarDias(ini, 6);
    const mismoMes = ini.getMonth() === fin.getMonth();
    return mismoMes
      ? `${ini.getDate()}–${fin.getDate()} ${MESES[ini.getMonth()]} ${ini.getFullYear()}`
      : `${ini.getDate()} ${MESES[ini.getMonth()].slice(0, 3)} – ${fin.getDate()} ${MESES[fin.getMonth()].slice(0, 3)} ${fin.getFullYear()}`;
  })();

  return (
    <div className="cal">
      <div className="cal-toolbar">
        <div className="cal-nav-group">
          <button type="button" className="cal-hoy" onClick={irHoy}>Hoy</button>
          <button type="button" className="cal-nav" onClick={() => mover(-1)} aria-label="Anterior">‹</button>
          <button type="button" className="cal-nav" onClick={() => mover(1)} aria-label="Siguiente">›</button>
          <strong className="cal-titulo">{titulo}</strong>
        </div>
        {vistas.length > 1 && (
          <div className="cal-toggle" role="tablist">
            {vistas.map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={vista === v}
                className={`cal-toggle-btn${vista === v ? " cal-toggle-btn--activo" : ""}`}
                onClick={() => setVista(v)}
              >
                {LABEL_VISTA[v]}
              </button>
            ))}
          </div>
        )}
      </div>

      {vista === "mes" && <VistaMes {...{ ancla, hoyStr, sel, setSel, porDia }} />}
      {vista === "semana" && <VistaSemana {...{ ancla, hoyStr, porDia, setAncla, setVista, hayDia: vistas.includes("dia") }} />}
      {vista === "dia" && <VistaDia {...{ ancla, hoyStr, porDia }} />}
    </div>
  );
}

// --- Chip de evento (compartido por las vistas) ---
function Chip({ e }) {
  return (
    <span className={`cal-chip cal-chip--${e.color || "aqua"}`} title={e.titulo}>
      {e.icono && <span className="cal-chip-ico"><Icon name={e.icono} size={11} /></span>}
      <span className="cal-chip-txt">{e.etiqueta || e.titulo}</span>
    </span>
  );
}

// --- Vista MES ---
function VistaMes({ ancla, hoyStr, sel, setSel, porDia }) {
  const y = ancla.getFullYear(), m = ancla.getMonth();
  const offset = (new Date(y, m, 1).getDay() + 6) % 7;
  const totalDias = new Date(y, m + 1, 0).getDate();
  const celdas = [...Array(offset).fill(null), ...Array.from({ length: totalDias }, (_, i) => i + 1)];
  const eventosSel = porDia[sel] || [];

  return (
    <>
      <div className="cal-grid cal-grid--dow">
        {DOW_MIN.map((d, i) => <span key={i} className="cal-dow">{d}</span>)}
      </div>
      <div className="cal-grid">
        {celdas.map((d, i) => {
          if (d === null) return <span key={`v${i}`} className="cal-celda cal-celda--vacia" />;
          const k = isoYMD(y, m, d);
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
                  <span className="cal-chips">
                    {otros.slice(0, MAX_CHIPS).map((e, j) => <Chip key={j} e={e} />)}
                    {restantes > 0 && <span className="cal-chip cal-chip--mas">+{restantes} más</span>}
                  </span>
                  <span className="cal-puntos">
                    {otros.slice(0, MAX_PUNTOS).map((e, j) => <span key={j} className={`cal-punto cal-punto--${e.color || "aqua"}`} />)}
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
              <span className={`cal-evento-ico cal-ico--${e.color || "aqua"}`} aria-hidden="true">
                {e.icono ? <Icon name={e.icono} size={15} /> : <span className={`cal-punto cal-punto--${e.color || "aqua"}`} />}
              </span>
              <span className="cal-evento-titulo">{e.titulo}</span>
              {e.detalle && <em className="cal-evento-detalle">{e.detalle}</em>}
            </div>
          ))
        )}
      </div>
    </>
  );
}

// --- Vista SEMANA (agenda de 7 columnas) ---
function VistaSemana({ ancla, hoyStr, porDia, setAncla, setVista, hayDia }) {
  const ini = inicioSemana(ancla);
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(ini, i));

  return (
    <div className="cal-semana">
      {dias.map((d, i) => {
        const k = iso(d);
        const evs = porDia[k] || [];
        const festivo = evs.find((e) => e.esFestivo);
        const otros = evs.filter((e) => !e.esFestivo);
        const abrirDia = () => { if (hayDia) { setAncla(new Date(d)); setVista("dia"); } };
        return (
          <div key={k} className={`cal-sem-col${k === hoyStr ? " cal-sem-col--hoy" : ""}${festivo ? " cal-sem-col--festivo" : ""}`}>
            <button type="button" className="cal-sem-head" onClick={abrirDia} title={hayDia ? "Ver día" : undefined}>
              <span className="cal-sem-dow">{DOW[i]}</span>
              <span className="cal-sem-num">{d.getDate()}</span>
            </button>
            <div className="cal-sem-body">
              {festivo && (
                <div className="cal-sem-festivo" title={festivo.titulo}>
                  <Icon name={festivo.icono || "partyPopper"} size={12} />
                  <span>{festivo.titulo}</span>
                </div>
              )}
              {otros.map((e, j) => <Chip key={j} e={e} />)}
              {evs.length === 0 && <span className="cal-sem-vacio">—</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// --- Vista DÍA (agenda de un día) ---
function VistaDia({ ancla, porDia }) {
  const k = iso(ancla);
  const evs = porDia[k] || [];
  const festivo = evs.find((e) => e.esFestivo);
  const otros = evs.filter((e) => !e.esFestivo);

  return (
    <div className="cal-dia-view">
      {festivo && (
        <div className="cal-dia-banner">
          <Icon name={festivo.icono || "partyPopper"} size={18} />
          <div>
            <strong>{festivo.titulo}</strong>
            <span>Día no laborable</span>
          </div>
        </div>
      )}
      {otros.length === 0 && !festivo ? (
        <p className="cal-vacio">Sin eventos este día.</p>
      ) : (
        <div className="cal-dia-lista">
          {otros.map((e, i) => (
            <div key={i} className="cal-dia-evento">
              <span className={`cal-evento-ico cal-ico--${e.color || "aqua"}`} aria-hidden="true">
                {e.icono ? <Icon name={e.icono} size={16} /> : <span className={`cal-punto cal-punto--${e.color || "aqua"}`} />}
              </span>
              <div className="cal-dia-evento-txt">
                <strong>{e.titulo}</strong>
                {e.detalle && <span>{e.detalle}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
