import { useMemo, useState, useEffect, useRef } from "react";
import Icon from "../ui/Icon";
import EventoModal from "./EventoModal";

/**
 * Agenda de la clínica al estilo "event calendar" de Untitled UI: vistas Mes / Semana / Día con
 * rejilla de horas, línea de "ahora", y creación/edición de eventos ("Agregar evento").
 * Implementación propia. Recibe dos fuentes:
 *   - `overlay`: eventos por DÍA (festivos, vacaciones, permisos, intercambios), solo lectura.
 *   - `citas`:   eventos con hora (tabla eventos_calendario), editables por gestión.
 */

const DOW = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MES_ABR = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
const HORA_ALTO = 52; // px por hora en semana/día
const MAX_CHIPS = 3;

const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const isoYMD = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const inicioSemana = (d) => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); x.setHours(0, 0, 0, 0); return x; };
const sumar = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const min = (hhmm) => { const [h, m] = (hhmm || "0:0").split(":").map(Number); return h * 60 + m; };
const numSemana = (d) => { const primero = new Date(d.getFullYear(), 0, 1); return Math.ceil(((d - primero) / 86400000 + primero.getDay() + 1) / 7); };
const h12 = (h) => (h === 0 ? "12 a.m." : h < 12 ? `${h} a.m.` : h === 12 ? "12 p.m." : `${h - 12} p.m.`);

export default function AgendaClinica({ overlay = [], citas = [], onGuardarEvento, onEliminarEvento, puedeEditar = false }) {
  const hoy = new Date();
  const hoyStr = isoYMD(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const [vista, setVista] = useState("mes");
  const [ancla, setAncla] = useState(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()));
  const [modal, setModal] = useState(null); // { evento } | { fecha } | null

  // Eventos por día. Overlay (día) + citas de todo el día → chips "all-day"; citas con hora → timed.
  const porDia = useMemo(() => {
    const map = {};
    const push = (k, v) => (map[k] ||= []).push(v);
    for (const e of overlay) {
      if (!e?.fecha) continue;
      const ini = new Date(`${e.fecha}T00:00:00`), fin = new Date(`${e.fechaFin || e.fecha}T00:00:00`);
      for (const d = new Date(ini); d <= fin; d.setDate(d.getDate() + 1)) push(iso(d), { ...e, _tipo: "overlay" });
    }
    for (const c of citas) {
      push(c.fecha, { ...c, _tipo: c.todoElDia || !c.horaInicio ? "allday" : "timed" });
    }
    return map;
  }, [overlay, citas]);

  const mover = (dir) => setAncla((a) => {
    const x = new Date(a);
    if (vista === "mes") x.setMonth(x.getMonth() + dir);
    else if (vista === "semana") x.setDate(x.getDate() + 7 * dir);
    else x.setDate(x.getDate() + dir);
    return x;
  });
  const irHoy = () => setAncla(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()));

  const rango = (() => {
    const ini = inicioSemana(ancla), fin = sumar(ini, 6);
    if (vista === "dia") return cap(ancla.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" }));
    if (vista === "semana") return `${ini.getDate()} ${MESES[ini.getMonth()].slice(0, 3)} – ${fin.getDate()} ${MESES[fin.getMonth()].slice(0, 3)} ${fin.getFullYear()}`;
    return `1 ${MESES[ancla.getMonth()].slice(0, 3)} – ${new Date(ancla.getFullYear(), ancla.getMonth() + 1, 0).getDate()} ${MESES[ancla.getMonth()].slice(0, 3)} ${ancla.getFullYear()}`;
  })();

  const abrirNuevo = (fecha) => { if (puedeEditar) setModal({ fecha: fecha || iso(ancla) }); };
  const abrirEvento = (cita) => { if (puedeEditar) setModal({ evento: cita }); };

  const guardar = async (form) => {
    const r = modal?.evento ? await onGuardarEvento(modal.evento.id, form) : await onGuardarEvento(null, form);
    return !!r;
  };

  return (
    <div className="agenda">
      <div className="agenda-top">
        <div className="agenda-title">
          <div className="agenda-badge">
            <span className="agenda-badge-mes">{MES_ABR[hoy.getMonth()]}</span>
            <span className="agenda-badge-dia">{hoy.getDate()}</span>
          </div>
          <div>
            <div className="agenda-title-row">
              <strong>{cap(MESES[ancla.getMonth()])} {ancla.getFullYear()}</strong>
              <span className="agenda-week-pill">Semana {numSemana(ancla)}</span>
            </div>
            <div className="agenda-rango">{rango}</div>
          </div>
        </div>

        <div className="agenda-acciones">
          <div className="agenda-nav">
            <button type="button" className="cal-nav" onClick={() => mover(-1)} aria-label="Anterior">‹</button>
            <button type="button" className="agenda-hoy" onClick={irHoy}>Hoy</button>
            <button type="button" className="cal-nav" onClick={() => mover(1)} aria-label="Siguiente">›</button>
          </div>
          <select className="agenda-vista-select" value={vista} onChange={(e) => setVista(e.target.value)} aria-label="Vista">
            <option value="mes">Vista Mes</option>
            <option value="semana">Vista Semana</option>
            <option value="dia">Vista Día</option>
          </select>
          {puedeEditar && (
            <button type="button" className="agenda-add" onClick={() => abrirNuevo()}>
              <Icon name="plus" size={16} /> Agregar evento
            </button>
          )}
        </div>
      </div>

      {vista === "mes" && <Mes {...{ ancla, hoyStr, porDia, abrirEvento, abrirNuevo }} />}
      {vista === "semana" && <Semana {...{ ancla, hoyStr, hoy, porDia, abrirEvento, abrirNuevo }} />}
      {vista === "dia" && <Dia {...{ ancla, hoyStr, hoy, porDia, abrirEvento, abrirNuevo }} />}

      {modal && (
        <EventoModal
          evento={modal.evento}
          fechaInicial={modal.fecha}
          onGuardar={guardar}
          onEliminar={onEliminarEvento}
          onCerrar={() => setModal(null)}
        />
      )}
    </div>
  );
}

