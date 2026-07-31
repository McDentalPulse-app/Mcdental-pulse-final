import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// pushService toca Notification, service workers y VAPID al importarse; aquí solo interesa
// el contrato, así que se sustituye.
vi.mock("../services/pushService", () => ({
  soportado: () => true,
  estadoPermiso: () => "default",
  activar: vi.fn(async () => "granted"),
}));

import { consultarPermiso, pedirPermiso, comoReactivar, PERMISOS } from "./permisosDispositivo";

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
  it("no vuelve a preguntar si ya está denegado", async () => {
    navegador.permissions.query = vi.fn(async () => ({ state: "denied" }));
    await expect(pedirPermiso("ubicacion")).resolves.toBe("denied");
    expect(navegador.geolocation.getCurrentPosition).not.toHaveBeenCalled();
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

describe("comoReactivar", () => {
  it("da la ruta de iPhone en iPhone", () => {
    expect(comoReactivar("iPhone; CPU iPhone OS 17_0")).toMatch(/Ajustes/);
  });

  it("da la del candado en escritorio", () => {
    expect(comoReactivar("Mozilla/5.0 (X11; Linux x86_64)")).toMatch(/candado/);
  });
});
