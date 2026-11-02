// Pictogramas de los patrones de movimiento (v0.50): monigotes de línea propios, uno por patrón (empuje, tirón,
// sentadilla, bisagra, zancada, aislamiento de brazo o de pierna, core, cardio y otro). Son decorativos (aria-hidden):
// el nombre del ejercicio, al lado, es lo que se lee. El patrón sale de logica/diseno.js (patronEjercicio).
import { patronEjercicio } from '../logica/diseno.js';

// Una cabeza (círculo completo en el mismo trazo): centro y radio
const cabeza = (x, y, r = 2.2) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

// 32 × 32, trazo redondo (como los iconos de la app, algo más grueso para que se lean pequeños)
const DIBUJO = {
  // Press de banca: tumbado en el banco, la barra arriba
  empuje_h: `M4 23h20M8 23v4M20 23v4M9 21h11M12 21V12M17 21V12M7 12h15M7 10v4M22 10v4${cabeza(6.2, 20.4)}`,
  // Press militar: de pie, la barra por encima de la cabeza
  empuje_v: `M16 13.5v8M16 21.5l-3.5 6.5M16 21.5l3.5 6.5M16 14.5l-5-7.5M16 14.5l5-7.5M7 6h18M7 4v4M25 4v4${cabeza(16, 10)}`,
  // Remo: inclinado, la barra hacia el abdomen
  tiron_h: `M9.5 12.5l10.5 4.5M20 17l-1.5 10M20 17l4 9.5M12.5 14l1 8.5M8 23.5h12M8 21.5v4M20 21.5v4${cabeza(6.8, 11)}`,
  // Dominada: colgado de la barra
  tiron_v: `M5 5h22M11 5l3.5 7M21 5l-3.5 7M16 14.5v7.5M16 22l-2.5 6.5M16 22l2.5 6.5${cabeza(16, 10.6)}`,
  // Sentadilla: la barra en la espalda, muslos paralelos
  sentadilla: `M8 11.5h14M8 9.5v4M22 9.5v4M14.5 12.5l-2 7M12.5 19.5h8M20.5 19.5l-2 8M18.5 27.5h3.5${cabeza(14.6, 7.6)}`,
  // Peso muerto rumano: cadera atrás, la barra pegada a las piernas
  bisagra: `M9.5 12l10.5 4M20 16l-.5 11.5M19.5 27.5h3.5M12.5 13.2l.5 9.8M8 23h11M8 21v4M19 21v4${cabeza(7, 10.6)}`,
  // Zancada: una pierna delante y otra atrás, con mancuernas
  unilateral: `M16 9.5v8.5M16 18l7 2.5v7M16 18l-6 6l-4 2.5M16 11l-3.5 6.5M16 11l3.5 6.5M11 17.5h3M18 17.5h3${cabeza(16, 6.6)}`,
  // Curl: el brazo flexionado con la mancuerna
  brazo: `M10 9v10M10 19l9-7M17.5 9.2l3 3.6M19 7.5l-3 3M22 11.5l-3 3M6 27h10${cabeza(10, 5.8, 3)}`,
  // Extensión de cuádriceps: sentado en la máquina, la pierna estirada
  pierna: `M7 16h10M9 16v11M15 16v11M10 16l-2.5-8M8.5 10l5 3M17 16l8.5-2.5M5 27h14${cabeza(6.8, 5.4, 2.2)}${cabeza(27.2, 13, 1.7)}`,
  // Plancha: el cuerpo recto sobre los antebrazos
  core: `M8.5 18.5l18 4.5M10 19.5v5.5h5M26.5 23v2M4 27.5h25${cabeza(6.2, 16.4)}`,
  // Cardio: corriendo, con las líneas de la velocidad
  cardio: `M19 9.5l-3.5 8M17.5 12l4.5 3M17.5 12l-5 1M15.5 17.5l5 4-1.5 6M15.5 17.5l-4 5.5-4-1M4 10h5M3 15h4${cabeza(20.4, 6.4)}`,
  // Otro: una pesa rusa
  otro: 'M12 12V9.5a4 4 0 0 1 8 0V12M16 26.5a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM12.5 26.5h7',
};

export function Pictograma({ patron = 'otro', clase = '' }) {
  return (
    <span class={`picto picto-${patron} ${clase}`} aria-hidden="true">
      <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" focusable="false">
        <path d={DIBUJO[patron] || DIBUJO.otro} />
      </svg>
    </span>
  );
}

// El de un ejercicio (con su nombre, sus grupos musculares y su tipo de la biblioteca)
export function PictoEjercicio({ ejercicio, clase = '' }) {
  if (!ejercicio) return null;
  return <Pictograma patron={patronEjercicio(ejercicio.nombre, ejercicio.grupos_musculares, ejercicio.tipo)} clase={clase} />;
}
