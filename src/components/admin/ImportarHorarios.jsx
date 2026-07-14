import { useMemo, useState } from "react";
import PageHeader from "../common/PageHeader";
import Card from "../common/Card";
import SectionTitle from "../common/SectionTitle";
import Icon from "../ui/Icon";
import { useNotification } from "../../contexts/NotificationContext";
import { upsertHorario } from "../../services/supabase/horariosService";
import { analizarFilas, empleadosSinHorario } from "../../utils/horariosImport";

const CAMPOS = [
  { clave: "nombre", label: "Nombre del empleado", requerido: true },
  { clave: "dia", label: "Día de la semana", requerido: true },
  { clave: "entrada", label: "Hora de entrada", requerido: true },
  { clave: "salida", label: "Hora de salida", requerido: true },
  { clave: "tolerancia", label: "Tolerancia en minutos", requerido: false },
];

const DIAS_NOMBRE = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

/**
 * Importar los horarios desde un Excel.
 *
 * LA REGLA QUE MANDA: NUNCA IMPORTAR A CIEGAS. El Excel de una empresa real trae nombres mal
 * escritos, filas en blanco, horas como texto y gente que ya no trabaja aquí. Un import
 * silencioso que "casi acierta" es PEOR que no tener importador: deja horarios equivocados que
 * luego generan retardos falsos, y nadie sabe de dónde salieron.
 *
 * Por eso el flujo tiene tres pasos y ninguno se puede saltar: mapear las columnas → MIRAR la
 * previsualización → aplicar. El botón de aplicar solo escribe lo válido, y dice exactamente
 * qué se queda fuera y por qué.
 */
