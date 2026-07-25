/**
 * Calibración del cotejo facial.
 *
 * EL ERROR QUE ESTE MÓDULO NO COMETE, Y QUE ES EL FÁCIL DE COMETER:
 *
 * La idea obvia es pintar las dos distribuciones —los scores que pasaron y los que no— ver el
 * hueco entre ellas y poner el umbral en medio. Es la idea obvia y es CIRCULAR.
 *
 * Los scores que pasan se guardan en `asistencias.match_score` y los que no, en
 * `cotejo_intentos.score`. Es decir: FUE EL UMBRAL QUIEN DECIDIÓ EN QUÉ TABLA CAE CADA NÚMERO.
 * Todos los de arriba están por encima de 0.50 y todos los de abajo, por debajo — no porque la
 * realidad los separe ahí, sino porque ahí está el corte. El "hueco" que se vería en el gráfico
 * es el propio umbral mirándose al espejo, y el "umbral óptimo" que saliera de ahí no sería una
 * medición: sería el número que ya teníamos, devuelto con un aire de autoridad que no se ha
 * ganado. Exactamente el tipo de error que nos costó el 0.363.
 *
 * Los datos están CENSURADOS. Y una vez asumido eso, lo que se puede medir de verdad es esto:
 *
 *   1. EL MARGEN DE CADA EMPLEADO (lo más importante). El score mínimo con el que ha pasado.
 *      Quien pasa raspando está a un día de mala luz de quedarse plantado en la puerta sin poder
 *      fichar. A ese hay que rehacerle las fotos ANTES, no cuando ya está atascado en la entrada.
 *
 *   2. LO MÁS CERCA QUE ESTUVO UN RECHAZO. El techo de los rechazos es 0.50 por construcción,
 *      sí — pero si el máximo observado es 0.37, el techo no está apretando y hay aire. Si empieza
 *      a subir hacia 0.49, alguien se está acercando peligrosamente a colarse. Eso el censurado
 *      no lo esconde.
 *
 *   3. CUÁNTO COSTARÍA SUBIR EL UMBRAL. Se sabe con exactitud: son las checadas reales que ya
 *      pasaron y que con el nuevo umbral habrían sido rechazadas. Subir es medible.
 *
 *   4. BAJARLO NO SE PUEDE MEDIR. Debajo de 0.50 estamos ciegos: ahí conviven las personas de
 *      verdad que fallaron por mala luz y los impostores, y desde la base no hay forma de saber
 *      quién estaba delante de la cámara. Bajar el umbral es una apuesta a ciegas, y este módulo
 *      lo dice en vez de disimularlo con un gráfico bonito.
 *
 * Todo es puro: entra data, sale data. Sin React y sin Supabase.
 */

/**
 * El umbral que aplica el servidor. DUPLICADO A PROPÓSITO de `api/_rostro.js`
 * (UMBRAL_MISMA_PERSONA) porque el navegador no puede importar de api/ — pero un test lo lee
 * del archivo real y falla si los dos números dejan de coincidir. Que esta pantalla dibuje una
 * raya donde el servidor no la tiene sería la peor forma posible de mentir: una que parece
 * medición.
 */
export const UMBRAL_ACTUAL = 0.5;

/** Por encima de esto, dos caras distintas son lo bastante parecidas como para preocupar. */
export const UMBRAL_PARECIDO = 0.4;

/** Un margen por debajo de esto es una persona a punto de no poder fichar. */
export const MARGEN_JUSTO = 0.1;

/**
 * El margen de cada empleado: con cuánto ha pasado, y sobre todo con cuán poco.
 *
 * ESTA ES LA CIFRA QUE IMPORTA. No el promedio —el promedio siempre sale bien y no avisa de
 * nada— sino el MÍNIMO: el peor día de cada quien. Alguien cuyo mínimo es 0.52 ha estado a 0.02
 * de no poder entrar a trabajar, y no se ha enterado ni él ni nadie.
 */
export const margenPorEmpleado = (checadas = []) => {
  const porEmpleado = new Map();

  for (const c of checadas) {
    if (c.match_score == null) continue; // checada sin cotejo (alta manual de RH, o antes del cotejo)
    const id = c.empleado_id;
    const actual = porEmpleado.get(id) ?? { empleadoId: id, minimo: Infinity, suma: 0, n: 0 };
    actual.minimo = Math.min(actual.minimo, c.match_score);
    actual.suma += c.match_score;
    actual.n += 1;
    porEmpleado.set(id, actual);
  }

  return [...porEmpleado.values()]
    .map(({ empleadoId, minimo, suma, n }) => ({
      empleadoId,
      minimo,
      media: suma / n,
      n,
      margen: minimo - UMBRAL_ACTUAL,
      // "Justo" = le sobran menos de 0.10 sobre el umbral. Es quien se va a quedar fuera el día
      // que haya contraluz, y a quien hay que rehacerle las fotos antes de que eso pase.
      justo: minimo - UMBRAL_ACTUAL < MARGEN_JUSTO,
    }))
    .sort((a, b) => a.minimo - b.minimo); // el que peor lo tiene, primero
};

