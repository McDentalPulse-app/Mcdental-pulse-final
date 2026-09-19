import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "../common/PageHeader";
import Card from "../common/Card";
import StatCard from "../common/StatCard";
import SectionTitle from "../common/SectionTitle";
import EmptyState from "../common/EmptyState";
import WeekSelect from "../common/WeekSelect";
import Icon from "../ui/Icon";
import { useGlobal } from "../../contexts/GlobalContext";
import { useAuth } from "../../contexts/AuthContext";
import { useNotification } from "../../contexts/NotificationContext";
import { getAsistencias } from "../../services/supabase/asistenciasService";
import { getNominaConfig, setNominaConfig } from "../../services/supabase/nominaConfigService";
import { updateUsuario } from "../../services/supabase/usuariosService";
import { getISOWeek, isoWeekToMonday, normalizeSucursal } from "../../utils/constants";
import {
  construirDias,
  mapaZonas,
  zonaDe,
  diaISO,
  ESTADOS_DIA,
  ETIQUETA_ESTADO,
} from "../../utils/asistencia";
import { calcularNomina, money } from "../../utils/nomina";
import AcuerdoConformidad from "./AcuerdoConformidad";

// ISO: 1=lunes … 7=domingo. La misma numeración que horarios.dia_semana.
const DIAS = [
  { iso: 1, label: "L", nombre: "Lunes" },
  { iso: 2, label: "M", nombre: "Martes" },
  { iso: 3, label: "M", nombre: "Miércoles" },
  { iso: 4, label: "J", nombre: "Jueves" },
  { iso: 5, label: "V", nombre: "Viernes" },
  { iso: 6, label: "S", nombre: "Sábado" },
  { iso: 7, label: "D", nombre: "Domingo" },
];

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const aISO = (d) => d.toISOString().slice(0, 10);
const sumarDias = (d, n) => new Date(d.getTime() + n * 86400000);

/** "7 – 13 sep" a partir del lunes de la semana. */
const rotuloSemana = (lunes) => {
  const domingo = sumarDias(lunes, 6);
  const mesL = MESES[lunes.getUTCMonth()];
  const mesD = MESES[domingo.getUTCMonth()];
  return mesL === mesD
    ? `${lunes.getUTCDate()} – ${domingo.getUTCDate()} ${mesD}`
    : `${lunes.getUTCDate()} ${mesL} – ${domingo.getUTCDate()} ${mesD}`;
};

/** Las últimas `n` semanas ISO, de la más reciente a la más antigua. */
const semanasRecientes = (n = 12) => {
  const hoy = new Date();
  const lunesActual = isoWeekToMonday(getISOWeek(hoy));
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const lunes = sumarDias(lunesActual, -7 * i);
    const clave = getISOWeek(new Date(lunes.getUTCFullYear(), lunes.getUTCMonth(), lunes.getUTCDate()));
    out.push({ value: clave, label: rotuloSemana(lunes) });
  }
  return out;
};

/**
 * Una persona en la semana: sus 6-7 días con su estado y su descuento, y el pago final.
 *
 * El sueldo se edita aquí mismo, sin control (defaultValue + onBlur): es un número que se teclea
 * dígito a dígito y guardar en cada pulsación mandaría un UPDATE por tecla. El `key` lo vuelve a
 * montar cuando el servidor confirma otro valor, así que tampoco se queda desincronizado.
 */
