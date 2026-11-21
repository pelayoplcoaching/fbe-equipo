// Piezas de la personalización (v0.104) que salen en varios sitios:
//   · MensajeCoach: lo que el coach dejó escrito para ese momento, como una cita con su foto (récord, bloque, racha…)
//   · RecordAlAlcance: en la portada de la sesión, la carga que batiría su récord si lo reciente dice que la tiene
//   · RecuerdoProgreso: al terminar, «En mayo: 60 kg × 8. Hoy: 75 kg × 8»
//   · CifraObjetivo y TusEjercicios: arriba en Progreso, lo de su objetivo y sus tres ejercicios
import { VozCoach } from './Compania.jsx';
import { useApp, useCarga, Icono, Avatar } from '../comunes.jsx';
import { LOBO } from '../marca-lobo.js';
import { textoMensajeCoach, mensajeDe, nombreSaludo, recordAlAlcance, recuerdoProgreso, textoSerieCorta, cifraObjetivo } from '../../logica/personal.js';
import { OBJETIVOS } from '../../logica/cuestionario.js';
import { num } from '../../logica/calculos.js';
import { hoyISO } from '../../logica/fechas.js';
import { pesoTxt, pesoNum, etiquetaPeso, difVista } from '../../logica/unidades.js';

// Lo del atleta y los mensajes del coach (los dos se recuerdan un minuto en la api)
export function usePersonal() {
  const { api, atleta } = useApp();
  return useCarga(() => api.personal().then((p) => p || null).catch(() => null), [atleta?.id]);
}

export function MensajeCoach({ momento, ejercicio = '', semanas = '', tiempo = '', meta = '', clase = '' }) {
  const { api, atleta, propio } = useApp();
  const mensajes = useCarga(() => (propio ? Promise.resolve([]) : api.mensajesCoach().catch(() => [])), [momento]);
  const personal = usePersonal();
  const foto = useCarga(() => (propio ? Promise.resolve(null) : api.fotoCoach().catch(() => null)), []);
  const texto = textoMensajeCoach(mensajeDe(mensajes.datos, momento), { nombre: nombreSaludo(personal.datos, atleta?.nombre), ejercicio, semanas, tiempo, meta });
  const conAudio = (Array.isArray(mensajes.datos) ? mensajes.datos : []).find((m) => m?.momento === momento) || null;
  if (!texto) return null;
  return (
    <figure class={`cita-coach mensaje-coach ${clase}`} data-momento={momento}>
      {foto.datos ? <Avatar nombre="Tu coach" foto={foto.datos} /> : <img class="avatar-coach" src={LOBO} alt="" width="44" height="44" aria-hidden="true" />}
      <div>
        <blockquote>{texto}</blockquote>
        <figcaption>Tu coach</figcaption>
        {/* (personalización 3, tanda 8) su voz, si se lo ha grabado */}
        {conAudio?.audio_ruta && <VozCoach ruta={conAudio.audio_ruta} segundos={conAudio.audio_segundos} />}
      </div>
    </figure>
  );
}

export function RecordAlAlcance({ ejercicios = [] }) {
  const { api, atleta } = useApp();
  const conReps = ejercicios.some((e) => (e.reps_max ?? e.reps_min) != null);
  const historial = useCarga(() => (conReps ? api.historial(atleta.id).catch(() => []) : Promise.resolve([])), [atleta.id, conReps]);
  const lista = historial.datos ? recordAlAlcance(ejercicios, historial.datos, hoyISO()) : [];
  if (!lista.length) return null;
  return (
    <section class="panel panel-pad record-alcance" aria-labelledby="record-alcance-t">
      <span class="record-alcance-ico" aria-hidden="true"><Icono n="trofeo" /></span>
      <div class="pila-xs">
        <strong id="record-alcance-t">{lista.length === 1 ? 'Un récord al alcance' : 'Récords al alcance'}</strong>
        <ul class="record-alcance-lista">
          {lista.map((r) => (
            <li key={r.id}>
              <span class="num"><b>{pesoTxt(r.kg, 2)} × {r.reps}</b></span> en {r.ejercicio}
              <span class="mini terciario"> (tu mejor a {r.reps}: {pesoTxt(r.antes, 2)})</span>
            </li>
          ))}
        </ul>
        <span class="mini terciario">Sale de lo que has hecho estas semanas. Si el día no acompaña, no pasa nada: manda tu coach.</span>
      </div>
    </section>
  );
}

// hoySeries: las de esta sesión (del historial, por su id)
export function RecuerdoProgreso({ sesionId }) {
  const { api, atleta } = useApp();
  const historial = useCarga(() => (sesionId ? api.historial(atleta.id).catch(() => []) : Promise.resolve([])), [sesionId]);
  if (!historial.datos?.length) return null;
  const hoyS = historial.datos.filter((s) => s.sesion_id === sesionId);
  const fecha = hoyS[0]?.fecha || hoyISO();
  const r = recuerdoProgreso(hoyS, historial.datos.filter((s) => s.sesion_id !== sesionId), fecha);
  if (!r) return null;
  return (
    <section class="panel panel-pad recuerdo-progreso" aria-label={`Hace ${r.hace}`}>
      <span class="t-sobre">Hace {r.hace}</span>
      <p class="recuerdo-linea"><strong>{r.ejercicio}</strong></p>
      <div class="recuerdo-cifras">
        <span class="recuerdo-antes"><span class="mini terciario">En {r.mes}</span><span class="num">{textoSerieCorta(r.antes)}</span></span>
        <Icono n="derecha" />
        <span class="recuerdo-hoy"><span class="mini">Hoy</span><span class="num">{textoSerieCorta(r.hoy)}</span></span>
      </div>
      <span class="mini terciario num">+{num(r.pct, 1)} % de 1RM estimado. Así se ve lo que llevas construido.</span>
    </section>
  );
}

