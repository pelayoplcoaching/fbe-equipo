// Ilustraciones de la v0.50: dibujos de línea propios, en el estilo del lobo de FBE (su silueta, solo el trazo), para
// los estados vacíos y la tarjeta de Hoy. Se pintan con los colores del tema (clases ilu-*, en estilos.css): en
// claro, oscuro y negro puro, y con cualquier acento. Son decorativas (aria-hidden): lo que dicen va en el texto.
import { LOBO_CAJA, LOBO_D } from './lobo-trazo.js';

// El lobo en línea: su trazado, sin relleno, con el grosor de los iconos aunque se pinte pequeño
function Lobo({ x, y, w, clase = 'ilu-acento' }) {
  const [, , cw, ch] = LOBO_CAJA.split(' ').map(Number);
  return (
    <svg x={x} y={y} width={w} height={(w * ch) / cw} viewBox={LOBO_CAJA} overflow="visible">
      <path class={clase} d={LOBO_D} fill-rule="evenodd" vector-effect="non-scaling-stroke" />
    </svg>
  );
}

// El suelo: una línea con dos trazos cortos, como en un cuaderno
const Suelo = ({ y = 100, x1 = 14, x2 = 146 }) => (
  <g class="ilu-tenue"><path d={`M${x1} ${y}H${x2}`} /><path d={`M${x1 + 8} ${y + 6}h18M${x2 - 40} ${y + 6}h26`} /></g>
);

