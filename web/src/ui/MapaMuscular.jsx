import { num, NOMBRE_GRUPO, GRUPOS } from '../logica/calculos.js';

// Mapa muscular: una figura de frente y otra de espalda con cada grupo coloreado según sus series
// (el principal de cada ejercicio cuenta 1 y los secundarios, media). Dibujo propio y esquemático.

const NIVELES = [[0, 'Sin series'], [1, '1 a 4'], [2, '5 a 9'], [3, '10 a 14'], [4, '15 o más']];
export const nivelSeries = (n) => (!(n > 0) ? 0 : n < 5 ? 1 : n < 10 ? 2 : n < 15 ? 3 : 4);

// Mitad izquierda de cada figura (la derecha es su reflejo)
const NEUTRO_COMUN = [
  'M45 24 L55 24 L56 31 L44 31 Z',                                   // cuello
  'M20 72 Q16 84 17 94 L22.5 94 Q26 84 27 73 Z',                       // antebrazo
  'M15.5 98 a3.6 4.6 0 1 0 7.2 0 a3.6 4.6 0 1 0 -7.2 0',               // mano
  'M37 154 a5 4 0 1 0 10 0 a5 4 0 1 0 -10 0',                          // rodilla
  'M36 192 a5.2 3 0 1 0 10.4 0 a5.2 3 0 1 0 -10.4 0',                  // pie
];
const TRONCO = 'M36 32 L64 32 Q72 40 68 60 Q64 78 62 92 Q64 100 62 106 L38 106 Q36 100 38 92 Q36 78 32 60 Q28 40 36 32 Z';
const DELTOIDES = 'M21 39 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0';
const BRAZO = 'M24 50 Q19 60 20 70 Q23 73.5 27 71.5 Q30 61 30.5 51 Q27 48 24 50 Z';

const DELANTE = {
  neutro: [...NEUTRO_COMUN, 'M37.5 158 Q37 172 39 188 L45 188 Q47 172 46.5 158 Z'],
  musculos: [
    ['deltoides', DELTOIDES],
    ['pectoral', 'M49.2 34 L37 34 Q32 37 32 45 Q36 53 49.2 52 Z'],
    ['biceps', BRAZO],
    ['cuadriceps', 'M38 107 Q34 126 37 149 Q42 152 47.5 149 Q50 128 49.2 107 Z'],
  ],
  centro: [['abdominales', 'M41.5 54 h17 v34 a5 5 0 0 1 -5 5 h-7 a5 5 0 0 1 -5 -5 Z']],
};
const DETRAS = {
  neutro: [...NEUTRO_COMUN, 'M38.5 178 L46 178 L45 188 L39.5 188 Z'],
  musculos: [
    ['deltoides', DELTOIDES],
    ['triceps', BRAZO],
    ['gluteo', 'M38.5 94 Q36 104 40 110.5 Q46 113.5 49.6 108.5 L49.6 94 Z'],
    ['isquiotibiales', 'M38 113 Q35 131 38 149 Q42 152 47.5 149 Q49.5 131 49.2 113.5 Z'],
    ['gemelo', 'M37.5 158 Q35 168 38 177.5 Q42 180.5 46 177 Q48 167 46.5 158 Z'],
  ],
  centro: [['espalda', 'M50 31 L38 33 Q31 38 33 52 Q36 70 44 82 L50 87 L56 82 Q64 70 67 52 Q69 38 62 33 Z']],
};

function Figura({ partes, series }) {
  const musc = (g, d, k) => (
    <path key={k} class={`musculo m${nivelSeries(series[g])}`} d={d}>
      <title>{NOMBRE_GRUPO[g]}: {num(series[g] || 0)} series</title>
    </path>
  );
  const mitad = (
    <>
      {partes.neutro.map((d, i) => <path key={`n${i}`} class="neutro" d={d} />)}
      {partes.musculos.map(([g, d], i) => musc(g, d, `m${i}`))}
    </>
  );
  return (
    <>
      <circle class="neutro" cx="50" cy="14.5" r="9.5" />
      <path class="neutro" d={TRONCO} />
      <g>{mitad}</g>
      <g transform="translate(100 0) scale(-1 1)">{mitad}</g>
      {partes.centro.map(([g, d], i) => musc(g, d, `c${i}`))}
    </>
  );
}

export function MapaMuscular({ series = {}, etiqueta = 'Series por músculo', leyenda = true }) {
  const texto = GRUPOS.filter(([g]) => series[g]).map(([g, n]) => `${n} ${num(series[g])}`).join(', ');
  return (
    <figure class="mapa-muscular">
      <svg viewBox="0 0 220 212" role="img" aria-label={`${etiqueta}: ${texto || 'ninguna'}`}>
        <g><Figura partes={DELANTE} series={series} /></g>
        <g transform="translate(120 0)"><Figura partes={DETRAS} series={series} /></g>
        <text x="50" y="209" text-anchor="middle">Delante</text>
        <text x="170" y="209" text-anchor="middle">Detrás</text>
      </svg>
      {leyenda && (
        <figcaption class="leyenda-mapa" aria-hidden="true">
          {NIVELES.map(([n, t]) => <span key={n}><i class={`m${n}`} />{t}</span>)}
        </figcaption>
      )}
    </figure>
  );
}
