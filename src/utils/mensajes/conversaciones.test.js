import { describe, it, expect } from "vitest";
import { construirConversaciones, ordenarConversaciones, quienAtiende, BUZONES } from "./conversaciones";

const EMP = { id: "emp1", name: "Empleada Uno", role: "empleado" };
const EMP2 = { id: "emp2", name: "Empleado Dos", role: "empleado" };
const PSI = { id: "psi", name: "Psicóloga", role: "psicologa" };
const RH = { id: "rh", name: "RH", role: "rh" };
const ADMIN = { id: "adm", name: "Admin", role: "admin" };
const SOPORTE = { id: "sop", name: "Encargado Sistemas", role: "empleado", soporteTi: true };

const USUARIOS = [EMP, EMP2, PSI, RH, ADMIN, SOPORTE];
const getUserById = (id) => USUARIOS.find((u) => u.id === id);
const empleados = [EMP, EMP2, SOPORTE];

const m = (over) => ({ de: "emp1", para: null, canal: "mantenimiento", texto: "x", leido: false, fecha: "2026-09-10T10:00:00Z", ...over });

const construir = (user, mensajes) =>
  construirConversaciones({ mensajes, user, psicologa: PSI, empleados, getUserById });

const canales = (convs) => convs.map((c) => c.canal);

describe("quienAtiende", () => {
  it("Sistemas por bandera, Mantenimiento por rol", () => {
    expect(quienAtiende(SOPORTE)).toEqual({ soporte: true, mantenimiento: false });
    expect(quienAtiende(RH)).toEqual({ soporte: false, mantenimiento: true });
    expect(quienAtiende(ADMIN)).toEqual({ soporte: false, mantenimiento: true });
    expect(quienAtiende({ role: "admin_plus" })).toEqual({ soporte: false, mantenimiento: true });
    expect(quienAtiende(PSI)).toEqual({ soporte: false, mantenimiento: true });
    expect(quienAtiende(EMP)).toEqual({ soporte: false, mantenimiento: false });
  });
});