const DIBUJOS = {
  // Sin mensajes: dos bocadillos, uno con el lobo
  mensajes: () => (
    <>
      <path class="ilu-relleno ilu-trazo" d="M30 26h62a8 8 0 0 1 8 8v30a8 8 0 0 1-8 8H58l-14 12v-12H30a8 8 0 0 1-8-8V34a8 8 0 0 1 8-8z" />
      <Lobo x={47} y={30} w={34} />
      <path class="ilu-trazo" d="M108 52h24a6 6 0 0 1 6 6v20a6 6 0 0 1-6 6h-4v9l-11-9h-9a6 6 0 0 1-6-6V58a6 6 0 0 1 6-6z" />
      <path class="ilu-tenue" d="M112 64h16M112 72h10" />
      <Suelo y={102} />
    </>
  ),
  // Diario vacío: la claqueta con su botón de reproducir
  diario: () => (
    <>
      <rect class="ilu-relleno ilu-trazo" x="36" y="38" width="88" height="56" rx="8" />
      <path class="ilu-trazo" d="M36 38l4-14 86 10-2 4M54 26l-4 14M74 28l-4 12M94 31l-4 9M114 33l-3 6" />
      <path class="ilu-acento" d="M72 54v24l20-12z" />
      <circle class="ilu-tenue" cx="132" cy="22" r="3" /><path class="ilu-tenue" d="M22 56h8M18 66h12" />
      <Suelo y={104} />
    </>
  ),
  // Sin récords: la vitrina vacía, un trofeo por ganar (de puntos) y discos esperando
  records: () => (
    <>
      <path class="ilu-trazo" d="M24 88h112M30 88V36M130 88V36M24 36h112" />
      <path class="ilu-acento ilu-discontinuo" d="M66 46h28v12a14 14 0 0 1-28 0zM66 50h-8a8 8 0 0 0 8 10M94 50h8a8 8 0 0 1-8 10M80 72v8M70 84h20" />
      <rect class="ilu-relleno ilu-trazo" x="40" y="62" width="9" height="26" rx="3" /><rect class="ilu-trazo" x="51" y="68" width="7" height="20" rx="3" />
      <rect class="ilu-trazo" x="104" y="68" width="7" height="20" rx="3" /><rect class="ilu-relleno ilu-trazo" x="113" y="62" width="9" height="26" rx="3" />
      <Lobo x={124} y={10} w={20} clase="ilu-tenue" />
      <Suelo y={102} />
    </>
  ),
  // Sin check-ins: la carpeta con sus marcas por hacer
  checkins: () => (
    <>
      <rect class="ilu-relleno ilu-trazo" x="48" y="20" width="64" height="80" rx="8" />
      <path class="ilu-trazo" d="M68 20v-4a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v4z" />
      <path class="ilu-acento" d="M58 42l4 4 8-8" /><path class="ilu-trazo" d="M76 42h24" />
      <rect class="ilu-tenue" x="57" y="56" width="10" height="10" rx="3" /><path class="ilu-tenue" d="M76 61h24" />
      <rect class="ilu-tenue" x="57" y="74" width="10" height="10" rx="3" /><path class="ilu-tenue" d="M76 79h18" />
      <Lobo x={118} y={66} w={24} />
      <Suelo y={106} />
    </>
  ),
  // Sin tareas: una nota con su chincheta y la lista en blanco
  tareas: () => (
    <>
      <path class="ilu-relleno ilu-trazo" d="M42 24h76v62l-14 14H42z" />
      <path class="ilu-trazo" d="M104 100V86h14" />
      <path class="ilu-acento" d="M80 14v10M74 14h12l-2 6h-8z" />
      <path class="ilu-tenue" d="M54 44h52M54 56h44M54 68h30" />
      <Lobo x={14} y={64} w={22} clase="ilu-tenue" />
      <Suelo y={106} />
    </>
  ),
  // Revisar vacío («Todo al día»): la barra en su soporte, con el lobo y un check
  todo: () => (
    <>
      <path class="ilu-trazo" d="M34 22v76M126 22v76M26 98h16M118 98h16" />
      <path class="ilu-trazo" d="M10 46h140" />
      <rect class="ilu-relleno ilu-trazo" x="44" y="28" width="10" height="36" rx="3" /><rect class="ilu-trazo" x="56" y="32" width="8" height="28" rx="3" />
      <rect class="ilu-trazo" x="96" y="32" width="8" height="28" rx="3" /><rect class="ilu-relleno ilu-trazo" x="106" y="28" width="10" height="36" rx="3" />
      <circle class="ilu-relleno ilu-acento" cx="80" cy="76" r="14" /><path class="ilu-acento" d="M73 76l5 5 9-10" />
      <Lobo x={70} y={10} w={20} clase="ilu-tenue" />
      <Suelo y={104} />
    </>
  ),
  // Nadie con este filtro: la lupa sobre dos fichas vacías
  filtro: () => (
    <>
      <rect class="ilu-trazo" x="24" y="30" width="70" height="24" rx="7" /><circle class="ilu-tenue" cx="37" cy="42" r="6" /><path class="ilu-tenue" d="M49 38h34M49 46h22" />
      <rect class="ilu-trazo" x="24" y="62" width="70" height="24" rx="7" /><circle class="ilu-tenue" cx="37" cy="74" r="6" /><path class="ilu-tenue" d="M49 70h28M49 78h18" />
      <circle class="ilu-relleno ilu-acento" cx="110" cy="56" r="20" /><path class="ilu-acento" d="M124 70l14 14" />
      <Lobo x={100} y={44} w={20} />
      <Suelo y={104} />
    </>
  ),
  // Hoy, día de descanso: la luna, las estrellas y el lobo tranquilo
  descanso: () => (
    <>
      <path class="ilu-relleno ilu-acento" d="M118 18a22 22 0 1 0 22 30 18 18 0 1 1-22-30z" />
      <path class="ilu-tenue" d="M34 22v8M30 26h8M56 12v6M53 15h6M92 30v6M89 33h6" />
      <Lobo x={40} y={40} w={52} />
      <Suelo y={104} />
    </>
  ),
  // Hoy, sesión hecha: el lobo con su medalla
  hecha: () => (
    <>
      <path class="ilu-tenue" d="M104 14l8 18M132 14l-8 18" />
      <circle class="ilu-relleno ilu-acento" cx="118" cy="48" r="16" /><path class="ilu-acento" d="M111 48l5 5 9-10" />
      <Lobo x={22} y={28} w={58} />
      <path class="ilu-tenue" d="M96 80l6-6M140 78l-6-5M100 92h8M130 92h8" />
      <Suelo y={104} />
    </>
  ),
  // Hoy, semana completa: siete marcas y el lobo con su corona de laurel
  semana: () => (
    <>
      <path class="ilu-acento" d="M40 58c-6-10-4-24 6-32M120 58c6-10 4-24-6-32M44 46l-8-2M42 36l-8-4M116 46l8-2M118 36l8-4" />
      <Lobo x={56} y={18} w={48} />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => <circle key={i} class="ilu-relleno ilu-acento" cx={32 + i * 16} cy="88" r="5" />)}
      <Suelo y={104} />
    </>
  ),
  // Hoy, sin semana publicada: el calendario en blanco, el reloj y el lobo esperando
  espera: () => (
    <>
      <rect class="ilu-relleno ilu-trazo" x="22" y="26" width="72" height="66" rx="8" />
      <path class="ilu-trazo" d="M22 42h72M40 18v14M76 18v14" />
      <path class="ilu-tenue" d="M34 56h8M50 56h8M66 56h8M34 70h8M50 70h8M66 70h8" />
      <circle class="ilu-acento" cx="112" cy="40" r="14" /><path class="ilu-acento" d="M112 32v8l5 4" />
      <Lobo x={104} y={60} w={34} />
      <Suelo y={104} />
    </>
  ),
  // (diseño, tanda 17) Cinco escenas más, para los estados vacíos que más se ven y solo llevaban un icono
  // Sin datos de progreso: los ejes, la curva que va a subir y el lobo mirándola
  progreso: () => (
    <>
      <path class="ilu-trazo" d="M28 20v68h108" />
      <path class="ilu-tenue ilu-discontinuo" d="M34 70h96M34 52h96M34 34h96" />
      <path class="ilu-acento" d="M34 80c14-2 20-14 32-16s16 6 28-6 18-22 34-26" />
      <circle class="ilu-relleno ilu-acento" cx="128" cy="32" r="4.5" />
      <Lobo x={42} y={22} w={24} clase="ilu-tenue" />
      <Suelo y={102} />
    </>
  ),
  // Sin recetas: el plato con el lobo, el tenedor y el cuchillo
  recetas: () => (
    <>
      <circle class="ilu-relleno ilu-trazo" cx="80" cy="56" r="31" />
      <circle class="ilu-tenue" cx="80" cy="56" r="21" />
      <Lobo x={68} y={42} w={24} />
      <path class="ilu-trazo" d="M32 26v16a6 6 0 0 0 12 0V26M38 26v64" />
      <path class="ilu-trazo" d="M126 26c-8 7-9 24-2 32v32" />
      <Suelo y={104} />
    </>
  ),
  // El muro del equipo, vacío: la manada
  equipo: () => (
    <>
      <Lobo x={18} y={44} w={34} clase="ilu-tenue" />
      <Lobo x={56} y={26} w={48} />
      <Lobo x={108} y={44} w={34} clase="ilu-tenue" />
      <path class="ilu-acento" d="M68 18l-4-7M80 15V6M92 18l4-7" />
      <Suelo y={96} />
    </>
  ),
  // Sin atletas todavía: la lista con sus fichas y el hueco para el primero
  atletas: () => (
    <>
      <rect class="ilu-relleno ilu-trazo" x="30" y="18" width="100" height="24" rx="8" />
      <circle class="ilu-acento" cx="44" cy="30" r="6" /><path class="ilu-trazo" d="M58 30h38" /><path class="ilu-tenue" d="M108 30h12" />
      <rect class="ilu-trazo" x="30" y="48" width="100" height="24" rx="8" />
      <circle class="ilu-tenue" cx="44" cy="60" r="6" /><path class="ilu-tenue" d="M58 60h30M108 60h12" />
      <rect class="ilu-tenue ilu-discontinuo" x="30" y="78" width="100" height="22" rx="8" />
      <path class="ilu-acento" d="M80 83v12M74 89h12" />
    </>
  ),
  // Sin plantillas ni bloques: las hojas apiladas, por escribir
  plantillas: () => (
    <>
      <rect class="ilu-tenue" x="54" y="16" width="62" height="76" rx="8" transform="rotate(7 85 54)" />
      <rect class="ilu-relleno ilu-trazo" x="44" y="20" width="62" height="76" rx="8" />
      <path class="ilu-acento" d="M56 36h26" /><path class="ilu-trazo" d="M56 50h38M56 60h38M56 70h24" />
      <path class="ilu-tenue" d="M56 82h14" />
      <Lobo x={116} y={64} w={24} clase="ilu-tenue" />
      <Suelo y={104} />
    </>
  ),
};

export const ILUSTRACIONES = Object.keys(DIBUJOS);

export function Ilustracion({ n, clase = '' }) {
  const Dibujo = DIBUJOS[n];
  if (!Dibujo) return null;
  return (
    <svg class={`ilustracion ilu-${n} ${clase}`} viewBox="0 0 160 112" aria-hidden="true" focusable="false">
      <Dibujo />
    </svg>
  );
}
