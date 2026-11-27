// (vista 260-268, v0.275) Datos que se entienden solos: las piezas que se ven en Progreso, en la sesión y en «Tus
// entrenamientos». Las cuentas, en logica/datos-vista.js. Va en los trozos de esas pantallas (no al abrir la app).
import { useLayoutEffect, useRef } from 'preact/hooks';
import { Icono, useApp, useCarga } from '../comunes.jsx';
import { num, NOMBRE_GRUPO } from '../../logica/calculos.js';
import { pesoTxt, difVista, etiquetaPeso } from '../../logica/unidades.js';
import { fmtCorta } from '../../logica/fechas.js';
import { sinMovimiento } from '../transiciones.js';
import { ejerciciosDeGrupo, textoHuella, tendenciaLinea, compararSemanas } from '../../logica/datos-vista.js';

// ---------- (263) la huella de una sesión: una fila de puntos por ejercicio, uno por serie ----------
// filas: [{ nombre?, puntos: [{ t, rec }], mas }]. Con nombres (el resumen), cada fila dice su ejercicio; sin ellos («Tus
// entrenamientos»), es un dibujo que acompaña a las cifras de la fila (que ya lo dicen)
export function Huella({ filas, nombres = false }) {
  if (!filas?.length) return null;
  if (!nombres) {
    return (
      <span class="hue-raiz hue-mini" aria-hidden="true">
        {filas.map((f, i) => <span class="hue-fila" key={i}>{f.puntos.map((p, k) => <i key={k} class={`hue-p hue-${p.t}${p.rec ? ' hue-rec' : ''}`} />)}</span>)}
      </span>
    );
  }
  return (
    <div class="hue-raiz hue-con-nombres">
      <ul class="hue-lista" aria-label={`Tu sesión, serie a serie: ${textoHuella(filas)}`}>
        {filas.map((f, i) => {
          const rec = f.puntos.filter((p) => p.rec).length, fuertes = f.puntos.filter((p) => p.t === 'fuerte').length, n = f.puntos.length + f.mas;
          return (
            <li class="hue-fila" key={i}>
              <span class="hue-nombre">{f.nombre}</span>
              <span class="hue-puntos" aria-hidden="true">{f.puntos.map((p, k) => <i key={k} class={`hue-p hue-${p.t}${p.rec ? ' hue-rec' : ''}`} />)}{f.mas > 0 && <span class="hue-mas num">+{f.mas}</span>}</span>
              <span class="sr">{n} {n === 1 ? 'serie' : 'series'}{fuertes ? `, ${fuertes} muy exigente${fuertes === 1 ? '' : 's'}` : ''}{rec ? `, ${rec} ${rec === 1 ? 'récord' : 'récords'}` : ''}</span>
            </li>
          );
        })}
      </ul>
      <p class="hue-leyenda mini terciario" aria-hidden="true">
        <span><i class="hue-p hue-suave" />Suave</span><span><i class="hue-p hue-medio" />Medio</span><span><i class="hue-p hue-fuerte" />Muy exigente</span><span><i class="hue-p hue-rec" />Récord</span>
      </p>
    </div>
  );
}

