// (apuntes bellos) Los dibujos de «Apuntes»: el sello de cada tipo, las medallas, el aro de la nota, el confeti y las
// ilustraciones de las pantallas vacías. Todo SVG hecho a mano (sin imágenes ni descargas) y con los colores del tema,
// así que se ve igual de bien en claro y en oscuro.
import { arteDe, metalDe, aroDeNota, dado } from '../../logica/apuntes-arte.js';

// Los trazos de cada sello (24 × 24, a línea)
const TRAZOS = {
  diana: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4.2" /><circle cx="12" cy="12" r="1" class="lleno" /></>,
  aviso: <><path d="M12 4 21 19.5H3Z" /><path d="M12 10v4.2" /><circle cx="12" cy="16.9" r=".7" class="lleno" /></>,
  mito: <><path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5h-6.5L8 20v-3.5H5A1.5 1.5 0 0 1 3.5 15V7A1.5 1.5 0 0 1 5 5.5Z" /><path d="m9.5 8.8 5 4.4m0-4.4-5 4.4" /></>,
  bombilla: <><path d="M9 17.5h6M9.8 20.5h4.4M12 3.5a6 6 0 0 0-3.6 10.8c.6.5.9 1.2.9 2v.2h5.4v-.2c0-.8.3-1.5.9-2A6 6 0 0 0 12 3.5Z" /><path d="M12 7.5a2.5 2.5 0 0 0-2.5 2.5" /></>,
  libro: <><path d="M12 6.5C10 5 7 4.6 4 5.2v12.6c3-.6 6-.2 8 1.3 2-1.5 5-1.9 8-1.3V5.2c-3-.6-6-.2-8 1.3Z" /><path d="M12 6.5v12.6" /></>,
  casilla: <><rect x="4" y="4" width="16" height="16" rx="3.5" /><path d="m8.2 12.3 2.6 2.6 5-5.4" /></>,
  pregunta: <><path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5h-6.5L8 20v-3.5H5A1.5 1.5 0 0 1 3.5 15V7A1.5 1.5 0 0 1 5 5.5Z" /><path d="M10 9.3a2 2 0 1 1 2.8 1.8c-.5.3-.8.7-.8 1.3" /><circle cx="12" cy="14.4" r=".7" class="lleno" /></>,
  silbato: <><path d="M4 11.5a4.5 4.5 0 1 0 9 0V9h7.5v3.2l-3 .8" /><path d="M8.5 7V4.5" /><circle cx="8.5" cy="11.5" r="1.2" class="lleno" /></>,
  chispa: <><path d="M12 3.5 13.9 10l6.6 2-6.6 2L12 20.5 10.1 14l-6.6-2 6.6-2Z" /><path d="M19 4v3m-1.5-1.5h3" /></>,
  barras: <><path d="M4 20h16" /><rect x="5.5" y="12" width="3" height="6" rx=".8" /><rect x="10.5" y="8" width="3" height="10" rx=".8" /><rect x="15.5" y="4.5" width="3" height="13.5" rx=".8" /></>,
  lapiz: <><path d="m14.5 5.5 4 4L9 19l-4.5.5L5 15Z" /><path d="m12.5 7.5 4 4" /></>,
  pulso: <path d="M3 12.5h4l2-5 3.5 10 2.5-6.5 1.5 1.5H21" />,
  play: <><rect x="3.5" y="5.5" width="17" height="13" rx="3" /><path d="m10.3 9.2 4.6 2.8-4.6 2.8Z" class="lleno" /></>,
  bandera: <><path d="M6 20.5V4" /><path d="M6 4.5h11l-2.5 3.8L17 12H6" /></>,
};
export function Sello({ tipo, clase = '' }) {
  const a = arteDe(tipo);
  return <span class={`apunte-sello tono-${a.tono} ${clase}`} aria-hidden="true"><svg viewBox="0 0 24 24">{TRAZOS[a.sello] || TRAZOS.bombilla}</svg></span>;
}

