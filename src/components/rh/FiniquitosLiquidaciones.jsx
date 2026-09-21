import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import Card from "../common/Card";
import PageHeader from "../common/PageHeader";
import SectionTitle from "../common/SectionTitle";
import Select from "../common/Select";
import DateRangePicker from "../common/DateRangePicker";
import Icon from "../ui/Icon";
import { normalizeSucursal } from "../../utils/constants";
import { money } from "../../utils/nomina";
import {
  calcularFiniquito,
  calcularLiquidacion,
  calcularAguinaldo,
  DIAS_AGUINALDO_MINIMO,
} from "../../utils/finiquito";
import ReciboFiniquito from "./ReciboFiniquito";

const TIPOS = [
  { valor: "finiquito", label: "Finiquito", desc: "Renuncia voluntaria o término normal de la relación laboral: sueldo pendiente, vacaciones, prima vacacional y aguinaldo proporcionales." },
  { valor: "liquidacion", label: "Liquidación", desc: "Despido injustificado: lo mismo que el finiquito, más 3 meses de indemnización, 20 días por año de servicio y prima de antigüedad." },
  { valor: "gratificacion", label: "Gratificación (aguinaldo)", desc: "Aguinaldo anual para alguien que sigue en la empresa, proporcional a los días trabajados en el año." },
];

const hoyISO = () => new Date().toISOString().slice(0, 10);
const numero = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

/**
 * Calculadora de finiquito / liquidación / gratificación (aguinaldo), con recibo imprimible.
 *
 * Las fórmulas (utils/finiquito.js) son de la LFT, no de esta empresa — a diferencia de
 * nomina.js, aquí no hay una regla propia que aplicar. Lo que SÍ es de la empresa es el saldo
 * de vacaciones (8 días/año, ver vacaciones.js), y por eso el cálculo lo reutiliza en vez de
 * traer la tabla progresiva genérica que usan las calculadoras de internet.
 */
