import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "../common/PageHeader";
import Card from "../common/Card";
import StatCard from "../common/StatCard";
import SectionTitle from "../common/SectionTitle";
import Icon from "../ui/Icon";
import Avatar from "../ui/Avatar";
import { useNotification } from "../../contexts/NotificationContext";
import {
  getAsistencias,
  subscribeAsistencias,
  getSignedUrlSelfie,
  anularChecada,
} from "../../services/supabase/asistenciasService";
import {
  construirDias,
  agruparPor,
  resumen,
  requiereRevision,
  detectarDispositivosCompartidos,
  ESTADOS_DIA,
  TZ_CLINICA,
} from "../../utils/asistencia";

const GRANULARIDADES = [
  { valor: "dia", label: "Día" },
  { valor: "semana", label: "Semana" },
  { valor: "mes", label: "Mes" },
  { valor: "anio", label: "Año" },
];

const ETIQUETA_ESTADO = {
  [ESTADOS_DIA.PRESENTE]: "Presente",
  [ESTADOS_DIA.RETARDO]: "Retardo",
  [ESTADOS_DIA.FALTA]: "Falta",
  [ESTADOS_DIA.JUSTIFICADO]: "Justificado",
  [ESTADOS_DIA.DESCANSO]: "Descanso",
  [ESTADOS_DIA.INCOMPLETO]: "Sin salida",
};

const hoyClinica = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ_CLINICA }).format(new Date());

const hace = (dias) => {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ_CLINICA }).format(d);
};

