// v0.114: piezas del perfil que salen en el tuyo y en el del equipo (como en Strava o Instagram):
//   · PortadaPerfil: la banda de arriba con un dibujo de líneas propio que sale del nombre (siempre el mismo para la
//     misma persona; logica/arte.js), con los colores del tema;
//   · FotoConAnillo: la foto con un aro alrededor que se va cerrando con la racha (hacia el siguiente hito de 4, 8, 12,
//     26 o 52 semanas) y la llama con las semanas; sin racha, el aro apagado.
// Sin datos nuevos: el nombre y la racha que ya se ven.
import { Avatar, Icono } from './comunes.jsx';
import { arteSesion, semilla } from '../logica/arte.js';
import { anilloRacha } from '../logica/perfil.js';

const TIPOS = ['fuerza', 'movilidad', 'cardio'];
export function PortadaPerfil({ texto = '', clase = '' }) {
  const tipo = TIPOS[semilla(`perfil|${texto}`) % TIPOS.length];
  const a = arteSesion({ nombre: `perfil|${texto}`, tipo, patron: 'pierna' }, 400, 140);
  return (
    <div class={`perfil-portada ${clase}`} aria-hidden="true">
      <svg viewBox={`0 0 ${a.ancho} ${a.alto}`} preserveAspectRatio="xMidYMid slice" focusable="false" fill="none" stroke-linecap="round">
        {a.formas.map((f, i) => {
          const comun = { key: i, class: f.tono, 'stroke-width': f.grosor, opacity: f.opacidad };
          if (f.t === 'circulo') return <circle {...comun} cx={f.cx} cy={f.cy} r={f.r} />;
          if (f.t === 'elipse') return <ellipse {...comun} cx={f.cx} cy={f.cy} rx={f.rx} ry={f.ry} transform={`rotate(${f.giro} ${f.cx} ${f.cy})`} />;
          if (f.t === 'linea') return <line {...comun} x1={f.x1} y1={f.y1} x2={f.x2} y2={f.y2} />;
          if (f.t === 'trazo') return <path {...comun} d={f.d} />;
          return <circle key={i} class={`relleno-punto ${f.tono}`} cx={f.cx} cy={f.cy} r={f.r} opacity={f.opacidad} />;
        })}
      </svg>
    </div>
  );
}

export function FotoConAnillo({ nombre, foto = null, racha = 0, clase = 'enorme', ampliable = false, perfilId = undefined, lleno = false }) {
  const a = anilloRacha(racha);
  const r = 47, c = 2 * Math.PI * r;
  return (
    <span class={`foto-anillo tono-${a.tono}`} data-racha={a.racha}>
      <svg class="foto-anillo-aro" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <circle class="aro-fondo" cx="50" cy="50" r={r} />
        {a.racha > 0 && <circle class="aro-lleno" cx="50" cy="50" r={r} stroke-dasharray={`${(c * Math.max(0.04, a.fraccion)).toFixed(1)} ${c.toFixed(1)}`} transform="rotate(-90 50 50)" />}
      </svg>
      <Avatar nombre={nombre} foto={foto} clase={clase} lleno={lleno} ampliable={ampliable} perfilId={perfilId} />
      {a.racha > 0 && (
        <span class="foto-anillo-llama" title={`Racha de ${a.racha} ${a.racha === 1 ? 'semana' : 'semanas'}`}>
          <Icono n="llama" /><span class="num">{a.racha}</span><span class="sr"> {a.racha === 1 ? 'semana' : 'semanas'} de racha</span>
        </span>
      )}
    </span>
  );
}
