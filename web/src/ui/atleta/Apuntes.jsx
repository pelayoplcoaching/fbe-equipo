import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Icono, Capa, useApp, useCarga } from '../comunes.jsx';
import { hoyISO } from '../../logica/fechas.js';
import { guiasConTexto, fichaDeEjercicio } from '../../datos/guias.js';
import { apuntesDeFicha, apuntesDeGuias, elegirApunte, apunteDelDia, paraRepasar } from '../../logica/apuntes.js';
import { leerApuntes, guardarVisto } from '../apuntes.js';

// «Apuntes»: algo que aprender en el descanso (o cuando se quiera). Una tarjeta cada vez, de lo que el coach tiene escrito:
// una clave o un error típico del ejercicio del que se descansa, una idea de sus guías o un mito. Las que tienen vuelta
// (error, mito) se destapan y el atleta dice si lo sabía: las que no, vuelven otro día.
//   · En un descanso (`fin`): arriba va la cuenta y, al acabar, se cierra sola: manda el descanso.
//   · modo 'dia': empieza por el apunte del día. modo 'repaso': los que no sabía y los de la semana.
//   · alCerrar(motivo): 'fin' (se acabó el descanso) o 'salir' (la cerró a mano).
const mmss = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;

export function Apuntes(props) { return <Capa><ApuntesDentro {...props} /></Capa>; }
function ApuntesDentro({ atletaId, ejercicio = null, fin = null, pausa = null, modo = 'descanso', alCerrar }) {
  const { backend } = useApp();
  const hoy = hoyISO();
  const guias = useCarga(() => guiasConTexto({ backend }).catch(() => []), [], { recuerdo: 'apuntes-guias' });
  const ficha = useCarga(() => (ejercicio?.id ? fichaDeEjercicio({ backend }, ejercicio.id).catch(() => null) : Promise.resolve(null)), [ejercicio?.id], { recuerdo: ejercicio?.id ? `ficha-fbe:${ejercicio.id}` : null });
  const listo = !guias.cargando && !(ejercicio?.id && ficha.cargando);
  const todos = useMemo(() => [...(ficha.datos?.ficha ? apuntesDeFicha(ficha.datos.ficha, ejercicio?.nombre) : []), ...apuntesDeGuias(guias.datos || [])], [guias.datos, ficha.datos]);
  const [estado, setEstado] = useState(() => leerApuntes(atletaId));
  const [actual, setActual] = useState(null);
  const [vuelta, setVuelta] = useState(false);
  const pasados = useRef([]);        // los de esta tanda, para no repetir
  const cola = useRef(null);         // (repaso) los que quedan

  const siguiente = (est = estado) => {
    let a = null;
    if (modo === 'repaso') {
      cola.current ||= paraRepasar(todos, est, hoy);
      a = cola.current.shift() || null;
    } else if (modo === 'dia' && !pasados.current.length) a = apunteDelDia(todos, hoy);
    a ||= modo === 'repaso' ? null : elegirApunte(todos, est, { hoy, salto: pasados.current.length, excluir: pasados.current });
    if (a) pasados.current.push(a.id);
    setActual(a); setVuelta(false);
    // (los que no tienen vuelta quedan vistos al salir; los que la tienen, al contestar o al pasar de largo)
    if (a && !a.vuelta) setEstado(guardarVisto(atletaId, a.id, hoy));
  };
  useEffect(() => { if (listo && !actual) siguiente(); }, [listo]);
  const responder = (sabia) => { const e = guardarVisto(atletaId, actual.id, hoy, sabia); setEstado(e); siguiente(e); };
  const otro = () => { let e = estado; if (actual?.vuelta) { e = guardarVisto(atletaId, actual.id, hoy); setEstado(e); } siguiente(e); };

  // La cuenta del descanso (si lo hay) y el cierre al acabar
  const [ahora, setAhora] = useState(Date.now());
  const conReloj = Number.isFinite(fin);
  useEffect(() => { if (!conReloj) return undefined; const t = setInterval(() => setAhora(Date.now()), 250); return () => clearInterval(t); }, [conReloj]);
  const quedan = !conReloj ? null : Number.isFinite(pausa) ? pausa / 1000 : (fin - ahora) / 1000;
  const acabado = conReloj && quedan <= 0;
  const cerrar = useRef(alCerrar);
  cerrar.current = alCerrar;
  useEffect(() => { if (!acabado) return undefined; const t = setTimeout(() => cerrar.current?.('fin'), 4000); return () => clearTimeout(t); }, [acabado]);

  const caja = useRef(null);
  useEffect(() => { caja.current?.focus({ preventScroll: true }); }, []);
  const tecla = (ev) => { if (ev.key === 'Escape') { ev.stopPropagation(); alCerrar?.('salir'); } };
  const titulo = modo === 'repaso' ? 'Repaso' : modo === 'dia' ? 'El apunte de hoy' : 'Apuntes';

  return (
    <div ref={caja} class={`apuntes${acabado ? ' acabado' : ''}`} role="dialog" aria-modal="true" aria-label={`${titulo}: algo que aprender${conReloj ? ' en el descanso' : ''}`} tabIndex={-1} onKeyDown={tecla}>
      <header class="apuntes-cab">
        <span class="apuntes-titulo"><Icono n="biblioteca" />{titulo}</span>
        {conReloj && <span class="apuntes-cuenta num" role="timer" aria-live="off" aria-label={acabado ? 'Descanso terminado' : `Descanso: quedan ${Math.ceil(quedan)} segundos`}>{acabado ? '¡Vamos!' : mmss(Math.ceil(quedan))}</span>}
        <button type="button" class="btn btn-icono plano" onClick={() => alCerrar?.('salir')} aria-label="Cerrar los apuntes"><Icono n="cerrar" /></button>
      </header>
      <div class="apuntes-cuerpo">
        {!listo && <div class="apunte" aria-busy="true"><span class="sil" style="width:38%;height:14px" /><span class="sil" style="width:86%;height:26px" /><span class="sil" style="width:100%;height:64px" /></div>}
        {listo && !actual && (
          <div class="apunte vacio-apuntes">
            <strong>{modo === 'repaso' ? (pasados.current.length ? 'Repaso hecho' : 'Nada que repasar todavía') : pasados.current.length ? 'Has visto todos por ahora' : 'Aún no hay apuntes'}</strong>
            <p>{modo === 'repaso' ? (pasados.current.length ? 'Los que no sabías volverán a salir otro día.' : 'Cuando veas apuntes en tus descansos, aquí podrás repasarlos.')
              : pasados.current.length ? 'Mañana habrá más: los que no sabías vuelven a salir.' : 'Cuando tu coach publique sus guías y las fichas de técnica, saldrán aquí.'}</p>
          </div>
        )}
        {listo && actual && (
          <article class={`apunte tipo-${actual.tipo}`} key={actual.id} aria-live="polite">
            <p class="apunte-etq"><span class="chip">{actual.etiqueta}</span>{actual.de && <span class="apunte-de">{actual.de}</span>}</p>
            {actual.titulo && <h2>{actual.titulo}</h2>}
            {actual.vuelta && !vuelta
              ? <button type="button" class="btn apunte-destapar" onClick={() => setVuelta(true)}>{actual.tipo === 'mito' ? '¿Por qué es un mito?' : '¿Por qué, y cómo se corrige?'}</button>
              : actual.texto && <p class="apunte-texto">{actual.texto}</p>}
          </article>
        )}
      </div>
      {listo && actual && (
        <footer class="apuntes-pie">
          {actual.vuelta && vuelta ? (
            <>
              <button type="button" class="btn" onClick={() => responder(false)}>No lo sabía</button>
              <button type="button" class="btn btn-primario" onClick={() => responder(true)}>Lo sabía</button>
            </>
          ) : <button type="button" class="btn btn-primario" onClick={otro}>{modo === 'repaso' ? 'Siguiente' : 'Otro apunte'}</button>}
        </footer>
      )}
    </div>
  );
}
