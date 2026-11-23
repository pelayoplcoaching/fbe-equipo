// El dibujo de líneas de cada sesión (logica/arte.js: solo geometría; los colores, del tema). (v0.208) En su propio archivo:
// Hoy lo enseña en la tarjeta del día y, antes, para eso cargaba entera la portada de la sesión (Portada.jsx) al abrir.
import { arteSesion } from '../../logica/arte.js';

export function ArteSesion({ nombre, tipo, patron, clase = 'portada-arte' }) {
  const a = arteSesion({ nombre, tipo, patron }, 400, 300);
  return (
    <svg class={clase} viewBox={`0 0 ${a.ancho} ${a.alto}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false" fill="none" stroke-linecap="round">
      {a.formas.map((f, i) => {
        const comun = { key: i, class: f.tono, 'stroke-width': f.grosor, opacity: f.opacidad };
        if (f.t === 'circulo') return <circle {...comun} cx={f.cx} cy={f.cy} r={f.r} />;
        if (f.t === 'elipse') return <ellipse {...comun} cx={f.cx} cy={f.cy} rx={f.rx} ry={f.ry} transform={`rotate(${f.giro} ${f.cx} ${f.cy})`} />;
        if (f.t === 'linea') return <line {...comun} x1={f.x1} y1={f.y1} x2={f.x2} y2={f.y2} />;
        if (f.t === 'trazo') return <path {...comun} d={f.d} />;
        return <circle key={i} class={`relleno-punto ${f.tono}`} cx={f.cx} cy={f.cy} r={f.r} opacity={f.opacidad} />;
      })}
    </svg>
  );
}
