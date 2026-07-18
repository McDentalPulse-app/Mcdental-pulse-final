import { useEffect, useMemo, useState } from "react";
import PageHeader from "../common/PageHeader";
import Card from "../common/Card";
import Icon from "../ui/Icon";
import WeekSelect from "../common/WeekSelect";
import { useNotification } from "../../contexts/NotificationContext";
import { upsertHorario, deleteHorario } from "../../services/supabase/horariosService";

// ISO: 1=lunes … 7=domingo. La misma numeración que horarios.dia_semana y que diaISO().
const DIAS = [
  { iso: 1, label: "Lun" },
  { iso: 2, label: "Mar" },
  { iso: 3, label: "Mié" },
  { iso: 4, label: "Jue" },
  { iso: 5, label: "Vie" },
  { iso: 6, label: "Sáb" },
  { iso: 7, label: "Dom" },
];

// El horario general de la clínica: 10:00 a 19:00, con 10 minutos de tolerancia.
const DEFECTO = { horaEntrada: "10:00", horaSalida: "19:00", toleranciaMin: 10 };

const hhmm = (t) => (t || "").slice(0, 5);

// Dos turnos son "el mismo" si coinciden entrada, salida y tolerancia.
const mismoTurno = (fila, est) =>
  hhmm(fila.horaEntrada) === hhmm(est.horaEntrada) &&
  hhmm(fila.horaSalida) === hhmm(est.horaSalida) &&
  Number(fila.toleranciaMin) === Number(est.toleranciaMin);

// El turno "estándar" de un empleado = el más frecuente entre sus días con horario
// (empate → el primero que aparece). Sin días cargados → el default de la clínica.
// Así, si alguien trabaja 08–17 toda la semana, ESE es su estándar, no una excepción.
const turnoEstandar = (dias) => {
  if (!dias.length) return { ...DEFECTO };
  const conteo = new Map();
  for (const d of dias) {
    const k = `${hhmm(d.horaEntrada)}|${hhmm(d.horaSalida)}|${Number(d.toleranciaMin)}`;
    conteo.set(k, (conteo.get(k) || 0) + 1);
  }
  let mejor = null;
  let max = 0;
  for (const [k, n] of conteo) if (n > max) { max = n; mejor = k; }
  const [horaEntrada, horaSalida, toleranciaMin] = mejor.split("|");
  return { horaEntrada, horaSalida, toleranciaMin: Number(toleranciaMin) };
};

/**
 * Una fila plegable por empleado. Colapsada: resumen (días marcados + turno estándar).
 * Expandida: el turno estándar editable + los 7 días como chips (prender = poner ese
 * turno ese día; apagar = descanso) + las excepciones (días con un turno distinto al
 * estándar), editables aparte. El `est` local es el borrador de "qué turno aplicar";
 * arranca del estándar derivado y no se re-sincroniza solo (es un input, no un espejo).
 */
