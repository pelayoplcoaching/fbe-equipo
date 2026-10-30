// Moverse por la programación como en una hoja de cálculo (v0.34): Intro baja a la casilla de debajo (Mayús+Intro,
// a la de arriba), las flechas ↑ ↓ van a la fila de arriba o de abajo en la misma columna y ← → a la casilla de al
// lado cuando el cursor ya está en el borde del número (si no, mueven el cursor dentro de la casilla, como siempre).
// Las casillas llevan data-celda (su columna) y su fila data-fila; se salta de un ejercicio a otro y de una sesión
// a la siguiente. Al llegar, se selecciona el número: lo que se escriba lo sustituye. Salir de la casilla la guarda.

// Columnas que se corresponden al bajar de una pauta de series iguales a una serie a serie (y al revés)
const GRUPO = { reps: 'reps', reps_min: 'reps', reps_max: 'reps', kg: 'kg', rpe: 'rpe', rir: 'rir', series: 'series' };

// filas: [[columna, …], …] (las casillas de cada fila, en orden); desde { fila, col } y una dirección
// ('arriba' | 'abajo' | 'izquierda' | 'derecha') → { fila, col } de destino o null si no hay
export function destinoEnRejilla(filas, { fila, col }, dir) {
  const yo = filas[fila]?.[col];
  if (yo == null) return null;
  if (dir === 'izquierda' || dir === 'derecha') {
    const c = col + (dir === 'derecha' ? 1 : -1);
    return c >= 0 && c < filas[fila].length ? { fila, col: c } : null;
  }
  const paso = dir === 'abajo' ? 1 : -1;
  for (let f = fila + paso; f >= 0 && f < filas.length; f += paso) {
    let c = filas[f].indexOf(yo);
    if (c < 0) c = filas[f].findIndex((x) => GRUPO[x] && GRUPO[x] === GRUPO[yo]);
    if (c >= 0) return { fila: f, col: c };
  }
  return null;
}

function direccion(e, el) {
  if (e.altKey || e.ctrlKey || e.metaKey || e.isComposing) return null;
  if (e.key === 'Enter') return e.shiftKey ? 'arriba' : 'abajo';
  if (e.shiftKey) return null; // Mayús+flecha: seleccionar texto, como siempre
  if (e.key === 'ArrowDown') return 'abajo';
  if (e.key === 'ArrowUp') return 'arriba';
  const largo = el.value.length;
  if (e.key === 'ArrowRight') return el.selectionEnd == null || el.selectionEnd >= largo ? 'derecha' : null;
  if (e.key === 'ArrowLeft') return el.selectionStart == null || el.selectionStart <= 0 ? 'izquierda' : null;
  return null;
}

// onKeyDown en el contenedor de una sesión: abarca todas las sesiones de la semana (su contenedor común)
export function teclaEnRejilla(e) {
  const el = e.target;
  if (!el || el.tagName !== 'INPUT' || !el.dataset?.celda) return;
  const dir = direccion(e, el);
  if (!dir) return;
  const raiz = el.closest('.editor-sesion')?.parentElement || e.currentTarget;
  const celdas = [...raiz.querySelectorAll('input[data-celda]')].filter((x) => !x.disabled && x.getClientRects().length > 0);
  const filas = [], nodos = [], indice = new Map();
  for (const c of celdas) {
    const f = c.closest('[data-fila]') || c;
    if (!indice.has(f)) { indice.set(f, filas.length); filas.push([]); nodos.push([]); }
    const i = indice.get(f);
    filas[i].push(c.dataset.celda); nodos[i].push(c);
  }
  const fila = indice.get(el.closest('[data-fila]') || el);
  if (fila == null) return;
  const d = destinoEnRejilla(filas, { fila, col: nodos[fila].indexOf(el) }, dir);
  if (!d) {
    // Intro en la última casilla: se guarda (como al salir) y se queda ahí
    if (e.key === 'Enter') { e.preventDefault(); el.blur(); el.focus(); el.select?.(); }
    return;
  }
  e.preventDefault();
  const destino = nodos[d.fila][d.col];
  destino.focus(); // al salir, la casilla de antes se guarda (su «change»)
  destino.select?.();
}
