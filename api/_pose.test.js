import { describe, it, expect } from "vitest";
import { proyectarNariz, giroCorrecto, POSE, GIRO_MINIMO } from "./_pose.js";

/** Puntos como los devuelve YuNet: [ojoDer, ojoIzq, nariz, comisuraDer, comisuraIzq]. */
const cara = ({ ojoDer, ojoIzq, nariz }) => [ojoDer, ojoIzq, nariz, [0, 0], [0, 0]];

describe("proyectarNariz", () => {
  it("cara de frente: la nariz cae en medio de los ojos", () => {
    const t = proyectarNariz(cara({ ojoDer: [100, 100], ojoIzq: [200, 100], nariz: [150, 140] }));
    expect(t).toBeCloseTo(0.5);
  });

  it("cabeza girada a SU derecha: la nariz se va hacia el ojo derecho (t baja)", () => {
    const t = proyectarNariz(cara({ ojoDer: [100, 100], ojoIzq: [200, 100], nariz: [120, 140] }));
    expect(t).toBeCloseTo(0.2);
  });

  it("cabeza girada a SU izquierda: t sube", () => {
    const t = proyectarNariz(cara({ ojoDer: [100, 100], ojoIzq: [200, 100], nariz: [180, 140] }));
    expect(t).toBeCloseTo(0.8);
  });

  it("una cabeza INCLINADA de frente sigue dando 0.5 (no se confunde con un perfil)", () => {
    // Todo el mundo ladea la cabeza al mirarse en el móvil. Si midiéramos solo la X, esta cara
    // —que está de frente, solo torcida— parecería estar de perfil y el reto rechazaría a una
    // persona honrada que hizo justo lo que se le pidió.
    // Ojos en diagonal (cabeza ladeada 45°) y la nariz PERPENDICULAR a esa línea, o sea
    // centrada respecto a los ojos aunque en pantalla no esté "debajo" de ellos.
    const t = proyectarNariz(cara({ ojoDer: [100, 100], ojoIzq: [170, 170], nariz: [100, 170] }));
    expect(t).toBeCloseTo(0.5);
  });

  it("sin puntos suficientes no se inventa un número", () => {
    expect(proyectarNariz(null)).toBeNull();
    expect(proyectarNariz([[1, 1], [2, 2]])).toBeNull();
    // Los dos ojos en el mismo sitio: no hay línea sobre la que proyectar.
    expect(proyectarNariz(cara({ ojoDer: [100, 100], ojoIzq: [100, 100], nariz: [100, 140] }))).toBeNull();
  });
});

describe("giroCorrecto", () => {
  it("LA PRUEBA QUE IMPORTA: una foto girada no mueve la nariz, así que NO pasa el reto", () => {
    // Este es el ataque entero. Al rotar una foto impresa delante de la cámara, la imagen se
    // comprime pero la nariz sigue clavada en el centro entre los ojos: no hay relieve, no hay
    // paralaje. Da igual cuánto la giren.
    const fotoGirada = proyectarNariz(cara({ ojoDer: [100, 100], ojoIzq: [160, 100], nariz: [130, 130] }));
    expect(fotoGirada).toBeCloseTo(0.5);
    expect(giroCorrecto(fotoGirada, POSE.DERECHA)).toBe(false);
    expect(giroCorrecto(fotoGirada, POSE.IZQUIERDA)).toBe(false);
  });

  it("una cabeza de verdad girada al lado que se le pidió, pasa", () => {
    expect(giroCorrecto(0.2, POSE.DERECHA)).toBe(true);
    expect(giroCorrecto(0.8, POSE.IZQUIERDA)).toBe(true);
  });

  it("girar al lado CONTRARIO no cuela", () => {
    expect(giroCorrecto(0.2, POSE.IZQUIERDA)).toBe(false);
    expect(giroCorrecto(0.8, POSE.DERECHA)).toBe(false);
  });

  it("el servidor acepta justo el mínimo, y rechaza lo que se queda a medias", () => {
    expect(giroCorrecto(0.5 - GIRO_MINIMO, POSE.DERECHA)).toBe(true);
    expect(giroCorrecto(0.5 - GIRO_MINIMO + 0.01, POSE.DERECHA)).toBe(false);
  });

  it("el servidor es MÁS PERMISIVO que el navegador, nunca al revés", () => {
    // El navegador no deja tomar la foto hasta t <= 0.34; el servidor acepta hasta 0.38. Si
    // fuera al revés, la persona vería "perfecto" en pantalla y el servidor la rechazaría
    // después: no habría forma humana de entender qué hizo mal.
    const LO_QUE_EXIGE_EL_NAVEGADOR = 0.34;
    expect(giroCorrecto(LO_QUE_EXIGE_EL_NAVEGADOR, POSE.DERECHA)).toBe(true);
    expect(0.5 - GIRO_MINIMO).toBeGreaterThan(LO_QUE_EXIGE_EL_NAVEGADOR);
  });

  it("sin pose pedida, no hay reto que pasar", () => {
    expect(giroCorrecto(0.2, null)).toBe(false);
    expect(giroCorrecto(null, POSE.DERECHA)).toBe(false);
  });
});