// ---------- (264) tu línea, en la tarjeta del ejercicio: tus últimas seis veces ----------
// puntos: [{ fecha, valor }] (1RM estimado, en kg; se enseña en la unidad de la app)
export function LineaUltimas({ puntos }) {
  if (!puntos?.length || puntos.length < 3) return null;
  const W = 76, H = 26, pad = 3.5;
  const vs = puntos.map((p) => p.valor), lo = Math.min(...vs), hi = Math.max(...vs);
  const X = (i) => pad + (i * (W - 2 * pad)) / (puntos.length - 1);
  const Y = (v) => (hi === lo ? H / 2 : pad + (1 - (v - lo) / (hi - lo)) * (H - 2 * pad));
  const d = puntos.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(p.valor).toFixed(1)}`).join('');
  const t = tendenciaLinea(puntos);
  const ult = puntos[puntos.length - 1];
  const dif = difVista(Math.abs(t.dif));
  const resumen = t.sentido === 'sube' ? `+${num(dif, 1)} ${etiquetaPeso()}` : t.sentido === 'baja' ? `−${num(dif, 1)} ${etiquetaPeso()}` : 'Estable';
  return (
    <div class={`lul-raiz lul-${t.sentido}`}>
      <svg class="lul-svg" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img"
        aria-label={`Tus últimas ${puntos.length} veces, del ${fmtCorta(puntos[0].fecha)} al ${fmtCorta(ult.fecha)}: de ${pesoTxt(puntos[0].valor, 1)} a ${pesoTxt(ult.valor, 1)} de 1RM estimado`}>
        <path class="lul-linea" d={d} />
        {puntos.map((p, i) => <circle key={p.fecha} class={`lul-p${i === puntos.length - 1 ? ' lul-ult' : ''}`} cx={X(i).toFixed(1)} cy={Y(p.valor).toFixed(1)} r={i === puntos.length - 1 ? 2.8 : 1.7} />)}
      </svg>
      <span class="lul-t"><strong class="num">{resumen}</strong> en tus {puntos.length} últimas</span>
    </div>
  );
}

// ---------- (260 y 268) lo que sumó un músculo esa semana ----------
// g: el músculo; lunes: el de esa semana; total: sus series (las de la gráfica); cuando: «esta semana» o «la semana
// pasada»; alCerrar: quitarlo
export function DetalleMusculo({ g, lunes, total, cuando, atletaId, alCerrar }) {
  const { api } = useApp();
  const r = useCarga(() => api.historial(atletaId).then((ss) => ejerciciosDeGrupo(ss, lunes, g)).catch(() => []), [atletaId, lunes, g]);
  const caja = useRef(null);
  // (aparece desde donde se tocó: el músculo o su barra; sin movimiento, tal cual)
  useLayoutEffect(() => {
    const el = caja.current;
    if (!el?.animate || sinMovimiento()) return;
    try { el.animate([{ transform: 'translateY(-6px) scale(.98)', clipPath: 'inset(0 0 100% 0 round 14px)' }, { transform: 'none', clipPath: 'inset(0 0 0 0 round 14px)' }], { duration: 260, easing: 'cubic-bezier(.2, .8, .2, 1)' }); } catch { /* */ }
  }, [g]);
  const lista = r.datos || [];
  return (
    <div class="dmu-raiz" ref={caja} role="region" aria-label={`${NOMBRE_GRUPO[g] || g}: los ejercicios de ${cuando}`}>
      <div class="dmu-cab">
        <span class="pila-xs"><strong>{NOMBRE_GRUPO[g] || g}</strong><span class="peq secundario num">{num(total)} {total === 1 ? 'serie' : 'series'} {cuando}</span></span>
        <button type="button" class="btn btn-icono plano dmu-x" onClick={alCerrar} aria-label="Cerrar"><Icono n="cerrar" /></button>
      </div>
      {r.cargando && !r.datos ? <span class="dmu-carga" aria-hidden="true" />
        : !lista.length ? <p class="peq secundario">Esa semana no hay series de {(NOMBRE_GRUPO[g] || g).toLocaleLowerCase('es')}.</p> : (
          <ul class="dmu-lista">
            {lista.map((x) => (
              <li key={x.id || x.nombre} class="dmu-fila">
                <span class="dmu-nombre">{x.nombre}</span>
                <span class="dmu-v num">{x.principal ? `${x.series} ${x.series === 1 ? 'serie' : 'series'}` : `${x.series} × ½ = ${num(x.cuenta)}`}</span>
              </li>
            ))}
          </ul>
        )}
      {lista.some((x) => !x.principal) && <p class="mini terciario">Las series de un ejercicio en el que {(NOMBRE_GRUPO[g] || g).toLocaleLowerCase('es')} ayuda (sin ser el principal) cuentan media.</p>}
    </div>
  );
}

// ---------- (267) dos semanas, lado a lado ----------
export function DosSemanas({ a, b, rango, alCerrar }) {
  const c = compararSemanas(a, b);
  if (!c) return null;
  const v = (f, x) => (f.dec ? num(x, f.dec) : String(x));
  return (
    <div class="csm-raiz" role="region" aria-label="Dos semanas, lado a lado">
      <div class="csm-cab">
        <span class="csm-sem"><span class="mini terciario">Antes</span><strong>{rango(c.antes)}</strong></span>
        <span class="csm-sem"><span class="mini terciario">Después</span><strong>{rango(c.despues)}</strong></span>
        <button type="button" class="btn btn-icono plano csm-x" onClick={alCerrar} aria-label="Dejar de comparar"><Icono n="cerrar" /></button>
      </div>
      <table class="csm-tabla">
        <caption class="sr">De la semana {rango(c.antes)} a la {rango(c.despues)}</caption>
        <tbody>
          {c.filas.map((f) => (
            <tr key={f.id} class={f.dif > 0 ? 'csm-sube' : f.dif < 0 ? 'csm-baja' : 'csm-igual'}>
              <th scope="row">{f.nombre}</th>
              <td class="num">{v(f, f.a)}</td>
              <td class="num">{v(f, f.b)}</td>
              <td class="csm-dif num">{f.dif > 0 ? `+${v(f, f.dif)}` : f.dif < 0 ? `−${v(f, Math.abs(f.dif))}` : '='}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------- (265) superar a la última: lo dice la cabecera de la sesión, una vez ----------
export function AvisoSupera({ s }) {
  const caja = useRef(null);
  useLayoutEffect(() => {
    const el = caja.current;
    if (!el?.animate || sinMovimiento()) return;
    try {
      el.animate([{ transform: 'translate(-50%, -8px) scale(.94)' }, { transform: 'translate(-50%, 0) scale(1)' }], { duration: 320, easing: 'cubic-bezier(.2, 1.3, .4, 1)' });
      el.querySelector('.sup-luz')?.animate([{ transform: 'translateX(-120%)' }, { transform: 'translateX(220%)' }], { duration: 900, delay: 160, easing: 'ease-out' });
    } catch { /* */ }
  }, []);
  const texto = s.por === 'ton' ? `Ya has movido más que la última vez: ${num(Math.round(s.hoy / 100) / 10, 1)} t frente a ${num(Math.round(s.antes / 100) / 10, 1)}` : `Ya llevas más repeticiones que la última vez: ${s.hoy} frente a ${s.antes}`;
  return <p class="sup-aviso" role="status" ref={caja}><span class="sup-luz" aria-hidden="true" /><Icono n="arriba" />{texto}</p>;
}
