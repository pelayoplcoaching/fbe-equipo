// (v0.213, rendimiento) Number#toLocaleString con opciones crea un formateador en cada llamada (unos 17 µs en un ordenador
// y cuatro o cinco veces más en un móvil; en las tablas del coach, cientos por pantalla). Aquí se guardan, uno por cada
// combinación de opciones, y dan exactamente lo mismo.
const formateadores = new Map();
export function fmtNum(x, min = 0, max = 1, agrupar = undefined) {
  const k = `${min}|${max}|${agrupar === undefined ? '' : agrupar}`;
  let f = formateadores.get(k);
  if (!f) {
    f = new Intl.NumberFormat('es-ES', agrupar === undefined ? { minimumFractionDigits: min, maximumFractionDigits: max } : { minimumFractionDigits: min, maximumFractionDigits: max, useGrouping: agrupar });
    formateadores.set(k, f);
  }
  return f.format(x);
}

// (v0.214) Una cifra y su unidad, en la misma línea: «41 %», «9 kg», «3 semanas»… con un espacio que no parte (en las
// tarjetas estrechas, «41» quedaba al final de una línea y «%» al principio de la siguiente). Solo para lo que se pinta.
const UNIDADES = /(\d) (%|kg|lb|km|m|min|h|s|kcal|g|cm|mm|rep|reps|series|semanas?|días?|sesiones?|veces)(?=$|[\s.,;:!?)…])/g;
export const unirUnidades = (texto) => (typeof texto === 'string' ? texto.replace(UNIDADES, '$1 $2') : texto);
