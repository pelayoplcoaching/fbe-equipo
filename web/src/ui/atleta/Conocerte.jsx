// (personalización 2, tanda 3) Que la app le conozca, en la sesión y en su perfil: «la última vez…» contado como persona,
// el descanso que de verdad hace (preguntando), su molestia por zona (el texto del coach, con su consentimiento de
// salud), cómo está hoy (consejo, la pauta es la del coach) y sus momentos buenos.
import { useState } from 'preact/hooks';
import { useApp, useCarga, Icono } from '../comunes.jsx';
import { useTrato } from '../trato.js';
import { fraseUltimaVez, propuestaDescanso, avisoZona, hoyPorComoEstas, mejorMomento, momentoZona, ZONAS_AVISO } from '../../logica/conocerte.js';
import { mensajeDe } from '../../logica/personal.js';
import { hoyISO } from '../../logica/fechas.js';
import { leerPreferencia, guardarPreferencia } from '../preferencias.js';
import { vibrar } from '../hapticos.js';

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// Lo que la sesión necesita saber de él: sus zonas (del cuestionario, solo con el consentimiento de salud) y los
// avisos del coach por zona
export function useConocerte(salud) {
  const { api, atleta, propio } = useApp();
  const con = !!salud && !propio && !!atleta?.id;
  const d = useCarga(() => (con ? Promise.all([api.cuestionario(atleta.id).catch(() => null), api.mensajesCoach().catch(() => [])]) : Promise.resolve([null, []])), [atleta?.id, con]);
  const [cuest, mensajes] = d.datos || [null, []];
  const textos = Object.fromEntries(ZONAS_AVISO.map((z) => [z, mensajeDe(mensajes, momentoZona(z))]).filter(([, t]) => t));
  return { avisoDe: (ej) => (con ? avisoZona(ej, cuest?.lesiones || [], textos) : null) };
}

export function AvisoZona({ aviso }) {
  if (!aviso) return null;
  return <p class="aviso-zona" data-zona={aviso.zona}><Icono n="escudo" /><span><strong>{aviso.titulo}: </strong>{aviso.texto}</span></p>;
}

export function FraseUltimaVez({ ultimas }) {
  const trato = useTrato();
  const f = fraseUltimaVez(ultimas, trato, { hoy: hoyISO() });
  return f ? <p class="ultima-vez-frase">{f}</p> : null;
}

// «La última vez descansaste unos 2:30: ¿lo dejo así?» (solo si el coach no ha puesto descanso; «No» se recuerda)
const claveNo = (atletaId, ejId) => `fbe-costumbre-descanso:${atletaId}:${ejId}`;
export function CostumbreDescanso({ ej, ultimas, descanso, elegir }) {
  const { atleta } = useApp();
  const [no, setNo] = useState(() => leerPreferencia(claveNo(atleta.id, ej.id), null) === 'no');
  const seg = propuestaDescanso({ series: ultimas?.series || [], actual: descanso?.seg ?? null, delCoach: descanso?.origen === 'coach', rechazada: no });
  if (!seg) return null;
  return (
    <div class="costumbre" role="group" aria-label="Tu descanso de verdad">
      <p><Icono n="reloj" /><span>La última vez descansaste unos <strong class="num">{mmss(seg)}</strong> entre series. ¿Pongo tu descanso de {ej.nombre.toLocaleLowerCase('es')} en {mmss(seg)}?</span></p>
      <span class="costumbre-botones">
        <button type="button" class="btn btn-peq" onClick={() => { vibrar('toque'); elegir(seg); setNo(true); }}>Sí, {mmss(seg)}</button>
        <button type="button" class="btn-texto" onClick={() => { guardarPreferencia(claveNo(atleta.id, ej.id), 'no'); setNo(true); }}>No, déjalo</button>
      </span>
    </div>
  );
}

// En la portada: «Hoy, por cómo estás» (lo que llega de Salud y lo que contestó en «¿Cómo llegas hoy?»)
export function HoyComoEstas({ salud, prep }) {
  const { api, atleta, propio } = useApp();
  const trato = useTrato();
  const hoy = hoyISO();
  const s = useCarga(() => (salud && !propio ? api.saludDiaria(atleta.id, hoy, hoy).catch(() => null) : Promise.resolve(null)), [salud, atleta?.id]);
  if (!salud || propio) return null;
  const sueno = (s.datos?.dias || []).find((x) => x.fecha === hoy)?.sueno_min ?? null;
  const c = hoyPorComoEstas({ suenoMin: sueno, prep: prep || null }, trato);
  if (!c) return null;
  return <p class={`hoy-como-estas nivel-${c.nivel}`}><Icono n="sueno" /><span><strong>Hoy, por cómo estás. </strong>{c.texto}</span></p>;
}

// En el perfil: sus momentos buenos, y proponérselo a su coach (con un mensaje, si quiere)
export function MejorMomento({ entrenos, hoy }) {
  const { api, atleta, aviso, propio } = useApp();
  const m = mejorMomento(entrenos, hoy);
  const [enviado, setEnviado] = useState(false);
  if (!m) return null;
  const proponer = async () => {
    try { await api.enviarMensaje(atleta.id, { autor: 'atleta', texto: m.propuesta }); setEnviado(true); vibrar('hecho'); aviso('Enviado a tu coach'); } catch (e) { aviso(e.message, 'error'); }
  };
  return (
    <section class="panel panel-pad mejor-momento" aria-label="Tu mejor momento">
      <p><Icono n="rayo" /><span>{m.texto}</span></p>
      {!propio && (enviado ? <span class="mini secundario">Se lo has propuesto a tu coach.</span>
        : <button type="button" class="btn btn-peq" onClick={proponer}>Proponer a mi coach poner ahí la sesión más dura</button>)}
    </section>
  );
}
