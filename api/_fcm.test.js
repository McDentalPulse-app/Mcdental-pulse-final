import { generateKeyPairSync, createVerify } from "node:crypto";
import { describe, expect, it } from "vitest";
import { firmarJwt, mensaje, tokenMuerto } from "./_fcm.js";

/**
 * El push a la app nativa (_fcm.js), sin red. Lo que se prueba es lo que, si falla, falla EN
 * SILENCIO: un JWT mal firmado da un 401 que nadie ve, y un token vivo borrado por error deja a
 * alguien sin avisos para siempre.
 */
describe("push nativo por Firebase", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const cuenta = {
    client_email: "sa@proyecto.iam.gserviceaccount.com",
    private_key: privateKey.export({ type: "pkcs8", format: "pem" }),
  };

  it("firma un JWT RS256 que se verifica con la clave pública y pide el alcance de FCM", () => {
    const jwt = firmarJwt(cuenta, 1_000);
    const [cab, cuerpo, firma] = jwt.split(".");
    expect(JSON.parse(Buffer.from(cab, "base64url"))).toEqual({ alg: "RS256", typ: "JWT" });
    const c = JSON.parse(Buffer.from(cuerpo, "base64url"));
    expect(c).toMatchObject({
      iss: cuenta.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: 1_000,
      exp: 4_600,
    });
    const ok = createVerify("RSA-SHA256").update(`${cab}.${cuerpo}`).verify(publicKey, firma, "base64url");
    expect(ok).toBe(true);
  });

  it("solo da por muerto un token que Firebase dice que ya no existe", () => {
    expect(tokenMuerto(404, null)).toBe(true);
    expect(tokenMuerto(400, { error: { details: [{ errorCode: "UNREGISTERED" }] } })).toBe(true);
    expect(tokenMuerto(400, { error: { message: "The registration token is not a valid FCM registration token" } })).toBe(true);
    // Lo pasajero NO borra: perderíamos un teléfono bueno por un fallo de un momento.
    expect(tokenMuerto(500, { error: { message: "internal" } })).toBe(false);
    expect(tokenMuerto(503, null)).toBe(false);
    expect(tokenMuerto(0, { error: { message: "fetch failed" } })).toBe(false);
    expect(tokenMuerto(401, { error: { message: "auth" } })).toBe(false);
  });

  it("el mensaje lleva la url en data y el canal que crea la app", () => {
    const m = mensaje("tok", { titulo: "T", cuerpo: null, url: "/empleado/encuesta" });
    expect(m.message.token).toBe("tok");
    expect(m.message.notification).toEqual({ title: "T", body: "" });
    expect(m.message.data).toEqual({ url: "/empleado/encuesta" });
    expect(m.message.android.notification.channel_id).toBe("avisos");
  });
});