function FilaNomina({
  empleado,
  recibo,
  porDia,
  columnas,
  guardando,
  onGuardarSueldo,
  guardandoRetardoPersonal,
  onGuardarRetardoPersonal,
  onImprimir,
  seleccionado,
  onToggleSeleccion,
}) {
  return (
    <div className="nomina-fila">
      <label className="nomina-check" title="Marcar para imprimir en lote">
        <input
          type="checkbox"
          checked={seleccionado}
          onChange={() => onToggleSeleccion(empleado.id)}
          aria-label={`Seleccionar a ${empleado.name} para imprimir`}
        />
      </label>

      <div className="nomina-persona">
        <div className="nomina-persona-nombre">{empleado.name}</div>
        <div className="nomina-persona-sub">{normalizeSucursal(empleado.sucursal)}</div>
      </div>

      <div className="nomina-semana">
        {columnas.map((d) => {
          const dia = porDia.get(d.iso);
          const estado = dia?.estado || ESTADOS_DIA.DESCANSO;
          const descuento = dia?.descuento || 0;
          const titulo = dia
            ? `${d.nombre} ${dia.fecha} · ${ETIQUETA_ESTADO[estado] || estado}${
                dia.minutosRetardo > 0 ? ` (+${dia.minutosRetardo} min tarde)` : ""
              }${descuento > 0 ? ` · −${money(descuento)}` : ""}`
            : `${d.nombre} · sin turno`;

          return (
            <div key={d.iso} className="nomina-dia" title={titulo}>
              <span className="nomina-dia-letra">{d.label}</span>
              <span className={`nomina-dia-celda asistencia-calendario-celda--${estado}`} />
              <span className={`nomina-dia-monto${descuento > 0 ? " nomina-dia-monto--cobra" : ""}`}>
                {descuento > 0 ? `−${descuento}` : "—"}
              </span>
            </div>
          );
        })}
      </div>

      <label className="nomina-sueldo">
        <span>Sueldo semanal</span>
        <input
          key={empleado.sueldoSemanal ?? "vacio"}
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          placeholder="Sin capturar"
          defaultValue={empleado.sueldoSemanal ?? ""}
          disabled={guardando}
          aria-label={`Sueldo semanal de ${empleado.name}`}
          onBlur={(e) => onGuardarSueldo(empleado, e.target.value)}
        />
      </label>

      {/* Excepción puntual, no una columna que toda la plantilla necesite ver siempre llena:
          por eso el placeholder dice "General" (usa la tasa normal / de becario) en vez de
          "Sin capturar", que sonaría a que a todos les falta algo por llenar aquí. */}
      <label className="nomina-retardo-personal" title="Tasa de retardo distinta a la general, solo para esta persona">
        <span>Tasa de retardo</span>
        <input
          key={empleado.montoRetardoPersonal ?? "general"}
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          placeholder="General"
          defaultValue={empleado.montoRetardoPersonal ?? ""}
          disabled={guardandoRetardoPersonal}
          aria-label={`Tasa de retardo personalizada de ${empleado.name}`}
          onBlur={(e) => onGuardarRetardoPersonal(empleado, e.target.value)}
        />
      </label>

      <div className="nomina-totales">
        <div className="nomina-total-linea">
          <span>Descuentos</span>
          <strong className={recibo.descuento > 0 ? "nomina-monto--cobra" : ""}>
            {recibo.descuento > 0 ? `− ${money(recibo.descuento)}` : money(0)}
          </strong>
        </div>
        <div className="nomina-total-linea nomina-total-linea--final">
          <span>Pago final</span>
          {recibo.sinSueldo ? (
            <strong className="nomina-sin-sueldo">Falta el sueldo</strong>
          ) : (
            <strong>{money(recibo.pagoFinal)}</strong>
          )}
        </div>
        <div className="nomina-total-detalle">
          {recibo.retardos} retardo{recibo.retardos === 1 ? "" : "s"} · {recibo.faltas} falta
          {recibo.faltas === 1 ? "" : "s"}
        </div>
        <button
          type="button"
          className="mc-btn-outline mc-btn-with-icon nomina-btn-imprimir"
          onClick={() => onImprimir(empleado, recibo)}
        >
          <Icon name="printer" size={14} /> Imprimir acuerdo
        </button>
      </div>
    </div>
  );
}

/**
 * Nómina de la semana: qué gana cada persona después de sus retardos y sus faltas.
 *
 * NO guarda nóminas calculadas (ver el encabezado de la migración 156): el recibo se DERIVA cada
 * vez de las checadas + el horario de cada día + los permisos aprobados. Así, si RH justifica hoy
 * una falta de la semana pasada, esa semana deja de descontarla sola, sin reprocesar nada.
 *
 * El estado de cada día lo decide construirDias() (utils/asistencia.js), el mismo módulo que
 * pinta el calendario de Asistencia. Aquí no se vuelve a decidir quién llegó tarde: si esa
 * lógica estuviera en dos sitios, la nómina y el calendario acabarían diciendo cosas distintas.
 */