import { Imagen as ImagenObj, hayImagen as hayImagenObj } from '../Imagen.jsx';
import { imagenObjetivo } from '../../logica/imagenes.js';
import { objetivosDe } from '../../logica/cuestionario.js';
import { metaFuerza, metaPeso, MiniLinea } from './ProgresoPiezas.jsx';
const NOMBRE_OBJETIVO = Object.fromEntries(OBJETIVOS);
// (v0.203) objetivos: los suyos (del coach o propuestos y aceptados): si hay uno de ese ejercicio (o de peso), su
// camino (de dónde empezó, dónde está y la meta); y siempre, la minilínea de sus últimas semanas
function CaminoObjetivo({ o, peso }) {
  const x = peso ? o.autoPeso : o.auto;
  if (!x || x.inicio == null || x.actual == null || x.meta == null) return null;
  const pct = Math.max(0, Math.min(100, Number(peso ? x.pct : x.pct) || 0));
  const f = (v) => (peso ? `${num(v)} kg` : `${pesoNum(v, 1)} ${etiquetaPeso()}`);
  return (
    <div class="cifra-camino" role="img" aria-label={`Tu objetivo «${o.titulo}»: empezaste en ${f(x.inicio)}, vas por ${f(x.actual)} y la meta es ${f(x.meta)} (${pct} %)`}>
      <span class="camino-pista" aria-hidden="true"><span class="camino-lleno" style={{ width: `${pct}%` }} /><span class="camino-ahora" style={{ left: `${pct}%` }} /></span>
      <span class="camino-extremos mini num" aria-hidden="true"><span>{f(x.inicio)}</span><span class="camino-meta"><Icono n="bandera" />{f(x.meta)}</span></span>
    </div>
  );
}
export function CifraObjetivo({ progreso, constancia, salud, objetivos = [] }) {
  const { api, atleta } = useApp();
  const cuestionario = useCarga(() => api.cuestionario(atleta.id).catch(() => null), [atleta.id]);
  if (!cuestionario.datos || !progreso) return null;
  const c = cifraObjetivo({ cuestionario: cuestionario.datos, progreso, constancia, salud, hoy: hoyISO() });
  if (!c) return null;
  return (
    <section class="panel panel-pad cifra-objetivo" aria-labelledby="cifra-objetivo-t">
      {hayImagenObj(imagenObjetivo(objetivosDe(cuestionario.datos)[0])) && <ImagenObj id={imagenObjetivo(objetivosDe(cuestionario.datos)[0])} clase="cifra-objetivo-img" tamanos="56px" />}
      <span class="t-sobre" id="cifra-objetivo-t">Tu objetivo: {c.titulo.toLowerCase()}</span>
      <span class="peq secundario">{c.etiqueta}</span>
      <p class="cifra-objetivo-v"><span class="num">{c.cifra}</span> <small>{c.unidad}</small></p>
      <span class={`chip ${c.sube === true ? 'ok' : c.sube === false ? 'aviso' : 'morado'} cifra-objetivo-cambio`}>{c.sube === true && <Icono n="arriba" />}{c.sube === false && <Icono n="abajo" />}{c.detalle}</span>
      <MiniLinea valores={c.serie} ancho={120} alto={34} clase="cifra-objetivo-linea" />
      {(() => { const m = c.peso ? metaPeso(objetivos) : c.ejercicioId ? metaFuerza(objetivos, c.ejercicioId) : null; return m ? <CaminoObjetivo o={m.objetivo} peso={!!c.peso} /> : null; })()}
      {c.otros.length > 0 && <span class="mini terciario">También: {c.otros.map((o) => (NOMBRE_OBJETIVO[o] || o).toLowerCase()).join(', ')}.</span>}
    </section>
  );
}

export function TusEjercicios({ progreso }) {
  const personal = usePersonal();
  const fav = personal.datos?.favoritos || [];
  if (!fav.length || !progreso?.ejercicios) return null;
  const lista = fav.map((id) => progreso.ejercicios.find((e) => e.id === id)).filter(Boolean);
  if (!lista.length) return null;
  return (
    <section class="seccion tus-ejercicios" aria-labelledby="tus-ejercicios-t">
      <h2 id="tus-ejercicios-t">Tus ejercicios</h2>
      <div class={`tus-ejercicios-rejilla n${lista.length}`}>
        {lista.map((e) => {
          const p = e.puntos || [];
          const ult = p[p.length - 1], ant = p.length > 4 ? p[p.length - 5] : p[0];
          const cambio = ult && ant && p.length > 1 ? Math.round((ult.valor - ant.valor) * 10) / 10 : null;
          return (
            <div class="panel panel-pad tu-ejercicio" key={e.id}>
              <span class="peq secundario tu-ejercicio-nombre">{e.nombre}</span>
              <span class="num tu-ejercicio-v">{pesoNum(e.mejor, 1)}<small> {etiquetaPeso()}</small></span>
              <span class="mini terciario">mejor 1RM estimado</span>
              {cambio != null && cambio !== 0 && <span class={`mini num ${cambio > 0 ? 'ok-texto' : ''}`}>{cambio > 0 ? '+' : ''}{num(difVista(cambio))} {etiquetaPeso()} en 4 semanas</span>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
