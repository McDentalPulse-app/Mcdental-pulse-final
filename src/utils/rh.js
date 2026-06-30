import { normalizeEmployeeNameKey } from "./adminEmployeeDates";

const RH_PRINCIPAL_USER = "maricruz izaguirre";

/** RH oficial del sistema (prioridad sobre otras con role rh). */
export const isRhPrincipal = (user) => {
  if (!user || user.role !== "rh") return false;
  const key = normalizeEmployeeNameKey(user.name);
  return key.includes("MARICRUZ IZAGUIRRE") || user.user === RH_PRINCIPAL_USER;
};

export const getRhPrincipal = (usuarios = []) => {
  const rhUsers = usuarios.filter((u) => u.role === "rh");
  return rhUsers.find(isRhPrincipal) || rhUsers[0] || null;
};
