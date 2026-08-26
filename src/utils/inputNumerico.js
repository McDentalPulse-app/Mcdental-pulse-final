// El input nativo type="number" acepta "e"/"E"/"+" para notación científica (5e3 = 5000):
// se ve como si "dejara poner letras" y produce cantidades absurdas por accidente. Los campos
// de cantidad de inventario nunca necesitan notación científica, así que se bloquea en el
// keydown — el resto de las teclas (dígitos, ".", "-", navegación) sigue igual.
export const bloquearNotacionCientifica = (e) => {
  if (e.key === "e" || e.key === "E" || e.key === "+") e.preventDefault();
};