// Las medallas: un disco con su cinta, el metal de su nivel y, dentro, una estrella (la cuarta, la luna de la manada)
export function Medalla({ nivel = 1, clase = '' }) {
  const metal = metalDe(nivel) || 'bronce';
  return (
    <span class={`apuntes-medalla-dibujo metal-${metal} ${clase}`} aria-hidden="true">
      <svg viewBox="0 0 40 48">
        <path d="M11 2h7l4 13h-7Z" class="cinta-a" /><path d="M29 2h-7l-4 13h7Z" class="cinta-b" />
        <circle cx="20" cy="30" r="15" class="disco" /><circle cx="20" cy="30" r="11.2" class="aro" />
        {nivel >= 4
          ? <path d="M23.5 23.2a7.5 7.5 0 1 0 0 13.6 6 6 0 0 1 0-13.6Z" class="centro" />
          : <path d="m20 22.6 2.2 4.6 5 .6-3.7 3.4 1 5-4.5-2.5-4.5 2.5 1-5-3.7-3.4 5-.6Z" class="centro" />}
      </svg>
      <i class="brillo" />
    </span>
  );
}

// El aro de la nota: se llena hasta los aciertos (el trazo se anima en CSS)
export function AroNota({ aciertos, total }) {
  const a = aroDeNota(aciertos, total), largo = 2 * Math.PI * 52;
  return (
    <svg class={`examen-aro tono-${a.tono}`} viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="60" r="52" class="fondo" />
      <circle cx="60" cy="60" r="52" class="lleno" style={{ strokeDasharray: largo, '--hasta': largo * (1 - a.pct) }} />
    </svg>
  );
}

// Confeti de papel: trozos de cuatro colores que caen una vez (CSS). Siempre los mismos para la misma semilla
export function Confeti({ n = 28, semilla = 1 }) {
  return (
    <span class="apuntes-confeti" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <i key={i} class={`c${i % 4}`} style={{ left: `${(dado(i, semilla) * 100).toFixed(1)}%`, animationDelay: `${(dado(i, semilla + 1) * 0.5).toFixed(2)}s`,
          animationDuration: `${(1.6 + dado(i, semilla + 2) * 1.1).toFixed(2)}s`, '--giro': `${Math.round((dado(i, semilla + 3) - 0.5) * 900)}deg`, '--deriva': `${Math.round((dado(i, semilla + 4) - 0.5) * 80)}px` }} />
      ))}
    </span>
  );
}

// Las pantallas vacías: un cuaderno abierto con su lápiz
export function DibujoCuaderno() {
  return (
    <svg class="apuntes-dibujo" viewBox="0 0 160 110" aria-hidden="true">
      <ellipse cx="80" cy="100" rx="62" ry="6" class="sombra" />
      <path d="M80 26C62 16 38 14 18 18v68c20-4 44-2 62 8Z" class="hoja" /><path d="M80 26c18-10 42-12 62-8v68c-20-4-44-2-62 8Z" class="hoja" />
      <path d="M80 26v68" class="lomo" />
      {[34, 44, 54, 64, 74].map((y) => <path key={y} d={`M28 ${y - 4}c14-2 30-1 42 3M90 ${y - 1}c12-4 28-5 42-3`} class="renglon" />)}
      <path d="m118 14 26 26-6 6-26-26Z" class="lapiz" /><path d="m112 20 6-6-8-2Z" class="punta" />
    </svg>
  );
}
// El diploma del curso: un papel enrollado con su sello
export function DibujoDiploma() {
  return (
    <svg class="apuntes-dibujo diploma" viewBox="0 0 160 110" aria-hidden="true">
      <ellipse cx="80" cy="102" rx="60" ry="5" class="sombra" />
      <rect x="22" y="16" width="116" height="78" rx="6" class="hoja" />
      <path d="M22 22a6 6 0 0 1 6-6h6v78h-6a6 6 0 0 1-6-6Z" class="lomo" /><path d="M138 22a6 6 0 0 0-6-6h-6v78h6a6 6 0 0 0 6-6Z" class="lomo" />
      {[36, 46, 56].map((y) => <path key={y} d={`M48 ${y}h${y === 36 ? 64 : 56}`} class="renglon" />)}
      <circle cx="104" cy="74" r="13" class="sello" /><path d="m98 86-3 12 9-5 9 5-3-12" class="sello" />
      <path d="m104 67 2 4.2 4.6.5-3.4 3.1.9 4.6-4.1-2.3-4.1 2.3.9-4.6-3.4-3.1 4.6-.5Z" class="estrella" />
    </svg>
  );
}
