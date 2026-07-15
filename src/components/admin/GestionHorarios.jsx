import { useMemo, useState } from "react";
import PageHeader from "../common/PageHeader";
import Card from "../common/Card";
import Icon from "../ui/Icon";
import Avatar from "../ui/Avatar";
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

/**
 * Rejilla de horarios: empleado × día de la semana.
 *
 * Sin horarios cargados, el checador registra la hora a la que alguien llegó pero no
 * puede decir si llegó tarde — "las 9:07" no significa nada si nadie sabe cuál era su
 * entrada. Por eso esta pantalla es parte del alcance, no un extra.
 *
 * Una celda vacía NO es un error: es el día de descanso. Ese día no cuenta como falta.
 */
export default function GestionHorarios({ usuarios = [], horarios = [], setHorarios }) {
  const { toast, confirm } = useNotification();
  const [guardando, setGuardando] = useState(null); // `${empleadoId}-${dia}`

  const empleados = useMemo(
    () => usuarios.filter((u) => !u.inactivo).sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [usuarios]
  );

  const buscar = (empleadoId, diaSemana) =>
    horarios.find((h) => h.empleadoId === empleadoId && h.diaSemana === diaSemana) || null;

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

      <Card>
        <p className="mc-hint">
          <Icon name="alert" size={15} />
          La <strong>tolerancia</strong> son los minutos de gracia antes de contar retardo. Con
          entrada a las 9:00 y 10 minutos de tolerancia, las 9:10 llegan a tiempo; las 9:11, no.
        </p>
      </Card>

      {empleados.map((u) => (
        <Card key={u.id} className="horarios-empleado">
          <header className="asistencia-empleado-head">
            <Avatar name={u.name} photoUrl={u.avatarUrl} size={32} />
            <div>
              <strong>{u.name}</strong>
              <span>{u.sucursal}</span>
            </div>
          </header>

          <div className="horarios-rejilla">
            {DIAS.map((d) => {
              const h = buscar(u.id, d.iso);
              const clave = `${u.id}-${d.iso}`;
              const ocupado = guardando === clave;

              return (
                <div key={d.iso} className={`horarios-celda ${h ? "" : "horarios-celda--descanso"}`}>
                  <span className="horarios-celda-dia">{d.label}</span>

                  {h ? (
                    <>
                      <input
                        type="time"
                        value={h.horaEntrada.slice(0, 5)}
                        disabled={ocupado}
                        onChange={(e) => guardar(u.id, d.iso, { horaEntrada: e.target.value })}
                        aria-label={`Entrada del ${d.label}`}
                      />
                      <input
                        type="time"
                        value={h.horaSalida.slice(0, 5)}
                        disabled={ocupado}
                        onChange={(e) => guardar(u.id, d.iso, { horaSalida: e.target.value })}
                        aria-label={`Salida del ${d.label}`}
                      />
                      <label className="horarios-tolerancia">
                        ±
                        <input
                          type="number"
                          min="0"
                          max="120"
                          value={h.toleranciaMin}
                          disabled={ocupado}
                          onChange={(e) => guardar(u.id, d.iso, { toleranciaMin: Number(e.target.value) })}
                          aria-label={`Tolerancia del ${d.label}`}
                        />
                        min
                      </label>
                      <button
                        type="button"
                        className="mc-btn-outline horarios-quitar"
                        onClick={() => quitar(h, u, d.label)}
                      >
                        Quitar
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="mc-btn-outline"
                      disabled={ocupado}
                      onClick={() => guardar(u.id, d.iso, DEFECTO)}
                    >
                      <Icon name="plus" size={14} /> Añadir turno
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}