/**
 * Lo más cerca que estuvo un rechazo de colarse.
 *
 * El techo de esta nube es el umbral (nada por encima entra aquí), pero eso no la inutiliza: si
 * el máximo observado está MUY por debajo del techo, el techo no aprieta y hay aire de sobra.
 * Si se acerca, alguien se está acercando.
 */
export const masCercaDeColarse = (intentos = []) => {
  const conScore = intentos.filter((i) => i.score != null);
  if (conScore.length === 0) return null;

  const peor = conScore.reduce((a, b) => (b.score > a.score ? b : a));
  return {
    score: peor.score,
    empleadoId: peor.empleado_id,
    cuando: peor.creado_en,
    // Cuánto le faltó para pasar. Si esto se hace pequeño, el umbral se está quedando corto.
    distancia: UMBRAL_ACTUAL - peor.score,
  };
};

/**
 * Cuánto costaría subir el umbral a `nuevo`: las checadas REALES que habrían sido rechazadas.
 *
 * Esto sí es una medición, no una suposición: son personas de verdad que ya ficharon y que con
 * el umbral nuevo se habrían quedado fuera. Subir el umbral es gratis en seguridad y caro en
 * gente que no puede trabajar — y aquí se ve exactamente cuánta.
 */
export const costeDeSubir = (checadas = [], nuevo = UMBRAL_ACTUAL) => {
  const conScore = checadas.filter((c) => c.match_score != null);
  const caidas = conScore.filter((c) => c.match_score < nuevo);
  const afectados = new Set(caidas.map((c) => c.empleado_id));

  return {
    umbral: nuevo,
    checadasRechazadas: caidas.length,
    empleadosAfectados: afectados.size,
    ids: [...afectados],
    porcentaje: conScore.length ? (caidas.length / conScore.length) * 100 : 0,
  };
};

/**
 * La curva del coste: qué pasaría con cada umbral candidato, de 0.50 a 0.90.
 *
 * No devuelve un "umbral óptimo" porque NO SE PUEDE CALCULAR con datos censurados: haría falta
 * saber cuántos impostores pasaron, y eso la base no lo sabe. Devuelve el precio de cada opción
 * y deja la decisión donde tiene que estar — en una persona que sepa cuánta fricción aguanta la
 * clínica.
 */
export const curvaDeCoste = (checadas = [], desde = UMBRAL_ACTUAL, hasta = 0.9, paso = 0.05) => {
  const puntos = [];
  // Se acumula sobre enteros y se divide al final: 0.5 + 0.05 + 0.05 en coma flotante da
  // 0.6000000000000001, y las etiquetas del gráfico saldrían con doce decimales.
  const pasos = Math.round((hasta - desde) / paso);
  for (let i = 0; i <= pasos; i += 1) {
    const umbral = Math.round((desde + i * paso) * 100) / 100;
    puntos.push(costeDeSubir(checadas, umbral));
  }
  return puntos;
};

/**
 * Intentos fallidos por empleado.
 *
 * Un pico aquí tiene DOS lecturas opuestas y hay que mirar las dos, porque confundirlas es
 * castigar a la víctima:
 *   - alguien está intentando suplantarle (y el sistema lo está parando: funciona), o
 *   - su cara de referencia es mala y el sistema le está rechazando a ÉL una y otra vez.
 *
 * Se distinguen mirando si además tiene checadas que pasaron: si nunca pasa, el problema es la
 * referencia, no un impostor.
 */
export const intentosPorEmpleado = (intentos = []) => {
  const porEmpleado = new Map();

  for (const i of intentos) {
    const actual = porEmpleado.get(i.empleado_id) ?? { empleadoId: i.empleado_id, n: 0, maximo: 0 };
    actual.n += 1;
    if (i.score != null && i.score > actual.maximo) actual.maximo = i.score;
    porEmpleado.set(i.empleado_id, actual);
  }

  return [...porEmpleado.values()].sort((a, b) => b.n - a.n);
};

/** Histograma simple, para dibujar la nube. */
export const histograma = (valores = [], { desde = 0, hasta = 1, cubos = 20 } = {}) => {
  const ancho = (hasta - desde) / cubos;
  const barras = Array.from({ length: cubos }, (_, i) => ({
    desde: desde + i * ancho,
    hasta: desde + (i + 1) * ancho,
    n: 0,
  }));

  for (const v of valores) {
    if (v == null || v < desde || v > hasta) continue;
    // El último cubo incluye su borde derecho: si no, el valor 1.0 exacto no cae en ninguno.
    const i = Math.min(Math.floor((v - desde) / ancho), cubos - 1);
    barras[i].n += 1;
  }

  return barras;
};

/**
 * Los rostros que se parecen demasiado a los de otro.
 *
 * El caso difícil nunca fue el desconocido —da 0.04-0.17, ni se acerca— sino el parecido: un
 * hermano, un primo. En las pruebas reales dos personas parecidas llegaron a 0.37, a solo 0.13
 * del umbral. Estos son los pares que el cotejo podría llegar a confundir.
 */
export const parecidosPeligrosos = (rostros = [], umbral = UMBRAL_PARECIDO) =>
  rostros
    .filter((r) => r.parecido_maximo != null && r.parecido_maximo >= umbral)
    .sort((a, b) => b.parecido_maximo - a.parecido_maximo);
