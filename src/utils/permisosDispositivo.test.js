import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// pushService toca Notification, service workers y VAPID al importarse; aquí solo interesa
// el contrato, así que se sustituye.
vi.mock("../services/pushService", () => ({
  soportado: () => true,
  estadoPermiso: () => "default",
  activar: vi.fn(async () => "granted"),
}));

import { consultarPermiso, pedirPermiso, comoReactivar, PERMISOS, registrarEstadoUbicacionReal } from "./permisosDispositivo";

// En Node moderno `globalThis.navigator` solo tiene getter, así que una asignación directa
// revienta con "Cannot set property navigator". stubGlobal es la vía de vitest para esto.
let navegador;

beforeEach(() => {
  navegador = {
    userAgent: "Mozilla/5.0 (X11; Linux x86_64)",
    platform: "Linux x86_64",
    maxTouchPoints: 0,
    geolocation: { getCurrentPosition: vi.fn() },
    mediaDevices: { getUserMedia: vi.fn() },
    permissions: { query: vi.fn(async () => ({ state: "granted" })) },
  };
  vi.stubGlobal("navigator", navegador);

  // localStorage no existe en el Node puro donde corre este archivo (sin jsdom) — un stub en
  // memoria para poder probar registrarEstadoUbicacionReal()/su lectura. Vacío por default: los
  // tests que no lo tocan siguen viendo el mismo comportamiento de antes (cae a permissions.query).
  const almacen = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (k) => (almacen.has(k) ? almacen.get(k) : null),
    setItem: (k, v) => almacen.set(k, String(v)),
    removeItem: (k) => almacen.delete(k),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("catálogo", () => {
  it("solo la ubicación se marca como bloqueante", () => {
    const bloquean = Object.values(PERMISOS).filter((p) => p.bloquea).map((p) => p.id);
    expect(bloquean).toEqual(["ubicacion"]);
  });
});

describe("consultarPermiso", () => {
  it("lee el estado de la Permissions API", async () => {
    await expect(consultarPermiso("ubicacion")).resolves.toBe("granted");
  });

  it("sin geolocation en el navegador responde no-soportado", async () => {
    delete navegador.geolocation;
    await expect(consultarPermiso("ubicacion")).resolves.toBe("no-soportado");
  });

  // Safari no implementa permissions.query para cámara/micrófono.
  it("si no se puede consultar responde prompt, nunca granted", async () => {
    delete navegador.permissions;
    await expect(consultarPermiso("camara")).resolves.toBe("prompt");
  });

  it("si query lanza, tampoco inventa un granted", async () => {
    navegador.permissions.query = vi.fn(async () => { throw new Error("nope"); });
    await expect(consultarPermiso("microfono")).resolves.toBe("prompt");
  });

  it("traduce el 'default' de Notification a 'prompt'", async () => {
    await expect(consultarPermiso("avisos")).resolves.toBe("prompt");
  });
});

describe("pedirPermiso", () => {
  it("cámara/micrófono no vuelven a preguntar si ya están denegados", async () => {
    navegador.permissions.query = vi.fn(async () => ({ state: "denied" }));
    await expect(pedirPermiso("camara")).resolves.toBe("denied");
    expect(navegador.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  });

  // Hallazgo HIGH de revisión adversarial: ubicación es la excepción a propósito. Si usara el
  // mismo atajo, alguien que reactiva el permiso desde Ajustes del sistema (fuera de la app) se
  // queda con el botón "Activar ubicación" roto para siempre, porque el registro local de
  // registrarEstadoUbicacionReal nunca se corrige — pedirPermiso() es justo el toque explícito
  // que debe preguntarle al navegador de verdad, no al caché.
  it("ubicación SÍ vuelve a preguntarle al navegador aunque el registro diga denegado", async () => {
    registrarEstadoUbicacionReal("denied");
    navegador.geolocation.getCurrentPosition = vi.fn((ok) => ok({ coords: {} }));
    await expect(pedirPermiso("ubicacion")).resolves.toBe("granted");
    expect(navegador.geolocation.getCurrentPosition).toHaveBeenCalledOnce();
  });

  it("concede la ubicación cuando el navegador responde con una posición", async () => {
    navegador.permissions.query = vi.fn(async () => ({ state: "prompt" }));
    navegador.geolocation.getCurrentPosition = vi.fn((ok) => ok({ coords: {} }));
    await expect(pedirPermiso("ubicacion")).resolves.toBe("granted");
  });

  it("el código 1 del GPS es denegado, no un fallo pasajero", async () => {
    navegador.permissions.query = vi.fn(async () => ({ state: "prompt" }));
    navegador.geolocation.getCurrentPosition = vi.fn((ok, err) => err({ code: 1 }));
    await expect(pedirPermiso("ubicacion")).resolves.toBe("denied");
  });

  it("un timeout del GPS no se confunde con denegado", async () => {
    navegador.permissions.query = vi.fn(async () => ({ state: "prompt" }));
    navegador.geolocation.getCurrentPosition = vi.fn((ok, err) => err({ code: 3 }));
    await expect(pedirPermiso("ubicacion")).resolves.toBe("prompt");
  });

  // Si la pista se queda abierta, el piloto de la cámara sigue encendido y la gente cree
  // que la app la está grabando.
  it("suelta la cámara justo después de conseguir el permiso", async () => {
    const stop = vi.fn();
    navegador.permissions.query = vi.fn(async () => ({ state: "prompt" }));
    navegador.mediaDevices.getUserMedia = vi.fn(async () => ({
      getTracks: () => [{ stop }],
    }));
    await expect(pedirPermiso("camara")).resolves.toBe("granted");
    expect(stop).toHaveBeenCalledOnce();
  });

  it("NotAllowedError es denegado", async () => {
    navegador.permissions.query = vi.fn(async () => ({ state: "prompt" }));
    navegador.mediaDevices.getUserMedia = vi.fn(async () => {
      const e = new Error("no"); e.name = "NotAllowedError"; throw e;
    });
    await expect(pedirPermiso("microfono")).resolves.toBe("denied");
  });
});

describe("consultarPermiso('ubicacion') — el bug de iOS Safari", () => {
  // permissions.query({name:'geolocation'}) en iOS SIEMPRE dice 'prompt', concedido o no. Sin
  // esto, el aviso de "activa tu ubicación" nunca se iba pese a que la persona ya lo dio.
  // Se le pregunta primero a la API (2da revisión adversarial, HIGH: confiar en el registro
  // ANTES de preguntar dejaba atascado el aviso para siempre en navegadores donde la API sí
  // funciona, si alguien reactivaba el permiso desde Ajustes del sistema). Solo se cae al
  // registro cuando la API responde justo la mentira de iOS: 'prompt'.
  it("si la API miente 'prompt' (iOS) pero de verdad se concedió antes, usa el registro", async () => {
    navegador.permissions.query = vi.fn(async () => ({ state: "prompt" })); // como en iOS real
    registrarEstadoUbicacionReal("granted");
    await expect(consultarPermiso("ubicacion")).resolves.toBe("granted");
    expect(navegador.permissions.query).toHaveBeenCalledOnce(); // sí se le preguntó primero
  });

  it("si la API miente 'prompt' pero de verdad se denegó antes, usa el registro", async () => {
    navegador.permissions.query = vi.fn(async () => ({ state: "prompt" }));
    registrarEstadoUbicacionReal("denied");
    await expect(consultarPermiso("ubicacion")).resolves.toBe("denied");
  });

  it("si la API responde algo concreto, se le cree a ella aunque el registro diga otra cosa", async () => {
    navegador.permissions.query = vi.fn(async () => ({ state: "granted" }));
    registrarEstadoUbicacionReal("denied"); // registro viejo, de antes de reactivar en Ajustes
    await expect(consultarPermiso("ubicacion")).resolves.toBe("granted");
  });

  it("sin evidencia real todavía, le pregunta a permissions.query como antes", async () => {
    navegador.permissions.query = vi.fn(async () => ({ state: "granted" }));
    await expect(consultarPermiso("ubicacion")).resolves.toBe("granted");
    expect(navegador.permissions.query).toHaveBeenCalledOnce();
  });

  it("registrarEstadoUbicacionReal ignora 'prompt' — no hay nada real que recordar", async () => {
    navegador.permissions.query = vi.fn(async () => ({ state: "denied" }));
    registrarEstadoUbicacionReal("prompt");
    await expect(consultarPermiso("ubicacion")).resolves.toBe("denied"); // vino de query, no del registro
  });
});

describe("pedirPermiso('ubicacion') deja evidencia real para la próxima consulta", () => {
  it("al conceder, lo escribe — la próxima consultarPermiso ya no depende de la API", async () => {
    navegador.permissions.query = vi.fn(async () => ({ state: "prompt" }));
    navegador.geolocation.getCurrentPosition = vi.fn((ok) => ok({ coords: {} }));
    await pedirPermiso("ubicacion");

    navegador.permissions.query = vi.fn(async () => ({ state: "prompt" })); // la API sigue mintiendo
    await expect(consultarPermiso("ubicacion")).resolves.toBe("granted");
  });

  it("al denegar (código 1), también lo escribe", async () => {
    navegador.permissions.query = vi.fn(async () => ({ state: "prompt" }));
    navegador.geolocation.getCurrentPosition = vi.fn((ok, err) => err({ code: 1 }));
    await pedirPermiso("ubicacion");

    navegador.permissions.query = vi.fn(async () => ({ state: "prompt" }));
    await expect(consultarPermiso("ubicacion")).resolves.toBe("denied");
  });

  it("un timeout (código 3) no escribe nada — no es un veredicto sobre el permiso", async () => {
    // query en 'prompt' (no 'granted'/'denied'): así el único evento que podría escribir el
    // registro es el propio getCurrentPosition, no el consultarPermiso() previo de pedirPermiso.
    navegador.permissions.query = vi.fn(async () => ({ state: "prompt" }));
    navegador.geolocation.getCurrentPosition = vi.fn((ok, err) => err({ code: 3 }));
    await pedirPermiso("ubicacion");
    expect(localStorage.getItem("pulse:permiso-ubicacion-real")).toBeNull();
  });
});

describe("comoReactivar", () => {
  it("da la ruta de iPhone en iPhone", () => {
    expect(comoReactivar("iPhone; CPU iPhone OS 17_0")).toMatch(/Ajustes/);
  });

  it("da la del candado en escritorio", () => {
    expect(comoReactivar("Mozilla/5.0 (X11; Linux x86_64)")).toMatch(/candado/);
  });
});
