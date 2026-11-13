import { useEffect, useRef, useState } from 'preact/hooks';
import { Hoja, Icono, Paso } from '../comunes.jsx';
import { prepararAudio, vibrarCorto } from './sesion-comun.jsx';
import { sonarFBE } from '../sonido.js';
import { nota, MOTIVO, notaTempo } from '../../logica/sonido.js';
import { hablar } from '../voz.js';
import { leerAjustes } from '../ajustes.js';
import { Imagen } from '../Imagen.jsx';
import { imagenHerramienta } from '../../logica/imagenes.js';
import { explicarTempo, posicionTempo } from '../../logica/tempo.js';

// Metrónomo de tempo: cuenta atrás de 3 s y, en cada repetición, un pitido grave por segundo al bajar,
// un clic suave en las pausas y un pitido agudo al empezar a subir. Para solo al llegar a las repeticiones.
const CUENTA = 3;

export function Metronomo({ tempo, nombre, reps = 8, alCerrar }) {
  const [objetivo, setObjetivo] = useState(reps || 8);
  const [inicio, setInicio] = useState(null);   // performance.now() al pulsar Empezar
  const [ahora, setAhora] = useState(0);
  const ultimo = useRef(null);                    // último «segundo» que sonó, para no repetirlo
  const t = inicio == null ? null : (ahora - inicio) / 1000 - CUENTA;
  const pos = t != null && t >= 0 ? posicionTempo(t, tempo) : null;
  const terminado = pos && pos.rep >= objetivo;

  useEffect(() => {
    if (inicio == null || terminado) return undefined;
    let id;
    const bucle = () => { setAhora(performance.now()); id = requestAnimationFrame(bucle); };
    id = requestAnimationFrame(bucle);
    return () => cancelAnimationFrame(id);
  }, [inicio, terminado]);

  // Sonidos: cuenta atrás y, después, al empezar cada segundo de cada fase
  useEffect(() => {
    if (t == null) return;
    if (t < 0) {
      const s = Math.ceil(-t);
      if (ultimo.current !== `c${s}`) { ultimo.current = `c${s}`; sonarFBE('nota', { f: nota(Math.max(0, 3 - s)), v: 0.6, dura: 0.08 }); }
      return;
    }
    if (terminado) {
      if (ultimo.current !== 'fin') { ultimo.current = 'fin'; MOTIVO.forEach((f, i) => setTimeout(() => sonarFBE('nota', { f, v: 0.8, dura: i === 2 ? 0.3 : 0.1 }), i * 120)); vibrarCorto(120); }
      return;
    }
    const clave = `${pos.rep}-${pos.fase}-${Math.floor(pos.enFase)}`;
    if (ultimo.current === clave) return;
    ultimo.current = clave;
    const f = tempo.fases[pos.fase];
    if (pos.fase === 2 && Math.floor(pos.enFase) > 0) return; // la subida suena solo al empezar
    // (sonido 2, tanda 5) con la familia: cada fase, su nota, con acento al empezarla; (tanda 6) y, con «Contar las
    // repeticiones», la voz dice cuál empieza
    const primero = Math.floor(pos.enFase) === 0, nt = notaTempo(pos.fase, primero);
    sonarFBE('nota', { f: nt.f, v: nt.v, dura: nt.dura });
    if (pos.fase === 0 && primero && leerAjustes().contarReps) hablar(String(pos.rep + 1), { forzar: true });
    if (Math.floor(pos.enFase) === 0) vibrarCorto(f.explosiva ? 60 : 25);
  }, [t != null ? Math.floor((t + 10) * 10) : null]);

  const empezar = () => { prepararAudio(); ultimo.current = null; setInicio(performance.now()); setAhora(performance.now()); };
  const parar = () => setInicio(null);
  const fase = pos ? tempo.fases[pos.fase] : null;
  return (
    <Hoja titulo={`Tempo ${tempo.texto}`} alCerrar={() => { parar(); alCerrar(); }}>
      <div class="metronomo pila">
        <Imagen id={imagenHerramienta('metronomo')} clase="franja-ilu franja-herr" tamanos="(min-width: 640px) 560px, 92vw" />
        <p class="peq secundario">{nombre}: {explicarTempo(tempo).toLowerCase()}.</p>
        <div class={`metro-pantalla ${fase ? `fase-${pos.fase}` : ''}`} aria-live="polite">
          {inicio == null ? <span class="metro-grande">Listo</span>
            : t < 0 ? <span class="metro-grande num">{Math.ceil(-t)}</span>
              : terminado ? <span class="metro-grande">Hecho</span>
                : <><span class="metro-grande">{fase.explosiva ? '¡Sube!' : fase.nombre}</span><span class="metro-seg num">{fase.explosiva ? '' : Math.ceil(pos.quedan)}</span></>}
          <span class="metro-rep num">{pos ? `Repetición ${Math.min(pos.rep + 1, objetivo)} de ${objetivo}` : `${objetivo} repeticiones`}</span>
        </div>
        <div class="metro-fases" aria-hidden="true">
          {tempo.fases.filter((f) => f.s > 0).map((f, i) => {
            const idx = tempo.fases.indexOf(f);
            const lleno = pos && !terminado ? (idx < pos.fase ? 1 : idx === pos.fase ? pos.enFase / f.s : 0) : terminado ? 1 : 0;
            return <span key={i} style={{ flex: `${f.s} 1 0` }} class={`metro-fase f${idx}`}><i style={{ width: `${Math.min(100, lleno * 100)}%` }} /><b>{f.explosiva ? 'X' : f.s}</b></span>;
          })}
        </div>
        {inicio == null || terminado
          ? <button class="btn btn-primario btn-grande" onClick={empezar}><Icono n="play" /> {terminado ? 'Otra serie' : 'Empezar'}</button>
          : <button class="btn btn-grande" onClick={parar}><Icono n="pausa" /> Parar</button>}
        <div class="campo metro-reps"><label for="metro-reps">Repeticiones</label><Paso id="metro-reps" valor={objetivo} paso={1} min={1} max={30} dec={0} etiqueta="repeticiones" alCambiar={(v) => setObjetivo(v || 1)} /></div>
        <p class="mini terciario">Pitido grave cada segundo al bajar, un clic en las pausas y un pitido agudo para subir. Si tienes el sonido apagado en Perfil, solo vibra.</p>
      </div>
    </Hoja>
  );
}
