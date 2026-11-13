// (apuntes, tanda B) Practicar en los apuntes: emparejar contrarreloj, ordenar los pasos, verdadero o falso rápido, las
// microlecciones (tu 1RM, RIR ↔ RPE) y «Grábate y compáralo» (tu vídeo al lado del de la técnica; no sale del móvil).
// La lógica, en logica/apuntes-practica.js. Cada ejercicio avisa al acabar con alAcabar({ bien, resumen }).
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Icono, Hoja } from '../comunes.jsx';
import { barajar, notaEmparejar, ordenBueno, cuentas1rm, filaRirpe, RIR_RPE } from '../../logica/apuntes-practica.js';
import { VideoYoutube } from '../YouTube.jsx';
import { vibrar } from '../hapticos.js';

export const PRACTICA = ['emparejar', 'ordenar', 'vf'];
export const MICRO = ['calc1rm', 'rirpe'];

export function Practica({ a, alAcabar, quieto = false }) {
  if (a.tipo === 'emparejar') return <Emparejar a={a} alAcabar={alAcabar} quieto={quieto} />;
  if (a.tipo === 'ordenar') return <Ordenar a={a} alAcabar={alAcabar} />;
  if (a.tipo === 'vf') return <VerdaderoFalso a={a} alAcabar={alAcabar} quieto={quieto} />;
  if (a.tipo === 'calc1rm') return <Calc1rm a={a} />;
  if (a.tipo === 'rirpe') return <Rirpe a={a} />;
  return null;
}

// Una cuenta atrás que se ve (barra) y se para al acabar
function useCuenta(segundos, parado) {
  const [t, setT] = useState(0);
  const inicio = useRef(Date.now());
  useEffect(() => {
    if (parado) return undefined;
    const id = setInterval(() => setT((Date.now() - inicio.current) / 1000), 250);
    return () => clearInterval(id);
  }, [parado]);
  return { pasado: t, queda: Math.max(0, segundos - t), fuera: t >= segundos, reiniciar: () => { inicio.current = Date.now(); setT(0); } };
}

function Emparejar({ a, alAcabar, quieto }) {
  const defs = useMemo(() => barajar(a.pares.map((_, i) => i), a.pares.length * 7 + a.pares[0].termino.length), [a.id]);
  const [elegido, setElegido] = useState(null);      // el término tocado
  const [hechos, setHechos] = useState([]);
  const [mal, setMal] = useState(null);              // la definición que no casaba (se agita un momento)
  const fallos = useRef(0);
  const acabado = hechos.length === a.pares.length;
  const c = useCuenta(a.segundos, acabado);
  const tocarDef = (i) => {
    if (elegido == null || hechos.includes(i)) return;
    if (i === elegido) {
      const h = [...hechos, i]; setHechos(h); setElegido(null); vibrar('elegir');
      if (h.length === a.pares.length) {
        const n = notaEmparejar(a.pares, fallos.current, c.pasado, a.segundos);
        vibrar(n.bien ? 'hecho' : 'aviso');
        alAcabar({ bien: n.bien, resumen: n.fallos === 0 ? `Todas a la primera, en ${n.segundos} s${n.aTiempo ? '' : ' (fuera de tiempo)'}` : `${n.fallos === 1 ? 'Un fallo' : `${n.fallos} fallos`}, en ${n.segundos} s` });
      }
    } else { fallos.current += 1; setMal(i); vibrar('aviso'); setTimeout(() => setMal(null), quieto ? 0 : 420); }
  };
  return (
    <div class="practica emparejar">
      <div class={`practica-tiempo${c.fuera && !acabado ? ' fuera' : ''}`} role="timer" aria-label={`Quedan ${Math.ceil(c.queda)} segundos`}>
        <span style={{ transform: `scaleX(${acabado ? 1 - Math.min(1, c.pasado / a.segundos) : c.queda / a.segundos})` }} /><b class="num">{acabado ? `${Math.round(c.pasado)} s` : c.fuera ? 'Tiempo' : `${Math.ceil(c.queda)} s`}</b>
      </div>
      <div class="emparejar-columnas">
        <div class="emparejar-col" role="group" aria-label="Palabras">
          {a.pares.map((p, i) => (
            <button type="button" key={p.termino} class={`btn emparejar-termino${elegido === i ? ' elegido' : ''}${hechos.includes(i) ? ' hecho' : ''}`} disabled={hechos.includes(i)} aria-pressed={elegido === i ? 'true' : 'false'} onClick={() => setElegido(i)}>{p.termino}</button>
          ))}
        </div>
        <div class="emparejar-col" role="group" aria-label="Lo que significan">
          {defs.map((i) => (
            <button type="button" key={i} class={`btn emparejar-def${hechos.includes(i) ? ' hecho' : ''}${mal === i ? ' mal' : ''}`} disabled={hechos.includes(i) || elegido == null} onClick={() => tocarDef(i)}>{a.pares[i].definicion}</button>
          ))}
        </div>
      </div>
      {!acabado && <p class="practica-ayuda">{elegido == null ? 'Toca una palabra y luego lo que significa.' : `«${a.pares[elegido].termino}»: ¿cuál es?`}</p>}
    </div>
  );
}