const horaCorta = (ts) =>
  new Intl.DateTimeFormat("es-MX", {
    timeZone: TZ_CLINICA,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(ts));

const minutosAHoras = (min) => (min ? `${Math.floor(min / 60)} h ${min % 60} min` : "—");

export default function AsistenciaPanel({ usuarios = [], horarios = [], permisos = [], vacaciones = [], puedeAnular = false }) {
  const { toast, prompt } = useNotification();

  const [desde, setDesde] = useState(hace(30));
  const [hasta, setHasta] = useState(hoyClinica());
  const [granularidad, setGranularidad] = useState("dia");
  const [empleadoId, setEmpleadoId] = useState("");

  const [checadas, setChecadas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  // Fetch local acotado por rango, NO desde GlobalContext: esta tabla crece sin techo y
  // el contexto se carga entero en cada login. Mismo patrón que BolsaTrabajo.jsx.
  //
  // El estado se toca SOLO en los callbacks del promise, nunca en el cuerpo síncrono del
  // efecto: un setState síncrono ahí encadena un render extra en cada montaje (lo avisa
  // react-hooks/set-state-in-effect).
  //
  // Consecuencia buscada: `cargando` solo vale para la carga inicial. Al cambiar un filtro
  // se sigue viendo la tabla anterior hasta que llega la nueva, en vez de parpadear a
  // "Cargando…" y volver. Es menos brusco y no esconde la información que RH estaba
  // mirando.
  //
  // `cancelado` evita escribir estado de una petición vieja: si RH cambia el rango dos
  // veces seguidas, la primera respuesta puede llegar DESPUÉS de la segunda y pisarla con
  // datos que ya no son los que se están mirando.
  const cargar = useCallback(() => {
    let cancelado = false;

    getAsistencias({ desde, hasta, empleadoId: empleadoId || undefined })
      .then((rows) => {
        if (cancelado) return;
        setChecadas(rows);
        setError(null);
      })
      .catch((e) => {
        if (cancelado) return;
        console.error("Error cargando asistencia:", e);
        setError(e?.message || "No se pudo cargar la asistencia.");
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => { cancelado = true; };
  }, [desde, hasta, empleadoId]);

  useEffect(() => cargar(), [cargar]);

  // Realtime: cuando alguien checa, aparece aquí sin recargar.
  //
  // OJO: payload.new de Postgres NO trae el join con usuarios, así que la fila llega sin
  // nombre ni sucursal. En vez de pintar una fila con el nombre vacío, se refresca desde
  // la base — el coste es una consulta por checada y la alternativa es una interfaz que
  // enseña huecos.
  useEffect(() => {
    const desuscribir = subscribeAsistencias((nueva) => {
      if (nueva.fecha >= desde && nueva.fecha <= hasta) cargar();
    });
    return desuscribir;
  }, [cargar, desde, hasta]);

  const empleados = useMemo(
    () => usuarios.filter((u) => !u.inactivo).sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [usuarios]
  );

  // Los días clasificados, por empleado. Es donde vive todo el criterio (falta vs
  // justificado vs retardo) y está probado en src/utils/asistencia.test.js.
  const porEmpleado = useMemo(() => {
    const objetivo = empleadoId ? empleados.filter((u) => u.id === empleadoId) : empleados;

    return objetivo.map((u) => {
      const dias = construirDias({
        desde,
        hasta,
        checadas: checadas.filter((c) => c.empleadoId === u.id),
        horarios: horarios.filter((h) => h.empleadoId === u.id),
        permisos: permisos.filter((p) => p.empleadoId === u.id),
        vacaciones: vacaciones.filter((v) => v.empleadoId === u.id),
      });
      return { empleado: u, dias, resumen: resumen(dias), grupos: agruparPor(dias, granularidad) };
    });
  }, [empleados, empleadoId, checadas, horarios, permisos, vacaciones, desde, hasta, granularidad]);

  const totales = useMemo(
    () => resumen(porEmpleado.flatMap((e) => e.dias)),
    [porEmpleado]
  );

  // Un mismo teléfono checando a dos personas distintas el mismo día. Es la señal más
  // fuerte de suplantación y necesita ver el conjunto del día, no una checada suelta.
  const compartidos = useMemo(() => detectarDispositivosCompartidos(checadas), [checadas]);

  const paraRevisar = useMemo(
    () => checadas.filter((c) => requiereRevision(c) || compartidos.has(c.id)),
    [checadas, compartidos]
  );

  // Por qué está marcada esta checada. Se enseña el motivo, no un icono de alerta a secas:
  // sin saber QUÉ mirar, RH no puede accionar nada y acaba ignorando la lista entera.
  const motivoRevision = (c) => {
    // La cara primero: es lo más grave que puede decir el sistema.
    if (c.rostroVerificado === false) return "La cara de la foto NO coincide con la de esta persona.";
    if (compartidos.has(c.id)) return "Este mismo teléfono checó hoy a más de un empleado.";
    if (c.ubicacionEstado === "fuera") return `A ${c.distanciaM} m de ${c.sucursal}: fuera del área permitida.`;
    if (c.dispositivoNuevo) return "Checó desde un teléfono que nunca había usado.";
    if (!c.selfiePath) return "Se registró sin foto.";
    if (c.ubicacionEstado === "sin_gps") return "Sin ubicación: no dio permiso de GPS o falló.";
    return "";
  };

  const verSelfie = async (checada) => {
    if (!checada.selfiePath) {
      toast.info("Esa checada se registró sin foto.");
      return;
    }
    try {
      const url = await getSignedUrlSelfie(checada.selfiePath);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("No se pudo abrir la foto.");
    }
  };

  const handleAnular = async (checada) => {
    const nota = await prompt({
      title: "Anular checada",
      description: `¿Por qué se anula la ${checada.tipo} de ${checada.empleado}?`,
      confirmText: "Anular",
    });
    if (nota === null) return; // canceló

    try {
      await anularChecada(checada.id, nota || "Anulada por RH");
      toast.success("Checada anulada.");
      cargar();
    } catch (e) {
      toast.error(e?.message || "No se pudo anular la checada.");
    }
  };

  const exportarCSV = () => {
    const filas = [
      ["Empleado", "Sucursal", "Periodo", "Presentes", "Retardos", "Faltas", "Justificados", "Horas trabajadas", "Puntualidad %"],
    ];

    for (const { empleado, grupos } of porEmpleado) {
      for (const g of grupos) {
        filas.push([
          empleado.name,
          empleado.sucursal || "",
          g.clave,
          g.resumen.presentes,
          g.resumen.retardos,
          g.resumen.faltas,
          g.resumen.justificados,
          (g.resumen.minutosTrabajados / 60).toFixed(1),
          g.resumen.puntualidad,
        ]);
      }
    }

    const contenido = filas.map((f) => f.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    // El BOM es lo que hace que Excel abra los acentos bien en vez de "MartÃ­nez". Se
    // escribe escapado (\uFEFF) y no como carácter literal: un BOM invisible pegado en el
    // código es imposible de ver al revisar un diff. Mismo efecto que en rh/Reportes.jsx.
    const blob = new Blob(["\uFEFF" + contenido], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `asistencia_${desde}_a_${hasta}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="admin-page">
      <PageHeader
        icon="clock"
        title="Asistencia"
        subtitle={`Del ${desde} al ${hasta}`}
      >
        <button type="button" className="mc-btn-outline" onClick={exportarCSV} disabled={cargando}>
          <Icon name="file" size={16} /> Exportar CSV
        </button>
      </PageHeader>

      <Card className="asistencia-filtros">
        <label>
          Desde
          <input type="date" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} />
        </label>
        <label>
          Hasta
          <input type="date" value={hasta} min={desde} max={hoyClinica()} onChange={(e) => setHasta(e.target.value)} />
        </label>
        <label>
          Agrupar por
          <select value={granularidad} onChange={(e) => setGranularidad(e.target.value)}>
            {GRANULARIDADES.map((g) => (
              <option key={g.valor} value={g.valor}>{g.label}</option>
            ))}
          </select>
        </label>
        <label>
          Empleado
          <select value={empleadoId} onChange={(e) => setEmpleadoId(e.target.value)}>
            <option value="">Todos</option>
            {empleados.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </label>
      </Card>

      {error && (
        <Card>
          <p className="mc-empty">
            <Icon name="alert" size={16} /> {error}
          </p>
        </Card>
      )}

      <div className="admin-stat-grid">
        <StatCard iconName="check" value={totales.presentes} label="Presentes" valueClass="admin-stat-value--green" />
        <StatCard iconName="clock" value={totales.retardos} label="Retardos" valueClass="admin-stat-value--amber" />
        <StatCard iconName="alert" value={totales.faltas} label="Faltas" valueClass="admin-stat-value--red" />
        <StatCard iconName="vacation" value={totales.justificados} label="Justificados" valueClass="admin-stat-value--blue" />
      </div>

      {paraRevisar.length > 0 && (
        <>
          <SectionTitle icon="alert">Checadas que requieren revisión ({paraRevisar.length})</SectionTitle>
          <Card>
            {/* Esta lista es lo que hace que la comprobación sirva de algo: alguien la mira.
                Una selfie y una coordenada que nadie revisa son teatro. */}
            <ul className="asistencia-revision">
              {paraRevisar.map((c) => (
                <li key={c.id}>
                  <Avatar name={c.empleado} size={32} />
                  <div className="asistencia-revision-main">
                    <strong>{c.empleado}</strong>
                    <span>
                      {c.tipo === "entrada" ? "Entrada" : "Salida"} · {c.fecha} a las {horaCorta(c.marcadaEn)}
                    </span>
                    <em>{motivoRevision(c)}</em>
                  </div>
                  <div className="asistencia-revision-acciones">
                    {c.selfiePath && (
                      <button type="button" className="mc-btn-outline" onClick={() => verSelfie(c)}>
                        <Icon name="camera" size={15} /> Ver foto
                      </button>
                    )}
                    {puedeAnular && (
                      <button type="button" className="mc-btn-outline mc-btn-outline--danger" onClick={() => handleAnular(c)}>
                        Anular
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      <SectionTitle icon="users">Detalle por empleado</SectionTitle>

      {cargando ? (
        <Card><p className="mc-empty">Cargando asistencia…</p></Card>
      ) : porEmpleado.length === 0 ? (
        <Card><p className="mc-empty">No hay empleados que mostrar.</p></Card>
      ) : (
        porEmpleado.map(({ empleado, resumen: r, grupos }) => (
          <Card key={empleado.id} className="asistencia-empleado">
            <header className="asistencia-empleado-head">
              <Avatar name={empleado.name} photoUrl={empleado.avatarUrl} size={36} />
              <div>
                <strong>{empleado.name}</strong>
                <span>{empleado.sucursal}</span>
              </div>
              <div className="asistencia-empleado-kpis">
                <span title="Puntualidad">{r.puntualidad}% puntual</span>
                <span title="Horas trabajadas">{minutosAHoras(r.minutosTrabajados)}</span>
                {r.faltas > 0 && <span className="asistencia-chip--falta">{r.faltas} faltas</span>}
                {r.retardos > 0 && <span className="asistencia-chip--retardo">{r.retardos} retardos</span>}
              </div>
            </header>

            <div className="asistencia-tabla-wrap">
              <table className="mc-table asistencia-tabla">
                <thead>
                  <tr>
                    <th>{GRANULARIDADES.find((g) => g.valor === granularidad)?.label}</th>
                    <th>Presentes</th>
                    <th>Retardos</th>
                    <th>Faltas</th>
                    <th>Justificados</th>
                    <th>Horas</th>
                  </tr>
                </thead>
                <tbody>
                  {grupos.map((g) => (
                    <tr key={g.clave}>
                      <td>{g.clave}</td>
                      <td>{g.resumen.presentes}</td>
                      <td>{g.resumen.retardos || "—"}</td>
                      <td>{g.resumen.faltas || "—"}</td>
                      <td>{g.resumen.justificados || "—"}</td>
                      <td>{minutosAHoras(g.resumen.minutosTrabajados)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {granularidad === "dia" && (
              <details className="asistencia-detalle">
                <summary>Ver el detalle de cada día</summary>
                <ul className="asistencia-dias">
                  {grupos.map(({ clave, dias }) => dias.map((d) => (
                    <li key={clave} className={`asistencia-dia--${d.estado}`}>
                      <span className="asistencia-dia-fecha">{d.fecha}</span>
                      <span className="asistencia-dia-estado">{ETIQUETA_ESTADO[d.estado]}</span>
                      <span>
                        {d.entrada ? horaCorta(d.entrada.marcadaEn) : "—"}
                        {" → "}
                        {d.salida ? horaCorta(d.salida.marcadaEn) : "—"}
                      </span>
                      {d.minutosRetardo > 0 && <em>+{d.minutosRetardo} min tarde</em>}
                    </li>
                  )))}
                </ul>
              </details>
            )}
          </Card>
        ))
      )}
    </div>
  );
}
