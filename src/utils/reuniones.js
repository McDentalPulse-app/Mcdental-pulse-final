/**
 * Cuándo una reunión está «en curso» y qué debe mostrar el icono de la cabecera.
 *
 * POR QUÉ ESTE MÓDULO EXISTE. La regla vivía dentro de `Reuniones.jsx`. Desde que el icono de
 * la cabecera también la necesita, tenerla escrita dos veces sería garantizar que algún día el
 * icono pulse cuando el botón «Entrar» ya no está — o al revés, que alguien vea el icono
 * apagado con la reunión abierta y no entre. Las dos pantallas leen de aquí.
 *
 * LA REGLA NO USA `fin`, Y NO ES UN OLVIDO: viene tal cual de `Reuniones.jsx` y no se cambió al
 * moverla. La columna es opcional y en producción NINGUNA reunión la tiene rellena, así que una
 * ventana anclada solo en el inicio es la que funciona con los datos que hay de verdad. Si
 * algún día `fin` se vuelve obligatorio, este es el único sitio donde hay que tenerlo en cuenta.
 */

// Margen para entrar antes de la hora, y cuánto sigue siendo "de ahora" después. Una reunión
// a la que solo se puede entrar al segundo exacto es una reunión a la que se llega tarde.
export const ANTES_MIN = 15;
export const DESPUES_MIN = 120;

const inicioMs = (reunion) => {
  const t = new Date(reunion?.inicio ?? NaN).getTime();
  return Number.isFinite(t) ? t : null;
};

/**
 * Una cancelada no cuenta para nada de esto.
 *
 * `terminada` (el tercer valor que permite el CHECK de la tabla) NO se filtra, a propósito:
 * hoy nada la escribe, y la lista de reuniones tampoco la filtra. Si algún día algo la usa,
 * este es el sitio donde añadirla — y al estar aquí, el icono y la lista cambian juntos.
 */
const cuenta = (reunion) => Boolean(reunion) && reunion.estado !== "cancelada";

/** ¿Se puede entrar ahora mismo? Es la misma condición que habilita el botón «Entrar». */
export const enCurso = (reunion, ahora = Date.now()) => {
  if (!cuenta(reunion)) return false;
  const inicio = inicioMs(reunion);
  if (inicio == null) return false;
  const minutos = (ahora - inicio) / 60000;
  return minutos >= -ANTES_MIN && minutos <= DESPUES_MIN;
};

/**
 * ¿Empieza hoy y todavía no ha llegado su hora?
 *
 * «Hoy» es el día natural de quien mira, no de ninguna sucursal: lo que se le indica a la
 * persona es «hoy tienes una», y su idea de hoy es la de su propio teléfono. (Ojo si algún día
 * hay reuniones con gente de Hermosillo, que va una hora por detrás: a las 23:30 de allá puede
 * ser ya mañana en el centro.)
 */
export const esHoyMasTarde = (reunion, ahora = Date.now()) => {
  if (!cuenta(reunion)) return false;
  const inicio = inicioMs(reunion);
  if (inicio == null || inicio <= ahora) return false;
  const hoy = new Date(ahora);
  const dia = new Date(inicio);
  return (
    hoy.getFullYear() === dia.getFullYear() &&
    hoy.getMonth() === dia.getMonth() &&
    hoy.getDate() === dia.getDate()
  );
};

/**
 * Qué debe mostrar el icono: `"en_curso"`, `"hoy"` o `null` (apagado).
 *
 * `en_curso` GANA sobre `hoy`. Si hay una sala abierta ahora mismo, es lo único que importa;
 * avisar de la de las siete de la tarde mientras la de ahora está esperando es ruido.
 */
export const estadoParaElIcono = (reuniones, ahora = Date.now()) => {
  const lista = Array.isArray(reuniones) ? reuniones : [];
  if (lista.some((r) => enCurso(r, ahora))) return "en_curso";
  if (lista.some((r) => esHoyMasTarde(r, ahora))) return "hoy";
  return null;
};
