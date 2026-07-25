/**
 * Validación del alta/edición de usuarios (Gestión de Personal).
 *
 * Vive aparte del componente y sin dependencias de React a propósito: son reglas de
 * negocio (qué es un nombre válido, qué username va a poder iniciar sesión) y se
 * prueban solas.
 *
 * El caso importante es el USERNAME: es la credencial real de login, porque el backend
 * lo convierte en `{username}@mcdental.internal` (auth.users.email). El saneo del
 * servidor BORRA todo lo que no sea [a-z0-9._-] — así que "José Pérez" se convertía
 * calladamente en "jos.prez" y el empleado recibía un usuario que nadie escribió.
 * Acá se normaliza ANTES (con los acentos convertidos a su letra base, no borrados) y
 * se le muestra a quien lo da de alta exactamente con qué va a entrar.
 */

const DOMINIO_EMAIL = "mcdental.internal";

/** Quita acentos dejando la letra base: "José" -> "Jose" (el servidor los borraría). */
const sinAcentos = (texto) =>
  String(texto || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/**
 * Deja un username que sobrevive intacto al saneo del servidor.
 * Minúsculas, espacios a puntos, acentos a letra base, y fuera todo lo demás.
 */
export const normalizarUsername = (texto) =>
  sinAcentos(texto)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._-]/g, "");

/** El correo con el que realmente va a iniciar sesión. Espejo de config/supabase.js. */
export const emailDeLogin = (username) => `${normalizarUsername(username)}@${DOMINIO_EMAIL}`;

/** Nombre/puesto: letras (con acentos), espacios y . ' - . Sin dígitos. */
const SOLO_TEXTO = /^[\p{L}\s.'-]+$/u;

export const validarNombre = (valor) => {
  const v = String(valor || "").trim();
  if (!v) return "El nombre es obligatorio.";
  if (v.length < 3) return "El nombre es demasiado corto.";
  if (/\d/.test(v)) return "El nombre no puede llevar números.";
  if (!SOLO_TEXTO.test(v)) return "El nombre solo puede llevar letras.";
  return null;
};

export const validarPuesto = (valor) => {
  const v = String(valor || "").trim();
  if (!v) return "El puesto es obligatorio.";
  if (/\d/.test(v)) return "El puesto no puede llevar números.";
  if (!SOLO_TEXTO.test(v)) return "El puesto solo puede llevar letras.";
  return null;
};

/**
 * Username. `existentes` son los usernames ya usados (el de la BD tiene unique: sin
 * este aviso el error salía como un choque de constraint de Postgres al guardar).
 */
export const validarUsername = (valor, { existentes = [] } = {}) => {
  const v = String(valor || "").trim();
  if (!v) return "El nombre de usuario es obligatorio.";

  const normalizado = normalizarUsername(v);
  if (!normalizado) return "Ese nombre de usuario no deja ningún carácter válido.";
  if (normalizado.length < 3) return "El nombre de usuario es demasiado corto.";

  const yaExiste = existentes.some((u) => normalizarUsername(u) === normalizado);
  if (yaExiste) return "Ya hay alguien con ese nombre de usuario.";

  return null;
};

/** Teléfono: opcional. Dígitos, espacios, + ( ) y -. Entre 10 y 15 dígitos reales. */
export const validarTelefono = (valor) => {
  const v = String(valor || "").trim();
  if (!v) return null;
  if (!/^[\d\s+()-]+$/.test(v)) return "El teléfono solo puede llevar números.";
  const digitos = v.replace(/\D/g, "");
  if (digitos.length < 10) return "El teléfono debe tener al menos 10 dígitos.";
  if (digitos.length > 15) return "El teléfono tiene demasiados dígitos.";
  return null;
};

/** Email: opcional, pero si se escribe tiene que ser plausible. */
export const validarEmail = (valor) => {
  const v = String(valor || "").trim();
  if (!v) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return "Ese correo no parece válido.";
  return null;
};

const DIAS_POR_MES = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * Cumpleaños en MM-DD. El `pattern` del input solo pedía 2 dígitos y 2 dígitos, así
 * que "99-99" pasaba. Acá sí se comprueba que el mes y el día existan (29-02 se acepta:
 * es un cumpleaños real, aunque el año en curso no sea bisiesto).
 */
export const validarCumpleanos = (valor) => {
  const v = String(valor || "").trim();
  if (!v) return null;
  const m = /^(\d{2})-(\d{2})$/.exec(v);
  if (!m) return "Usá el formato MM-DD (por ejemplo 08-25).";
  const mes = Number(m[1]);
  const dia = Number(m[2]);
  if (mes < 1 || mes > 12) return "El mes tiene que estar entre 01 y 12.";
  if (dia < 1 || dia > DIAS_POR_MES[mes - 1]) return "Ese día no existe en ese mes.";
  return null;
};

/** Fecha de ingreso: opcional, pero no puede ser futura. */
export const validarFechaIngreso = (valor, hoyISO) => {
  const v = String(valor || "").trim();
  if (!v) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return "Fecha inválida.";
  const hoy = hoyISO || new Date().toISOString().slice(0, 10);
  if (v > hoy) return "La fecha de ingreso no puede ser futura.";
  return null;
};

/**
 * Valida el formulario entero. Devuelve un objeto {campo: mensaje} — vacío si todo
 * está bien.
 */
export const validarFormularioUsuario = (datos, { existentes = [], hoyISO } = {}) => {
  const errores = {};
  const agregar = (campo, error) => { if (error) errores[campo] = error; };

  agregar("name", validarNombre(datos.name));
  agregar("user", validarUsername(datos.user, { existentes }));
  agregar("puesto", validarPuesto(datos.puesto));
  agregar("telefono", validarTelefono(datos.telefono));
  agregar("email", validarEmail(datos.email));
  agregar("fechaCumpleanos", validarCumpleanos(datos.fechaCumpleanos));
  agregar("fechaIngreso", validarFechaIngreso(datos.fechaIngreso, hoyISO));

  return errores;
};
