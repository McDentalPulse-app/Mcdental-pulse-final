import { useMemo, useState } from "react";
import PageHeader from "../common/PageHeader";
import EmptyState from "../common/EmptyState";
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

// Un <input type="time"> dispara onChange mientras se escribe, y a medio teclear el valor puede
// venir vacío o incompleto. Guardar eso pisaría el turno con una hora inválida.
const horaCompleta = (v) => /^\d{2}:\d{2}$/.test(v || "");

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
 * Un día del empleado: o trabaja (con SU entrada, SU salida y SU tolerancia) o no trabaja.
 *
 * Cada día se edita aquí y no contra un "turno estándar" con excepciones derivadas, que era el
 * diseño anterior: para poner el jueves distinto del resto había que cambiar el estándar, quitar
 * el jueves y volver a marcarlo, porque la fila editable del jueves solo aparecía DESPUÉS de que
 * ya fuera distinta. Un horario como "lunes a miércoles 10–14, jueves y viernes 10–19, sábado
 * libre" era literalmente incapturable. Ahora cada renglón es independiente.
 *
 * La tolerancia va SIN control (defaultValue + onBlur) a propósito: es un número que se teclea
 * dígito a dígito, y guardar en cada pulsación mandaba un upsert por tecla —y con la respuesta
 * asíncrona pisando el valor, el campo peleaba con quien escribía. El `key` la vuelve a montar
 * cuando el servidor confirma otro valor, así que tampoco se queda desincronizada.
 */
function DiaFila({ dia, fila, ocupado, onGuardar, onQuitar, estandar }) {
  const trabaja = !!fila;

  return (
    <div className={`horarios-dia-row${trabaja ? "" : " horarios-dia-row--libre"}`}>
      <button
        type="button"
        className={`horarios-dia-chip${trabaja ? " horarios-dia-chip--on" : ""}`}
        aria-pressed={trabaja}
        disabled={ocupado}
        title={trabaja ? `Quitar el ${dia.label} (pasa a no trabajar)` : `Marcar que sí trabaja el ${dia.label}`}
        onClick={() => (trabaja ? onQuitar(fila, dia.label) : onGuardar(dia.iso, estandar))}
      >
        {dia.label}
      </button>

      {trabaja ? (
        <>
          <label>
            Entrada
            <input
              type="time"
              value={hhmm(fila.horaEntrada)}
              disabled={ocupado}
              aria-label={`Entrada del ${dia.label}`}
              onChange={(e) => horaCompleta(e.target.value) && onGuardar(dia.iso, { horaEntrada: e.target.value })}
            />
          </label>
          <label>
            Salida
            <input
              type="time"
              value={hhmm(fila.horaSalida)}
              disabled={ocupado}
              aria-label={`Salida del ${dia.label}`}
              onChange={(e) => horaCompleta(e.target.value) && onGuardar(dia.iso, { horaSalida: e.target.value })}
            />
          </label>
          <label>
            Tolerancia
            <span className="horarios-tol-wrap">
              ±
              <input
                key={fila.toleranciaMin}
                type="number"
                min="0"
                max="120"
                defaultValue={fila.toleranciaMin}
                disabled={ocupado}
                aria-label={`Tolerancia del ${dia.label}`}
                onBlur={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v) && v >= 0 && v <= 120 && v !== fila.toleranciaMin) {
                    onGuardar(dia.iso, { toleranciaMin: v });
                  }
                }}
              />
              min
            </span>
          </label>
          <button
            type="button"
            className="mc-btn-outline horarios-quitar"
            disabled={ocupado}
            onClick={() => onQuitar(fila, dia.label)}
          >
            No trabaja
          </button>
        </>
      ) : (
        <span className="horarios-dia-libre">No trabaja este día · no cuenta como falta</span>
      )}
    </div>
  );
}

/**
 * Una fila plegable por empleado. Colapsada: resumen (días con turno + horario o "varios").
 * Expandida: un renglón por cada uno de los 7 días, cada uno con su propio horario, más un
 * turno estándar arriba que sirve de atajo para rellenar varios días de golpe.
 *
 * El `est` local es el borrador de "qué turno aplicar al marcar un día"; arranca del estándar
 * derivado y no se re-sincroniza solo (es un input, no un espejo).
 */