function EmpleadoHorario({ empleado, dias, guardando, onGuardarDia, onQuitarDia }) {
  const estandarDerivado = useMemo(() => turnoEstandar(dias), [dias]);
  const [est, setEst] = useState(estandarDerivado);

  const filaDe = (iso) => dias.find((d) => d.diaSemana === iso) || null;
  const activos = dias.length;
  const excepciones = dias
    .filter((d) => !mismoTurno(d, est))
    .sort((a, b) => a.diaSemana - b.diaSemana);
  const ocupadoDia = (iso) => guardando === `${empleado.id}-${iso}`;

  const toggleDia = (d) => {
    const row = filaDe(d.iso);
    if (row) onQuitarDia(row, d.label);
    else onGuardarDia(d.iso, est);
  };

  // Reaplica el turno estándar a TODOS los días marcados de un tiro (la captura rápida).
  const aplicarAmarcados = () => {
    for (const d of dias) onGuardarDia(d.diaSemana, est);
  };

  return (
    <details className="horarios-empleado-row">
      <summary className="rh-data-row">
        <div className="rh-data-row-main">
          <div className="rh-data-row-title">{empleado.name}</div>
          <div className="rh-data-row-sub">{empleado.sucursal}</div>
        </div>
        <div className="horarios-mini-semana" aria-hidden="true">
          {DIAS.map((d) => (
            <span key={d.iso} className={`horarios-mini-dia${filaDe(d.iso) ? " horarios-mini-dia--on" : ""}`}>
              {d.label[0]}
            </span>
          ))}
        </div>
        <div className="rh-data-row-meta">
          <div className="rh-data-row-meta-primary">
            {activos === 0 ? "Sin turnos" : `${activos} día${activos === 1 ? "" : "s"} · ${hhmm(est.horaEntrada)}–${hhmm(est.horaSalida)}`}
          </div>
          <div className="rh-data-row-meta-secondary">
            {excepciones.length > 0
              ? `${excepciones.length} excepción${excepciones.length === 1 ? "" : "es"}`
              : `tolerancia ${est.toleranciaMin} min`}
          </div>
        </div>
        <Icon name="chevronDown" size={18} className="asistencia-empleado-chevron" />
      </summary>

      <div className="horarios-editor">
        <div className="horarios-estandar">
          <span className="horarios-editor-label">Turno estándar</span>
          <label>
            Entrada
            <input type="time" value={hhmm(est.horaEntrada)} onChange={(e) => setEst((s) => ({ ...s, horaEntrada: e.target.value }))} />
          </label>
          <label>
            Salida
            <input type="time" value={hhmm(est.horaSalida)} onChange={(e) => setEst((s) => ({ ...s, horaSalida: e.target.value }))} />
          </label>
          <label>
            Tolerancia
            <span className="horarios-tol-wrap">
              ±<input type="number" min="0" max="120" value={est.toleranciaMin} onChange={(e) => setEst((s) => ({ ...s, toleranciaMin: Number(e.target.value) }))} />min
            </span>
          </label>
          <button type="button" className="mc-btn-outline" onClick={aplicarAmarcados} disabled={activos === 0}>
            Aplicar a días marcados
          </button>
        </div>

        <div className="horarios-dias">
          <span className="horarios-editor-label">Días</span>
          {DIAS.map((d) => {
            const on = !!filaDe(d.iso);
            return (
              <button
                key={d.iso}
                type="button"
                className={`horarios-dia-chip${on ? " horarios-dia-chip--on" : ""}`}
                aria-pressed={on}
                disabled={ocupadoDia(d.iso)}
                onClick={() => toggleDia(d)}
              >
                {d.label}
              </button>
            );
          })}
        </div>

        {excepciones.length > 0 && (
          <div className="horarios-excepciones">
            <span className="horarios-editor-label">Excepciones (turno distinto al estándar)</span>
            {excepciones.map((row) => {
              const d = DIAS.find((x) => x.iso === row.diaSemana);
              const ocupado = ocupadoDia(row.diaSemana);
              return (
                <div key={row.diaSemana} className="horarios-exc-row">
                  <span className="horarios-exc-dia">{d.label}</span>
                  <input type="time" value={hhmm(row.horaEntrada)} disabled={ocupado} aria-label={`Entrada del ${d.label}`}
                    onChange={(e) => onGuardarDia(row.diaSemana, { horaEntrada: e.target.value })} />
                  <input type="time" value={hhmm(row.horaSalida)} disabled={ocupado} aria-label={`Salida del ${d.label}`}
                    onChange={(e) => onGuardarDia(row.diaSemana, { horaSalida: e.target.value })} />
                  <span className="horarios-tol-wrap">
                    ±<input type="number" min="0" max="120" value={row.toleranciaMin} disabled={ocupado} aria-label={`Tolerancia del ${d.label}`}
                      onChange={(e) => onGuardarDia(row.diaSemana, { toleranciaMin: Number(e.target.value) })} />min
                  </span>
                  <button type="button" className="mc-btn-outline horarios-quitar" onClick={() => onQuitarDia(row, d.label)}>
                    Quitar
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </details>
  );
}

/**
 * Horarios: un turno por empleado y día de la semana.
 *
 * Sin horarios cargados, el checador registra la hora a la que alguien llegó pero no
 * puede decir si llegó tarde — "las 9:07" no significa nada si nadie sabe cuál era su
 * entrada. Por eso esta pantalla es parte del alcance, no un extra.
 *
 * Un día sin fila NO es un error: es descanso. Ese día no cuenta como falta.
 */
export default function GestionHorarios({ usuarios = [], horarios = [], setHorarios }) {
  const { toast, confirm } = useNotification();
  const [guardando, setGuardando] = useState(null); // `${empleadoId}-${dia}`

  // Se ve UNA sucursal a la vez: con ~100 empleados, una sola lista era interminable.
  const [filtroSucursal, setFiltroSucursal] = useState("");

  const empleados = useMemo(
    () => usuarios.filter((u) => !u.inactivo).sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [usuarios]
  );

  const sucursales = useMemo(
    () => [...new Set(empleados.map((u) => u.sucursal).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [empleados]
  );

  useEffect(() => {
    if (!filtroSucursal && sucursales.length) setFiltroSucursal(sucursales[0]);
  }, [sucursales, filtroSucursal]);

  const empleadosFiltrados = useMemo(
    () => empleados.filter((u) => u.sucursal === filtroSucursal),
    [empleados, filtroSucursal]
  );

  const buscar = (empleadoId, diaSemana) =>
    horarios.find((h) => h.empleadoId === empleadoId && h.diaSemana === diaSemana) || null;

  // Guarda (upsert) el turno de un día. `campos` puede ser parcial (p. ej. solo horaEntrada
  // al editar una excepción): lo que falte se toma de la fila actual o del default.
  const guardar = async (empleadoId, diaSemana, campos) => {
    const clave = `${empleadoId}-${diaSemana}`;
    setGuardando(clave);
    try {
      const actual = buscar(empleadoId, diaSemana);
      const nuevo = await upsertHorario({
        empleadoId,
        diaSemana,
        horaEntrada: campos.horaEntrada ?? actual?.horaEntrada ?? DEFECTO.horaEntrada,
        horaSalida: campos.horaSalida ?? actual?.horaSalida ?? DEFECTO.horaSalida,
        toleranciaMin: campos.toleranciaMin ?? actual?.toleranciaMin ?? DEFECTO.toleranciaMin,
      });
      setHorarios((prev) => {
        const resto = prev.filter((h) => !(h.empleadoId === empleadoId && h.diaSemana === diaSemana));
        return [...resto, nuevo];
      });
    } catch (e) {
      toast.error(e?.message || "No se pudo guardar el horario.");
    } finally {
      setGuardando(null);
    }
  };

  const quitar = async (horario, empleado, diaLabel) => {
    const ok = await confirm({
      title: "Quitar el turno",
      description: `${empleado.name} dejará de tener turno los ${diaLabel}. Ese día pasará a contar como descanso, no como falta.`,
      variant: "warning",
      confirmText: "Quitar turno",
    });
    if (!ok) return;
    try {
      await deleteHorario(horario.id);
      setHorarios((prev) => prev.filter((h) => h.id !== horario.id));
    } catch (e) {
      toast.error(e?.message || "No se pudo quitar el turno.");
    }
  };

  return (
    <div className="admin-page">
      <PageHeader
        icon="calendarDays"
        title="Horarios"
        subtitle="Un turno por empleado y día. Los días sin turno son descanso."
      />

      <Card className="horarios-panel">
        <p className="mc-hint">
          <Icon name="alert" size={15} />
          La <strong>tolerancia</strong> son los minutos de gracia antes de contar retardo. Con
          entrada a las 9:00 y 10 minutos de tolerancia, las 9:10 llegan a tiempo; las 9:11, no.
        </p>
        <div className="horarios-filtro">
          <Icon name="mapPin" size={15} />
          <span>Sucursal</span>
          <WeekSelect
            value={filtroSucursal}
            options={sucursales.map((s) => ({ value: s, label: s }))}
            onChange={setFiltroSucursal}
            icon={null}
          />
          <em>{empleadosFiltrados.length} {empleadosFiltrados.length === 1 ? "empleado" : "empleados"}</em>
        </div>
      </Card>

      {empleadosFiltrados.length === 0 ? (
        <Card><p className="mc-empty">No hay empleados en esta sucursal.</p></Card>
      ) : (
        <div className="rh-data-list">
          {empleadosFiltrados.map((u) => (
            <EmpleadoHorario
              key={u.id}
              empleado={u}
              dias={horarios.filter((h) => h.empleadoId === u.id)}
              guardando={guardando}
              onGuardarDia={(dia, campos) => guardar(u.id, dia, campos)}
              onQuitarDia={(row, label) => quitar(row, u, label)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
