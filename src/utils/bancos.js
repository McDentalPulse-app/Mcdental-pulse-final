/**
 * Datos bancarios para el depósito de nómina (migración 163).
 *
 * Funciones puras: ni React ni Supabase, para que se puedan probar solas.
 *
 * Los dos números que se capturan traen DÍGITO VERIFICADOR, y por eso se validan aquí en
 * vez de solo mirar la longitud: el error que de verdad ocurre al teclear 18 dígitos no es
 * poner 17, es equivocarse en uno o transponer dos ("...4321..." por "...4312..."), y la
 * longitud no ve ninguno de los dos.
 *
 * CUÁNTO ALCANZA, MEDIDO Y NO SUPUESTO (ver bancos.test.js, que lo comprueba):
 *   - un dígito cambiado: lo caza SIEMPRE (162 de 162 sobre una CLABE real).
 *   - transposición de dos dígitos contiguos: 12 de 13. Escapan los pares cuyos productos
 *     coinciden módulo 10 al intercambiarse (en esa CLABE, el par "83").
 * O sea que es una red muy buena, no una garantía. Por eso la pantalla enseña además la
 * leyenda de responsabilidad: ningún dígito verificador distingue una cuenta ajena bien
 * tecleada de la propia.
 */

// Lo que se guarda en la base son SOLO dígitos (ver el comentario de la migración 163): la
// misma cuenta tecleada con espacios y sin ellos tiene que quedar idéntica en la columna.
export const soloDigitos = (valor) => String(valor ?? "").replace(/\D/g, "");

export const LARGO_CLABE = 18;
export const LARGO_TARJETA = 16;

/**
 * Dígito verificador de una CLABE: se recorren los 17 primeros dígitos con los pesos 3, 7, 1
 * repetidos, se toma cada producto módulo 10, se suman, y el verificador es lo que falta
 * para el siguiente múltiplo de 10.
 *
 * DOS `% 10` QUE NO SON LO MISMO, y conviene no confundirlos:
 *
 *   · El de cada producto (`(digito * peso) % 10`) está porque así lo escribe la
 *     especificación de Banxico. Es fiel a la norma pero NO cambia el resultado: por
 *     aritmética modular, Σ(xᵢ mod 10) mod 10 ≡ Σxᵢ mod 10. Medido para no afirmarlo a
 *     ciegas — 0 divergencias en 200.000 prefijos aleatorios. Se conserva por fidelidad a
 *     la norma, no porque haga falta. Una versión anterior de este comentario decía que
 *     «sin ese paso el resultado diverge»: era falso.
 *   · El de FUERA (`(10 - resto) % 10`) SÍ carga peso y borrarlo rompe de verdad: cuando el
 *     resto es 0, `10 - 0` da 10, que no es un dígito. Ese caso es ~1 de cada 10 CLABEs y
 *     lo cubre un fixture propio en bancos.test.js.
 */
const PESOS_CLABE = [3, 7, 1];

export const digitoVerificadorClabe = (primeros17) => {
  let suma = 0;
  for (let i = 0; i < 17; i += 1) {
    suma += ((Number(primeros17[i]) * PESOS_CLABE[i % 3]) % 10);
  }
  return (10 - (suma % 10)) % 10;
};

export const validarClabe = (valor) => {
  const d = soloDigitos(valor);
  if (d.length !== LARGO_CLABE) {
    return { ok: false, motivo: `La CLABE debe tener ${LARGO_CLABE} dígitos (llevas ${d.length}).` };
  }
  if (digitoVerificadorClabe(d) !== Number(d[17])) {
    return { ok: false, motivo: "La CLABE no es válida. Revísala: suele ser un dígito cambiado de lugar." };
  }
  return { ok: true };
};

/**
 * Luhn: desde la derecha, se duplica un dígito sí y otro no; si el doble pasa de 9 se le
 * restan 9. La suma total tiene que ser múltiplo de 10.
 */
export const pasaLuhn = (digitos) => {
  let suma = 0;
  let duplicar = false;
  for (let i = digitos.length - 1; i >= 0; i -= 1) {
    let n = Number(digitos[i]);
    if (duplicar) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    suma += n;
    duplicar = !duplicar;
  }
  return suma % 10 === 0;
};

export const validarTarjeta = (valor) => {
  const d = soloDigitos(valor);
  if (d.length !== LARGO_TARJETA) {
    return { ok: false, motivo: `La tarjeta debe tener ${LARGO_TARJETA} dígitos (llevas ${d.length}).` };
  }
  if (!pasaLuhn(d)) {
    return { ok: false, motivo: "El número de tarjeta no es válido. Revisa que esté completo y bien tecleado." };
  }
  return { ok: true };
};

// Formato de lectura. La CLABE se agrupa 3-3-11-1 porque ESO SIGNIFICA algo —banco, plaza,
// cuenta y dígito de control— y es como la imprimen los estados de cuenta, así que el
// empleado puede compararla de un vistazo con su papel.
export const formatClabe = (valor) => {
  const d = soloDigitos(valor);
  if (d.length !== LARGO_CLABE) return d;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 17)} ${d.slice(17)}`;
};

export const formatTarjeta = (valor) => {
  const d = soloDigitos(valor);
  if (d.length !== LARGO_TARJETA) return d;
  return d.replace(/(\d{4})(?=\d)/g, "$1 ");
};

export const tieneDatosBancarios = (u) => !!(u?.banco || u?.clabe || u?.tarjeta);

/**
 * Catálogo cerrado en vez de texto libre: con un campo abierto la misma institución acaba
 * escrita «BBVA», «Bancomer», «bbva bancomer» y «BVA» en la misma columna, y entonces RH no
 * puede ni agrupar ni confiar en lo que lee.
 *
 * No se valida contra esta lista en la base (ver el CHECK de la migración 163): los bancos
 * se fusionan y aparecen nuevos, y un CHECK con nombres obligaría a una migración cada vez.
 */
export const BANCOS = [
  "BBVA",
  "Citibanamex",
  "Santander",
  "Banorte",
  "HSBC",
  "Scotiabank",
  "Inbursa",
  "Banco Azteca",
  "BanCoppel",
  "Afirme",
  "Banregio",
  "BanBajío",
  "Banca Mifel",
  "Multiva",
  "Actinver",
  "Invex",
  "Banco Compartamos",
  "Banco del Bienestar",
  "Hey Banco",
  "Nu México",
  "Klar",
  "Spin by OXXO",
  "STP",
  "Otro",
];

export const LEYENDA_RESPONSABILIDAD =
  "Es responsabilidad de cada colaborador mantener sus datos bancarios actualizados. " +
  "Un depósito enviado a una cuenta equivocada por información desactualizada no puede recuperarse.";
