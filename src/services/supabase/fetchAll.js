// PostgREST corta las respuestas en `max-rows` (1000 por defecto en Supabase) y lo hace
// SIN error: un select sin .range() simplemente devuelve las primeras 1000 filas y la app
// calcula promedios, participación y semáforos sobre datos truncados sin enterarse.
//
// fetchAll pagina con .range() hasta agotar la tabla, así que devuelve el dataset completo
// pase lo que pase con ese ajuste del servidor. La semántica es idéntica a la de un
// select("*") pelado — no cambia ningún agregado, solo elimina el truncado silencioso.
//
// Uso:
//   const rows = await fetchAll((query) => query.from("encuestas").select("*"));

const PAGE_SIZE = 1000;

export const fetchAll = async (buildQuery, { pageSize = PAGE_SIZE } = {}) => {
  const filas = [];

  for (let desde = 0; ; desde += pageSize) {
    const { data, error } = await buildQuery().range(desde, desde + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;

    filas.push(...data);
    // Una página incompleta significa que ya no hay más filas.
    if (data.length < pageSize) break;
  }

  return filas;
};