function Ordenar({ a, alAcabar }) {
  const [orden, setOrden] = useState([]);
  const acabado = orden.length === a.pasos.length;
  const bien = acabado && ordenBueno(orden);
  const tocar = (i) => {
    if (orden.includes(i) || acabado) return;
    const o = [...orden, i]; setOrden(o); vibrar('elegir');
    if (o.length === a.pasos.length) { const b = ordenBueno(o); vibrar(b ? 'hecho' : 'aviso'); alAcabar({ bien: b, resumen: b ? 'En orden: así se hace.' : 'Casi: este es el orden bueno.' }); }
  };
  return (
    <div class="practica ordenar">
      {!acabado && (
        <ol class="ordenar-elegidos" aria-label="Tu orden">
          {a.pasos.map((_, k) => <li key={k} class={orden[k] != null ? 'lleno' : ''}>{orden[k] != null ? a.pasos[orden[k]] : <span class="terciario">Paso {k + 1}</span>}</li>)}
        </ol>
      )}
      {!acabado && (
        <div class="ordenar-opciones" role="group" aria-label="Pasos sin colocar">
          {a.mezcla.filter((i) => !orden.includes(i)).map((i) => <button type="button" key={i} class="btn ordenar-paso" onClick={() => tocar(i)}>{a.pasos[i]}</button>)}
        </div>
      )}
      {!acabado && orden.length > 0 && <button type="button" class="btn-texto" onClick={() => setOrden(orden.slice(0, -1))}><Icono n="deshacer" />Deshacer el último</button>}
      {acabado && (
        <ol class="ordenar-resultado" role="status">
          {a.pasos.map((p, k) => <li key={k} class={orden[k] === k ? 'bien' : 'mal'}><span>{p}</span>{orden[k] === k ? <Icono n="hecho" /> : <span class="peq">(lo pusiste {orden.indexOf(k) + 1}.º)</span>}</li>)}
        </ol>
      )}
      {acabado && <p class="practica-veredicto" data-bien={bien ? 'si' : 'no'}>{bien ? 'En orden: así se hace.' : 'Casi: este es el orden bueno.'}</p>}
    </div>
  );
}

function VerdaderoFalso({ a, alAcabar, quieto }) {
  const [i, setI] = useState(0);
  const [respuestas, setRespuestas] = useState([]);
  const [ultima, setUltima] = useState(null);       // la respuesta de la frase que se acaba de contestar (un momento)
  const acabado = respuestas.length === a.frases.length;
  const c = useCuenta(a.segundos, acabado || ultima != null);
  const contestar = (dijo) => {
    if (acabado || ultima != null) return;
    const f = a.frases[i], bien = dijo === f.verdadero;
    vibrar(bien ? 'elegir' : 'aviso');
    setUltima(bien);
    const r = [...respuestas, { dijo, bien }];
    setTimeout(() => {
      setRespuestas(r); setUltima(null);
      if (r.length === a.frases.length) {
        const n = r.filter((x) => x.bien).length;
        vibrar(n === r.length ? 'hecho' : 'elegir');
        alAcabar({ bien: n === r.length, resumen: `${n} de ${r.length}` });
      } else { setI(i + 1); c.reiniciar(); }
    }, quieto ? 60 : 650);
  };
  useEffect(() => { if (c.fuera && !acabado && ultima == null) contestar(null); }, [c.fuera]);
  if (acabado) {
    const n = respuestas.filter((x) => x.bien).length;
    return (
      <div class="practica vf" role="status">
        <p class="vf-nota"><b class="num">{n} de {respuestas.length}</b> {n === respuestas.length ? '¡Todas!' : n >= respuestas.length - 1 ? 'Muy bien.' : 'Las falladas, aquí:'}</p>
        {respuestas.some((x) => !x.bien) && (
          <ul class="vf-falladas">
            {a.frases.map((f, k) => !respuestas[k].bien && <li key={k}><strong>{f.verdadero ? 'Verdadero' : 'Falso'}:</strong> {f.frase}. <span class="secundario">{f.porque}</span></li>)}
          </ul>
        )}
      </div>
    );
  }
  const f = a.frases[i];
  return (
    <div class="practica vf">
      <div class="practica-tiempo corto" role="timer" aria-label={`Quedan ${Math.ceil(c.queda)} segundos`}><span style={{ transform: `scaleX(${c.queda / a.segundos})` }} /><b class="num">{i + 1}/{a.frases.length}</b></div>
      <p class={`vf-frase${ultima === true ? ' bien' : ultima === false ? ' mal' : ''}`} aria-live="polite">{f.frase}</p>
      <div class="vf-botones">
        <button type="button" class="btn vf-no" onClick={() => contestar(false)} disabled={ultima != null}>Falso</button>
        <button type="button" class="btn vf-si" onClick={() => contestar(true)} disabled={ultima != null}>Verdadero</button>
      </div>
    </div>
  );
}