// --- Chip (mes/semana) ---
function ChipEvento({ e, onClick }) {
  if (e._tipo === "timed") {
    return (
      <button type="button" className={`agenda-chip agenda-chip--${e.color || "azul"}`} onClick={onClick} title={e.titulo}>
        <span className="agenda-chip-punto" />
        <span className="agenda-chip-txt">{e.titulo}</span>
        <span className="agenda-chip-hora">{e.horaInicio}</span>
      </button>
    );
  }
  // overlay (festivo ya se maneja aparte) o all-day
  return (
    <button type="button" className={`agenda-chip agenda-chip--${e.color || "gris"}`} onClick={onClick} title={e.titulo}>
      {e.icono && <span className="agenda-chip-ico"><Icon name={e.icono} size={11} /></span>}
      <span className="agenda-chip-txt">{e.etiqueta || e.titulo}</span>
    </button>
  );
}

// --- Vista MES ---
function Mes({ ancla, hoyStr, porDia, abrirEvento, abrirNuevo }) {
  const y = ancla.getFullYear(), m = ancla.getMonth();
  const offset = (new Date(y, m, 1).getDay() + 6) % 7;
  const total = new Date(y, m + 1, 0).getDate();
  const inicioGrid = sumar(new Date(y, m, 1), -offset);
  const celdas = Array.from({ length: 42 }, (_, i) => sumar(inicioGrid, i));
  const ultimo = celdas[41];
  const filas = ultimo.getDate() < 8 && ultimo.getMonth() !== m ? 6 : Math.ceil((offset + total) / 7);

  return (
    <div className="agenda-mes">
      <div className="agenda-mes-dow">{DOW.map((d, i) => <span key={i}>{d.toLowerCase()}</span>)}</div>
      <div className="agenda-mes-grid" style={{ gridTemplateRows: `repeat(${filas}, minmax(120px, 1fr))` }}>
        {celdas.slice(0, filas * 7).map((d) => {
          const k = iso(d);
          const fuera = d.getMonth() !== m;
          const evs = porDia[k] || [];
          const festivo = evs.find((e) => e.esFestivo);
          const otros = evs.filter((e) => !e.esFestivo).sort((a, b) => (a._tipo === "timed" ? min(a.horaInicio) : -1) - (b._tipo === "timed" ? min(b.horaInicio) : -1));
          const rest = otros.length - MAX_CHIPS;
          return (
            <div
              key={k}
              className={`agenda-celda${fuera ? " agenda-celda--fuera" : ""}${k === hoyStr ? " agenda-celda--hoy" : ""}${festivo ? " agenda-celda--festivo" : ""}`}
              onClick={() => abrirNuevo(k)}
            >
              <span className={`agenda-celda-num${k === hoyStr ? " agenda-celda-num--hoy" : ""}`}>{d.getDate()}</span>
              {festivo && <span className="agenda-festivo"><Icon name={festivo.icono || "partyPopper"} size={11} /> {festivo.titulo}</span>}
              {otros.slice(0, MAX_CHIPS).map((e, j) => (
                <ChipEvento key={j} e={e} onClick={(ev) => { ev.stopPropagation(); if (e._tipo === "timed") abrirEvento(e); }} />
              ))}
              {rest > 0 && <span className="agenda-mas">{rest} más…</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Rejilla de horas (semana/día) ---
function RejillaHoras({ dias, hoyStr, hoy, porDia, abrirEvento, abrirNuevo }) {
  const scrollRef = useRef(null);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 7 * HORA_ALTO; }, []);
  const ahoraMin = hoy.getHours() * 60 + hoy.getMinutes();

  return (
    <div className="agenda-horas" ref={scrollRef}>
      <div className="agenda-horas-inner" style={{ gridTemplateColumns: `56px repeat(${dias.length}, 1fr)` }}>
        {/* Columna de horas */}
        <div className="agenda-horas-col">
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="agenda-hora-label" style={{ height: HORA_ALTO }}>{h > 0 ? h12(h) : ""}</div>
          ))}
        </div>
        {/* Columnas de días */}
        {dias.map((d) => {
          const k = iso(d);
          const timed = (porDia[k] || []).filter((e) => e._tipo === "timed");
          const esHoy = k === hoyStr;
          return (
            <div key={k} className={`agenda-dia-col${esHoy ? " agenda-dia-col--hoy" : ""}`} style={{ height: 24 * HORA_ALTO }}
              onClick={(ev) => { if (ev.target.classList.contains("agenda-dia-col")) abrirNuevo(k); }}>
              {Array.from({ length: 24 }, (_, h) => <div key={h} className="agenda-hora-linea" style={{ top: h * HORA_ALTO }} />)}
              {esHoy && <div className="agenda-ahora" style={{ top: (ahoraMin / 60) * HORA_ALTO }} />}
              {timed.map((e, j) => {
                const ini = min(e.horaInicio), fin = e.horaFin ? min(e.horaFin) : ini + 60;
                return (
                  <button key={j} type="button" className={`agenda-bloque agenda-bloque--${e.color || "azul"}`}
                    style={{ top: (ini / 60) * HORA_ALTO, height: Math.max(24, ((fin - ini) / 60) * HORA_ALTO) }}
                    onClick={(ev) => { ev.stopPropagation(); abrirEvento(e); }} title={e.titulo}>
                    <strong>{e.titulo}</strong>
                    <span>{e.horaInicio}{e.horaFin ? `–${e.horaFin}` : ""}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Vista SEMANA ---
function Semana({ ancla, hoyStr, hoy, porDia, abrirEvento, abrirNuevo }) {
  const ini = inicioSemana(ancla);
  const dias = Array.from({ length: 7 }, (_, i) => sumar(ini, i));
  return (
    <div className="agenda-semana">
      <div className="agenda-semana-head" style={{ gridTemplateColumns: `56px repeat(7, 1fr)` }}>
        <span />
        {dias.map((d, i) => (
          <div key={iso(d)} className={`agenda-semana-dia${iso(d) === hoyStr ? " agenda-semana-dia--hoy" : ""}`}>
            <span className="agenda-semana-dow">{DOW[i].toLowerCase()}</span>
            <span className="agenda-semana-num">{d.getDate()}</span>
          </div>
        ))}
      </div>
      <TodoElDiaBanda dias={dias} porDia={porDia} abrirEvento={abrirEvento} />
      <RejillaHoras dias={dias} hoyStr={hoyStr} hoy={hoy} porDia={porDia} abrirEvento={abrirEvento} abrirNuevo={abrirNuevo} />
    </div>
  );
}

// --- Vista DÍA ---
function Dia({ ancla, hoyStr, hoy, porDia, abrirEvento, abrirNuevo }) {
  return (
    <div className="agenda-diaview">
      <TodoElDiaBanda dias={[ancla]} porDia={porDia} abrirEvento={abrirEvento} />
      <RejillaHoras dias={[ancla]} hoyStr={hoyStr} hoy={hoy} porDia={porDia} abrirEvento={abrirEvento} abrirNuevo={abrirNuevo} />
    </div>
  );
}

// --- Banda "todo el día" (festivos, vacaciones, permisos, citas de todo el día) ---
function TodoElDiaBanda({ dias, porDia, abrirEvento }) {
  const hay = dias.some((d) => (porDia[iso(d)] || []).some((e) => e._tipo !== "timed"));
  if (!hay) return null;
  return (
    <div className="agenda-allday" style={{ gridTemplateColumns: `56px repeat(${dias.length}, 1fr)` }}>
      <span className="agenda-allday-label">Todo el día</span>
      {dias.map((d) => {
        const evs = (porDia[iso(d)] || []).filter((e) => e._tipo !== "timed");
        return (
          <div key={iso(d)} className="agenda-allday-col">
            {evs.map((e, j) => (
              <ChipEvento key={j} e={e} onClick={(ev) => { ev.stopPropagation(); if (e._tipo === "timed") abrirEvento(e); }} />
            ))}
          </div>
        );
      })}
    </div>
  );
}