export default function FiniquitosLiquidaciones({ usuarios = [], vacaciones = [] }) {
  const { user } = useAuth();

  const [tipo, setTipo] = useState("finiquito");
  const [empleadoId, setEmpleadoId] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [diasPendientesPago, setDiasPendientesPago] = useState("0");
  const [diasAguinaldo, setDiasAguinaldo] = useState(String(DIAS_AGUINALDO_MINIMO));
  const [otrasPercepciones, setOtrasPercepciones] = useState("0");
  const [salarioMinimoDiario, setSalarioMinimoDiario] = useState("");
  const [reciboImprimir, setReciboImprimir] = useState(null);

  const empleados = useMemo(
    () => usuarios.filter((u) => !u.oculto).sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [usuarios]
  );
  const empleado = empleados.find((u) => u.id === empleadoId) || null;

  const vacacionesEmpleado = useMemo(
    () => (empleado ? vacaciones.filter((v) => v.empleadoId === empleado.id) : []),
    [vacaciones, empleado]
  );

  const faltaSueldo = !!empleado && !empleado.sueldoSemanal;
  const faltaIngreso = !!empleado && !empleado.fechaIngreso;

  const resultado = useMemo(() => {
    if (!empleado || faltaSueldo || faltaIngreso) return null;
    const base = {
      sueldoSemanal: empleado.sueldoSemanal,
      fechaIngreso: empleado.fechaIngreso,
      fechaSalida: fecha,
      vacacionesEmpleado,
      diasPendientesPago: numero(diasPendientesPago),
      diasAguinaldo: numero(diasAguinaldo),
      otrasPercepciones: numero(otrasPercepciones),
    };
    if (tipo === "finiquito") return calcularFiniquito(base);
    if (tipo === "liquidacion") {
      return calcularLiquidacion({ ...base, salarioMinimoDiario: numero(salarioMinimoDiario) });
    }
    return calcularAguinaldo({
      sueldoSemanal: empleado.sueldoSemanal,
      fechaIngreso: empleado.fechaIngreso,
      fecha,
      diasAguinaldo: numero(diasAguinaldo),
    });
  }, [empleado, faltaSueldo, faltaIngreso, tipo, fecha, vacacionesEmpleado, diasPendientesPago, diasAguinaldo, otrasPercepciones, salarioMinimoDiario]);

  // Mismo mecanismo que Nomina.jsx: mientras se imprime, el resto de la pantalla no se monta
  // (evita las páginas en blanco/el contenido recortado — ver el historial en App.css), y el
  // `focus` es el respaldo por si `afterprint` no dispara al cancelar.
  useEffect(() => {
    if (!reciboImprimir) return;
    const limpiar = () => setReciboImprimir(null);
    window.addEventListener("afterprint", limpiar);
    window.addEventListener("focus", limpiar);
    window.print();
    return () => {
      window.removeEventListener("afterprint", limpiar);
      window.removeEventListener("focus", limpiar);
    };
  }, [reciboImprimir]);

  const imprimir = () => {
    if (!empleado || !resultado) return;
    setReciboImprimir({ empleado, tipo, fecha, resultado, elaboradoPor: user?.name || "" });
  };

  // Igual que Nomina.jsx: mientras se imprime, el `.admin-page` sigue ahí (los banners
  // persistentes de AdminLayout lo cuelgan de `.app-main-inner > *:not(.admin-page)`), pero
  // por dentro solo se monta el recibo — nada de la pantalla normal.
  if (reciboImprimir) {
    return (
      <div className="admin-page">
        <ReciboFiniquito
          empleado={reciboImprimir.empleado}
          tipo={reciboImprimir.tipo}
          fecha={reciboImprimir.fecha}
          resultado={reciboImprimir.resultado}
          elaboradoPor={reciboImprimir.elaboradoPor}
        />
      </div>
    );
  }

  const filasDesglose = !resultado ? [] : tipo === "gratificacion"
    ? [[`Aguinaldo (${resultado.diasAguinaldo} días, ${resultado.diasTrabajadosAnio} días trabajados)`, resultado.montoAguinaldo]]
    : [
        [`Días pendientes de pago (${resultado.diasPendientesPago})`, resultado.montoDiasPendientes],
        [`Vacaciones pendientes (${resultado.diasVacacionesPendientes} días)`, resultado.montoVacaciones],
        ["Prima vacacional (25%)", resultado.montoPrimaVacacional],
        [`Aguinaldo proporcional (${resultado.diasAguinaldo} días)`, resultado.montoAguinaldo],
        ...(tipo === "liquidacion" ? [
          ["Indemnización constitucional (90 días)", resultado.montoIndemnizacion],
          [`20 días por año (${resultado.aniosAntiguedad} años)`, resultado.montoVeinteDias],
          [`Prima de antigüedad${resultado.primaAntiguedadTopada ? " (topada)" : ""}`, resultado.montoPrimaAntiguedad],
        ] : []),
        ...(resultado.otrasPercepciones > 0 ? [["Otras percepciones", resultado.otrasPercepciones]] : []),
      ];

  return (
    <div className="admin-page">
      <PageHeader
        icon="dollar"
        title="Finiquitos y liquidaciones"
        subtitle="Calculadora de finiquito, liquidación y aguinaldo, con recibo listo para imprimir y firmar."
      />

      <Card className="nomina-config">
        <SectionTitle icon="settings">Tipo de cálculo</SectionTitle>
        <div className="cal-toggle" role="tablist">
          {TIPOS.map((t) => (
            <button
              key={t.valor}
              type="button"
              role="tab"
              aria-selected={tipo === t.valor}
              className={`cal-toggle-btn${tipo === t.valor ? " cal-toggle-btn--activo" : ""}`}
              onClick={() => setTipo(t.valor)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="mc-hint">
          <Icon name="alert" size={15} />
          <span>{TIPOS.find((t) => t.valor === tipo)?.desc}</span>
        </p>
      </Card>

      <Card>
        <SectionTitle icon="users">Datos</SectionTitle>
        <div className="nomina-config-campos">
          <label>
            Empleado
            <Select value={empleadoId} onChange={setEmpleadoId} placeholder="Buscar empleado…">
              {empleados.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} · {normalizeSucursal(e.sucursal)}{e.inactivo ? " (inactivo)" : ""}
                </option>
              ))}
            </Select>
          </label>
          <label>
            {tipo === "gratificacion" ? "Fecha de pago" : "Fecha de salida"}
            <DateRangePicker unico desde={fecha} onChange={setFecha} placeholder="Elige el día" />
          </label>
          {tipo !== "gratificacion" && (
            <label>
              Días pendientes de pago
              <input
                type="number" min="0" inputMode="decimal"
                value={diasPendientesPago}
                onChange={(e) => setDiasPendientesPago(e.target.value)}
              />
            </label>
          )}
          <label>
            Días de aguinaldo
            <input
              type="number" min="0" inputMode="decimal"
              value={diasAguinaldo}
              onChange={(e) => setDiasAguinaldo(e.target.value)}
            />
          </label>
          {tipo !== "gratificacion" && (
            <label>
              Otras percepciones
              <input
                type="number" min="0" step="0.01" inputMode="decimal"
                value={otrasPercepciones}
                onChange={(e) => setOtrasPercepciones(e.target.value)}
              />
            </label>
          )}
          {tipo === "liquidacion" && (
            <label>
              Salario mínimo diario vigente
              <input
                type="number" min="0" step="0.01" inputMode="decimal"
                value={salarioMinimoDiario}
                onChange={(e) => setSalarioMinimoDiario(e.target.value)}
                placeholder="Para el tope de la prima de antigüedad"
              />
            </label>
          )}
        </div>

        {faltaSueldo && (
          <p className="mc-hint">
            <Icon name="alert" size={15} />
            <span>{empleado.name} no tiene sueldo semanal capturado — captúralo en su ficha antes de calcular.</span>
          </p>
        )}
        {faltaIngreso && (
          <p className="mc-hint">
            <Icon name="alert" size={15} />
            <span>{empleado.name} no tiene fecha de ingreso capturada — captúrala en su ficha antes de calcular.</span>
          </p>
        )}
      </Card>

      {resultado && (
        <Card>
          <SectionTitle icon="dollar">Desglose</SectionTitle>
          <table className="mc-table">
            <thead>
              <tr><th>Concepto</th><th>Monto</th></tr>
            </thead>
            <tbody>
              {filasDesglose.map(([concepto, valor]) => (
                <tr key={concepto}><td>{concepto}</td><td>{money(valor)}</td></tr>
              ))}
              <tr>
                <td><strong>Total</strong></td>
                <td><strong>{money(resultado.total ?? resultado.montoAguinaldo)}</strong></td>
              </tr>
            </tbody>
          </table>
          <button type="button" className="mc-btn-primary mc-btn-with-icon" onClick={imprimir} style={{ marginTop: 16 }}>
            <Icon name="printer" size={16} /> Imprimir recibo
          </button>
        </Card>
      )}
    </div>
  );
}
