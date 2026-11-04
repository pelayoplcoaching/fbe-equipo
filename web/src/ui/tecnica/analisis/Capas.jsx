// Lo que el análisis pinta encima del vídeo (v0.58), en el rectángulo de la imagen: el círculo del disco al marcarlo, la
// trayectoria de la barra (cian al bajar, amarillo al subir), la vertical desde donde empieza (para ver si se va adelante
// o atrás), el punto de dónde está la barra ahora (al ritmo del vídeo) y el esqueleto con sus ángulos.
import { useEffect, useState } from 'preact/hooks';
import { posicionEn, poseEn, angulosDe, PUNTOS_POSE, HUESOS, VISIBLE_MIN } from '../../../logica/analisis.js';

// El momento del vídeo, al ritmo de la imagen mientras se reproduce (timeupdate va a saltos de un cuarto de segundo)
function useAhora(video, t) {
  const [x, setX] = useState(t);
  useEffect(() => { setX(t); }, [t]);
  useEffect(() => {
    if (!video) return undefined;
    let id = 0;
    const f = () => { setX(video.currentTime); if (!video.paused && !video.ended) id = requestAnimationFrame(f); };
    const al = () => { cancelAnimationFrame(id); id = requestAnimationFrame(f); };
    video.addEventListener('play', al); video.addEventListener('seeked', al);
    if (!video.paused) al();
    return () => { cancelAnimationFrame(id); video.removeEventListener('play', al); video.removeEventListener('seeked', al); };
  }, [video]);
  return x;
}

export function CapaAnalisis({ rect, caja, t, video, estado }) {
  const ahora = useAhora(video, t);
  if (!estado || !rect?.w) return null;
  const X = (x) => rect.x + x * rect.w, Y = (y) => rect.y + y * rect.h;
  const { circulo, barra, pose, toques } = estado;
  const pos = barra?.puntos?.length ? posicionEn(barra.puntos, ahora) : null;
  const foto = pose?.fotos?.length ? poseEn(pose.fotos, ahora) : null;
  const vw = caja.vw || rect.w;
  return (
    <svg class="capa-analisis" viewBox={`0 0 ${caja.w} ${caja.h}`} width="100%" height="100%">
      {barra?.puntos?.length > 1 && (
        <g class="capa-barra">
          <line class="capa-vertical" x1={X(barra.x0)} y1={rect.y} x2={X(barra.x0)} y2={rect.y + rect.h} />
          {(barra.fases || []).map((f, i) => <polyline key={i} class={`capa-tramo fase-${f.fase}`} points={f.p.map((p) => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(' ')} />)}
          {pos && <circle class="capa-punto" cx={X(pos[0])} cy={Y(pos[1])} r="6" />}
        </g>
      )}
      {circulo && (
        <g class="capa-circulo">
          <circle cx={X(circulo.c[0])} cy={Y(circulo.c[1])} r={Math.max(3, (circulo.r * rect.w) / vw)} />
          <line x1={X(circulo.c[0]) - 6} y1={Y(circulo.c[1])} x2={X(circulo.c[0]) + 6} y2={Y(circulo.c[1])} />
          <line x1={X(circulo.c[0])} y1={Y(circulo.c[1]) - 6} x2={X(circulo.c[0])} y2={Y(circulo.c[1]) + 6} />
        </g>
      )}
      {toques?.length > 0 && (
        <g class="capa-toques">
          {toques.length === 2 && <line x1={X(toques[0][0])} y1={Y(toques[0][1])} x2={X(toques[1][0])} y2={Y(toques[1][1])} />}
          {toques.map((p, i) => <circle key={i} cx={X(p[0])} cy={Y(p[1])} r="5" />)}
        </g>
      )}
      {foto && <Esqueleto kp={foto.kp} lado={pose.lado} X={X} Y={Y} rect={rect} />}
    </svg>
  );
}

// El esqueleto del lado elegido (el otro, más tenue) y los ángulos junto a sus articulaciones
function Esqueleto({ kp, lado, X, Y, rect }) {
  const pt = (n, l) => { const q = kp[PUNTOS_POSE[n][l === 'der' ? 1 : 0]]; return q && (q[2] ?? 1) >= VISIBLE_MIN ? [X(q[0]), Y(q[1])] : null; };
  const otro = lado === 'der' ? 'izq' : 'der';
  const huesos = (l, clase) => HUESOS.map(([a, b], i) => { const p = pt(a, l), q = pt(b, l); return p && q ? <line key={`${clase}${i}`} class={clase} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} /> : null; });
  const g = angulosDe(kp, lado, rect.w, rect.h);
  const etiqueta = (n, valor, dx = 10, dy = -8, antes = '') => { const p = pt(n, lado); return p && valor != null ? <text key={n} x={p[0] + dx} y={p[1] + dy} class="num">{antes}{Math.round(valor)}°</text> : null; };
  return (
    <g class="capa-pose">
      {huesos(otro, 'hueso otro')}
      {huesos(lado, 'hueso')}
      {Object.keys(PUNTOS_POSE).map((n) => { const p = pt(n, lado); return p ? <circle key={n} cx={p[0]} cy={p[1]} r="4" /> : null; })}
      {etiqueta('rodilla', g.rodilla)}
      {etiqueta('cadera', g.cadera, 10, 16)}
      {etiqueta('codo', g.codo)}
      {etiqueta('hombro', g.tronco, 10, -12, 'tronco ')}
    </g>
  );
}
