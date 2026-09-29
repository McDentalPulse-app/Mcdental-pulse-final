import { describe, it, expect } from "vitest";
import {
  aniosCumplidos,
  periodoVacaciones,
  diasEnPeriodo,
  saldoVacaciones,
  validarSolicitud,
  diasDeAnticipacion,
  diasVacacionesPorAnios,
} from "./vacaciones";

const vacacion = (fechaInicio, fechaFin, dias, estado = "aprobado") => ({
  fechaInicio,
  fechaFin,
  dias,
  estado,
});

describe("aniosCumplidos", () => {
  it("el día antes del aniversario todavía no cuenta el año", () => {
    expect(aniosCumplidos("2025-03-10", "2026-03-09")).toBe(0);
    expect(aniosCumplidos("2025-03-10", "2026-03-10")).toBe(1);
  });

  it("cuenta años completos, no cambios de año natural", () => {
    // Entró en diciembre: en enero lleva un mes, no "un año" por haber cambiado el calendario.
    expect(aniosCumplidos("2025-12-20", "2026-01-05")).toBe(0);
    expect(aniosCumplidos("2020-03-10", "2026-09-15")).toBe(6);
  });

  it("sin fecha de ingreso o con fecha futura devuelve 0", () => {
    expect(aniosCumplidos("", "2026-09-15")).toBe(0);
    expect(aniosCumplidos(null, "2026-09-15")).toBe(0);
    expect(aniosCumplidos("2027-01-01", "2026-09-15")).toBe(0);
  });

  it("el 29 de febrero cumple aniversario el 28 de febrero, igual que en Postgres", () => {
    // El trigger de la migración 162 hace esta misma cuenta; si aquí se eligiera el 1 de marzo,
    // la pantalla y la base le darían al empleado dos fechas distintas.
    expect(aniosCumplidos("2024-02-29", "2025-02-27")).toBe(0);
    expect(aniosCumplidos("2024-02-29", "2025-02-28")).toBe(1);
    expect(periodoVacaciones("2024-02-29", "2025-06-01")).toEqual({
      inicio: "2025-02-28",
      fin: "2026-02-28",
      anios: 1,
    });
  });
});

describe("periodoVacaciones", () => {
  it("va de aniversario a aniversario, no de enero a diciembre", () => {
    expect(periodoVacaciones("2020-03-10", "2026-09-15")).toEqual({
      inicio: "2026-03-10",
      fin: "2027-03-10",
      anios: 6,
    });
  });

  it("es null mientras no cumpla el primer año", () => {
    expect(periodoVacaciones("2026-01-01", "2026-09-15")).toBeNull();
  });
});

describe("diasEnPeriodo", () => {
  const periodo = { inicio: "2026-03-10", fin: "2027-03-10", anios: 6 };

  it("reparte una solicitud que cruza el aniversario", () => {
    // Del 5 al 12 de marzo con aniversario el 10: 5 días del periodo viejo, 3 del nuevo.
    const cruza = vacacion("2026-03-05", "2026-03-12", 8);
    expect(diasEnPeriodo(cruza, periodo)).toBe(3);
    expect(diasEnPeriodo(cruza, { inicio: "2025-03-10", fin: "2026-03-10", anios: 5 })).toBe(5);
  });

  it("una solicitud entera dentro del periodo cuenta entera", () => {
    expect(diasEnPeriodo(vacacion("2026-06-01", "2026-06-05", 5), periodo)).toBe(5);
  });

  it("una solicitud de otro periodo no cuenta nada", () => {
    expect(diasEnPeriodo(vacacion("2027-05-01", "2027-05-03", 3), periodo)).toBe(0);
  });

  it("sin fechaFin se deduce del número de días", () => {
    expect(diasEnPeriodo({ fechaInicio: "2026-06-01", dias: 4 }, periodo)).toBe(4);
    expect(diasEnPeriodo({ fechaInicio: "2026-06-01" }, periodo)).toBe(1);
  });
});