function EmpleadoHorario({ empleado, dias, guardando, onGuardarDia, onQuitarDia }) {
  const estandarDerivado = useMemo(() => turnoEstandar(dias), [dias]);
  const [est, setEst] = useState(estandarDerivado);

  const filaDe = (iso) => dias.find((d) => d.diaSemana === iso) || null;
  const activos = dias.length;
  const ocupadoDia = (iso) => guardando === `${empleado.id}-${iso}`;

  // Qué decir en la fila colapsada: si todos los días llevan el mismo horario, ese horario;
  // si no, "horarios distintos" — que es información, no un defecto que haya que esconder.
  const rangos = [...new Set(dias.map((d) => `${hhmm(d.horaEntrada)}–${hhmm(d.horaSalida)}`))];
  const resumenHoras = rangos.length === 1 ? rangos[0] : `${rangos.length} horarios distintos`;

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
            {activos === 0 ? "Sin turnos" : `${activos} día${activos === 1 ? "" : "s"} · ${resumenHoras}`}
          </div>
          <div className="rh-data-row-meta-secondary">
            {activos === 0 ? "no trabaja ningún día" : `${7 - activos} día${7 - activos === 1 ? "" : "s"} sin trabajar`}
          </div>
        </div>
        <Icon name="chevronDown" size={18} className="asistencia-empleado-chevron" />
      </summary>

      <div className="horarios-editor">
        <div className="horarios-estandar">
          <span className="horarios-editor-label">Turno para rellenar rápido</span>
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
            Aplicar a los días que ya trabaja
          </button>
        </div>

        <div className="horarios-semana">
          <span className="horarios-editor-label">Cada día por separado</span>
          {DIAS.map((d) => (
            <DiaFila
              key={d.iso}
              dia={d}
              fila={filaDe(d.iso)}
              ocupado={ocupadoDia(d.iso)}
              estandar={est}
              onGuardar={onGuardarDia}
              onQuitar={onQuitarDia}
            />
          ))}
        </div>
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

  // admin/admin_plus/psicologa no cuentan como plantilla aquí — ensuciaban el conteo por
  // sucursal (Mario Ruiz y la psicóloga, ambos con sucursal "Oficina Administrativa" cargada).
  // No les quita el acceso a la app ni su checador propio (psicologa sí fichaba) — solo los
  // saca de esta grilla de asignación de horario, a pedido del dueño.
  const empleados = useMemo(
    () => usuarios
      .filter((u) => !u.inactivo && !["admin", "admin_plus", "psicologa"].includes(u.role))
      .sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [usuarios]
  );

  const sucursales = useMemo(
    () => [...new Set(empleados.map((u) => u.sucursal).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [empleados]
  );

  // Sin sucursal elegida todavía, cae en la primera de la lista — derivado en vez de un
  // efecto que la fijara después del primer render (parpadeo: "0 empleados" hasta que corría).
  const filtroSucursalEfectivo = filtroSucursal || sucursales[0] || "";

  const empleadosFiltrados = useMemo(
    () => empleados.filter((u) => u.sucursal === filtroSucursalEfectivo),
    [empleados, filtroSucursalEfectivo]
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
        subtitle="Cada día con su propio horario. Los días sin turno son descanso."
      />

      <Card className="horarios-panel">
        {/* El texto va en UN solo <span>: .mc-hint es flex, y sin esto cada <strong> y cada
            trozo de texto suelto se vuelve un ítem del flex — el párrafo se parte en columnas. */}
        <p className="mc-hint">
          <Icon name="alert" size={15} />
          <span>
            Cada día se configura por separado: alguien puede entrar de lunes a miércoles de 10:00 a
            14:00, jueves y viernes de 10:00 a 19:00 y no venir el sábado. Un día sin turno{" "}
            <strong>no cuenta como falta</strong>. La <strong>tolerancia</strong> son los minutos de
            gracia antes de contar retardo: con entrada a las 9:00 y 10 de tolerancia, las 9:10
            llegan a tiempo; las 9:11, no.
          </span>
        </p>
        <div className="horarios-filtro">
          <Icon name="mapPin" size={15} />
          <span>Sucursal</span>
          <WeekSelect
            value={filtroSucursalEfectivo}
            options={sucursales.map((s) => ({ value: s, label: s }))}
            onChange={setFiltroSucursal}
            icon={null}
          />
          <em>{empleadosFiltrados.length} {empleadosFiltrados.length === 1 ? "empleado" : "empleados"}</em>
        </div>
      </Card>

      {empleadosFiltrados.length === 0 ? (
        <Card><EmptyState message="No hay empleados en esta sucursal." /></Card>
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