export default function Nomina({ usuarios = [], horarios = [], permisos = [], vacaciones = [] }) {
  const { sucursales = [], refreshUsuarios } = useGlobal();
  const { user } = useAuth();
  const { toast } = useNotification();

  const opcionesSemana = useMemo(() => semanasRecientes(12), []);
  const [semana, setSemana] = useState(() => opcionesSemana[0]?.value);
  const [filtroSucursal, setFiltroSucursal] = useState("");
  const [busquedaPersona, setBusquedaPersona] = useState("");

  const [checadas, setChecadas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [config, setConfig] = useState({ montoRetardo: 0 });
  const [borrador, setBorrador] = useState(null); // montos que se están editando, sin guardar
  const [guardandoConfig, setGuardandoConfig] = useState(false);
  const [guardandoSueldo, setGuardandoSueldo] = useState(null);
  const [guardandoRetardoPersonal, setGuardandoRetardoPersonal] = useState(null);

  // Acuerdos de conformidad que se están imprimiendo ahora mismo: null cuando no hay nada
  // que imprimir. `useEffect` de abajo dispara window.print() cuando esto deja de ser null, y
  // `afterprint` lo limpia — así el contenedor imprimible (AcuerdoConformidad) solo vive en el
  // DOM mientras hace falta, en vez de calcular el recibo de todos en cada render.
  const [acuerdosImprimir, setAcuerdosImprimir] = useState(null);

  // Selección para imprimir en lote (hallazgo real, 2026-09-19): el motor de impresión de
  // Chrome falla al paginar un documento muy largo de una sola vez — con 25 acuerdos apilados
  // (~20.000 px de alto) solo llegaban a salir unos 10, sin ningún error visible. Medido con
  // getBoundingClientRect: el DOM y el CSS están perfectos, los 25 bloques quedan en su lugar
  // exacto sin recortes — es el propio navegador el que no pagina bien algo tan largo al
  // imprimir. La solución no es técnica (no hay CSS que se lo arregle a Chrome): es dejar
  // elegir un lote más chico, de cualquier tamaño, sin depender del filtro de sucursal.
  const [seleccionados, setSeleccionados] = useState(() => new Set());

  const lunes = useMemo(() => isoWeekToMonday(semana), [semana]);
  const desde = lunes ? aISO(lunes) : null;
  const hasta = lunes ? aISO(sumarDias(lunes, 6)) : null;

  useEffect(() => {
    let cancelado = false;
    getNominaConfig()
      .then((c) => { if (!cancelado) setConfig(c); })
      .catch(() => { /* getNominaConfig ya cae a ceros por su cuenta */ });
    return () => { cancelado = true; };
  }, []);

  // Las checadas se piden acotadas a la semana: la tabla crece sin techo y por eso no vive
  // en el contexto global (mismo patrón que AsistenciaPanel).
  //
  // El spinner NO se enciende aquí sino en `cambiarSemana`: encender un estado de React de
  // forma síncrona dentro de un efecto dispara un render en cascada (react-hooks/
  // set-state-in-effect). Quien cambia la semana es una persona pulsando el desplegable, así
  // que ese es el sitio honesto para decir "estoy cargando".
  const cargar = useCallback(() => {
    if (!desde || !hasta) return undefined;
    let cancelado = false;
    getAsistencias({ desde, hasta })
      .then((rows) => { if (!cancelado) { setChecadas(rows); setError(null); } })
      .catch((e) => {
        if (cancelado) return;
        console.error("Error cargando la asistencia de la nómina:", e);
        setError(e?.message || "No se pudo cargar la asistencia de esta semana.");
      })
      .finally(() => { if (!cancelado) setCargando(false); });
    return () => { cancelado = true; };
  }, [desde, hasta]);

  useEffect(() => cargar(), [cargar]);

  // Toda la plantilla activa, no solo empleado/doctor: RH y la psicóloga también cobran.
  const empleados = useMemo(
    () => usuarios
      .filter((u) => !u.inactivo && !u.archivado)
      .sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [usuarios]
  );

  const sucursalesConGente = useMemo(
    () => [...new Set(empleados.map((u) => normalizeSucursal(u.sucursal)).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [empleados]
  );

  const visibles = useMemo(() => {
    const buscado = busquedaPersona.trim().toLowerCase();
    return empleados
      .filter((u) => !filtroSucursal || normalizeSucursal(u.sucursal) === filtroSucursal)
      .filter((u) => !buscado || (u.name || "").toLowerCase().includes(buscado));
  }, [empleados, filtroSucursal, busquedaPersona]);

  // Cada persona se clasifica en la zona horaria de SU clínica: Hermosillo va una hora por
  // detrás del centro y Reynosa una por delante en verano. Con una sola zona para todos, a los
  // de Hermosillo se les cobraría un retardo diario que no existe (ver utils/asistencia.js).
  const zonas = useMemo(() => mapaZonas(sucursales), [sucursales]);

  const recibos = useMemo(() => {
    if (!desde || !hasta) return [];
    return visibles.map((u) => {
      const dias = construirDias({
        desde,
        hasta,
        checadas: checadas.filter((c) => c.empleadoId === u.id),
        horarios: horarios.filter((h) => h.empleadoId === u.id),
        permisos: permisos.filter((p) => p.empleadoId === u.id),
        vacaciones: vacaciones.filter((v) => v.empleadoId === u.id),
        fechaIngreso: u.fechaIngreso,
        tz: zonaDe(zonas, u.sucursal),
      });
      const recibo = calcularNomina({
        dias,
        sueldoSemanal: u.sueldoSemanal,
        config,
        puesto: u.puesto,
        montoRetardoPersonal: u.montoRetardoPersonal,
      });
      // Indexado por día ISO para poder pintar cada uno bajo su letra. construirDias() puede
      // devolver menos de 7 días (alguien que entró a mitad de semana): los que falten quedan
      // sin celda, que es exactamente lo que pasó.
      const porDia = new Map(recibo.detalle.map((d) => [diaISO(d.fecha), d]));
      return { empleado: u, recibo, porDia };
    });
  }, [visibles, checadas, horarios, permisos, vacaciones, desde, hasta, zonas, config]);

  // El domingo solo ocupa columna si alguien trabaja en domingo. Con la plantilla de siempre
  // (lunes a sábado) son seis columnas —L M M J V S, lo que se pidió— y no una columna muerta.
  const hayDomingo = useMemo(
    () => horarios.some((h) => h.diaSemana === 7 && visibles.some((u) => u.id === h.empleadoId)),
    [horarios, visibles]
  );
  const columnas = hayDomingo ? DIAS : DIAS.filter((d) => d.iso !== 7);

  const totales = useMemo(
    () => recibos.reduce(
      (acc, { recibo }) => ({
        pago: acc.pago + recibo.pagoFinal,
        descuento: acc.descuento + recibo.descuento,
        retardos: acc.retardos + recibo.retardos,
        faltas: acc.faltas + recibo.faltas,
        sinSueldo: acc.sinSueldo + (recibo.sinSueldo ? 1 : 0),
      }),
      { pago: 0, descuento: 0, retardos: 0, faltas: 0, sinSueldo: 0 }
    ),
    [recibos]
  );

  const montos = borrador || config;

  // Cambiar de semana vuelve a pedir las checadas: el spinner se enciende acá, en el evento,
  // y `cargar` lo apaga en su .finally. La selección de impresión también se limpia: es la
  // semana anterior la que se había marcado, y arrastrarla a otra semana imprimiría acuerdos
  // de la persona equivocada sin que nadie lo pidiera.
  const cambiarSemana = (valor) => {
    setCargando(true);
    setSemana(valor);
    setSeleccionados(new Set());
  };

  const guardarConfig = async () => {
    setGuardandoConfig(true);
    try {
      const nueva = await setNominaConfig(montos, user?.id);
      setConfig(nueva);
      setBorrador(null);
      toast.success("Montos guardados. La nómina de todas las semanas se recalcula con ellos.");
    } catch (e) {
      toast.error(e?.message || "No se pudieron guardar los montos.");
    } finally {
      setGuardandoConfig(false);
    }
  };

  const guardarSueldo = async (empleado, valor) => {
    const texto = String(valor ?? "").trim();
    const actual = empleado.sueldoSemanal;
    // Vaciar el campo devuelve el sueldo a "sin capturar" (null), que no es lo mismo que 0.
    const nuevo = texto === "" ? null : Math.round(Number(texto) * 100) / 100;

    if (nuevo !== null && (!Number.isFinite(nuevo) || nuevo < 0)) {
      toast.error("El sueldo debe ser un número de 0 o más.");
      return;
    }
    if (nuevo === actual || (nuevo === null && actual == null)) return;

    setGuardandoSueldo(empleado.id);
    try {
      await updateUsuario(empleado.id, { sueldoSemanal: nuevo });
      await refreshUsuarios();
    } catch (e) {
      toast.error(e?.message || "No se pudo guardar el sueldo.");
    } finally {
      setGuardandoSueldo(null);
    }
  };

  // Tasa de retardo PERSONAL (mig. 164): gana sobre la general y sobre la de becario (ver
  // esBecario() en utils/nomina.js) — es para el caso suelto de una persona en concreto, no
  // para configurar la empresa entera. Mismo patrón que guardarSueldo: vaciar el campo vuelve
  // al comportamiento normal (null), no a "le cuesta cero".
  const guardarRetardoPersonal = async (empleado, valor) => {
    const texto = String(valor ?? "").trim();
    const actual = empleado.montoRetardoPersonal;
    const nuevo = texto === "" ? null : Math.round(Number(texto) * 100) / 100;

    if (nuevo !== null && (!Number.isFinite(nuevo) || nuevo < 0)) {
      toast.error("La tasa de retardo debe ser un número de 0 o más.");
      return;
    }
    if (nuevo === actual || (nuevo === null && actual == null)) return;

    setGuardandoRetardoPersonal(empleado.id);
    try {
      await updateUsuario(empleado.id, { montoRetardoPersonal: nuevo });
      await refreshUsuarios();
    } catch (e) {
      toast.error(e?.message || "No se pudo guardar la tasa de retardo.");
    } finally {
      setGuardandoRetardoPersonal(null);
    }
  };

  // Dispara la impresión en cuanto AcuerdoConformidad ya está en el DOM (el efecto corre
  // DESPUÉS del render que puso acuerdosImprimir), y limpia el estado cuando el diálogo de
  // impresión se cierra — imprima o cancele la persona.
  //
  // Mientras acuerdosImprimir tiene algo, el return de este componente NO monta el resto de
  // la pantalla (ver más abajo — es lo que arregla las páginas en blanco y el contenido
  // empujado hacia abajo al imprimir). Eso vuelve CRÍTICO limpiar el estado siempre: si nada
  // lo hiciera, la pantalla se quedaría en blanco para siempre, viéndose como si "no cargara".
  // `afterprint` no siempre dispara (cancelar con Escape, o el navegador que sea, es un caso
  // conocido de que no lo haga) — así que `focus` es la red de seguridad: recuperar el foco
  // de la ventana es justo lo que pasa siempre que el diálogo de impresión se cierra, se haya
  // impreso o cancelado, y no depende de que el navegador dispare `afterprint` bien.
  useEffect(() => {
    if (!acuerdosImprimir) return;
    const limpiar = () => setAcuerdosImprimir(null);
    window.addEventListener("afterprint", limpiar);
    window.addEventListener("focus", limpiar);
    window.print();
    return () => {
      window.removeEventListener("afterprint", limpiar);
      window.removeEventListener("focus", limpiar);
    };
  }, [acuerdosImprimir]);

  const imprimirUno = (empleado, recibo) => setAcuerdosImprimir([{ empleado, recibo }]);
  const imprimirTodos = () => {
    if (!recibos.length) return;
    setAcuerdosImprimir(recibos.map(({ empleado, recibo }) => ({ empleado, recibo })));
  };

  const toggleSeleccion = (empleadoId) => {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(empleadoId)) next.delete(empleadoId); else next.add(empleadoId);
      return next;
    });
  };

  // Cuenta cuántos de los VISIBLES (con el filtro actual) ya están marcados, para que el
  // botón "Seleccionar visibles" sepa si le toca marcar o desmarcar. Adrede solo mira a
  // `recibos` (lo que el filtro deja ver ahora) y no a `seleccionados` entero: alguien puede
  // tener marcada gente de otra sucursal que ya no se ve, y este botón no debe tocarla.
  const visiblesSeleccionados = recibos.filter(({ empleado }) => seleccionados.has(empleado.id)).length;

  const toggleSeleccionVisibles = () => {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      const marcarTodos = visiblesSeleccionados < recibos.length;
      for (const { empleado } of recibos) {
        if (marcarTodos) next.add(empleado.id); else next.delete(empleado.id);
      }
      return next;
    });
  };

  const imprimirSeleccionados = () => {
    const elegidos = recibos.filter(({ empleado }) => seleccionados.has(empleado.id));
    if (!elegidos.length) return;
    setAcuerdosImprimir(elegidos.map(({ empleado, recibo }) => ({ empleado, recibo })));
  };

  return (
    <div className="admin-page">
      {/* Mientras se imprime, el resto de la pantalla NO se monta (no solo se oculta con CSS):
          con la lista completa oculta por visibility:hidden pero ocupando su espacio, una
          sucursal de 20+ personas dejaba página en blanco tras página en blanco después del
          último acuerdo real — el documento impreso mide tanto como la lista escondida, no
          como lo que de verdad se ve. Sin la lista en el DOM, no hay espacio que medir. */}
      {acuerdosImprimir ? (
        <AcuerdoConformidad acuerdos={acuerdosImprimir} desde={desde} hasta={hasta} />
      ) : (
        <>
      <PageHeader
        icon="dollar"
        title="Nómina"
        subtitle={`Semana del ${desde || "—"} al ${hasta || "—"}. El pago se calcula con los retardos y las faltas de esa semana.`}
      />

      <Card className="nomina-config">
        <SectionTitle icon="settings">Montos que se descuentan</SectionTitle>
        {/* El texto va en UN solo <span>: .mc-hint es flex, y sin esto cada <strong> y cada
            trozo de texto suelto se vuelve un ítem del flex — el párrafo se parte en columnas.
            Mismo motivo que el comentario gemelo en MiRostro.jsx. */}
        <p className="mc-hint">
          <Icon name="alert" size={15} />
          <span>
            Un <strong>retardo</strong> es llegar pasada la tolerancia de su horario y descuenta un
            monto fijo, igual para toda la empresa: se configura aquí. Hay dos excepciones: los{" "}
            <strong>becarios</strong> siempre pagan $50 (se sabe quién es becario por su puesto), y
            cualquier persona puede tener su propia <strong>tasa de retardo</strong> capturada en su
            fila más abajo — gana sobre todo lo demás, para el caso suelto de alguien en concreto.
            Una <strong>falta</strong> es un día con turno sin checada y sin permiso ni vacación
            aprobados, y descuenta el sueldo diario de esa persona (su sueldo semanal entre 7) — no
            hay nada que configurar, cada quien pierde su propio día. Un día justificado o de
            descanso no descuenta nada. Cambiar el monto de retardo general recalcula lo que se ve
            en <em>todas</em> las semanas, salvo para quien tenga su propia tasa.
          </span>
        </p>
        <div className="nomina-config-campos">
          <label>
            Por retardo
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={montos.montoRetardo}
              disabled={guardandoConfig}
              onChange={(e) => setBorrador({ ...montos, montoRetardo: e.target.value })}
            />
          </label>
          <button
            type="button"
            className="mc-btn-primary mc-btn-with-icon"
            onClick={guardarConfig}
            disabled={guardandoConfig || !borrador}
          >
            <Icon name="check" size={16} /> {guardandoConfig ? "Guardando…" : "Guardar montos"}
          </button>
          {borrador && <span className="nomina-config-aviso">Sin guardar</span>}
        </div>
      </Card>

      <Card className="nomina-toolbar">
        <div className="nomina-filtros">
          <span className="nomina-filtro-label"><Icon name="calendar" size={15} /> Semana</span>
          <WeekSelect value={semana} options={opcionesSemana} onChange={cambiarSemana} />
          <span className="nomina-filtro-label"><Icon name="mapPin" size={15} /> Sucursal</span>
          <WeekSelect
            value={filtroSucursal}
            options={[{ value: "", label: "Todas las sucursales" }, ...sucursalesConGente.map((s) => ({ value: s, label: s }))]}
            onChange={setFiltroSucursal}
            icon={null}
          />
          <span className="nomina-filtro-label"><Icon name="search" size={15} /> Persona</span>
          <input
            type="text"
            className="list-filter-input nomina-filtro-buscar"
            placeholder="Buscar por nombre…"
            value={busquedaPersona}
            onChange={(e) => setBusquedaPersona(e.target.value)}
            aria-label="Buscar persona por nombre"
          />
          <em>{visibles.length} {visibles.length === 1 ? "persona" : "personas"}</em>
          <button
            type="button"
            className="mc-btn-outline mc-btn-with-icon"
            onClick={toggleSeleccionVisibles}
            disabled={!recibos.length}
          >
            <Icon name="check" size={15} />{" "}
            {visiblesSeleccionados < recibos.length ? "Seleccionar visibles" : "Quitar selección"}
          </button>
          <button
            type="button"
            className="mc-btn-primary mc-btn-with-icon"
            onClick={imprimirSeleccionados}
            disabled={!seleccionados.size}
            title="Imprime solo a quien tenga la casilla marcada — en lotes chicos, la impresión sale bien siempre"
          >
            <Icon name="printer" size={15} /> Imprimir seleccionados ({seleccionados.size})
          </button>
          <button
            type="button"
            className="mc-btn-outline mc-btn-with-icon nomina-btn-imprimir-todos"
            onClick={imprimirTodos}
            disabled={!recibos.length}
            title="Con grupos grandes (20+), Chrome puede no imprimir todas las hojas — mejor seleccionar en lotes"
          >
            <Icon name="printer" size={15} /> Imprimir acuerdos ({recibos.length})
          </button>
        </div>
      </Card>

      <div className="admin-stat-grid">
        <StatCard iconName="dollar" value={money(totales.pago)} label="Total a pagar" valueClass="admin-stat-value--green" />
        <StatCard iconName="dollar" value={money(totales.descuento)} label="Total descontado" valueClass="admin-stat-value--amber" />
        <StatCard iconName="clock" value={totales.retardos} label="Retardos" valueClass="admin-stat-value--amber" />
        <StatCard iconName="alert" value={totales.faltas} label="Faltas" valueClass="admin-stat-value--red" />
      </div>

      {totales.sinSueldo > 0 && (
        <Card>
          <p className="mc-hint">
            <Icon name="alert" size={15} />
            <span>
              {totales.sinSueldo} {totales.sinSueldo === 1 ? "persona no tiene" : "personas no tienen"} sueldo
              capturado. Su pago final aparece como <strong>«Falta el sueldo»</strong> y no suma al total:
              un $0.00 ahí parecería un cálculo hecho.
            </span>
          </p>
        </Card>
      )}

      {error && (
        <Card><p className="mc-empty"><Icon name="alert" size={16} /> {error}</p></Card>
      )}

      {cargando ? (
        <Card><p className="mc-empty">Cargando la semana…</p></Card>
      ) : recibos.length === 0 ? (
        <Card><EmptyState message="No hay personal que mostrar con este filtro." /></Card>
      ) : (
        <Card>
          <SectionTitle icon="users">Recibo por persona</SectionTitle>
          <div className="nomina-lista">
            {recibos.map(({ empleado, recibo, porDia }) => (
              <FilaNomina
                key={empleado.id}
                empleado={empleado}
                recibo={recibo}
                porDia={porDia}
                columnas={columnas}
                guardando={guardandoSueldo === empleado.id}
                onGuardarSueldo={guardarSueldo}
                guardandoRetardoPersonal={guardandoRetardoPersonal === empleado.id}
                onGuardarRetardoPersonal={guardarRetardoPersonal}
                onImprimir={imprimirUno}
                seleccionado={seleccionados.has(empleado.id)}
                onToggleSeleccion={toggleSeleccion}
              />
            ))}
          </div>
        </Card>
      )}

        </>
      )}
    </div>
  );
}