describe("diasVacacionesPorAnios (tabla de la LFT menos 4 días)", () => {
  it("sin el año cumplido no hay días", () => {
    expect(diasVacacionesPorAnios(0)).toBe(0);
    expect(diasVacacionesPorAnios(-1)).toBe(0);
    expect(diasVacacionesPorAnios(undefined)).toBe(0);
  });

  it("los primeros cinco años suben de 2 en 2 desde 8", () => {
    expect([1, 2, 3, 4, 5].map(diasVacacionesPorAnios)).toEqual([8, 10, 12, 14, 16]);
  });

  it("después, +2 por cada bloque de cinco años", () => {
    expect([6, 10].map(diasVacacionesPorAnios)).toEqual([18, 18]);
    expect([11, 15].map(diasVacacionesPorAnios)).toEqual([20, 20]);
    expect([16, 20].map(diasVacacionesPorAnios)).toEqual([22, 22]);
    expect([21, 25, 26, 30, 31].map(diasVacacionesPorAnios)).toEqual([24, 24, 26, 26, 28]);
  });

  it("siempre 4 menos que el Art. 76 de la LFT", () => {
    const lft = (n) => (n <= 5 ? 10 + 2 * n : 20 + 2 * Math.ceil((n - 5) / 5));
    for (let n = 1; n <= 40; n++) expect(diasVacacionesPorAnios(n), `${n} años`).toBe(lft(n) - 4);
  });
});

describe("saldoVacaciones", () => {
  it("sin el año cumplido no hay días: bloqueado, no agotado", () => {
    const saldo = saldoVacaciones("2026-01-01", [], "2026-09-15");
    expect(saldo.desbloqueado).toBe(false);
    expect(saldo.disponibles).toBe(0);
    expect(saldo.proximoAniversario).toBe("2027-01-01");
  });

  it("al cumplir el año estrena los 8 días completos", () => {
    const saldo = saldoVacaciones("2025-09-15", [], "2026-09-15");
    expect(saldo.desbloqueado).toBe(true);
    expect(saldo.total).toBe(8);
    expect(saldo.disponibles).toBe(8);
  });

  it("el total crece con la antigüedad: 2 años → 10, 6 años → 18", () => {
    expect(saldoVacaciones("2024-09-15", [], "2026-09-15").total).toBe(10);
    const seis = saldoVacaciones("2020-03-10", [], "2026-09-15");
    expect(seis.anios).toBe(6);
    expect(seis.total).toBe(18);
    expect(seis.disponibles).toBe(18);
  });

  it("descuenta lo aprobado y lo pendiente, pero no lo rechazado", () => {
    const saldo = saldoVacaciones(
      "2025-03-10",
      [
        vacacion("2026-04-01", "2026-04-03", 3, "aprobado"),
        vacacion("2026-06-01", "2026-06-02", 2, "pendiente"),
        vacacion("2026-07-01", "2026-07-05", 5, "rechazado"),
      ],
      "2026-09-15"
    );
    expect(saldo.usados).toBe(5);
    expect(saldo.disponibles).toBe(3);
  });

  it("el saldo se reinicia en el aniversario: lo del periodo anterior no cuenta", () => {
    // Primer año (8 días) agotado; al cumplir el segundo estrena los 10 del nuevo periodo.
    const tomadas = [vacacion("2026-02-01", "2026-02-08", 8)];
    expect(saldoVacaciones("2024-03-10", tomadas, "2026-02-15").disponibles).toBe(0);
    expect(saldoVacaciones("2024-03-10", tomadas, "2026-09-15").disponibles).toBe(10);
  });

  it("una solicitud que cruza el aniversario solo gasta del periodo nuevo los días que caen en él", () => {
    // El defecto que encontró la revisión: antes esto devolvía 8 disponibles, regalando 3 días.
    // Periodo viejo: 8 días (1 año), gasta 5. Periodo nuevo: 10 días (2 años), gasta 3.
    const cruza = [vacacion("2026-03-05", "2026-03-12", 8)];
    expect(saldoVacaciones("2024-03-10", cruza, "2026-03-08").disponibles).toBe(3);
    expect(saldoVacaciones("2024-03-10", cruza, "2026-03-15").disponibles).toBe(7);
  });

  it("nunca devuelve disponibles negativos aunque RH haya aprobado de más", () => {
    const saldo = saldoVacaciones("2025-03-10", [vacacion("2026-04-01", "2026-04-12", 12)], "2026-09-15");
    expect(saldo.usados).toBe(12);
    expect(saldo.disponibles).toBe(0);
  });

  it("ignora solicitudes sin fecha", () => {
    const saldo = saldoVacaciones("2020-03-10", [vacacion("", "", 3)], "2026-09-15");
    expect(saldo.usados).toBe(0);
  });
});

