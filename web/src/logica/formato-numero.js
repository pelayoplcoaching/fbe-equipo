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