describe("construirConversaciones", () => {
  it("empleado: psicóloga + los dos buzones, aunque estén vacíos", () => {
    const convs = construir(EMP, []);
    expect(canales(convs)).toEqual(["psicologa", "soporte", "mantenimiento"]);
    // Los buzones se pintan como canal, no como persona.
    expect(convs[1].usuario.name).toBe(BUZONES.soporte.name);
    expect(convs[2].usuario.name).toBe(BUZONES.mantenimiento.name);
    expect(convs[1].para).toBeNull();
  });

  it("RH: NO lleva canal con la psicóloga, atiende Mantenimiento y reporta a Sistemas", () => {
    const convs = construir(RH, [m({ de: "emp1" }), m({ de: "emp2" })]);
    expect(canales(convs)).not.toContain("psicologa");
    // Un hilo por persona que reportó (atendidos) MÁS el suyo propio para reportar.
    const mant = convs.filter((c) => c.canal === "mantenimiento");
    expect(mant.filter((c) => c.atendido).map((c) => c.usuario.id).sort()).toEqual(["emp1", "emp2"]);
    expect(mant.filter((c) => !c.atendido)).toHaveLength(1);
    // Y su hilo hacia Sistemas, donde ella reporta pero no atiende.
    expect(convs.filter((c) => c.canal === "soporte")).toHaveLength(1);
  });

  it("la psicóloga atiende Mantenimiento pero NO gana conversación hacia Sistemas (§10.1-P3)", () => {
    const convs = construir(PSI, [m({ de: "emp1" })]);
    expect(canales(convs)).not.toContain("soporte");
    expect(canales(convs)).toContain("mantenimiento");
  });

  it("quien atiende un buzón VACÍO igual tiene dónde escribir su propio reporte", () => {
    // El bug que cazó la revisión: el hilo propio solo aparecía "cuando ya había escrito", así
    // que los 4 roles que atienden Mantenimiento no tenían dónde escribir el primero. Circular.
    const convs = construir(RH, []);
    const propio = convs.find((c) => c.canal === "mantenimiento" && !c.atendido);
    expect(propio).toBeDefined();
    expect(propio.usuario.id).toBe(BUZONES.mantenimiento.id);
    expect(propio.para).toBeNull();
  });

  it("quien atiende y además reportó NO ve su conversación duplicada", () => {
    // Su propio hilo sale UNA vez (el pseudo-contacto), no también como hilo atendido.
    const convs = construir(RH, [m({ de: "rh" }), m({ de: "emp1" })]);
    const mant = convs.filter((c) => c.canal === "mantenimiento");
    expect(mant).toHaveLength(2);
    // El propio, con el buzón como interlocutor; y el ajeno, con la persona.
    expect(mant.filter((c) => !c.atendido)).toHaveLength(1);
    expect(mant.find((c) => !c.atendido).mensajes.map((x) => x.de)).toEqual(["rh"]);
    expect(mant.find((c) => c.atendido).usuario.id).toBe("emp1");
  });

  it("el hilo propio hacia un buzón NO arrastra lo que reportaron otros", () => {
    // Caso real: un admin atiende Mantenimiento (la base le entrega TODO ese canal) y además
    // tiene su propio hilo hacia Sistemas. Ese hilo propio no puede traer lo ajeno.
    const mensajes = [
      m({ de: "emp1", canal: "soporte" }),   // de otra persona, al buzón de Sistemas
      m({ de: "adm", canal: "soporte" }),    // suyo
    ];
    const propio = construir(ADMIN, mensajes).find((c) => c.canal === "soporte");
    expect(propio.mensajes).toHaveLength(1);
    expect(propio.mensajes[0].de).toBe("adm");
  });

  it("el canal de la psicóloga nunca mezcla mensajes de un buzón", () => {
    const mensajes = [
      { de: "emp1", para: "psi", canal: "psicologa", texto: "privado", fecha: "2026-09-10T09:00:00Z" },
      m({ de: "emp1", canal: "mantenimiento" }),
    ];
    const priv = construir(EMP, mensajes).find((c) => c.canal === "psicologa");
    expect(priv.mensajes).toHaveLength(1);
    expect(priv.mensajes[0].texto).toBe("privado");
  });

  it("cuenta como no leído lo que entra al buzón sin destinatario", () => {
    const convs = construir(RH, [m({ de: "emp1", leido: false })]);
    const hilo = convs.find((c) => c.canal === "mantenimiento");
    // `para` es nulo: si el contador solo mirara "dirigido a mí", esto daría 0 y el badge
    // nunca se encendería para nadie (el fallo silencioso que motivó el arreglo).
    expect(hilo.noLeidos).toBe(1);
  });

  it("lo propio no cuenta como no leído para uno mismo", () => {
    const hilo = construir(RH, [m({ de: "rh" })]).find((c) => c.canal === "mantenimiento");
    expect(hilo.noLeidos).toBe(0);
  });
});

describe("ordenarConversaciones", () => {
  it("las propias primero aunque estén vacías; las atendidas por recencia y solo con mensajes", () => {
    const convs = [
      { canal: "mantenimiento", atendido: true, mensajes: [1], ultimo: { fecha: "2026-09-01" } },
      { canal: "soporte", atendido: false, mensajes: [], ultimo: undefined },
      { canal: "mantenimiento", atendido: true, mensajes: [1], ultimo: { fecha: "2026-09-09" } },
      { canal: "mantenimiento", atendido: true, mensajes: [], ultimo: undefined },
    ];
    const orden = ordenarConversaciones(convs);
    expect(orden).toHaveLength(3);
    expect(orden[0].atendido).toBe(false);
    expect(orden[1].ultimo.fecha).toBe("2026-09-09");
    expect(orden[2].ultimo.fecha).toBe("2026-09-01");
  });
});