describe("validarSolicitud", () => {
  // Aniversario cada 10 de marzo. Con HOY 2026-09-15 lleva 1 año: periodo de 8 días hasta el
  // 2027-03-10, y el siguiente (2 años) ya trae 10.
  const INGRESO = "2025-03-10";
  const HOY = "2026-09-15";

  it("acepta lo que cabe en el periodo", () => {
    expect(validarSolicitud(INGRESO, [], "2026-10-01", "2026-10-05", HOY)).toEqual({ ok: true });
  });

  it("rechaza si excede el saldo del periodo", () => {
    const usadas = [vacacion("2026-04-01", "2026-04-06", 6)];
    const r = validarSolicitud(INGRESO, usadas, "2026-10-01", "2026-10-04", HOY);
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe("excede");
    expect(r.disponibles).toBe(2);
    expect(r.pide).toBe(4);
  });

  it("una solicitud a caballo del aniversario tiene que caber en LOS DOS periodos", () => {
    // 6 días ya usados en el periodo que acaba el 2027-03-10; se piden 4 días del 8 al 11 de
    // marzo: 2 caen en el periodo viejo (donde solo quedan 2) y 2 en el nuevo.
    const usadas = [vacacion("2026-04-01", "2026-04-06", 6)];
    expect(validarSolicitud(INGRESO, usadas, "2027-03-08", "2027-03-11", HOY)).toEqual({ ok: true });

    // Con 7 usados, los 2 días que caen en el periodo viejo ya no caben (aunque el nuevo, de 10,
    // tendría de sobra: cada periodo se valida con SUS días).
    const casiLlenas = [vacacion("2026-04-01", "2026-04-07", 7)];
    const r = validarSolicitud(INGRESO, casiLlenas, "2027-03-08", "2027-03-11", HOY);
    expect(r.ok).toBe(false);
    expect(r.periodo.fin).toBe("2027-03-10");
    expect(r.disponibles).toBe(1);
    expect(r.pide).toBe(2);
    expect(r.total).toBe(8);
  });

  it("el periodo nuevo se valida con los días de su año de antigüedad", () => {
    // Entró 2024-03-10: el periodo que empieza el 2026-03-10 (2 años) trae 10 días.
    expect(validarSolicitud("2024-03-10", [], "2026-10-01", "2026-10-10", HOY)).toEqual({ ok: true });
    const r = validarSolicitud("2024-03-10", [], "2026-10-01", "2026-10-11", HOY);
    expect(r.motivo).toBe("excede");
    expect(r.disponibles).toBe(10);
  });

  it("no deja pedir si hoy todavía no cumple el año, ni siquiera para después del aniversario", () => {
    const r = validarSolicitud("2026-01-01", [], "2027-02-01", "2027-02-03", HOY);
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe("bloqueado");
    expect(r.proximoAniversario).toBe("2027-01-01");
  });

  it("señala la falta de fecha de ingreso como tal, no como saldo agotado", () => {
    expect(validarSolicitud("", [], "2026-10-01", "2026-10-02", HOY).motivo).toBe("sin_ingreso");
  });

  it("rechaza un rango invertido", () => {
    expect(validarSolicitud(INGRESO, [], "2026-10-05", "2026-10-01", HOY).motivo).toBe("rango");
  });

  it("distingue agotado de excedido", () => {
    const llenas = [vacacion("2026-04-01", "2026-04-08", 8)];
    expect(validarSolicitud(INGRESO, llenas, "2026-10-01", "2026-10-01", HOY).motivo).toBe("agotado");
  });

  it("sin diasAnticipacionMinima no exige ningún aviso previo (compatibilidad)", () => {
    expect(validarSolicitud(INGRESO, [], "2026-09-16", "2026-09-17", HOY)).toEqual({ ok: true });
  });

  it("rechaza por falta de anticipación cuando faltan menos días de los que exige", () => {
    // HOY es 2026-09-15; pedir para el 2026-09-20 son 5 días de aviso, no los 30 exigidos.
    const r = validarSolicitud(INGRESO, [], "2026-09-20", "2026-09-21", HOY, 30);
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe("anticipacion");
    expect(r.diasAnticipacionMinima).toBe(30);
    expect(r.primeraFechaPermitida).toBe("2026-10-15");
  });

  it("acepta con la anticipación exacta que exige", () => {
    // 2026-09-15 + 15 días = 2026-09-30.
    expect(validarSolicitud(INGRESO, [], "2026-09-30", "2026-10-02", HOY, 15)).toEqual({ ok: true });
  });
});

describe("diasDeAnticipacion", () => {
  it("cuenta los días entre hoy y una fecha futura", () => {
    expect(diasDeAnticipacion("2026-09-15", "2026-10-15")).toBe(30);
  });

  it("da negativo para una fecha que ya pasó", () => {
    expect(diasDeAnticipacion("2026-09-15", "2026-09-10")).toBe(-5);
  });

  it("da null si alguna fecha no es ISO válida", () => {
    expect(diasDeAnticipacion("2026-09-15", "")).toBeNull();
    expect(diasDeAnticipacion("", "2026-09-15")).toBeNull();
  });
});
