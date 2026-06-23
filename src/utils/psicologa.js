import { normalizeSucursal } from "./constants";
import { normalizeEmployeeNameKey } from "./adminEmployeeDates";

const PSICOLOGA_PRINCIPAL_USER = "ana salas";

/** Psicóloga oficial del sistema (prioridad sobre otras con role psicologa). */
export const isPsicologaPrincipal = (user) => {
  if (!user || user.role !== "psicologa") return false;
  const key = normalizeEmployeeNameKey(user.name);
  return key.includes("ANA GORETTY") || user.user === PSICOLOGA_PRINCIPAL_USER;
};

export const getPsicologaPrincipal = (usuarios = []) => {
  const psicologas = usuarios.filter((u) => u.role === "psicologa");
  return psicologas.find(isPsicologaPrincipal) || psicologas[0] || null;
};

export const formatUsuarioMensajesMeta = (usuario) => {
  if (!usuario) return "";
  const puesto = usuario.role === "psicologa" ? "Psicóloga" : usuario.puesto;
  return `${puesto} · ${normalizeSucursal(usuario.sucursal)}`;
};
