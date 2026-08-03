import { describe, it, expect } from "vitest";
import { estimarPose, poseCoincide, POSE, evaluarLuz } from "./rostro";

/**
 * Los puntos vienen de MediaPipe en este orden: ojo derecho, ojo izquierdo, nariz.
 * "Derecho" es el de LA PERSONA, así que en la imagen (que NO está espejada) cae a la
 * izquierda: su x es menor.
 */
const cara = (narizX, narizY = 0.5, ojoDerX = 0.4, ojoIzqX = 0.6, ojoY = 0.45) => [
  { x: ojoDerX, y: ojoY },
  { x: ojoIzqX, y: ojoY },
  { x: narizX, y: narizY },
];

describe("estimarPose", () => {
  it("nariz justo en medio de los ojos => de frente", () => {
    expect(estimarPose(cara(0.5)).pose).toBe(POSE.FRONTAL);
  });

  it("nariz desplazada hacia el ojo DERECHO de la persona => giró a su derecha", () => {
    // El ojo derecho está en x=0.4 (izquierda de la imagen). Al girar la cabeza hacia su
    // derecha, la nariz se va hacia allí.
    expect(estimarPose(cara(0.44)).pose).toBe(POSE.DERECHA);
  });

  it("nariz desplazada hacia el ojo IZQUIERDO => giró a su izquierda", () => {
    expect(estimarPose(cara(0.56)).pose).toBe(POSE.IZQUIERDA);
  });

  it("una cara INCLINADA de frente sigue siendo frontal", () => {
    // El bug que esto previene: mirar solo la coordenada X. Todo el mundo ladea la cabeza al
    // mirarse en el móvil, y con la X a secas una cabeza inclinada parecería estar de perfil
    // — la persona no entendería nunca por qué no le acepta la foto de frente.
    // Ojos en diagonal (cabeza ladeada 45°), nariz en el punto medio de la línea de los ojos.
    const ladeada = [
      { x: 0.40, y: 0.40 }, // ojo derecho
      { x: 0.60, y: 0.60 }, // ojo izquierdo, más abajo: cabeza inclinada
      { x: 0.50, y: 0.50 }, // nariz, en el medio
    ];
    expect(estimarPose(ladeada).pose).toBe(POSE.FRONTAL);
  });

  it("sin puntos devuelve null, no revienta", () => {
    expect(estimarPose(null)).toBeNull();
    expect(estimarPose([{ x: 1, y: 1 }])).toBeNull();
  });
});

describe("poseCoincide", () => {
  it("RECHAZA la foto de frente cuando se pide perfil", () => {
    // El motivo entero de esta lógica: sin ella, la persona se queda quieta y las tres fotos
    // del registro salen idénticas.
    const r = poseCoincide(cara(0.5), POSE.DERECHA);
    expect(r.ok).toBe(false);
    expect(r.pista).toContain("derecha");
  });

  it("acepta la pose correcta", () => {
    expect(poseCoincide(cara(0.44), POSE.DERECHA).ok).toBe(true);
    expect(poseCoincide(cara(0.56), POSE.IZQUIERDA).ok).toBe(true);
    expect(poseCoincide(cara(0.5), POSE.FRONTAL).ok).toBe(true);
  });

  it("si giró al lado CONTRARIO, se lo dice — no repite 'gira más'", () => {
    // Decirle "gira un poco más a la derecha" a alguien que ya está girado a la izquierda es
    // sacarlo de quicio: gira más y se aleja más de lo que se le pide.
    const r = poseCoincide(cara(0.56), POSE.DERECHA);
    expect(r.ok).toBe(false);
    expect(r.pista).toContain("otro lado");
  });

  it("sin pose requerida, cualquier cara vale", () => {
    // El checador de cada día NO exige pose: ahí solo importa que se vea la cara. Exigirle a
    // alguien que ponga la cabeza en un ángulo concreto para poder fichar sería absurdo.
    expect(poseCoincide(cara(0.44), null).ok).toBe(true);
  });

  it("si el detector no dio puntos, no se exige nada", () => {
    // Una comprobación que no se puede hacer no puede bloquear a nadie. Misma regla que con
    // el GPS y con el propio detector.
    expect(poseCoincide(null, POSE.DERECHA).ok).toBe(true);
  });
});

/**
 * La guía de luz. Lo que se prueba de verdad es el invariante que la sostiene: AVISA, NO
 * BLOQUEA. Si algún día alguien le añade un `ok: false`, esto lo tiene que cazar — sería
 * dejar sin fichar a quien trabaja en un recibidor a oscuras.
 */
describe("evaluarLuz", () => {
  it("una cara bien iluminada no dice nada", () => {
    expect(evaluarLuz({ cara: 140, fondo: 150 })).toEqual({ nivel: "ok", pista: null });
  });

  it("cara en penumbra => avisa de poca luz", () => {
    const r = evaluarLuz({ cara: 40, fondo: 45 });
    expect(r.nivel).toBe("oscura");
    expect(r.pista).toMatch(/poca luz/i);
  });

  it("fondo mucho más claro que la cara => contraluz, no 'poca luz'", () => {
    // El caso de la puerta de cristal: la pantalla se ve luminosa y la cara sale en sombra.
    const r = evaluarLuz({ cara: 70, fondo: 200 });
    expect(r.nivel).toBe("contraluz");
    expect(r.pista).toMatch(/detrás/i);
  });

  it("el contraluz gana a la penumbra cuando se dan los dos", () => {
    // Cara oscura Y fondo quemado: decir "enciende la luz" sería el consejo equivocado.
    expect(evaluarLuz({ cara: 45, fondo: 210 }).nivel).toBe("contraluz");
  });

  it("cara quemada => avisa de demasiada luz", () => {
    expect(evaluarLuz({ cara: 245, fondo: 200 }).nivel).toBe("quemada");
  });

  it("sin medición no inventa un aviso", () => {
    expect(evaluarLuz(null)).toEqual({ nivel: "ok", pista: null });
    expect(evaluarLuz({ cara: NaN, fondo: 100 })).toEqual({ nivel: "ok", pista: null });
  });

  it("sin dato de fondo sigue detectando la penumbra", () => {
    expect(evaluarLuz({ cara: 30, fondo: null }).nivel).toBe("oscura");
  });

  it("NUNCA devuelve un veto: ningún nivel bloquea la checada", () => {
    const casos = [
      { cara: 10, fondo: 10 }, { cara: 70, fondo: 220 },
      { cara: 250, fondo: 250 }, { cara: 140, fondo: 150 },
    ];
    for (const c of casos) expect(evaluarLuz(c).ok).toBeUndefined();
  });
});