function Calc1rm({ a }) {
  const [kg, setKg] = useState(a.kg), [reps, setReps] = useState(a.reps), [rir, setRir] = useState(a.rir);
  const r = cuentas1rm({ kg, reps, rir });
  const n = (v) => String(Math.round(v * 10) / 10).replace('.', ',');
  return (
    <div class="practica micro">
      <label class="micro-fila"><span>Peso <b class="num">{n(kg)} kg</b></span><input type="range" min="10" max="250" step="2.5" value={kg} aria-label="Peso de la serie" onInput={(e) => setKg(Number(e.currentTarget.value))} /></label>
      <label class="micro-fila"><span>Repeticiones <b class="num">{reps}</b></span><input type="range" min="1" max="12" step="1" value={reps} aria-label="Repeticiones" onInput={(e) => setReps(Number(e.currentTarget.value))} /></label>
      <label class="micro-fila"><span>Te quedaban <b class="num">{rir}</b></span><input type="range" min="0" max="4" step="1" value={rir} aria-label="Repeticiones que te quedaban" onInput={(e) => setRir(Number(e.currentTarget.value))} /></label>
      {r && <p class="micro-resultado" role="status">Tu 1RM, más o menos: <b class="num">{n(r.uno)} kg</b></p>}
      {r && (
        <div class="micro-tabla" aria-label="Con ese 1RM, dejando dos en recámara">
          {r.tabla.map((x) => <span key={x.reps}><b class="num">{x.reps}</b> rep. <span class="num">{n(x.kg)} kg</span></span>)}
        </div>
      )}
      <p class="practica-ayuda">Con ese 1RM, lo de abajo es lo que moverías dejando dos en recámara. Es una estimación: no hace falta probar tu máximo.</p>
    </div>
  );
}

function Rirpe({ a }) {
  const [rir, setRir] = useState(a.rir);
  const [r, rpe, como] = filaRirpe(rir);
  return (
    <div class="practica micro">
      <label class="micro-fila"><span>Te quedaban <b class="num">{r === 4 ? '4 o más' : r}</b></span><input type="range" min="0" max="4" step="1" value={rir} aria-label="Repeticiones que te quedaban" onInput={(e) => setRir(Number(e.currentTarget.value))} /></label>
      <p class="micro-resultado" role="status">RIR {r === 4 ? '4+' : r} = <b class="num">RPE {r === 4 ? '6 o menos' : rpe}</b></p>
      <div class="micro-escala" aria-hidden="true">{RIR_RPE.map(([x]) => <i key={x} class={x === r ? 'esta' : ''} />)}</div>
      <p class="practica-ayuda">{como}</p>
    </div>
  );
}

// --- Grábate y compáralo: tu vídeo (del móvil, no se sube) al lado del de la técnica, con la clave encima ---
export function GrabarYComparar({ video = null, nombre = '', clave = '', alCerrar }) {
  const [mio, setMio] = useState(null);
  const [lento, setLento] = useState(false);
  const yo = useRef(null);
  useEffect(() => () => { if (mio) URL.revokeObjectURL(mio); }, [mio]);
  useEffect(() => { if (yo.current) yo.current.playbackRate = lento ? 0.5 : 1; }, [lento, mio]);
  const elegir = (ev) => { const f = ev.currentTarget.files?.[0]; if (!f) return; if (mio) URL.revokeObjectURL(mio); setMio(URL.createObjectURL(f)); };
  return (
    <Hoja titulo="Grábate y compáralo" alCerrar={alCerrar} ancho>
        <div class="comparar">
          {clave && <p class="comparar-clave"><Icono n="diana" />{clave}</p>}
          <div class={`comparar-videos${mio ? ' con-mio' : ''}`}>
            <figure class="comparar-tuyo">
              {mio
                ? <video ref={yo} src={mio} controls playsInline loop muted aria-label="Tu vídeo" />
                : <label class="comparar-grabar btn btn-primario"><Icono n="camara" />Grabar mi serie<input type="file" accept="video/*" capture="environment" onChange={elegir} /></label>}
              <figcaption>Tú{mio && <button type="button" class="btn-texto" aria-pressed={lento ? 'true' : 'false'} onClick={() => setLento(!lento)}>{lento ? 'A cámara lenta' : 'Velocidad normal'}</button>}</figcaption>
            </figure>
            {video && (
              <figure class="comparar-tecnica">
                <VideoYoutube url={video} titulo={`Técnica: ${nombre}`} compacto />
                <figcaption>Así se hace</figcaption>
              </figure>
            )}
          </div>
          {mio && <label class="btn-texto comparar-otro"><Icono n="camara" />Grabar otra<input type="file" accept="video/*" capture="environment" onChange={elegir} /></label>}
          <p class="mini secundario">Tu vídeo se queda en este móvil: no se guarda ni se envía. Si quieres que lo vea tu coach, mándaselo desde la serie.</p>
        </div>
    </Hoja>
  );
}