export default function ImportarHorarios({ usuarios = [], onImportado }) {
  const { toast, confirm } = useNotification();

  const [filasCrudas, setFilasCrudas] = useState(null); // [[celda, celda...]]
  const [cabeceras, setCabeceras] = useState([]);
  const [mapeo, setMapeo] = useState({});
  const [cargando, setCargando] = useState(false);
  const [aplicando, setAplicando] = useState(false);

  const empleados = useMemo(
    () => usuarios.filter((u) => !u.inactivo && u.role === "empleado"),
    [usuarios]
  );

  const leerExcel = async (archivo) => {
    setCargando(true);
    try {
      // exceljs pesa lo suyo y solo hace falta aquí: se carga bajo demanda, no en el arranque
      // de la app. Nadie que no vaya a importar horarios debería pagar por él.
      const ExcelJS = (await import("exceljs")).default;
      const libro = new ExcelJS.Workbook();
      await libro.xlsx.load(await archivo.arrayBuffer());

      const hoja = libro.worksheets[0];
      if (!hoja) throw new Error("El archivo no tiene ninguna hoja.");

      const filas = [];
      hoja.eachRow((fila) => {
        // fila.values viene con un hueco en el índice 0 (exceljs cuenta las columnas desde 1).
        filas.push(fila.values.slice(1).map((v) => (v && v.text ? v.text : v)));
      });

      if (filas.length < 2) throw new Error("El archivo no tiene datos debajo de la cabecera.");

      const cab = filas[0].map((c, i) => String(c ?? `Columna ${i + 1}`));
      setCabeceras(cab);
      setFilasCrudas(filas.slice(1));

      // Se intenta adivinar el mapeo por el nombre de la columna, pero es solo una SUGERENCIA:
      // el admin la ve y la corrige. Adivinar y aplicar sin preguntar es justo lo que no se hace.
      const sugerencia = {};
      cab.forEach((titulo, i) => {
        const t = String(titulo).toLowerCase();
        if (/nombre|empleado|colaborador/.test(t)) sugerencia.nombre ??= i;
        else if (/d[ií]a/.test(t)) sugerencia.dia ??= i;
        else if (/entrada|inicio|ingreso/.test(t)) sugerencia.entrada ??= i;
        else if (/salida|fin|t[ée]rmino/.test(t)) sugerencia.salida ??= i;
        else if (/tolerancia|gracia/.test(t)) sugerencia.tolerancia ??= i;
      });
      setMapeo(sugerencia);

      toast.success(`${filas.length - 1} filas leídas. Revisa el mapeo de columnas.`);
    } catch (e) {
      console.error("Error leyendo el Excel:", e);
      toast.error(e?.message || "No se pudo leer el archivo. ¿Es un .xlsx?");
    } finally {
      setCargando(false);
    }
  };

  // El análisis se rehace en cuanto cambia el mapeo: el admin ve en vivo cómo mejora (o empeora)
  // la previsualización mientras ajusta las columnas.
  const analisis = useMemo(() => {
    if (!filasCrudas) return null;

    const listo = CAMPOS.filter((c) => c.requerido).every((c) => mapeo[c.clave] != null);
    if (!listo) return null;

    const filas = filasCrudas.map((f) => ({
      nombre: f[mapeo.nombre],
      dia: f[mapeo.dia],
      entrada: f[mapeo.entrada],
      salida: f[mapeo.salida],
      tolerancia: mapeo.tolerancia != null ? f[mapeo.tolerancia] : null,
    }));

    const { validas, errores } = analizarFilas(filas, empleados);
    return { validas, errores, olvidados: empleadosSinHorario(validas, empleados) };
  }, [filasCrudas, mapeo, empleados]);

  const dudosas = analisis?.validas.filter((v) => v.confianza === "parcial") || [];

  const aplicar = async () => {
    if (!analisis?.validas.length) return;

    const ok = await confirm({
      title: "Aplicar los horarios",
      description:
        `Se van a escribir ${analisis.validas.length} horarios.` +
        (analisis.errores.length ? ` ${analisis.errores.length} filas se quedan fuera.` : "") +
        (analisis.olvidados.length
          ? ` Y ${analisis.olvidados.length} empleado(s) se quedarán SIN horario: para el sistema, todos sus días serán descanso.`
          : "") +
        " Esto reemplaza los horarios que ya tuvieran esos empleados en esos días.",
      variant: analisis.olvidados.length ? "warning" : "default",
      confirmText: "Aplicar",
    });
    if (!ok) return;

    setAplicando(true);
    let escritos = 0;
    const fallos = [];

    for (const v of analisis.validas) {
      try {
        await upsertHorario({
          empleadoId: v.empleado.id,
          diaSemana: v.diaSemana,
          horaEntrada: v.horaEntrada,
          horaSalida: v.horaSalida,
          toleranciaMin: v.toleranciaMin,
        });
        escritos += 1;
      } catch (e) {
        fallos.push(`${v.empleado.name} (${DIAS_NOMBRE[v.diaSemana]}): ${e.message}`);
      }
    }

    setAplicando(false);

    if (fallos.length) {
      console.error("Horarios que fallaron:", fallos);
      toast.error(`${escritos} horarios aplicados, ${fallos.length} fallaron. Mira la consola.`);
    } else {
      toast.success(`${escritos} horarios aplicados.`);
    }

    setFilasCrudas(null);
    setCabeceras([]);
    setMapeo({});
    onImportado?.();
  };

  return (
    <div className="admin-page">
      <PageHeader
        icon="calendarDays"
        title="Importar horarios"
        subtitle="Desde un Excel. Nada se escribe hasta que lo revises."
      />

      <Card>
        <p className="mc-hint">
          <Icon name="alert" size={15} />
          El archivo debe tener una <strong>fila por empleado y día</strong>, con una cabecera arriba.
          Da igual cómo se llamen las columnas: tú dices cuál es cuál.
        </p>

        <label className="mc-file-input-wrap">
          <input
            type="file"
            accept=".xlsx,.xlsm"
            className="mc-file-input-overlay"
            disabled={cargando}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) leerExcel(f);
            }}
          />
          <Icon name="file" size={16} />
          {cargando ? "Leyendo…" : "Elegir archivo de Excel"}
        </label>
      </Card>

      {filasCrudas && (
        <>
          <SectionTitle icon="settings">1 · ¿Qué columna es cuál?</SectionTitle>
          <Card className="importar-mapeo">
            {CAMPOS.map((campo) => (
              <label key={campo.clave} className="mc-form-group">
                <span className="mc-form-label">
                  {campo.label} {campo.requerido && <em>·  obligatoria</em>}
                </span>
                <select
                  className="mc-form-input"
                  value={mapeo[campo.clave] ?? ""}
                  onChange={(e) =>
                    setMapeo((m) => ({
                      ...m,
                      [campo.clave]: e.target.value === "" ? undefined : Number(e.target.value),
                    }))
                  }
                >
                  <option value="">— ninguna —</option>
                  {cabeceras.map((c, i) => (
                    <option key={i} value={i}>{c}</option>
                  ))}
                </select>
              </label>
            ))}
          </Card>
        </>
      )}

      {analisis && (
        <>
          <SectionTitle icon="clipboardCheck">2 · Esto es lo que va a pasar</SectionTitle>

          <div className="admin-stat-grid">
            <StatSimple valor={analisis.validas.length} label="Se aplicarán" clase="admin-stat-value--green" />
            <StatSimple valor={analisis.errores.length} label="Se quedan fuera" clase="admin-stat-value--red" />
            <StatSimple valor={dudosas.length} label="Nombre dudoso" clase="admin-stat-value--amber" />
            <StatSimple valor={analisis.olvidados.length} label="Sin horario" clase="admin-stat-value--amber" />
          </div>

          {dudosas.length > 0 && (
            <Card>
              <p className="aviso-descuento">
                <Icon name="alert" size={16} />
                <span>
                  <strong>Revisa estos nombres.</strong> El Excel no los escribe igual que la app, y
                  los emparejé por las palabras. Casi siempre acierto — pero meterle el horario a la
                  persona equivocada es un error que nadie detecta hasta que empiezan a salir
                  retardos de alguien que llegó puntual.
                </span>
              </p>
              <ul className="importar-lista">
                {dudosas.map((v) => (
                  <li key={`${v.linea}`}>
                    Línea {v.linea}: <strong>“{v.nombreEnExcel}”</strong> → {v.empleado.name}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {analisis.olvidados.length > 0 && (
            <Card>
              <p className="mc-hint">
                <Icon name="alert" size={15} />
                Estos empleados <strong>no aparecen en el Excel</strong>. Se quedarán sin horario, y
                para el sistema <strong>todos sus días serán descanso</strong>: no acumularán retardos
                ni faltas.
              </p>
              <ul className="importar-lista">
                {analisis.olvidados.map((e) => <li key={e.id}>{e.name}</li>)}
              </ul>
            </Card>
          )}

          {analisis.errores.length > 0 && (
            <Card>
              <SectionTitle icon="alert">Filas que se quedan fuera</SectionTitle>
              <ul className="importar-lista importar-lista--error">
                {analisis.errores.map((e, i) => (
                  <li key={i}>Línea {e.linea}: {e.motivo}</li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <div className="asistencia-tabla-wrap">
              <table className="mc-table">
                <thead>
                  <tr>
                    <th>Empleado</th><th>Día</th><th>Entrada</th><th>Salida</th><th>Tolerancia</th>
                  </tr>
                </thead>
                <tbody>
                  {analisis.validas.map((v) => (
                    <tr key={`${v.empleado.id}-${v.diaSemana}`}>
                      <td>
                        {v.empleado.name}
                        {v.confianza === "parcial" && <span className="importar-dudoso"> · revisar</span>}
                      </td>
                      <td>{DIAS_NOMBRE[v.diaSemana]}</td>
                      <td>{v.horaEntrada}</td>
                      <td>{v.horaSalida}</td>
                      <td>{v.toleranciaMin} min</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              className="mc-btn-primary mc-btn-with-icon"
              disabled={aplicando || !analisis.validas.length}
              onClick={aplicar}
            >
              <Icon name="check" size={16} />
              {aplicando ? "Aplicando…" : `Aplicar ${analisis.validas.length} horarios`}
            </button>
          </Card>
        </>
      )}
    </div>
  );
}

const StatSimple = ({ valor, label, clase }) => (
  <Card className="admin-stat-card">
    <div className={`admin-stat-value ${clase}`}>{valor}</div>
    <div className="admin-stat-label">{label}</div>
  </Card>
);
