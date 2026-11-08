// Piezas de la personalización (v0.104) que salen en varios sitios:
//   · MensajeCoach: lo que el coach dejó escrito para ese momento, como una cita con su foto (récord, bloque, racha…)
//   · RecordAlAlcance: en la portada de la sesión, la carga que batiría su récord si lo reciente dice que la tiene
//   · BotonMusica: en la portada, abrir su lista (lo que eligió en «Lo tuyo»)
//   · RecuerdoProgreso: al terminar, «En mayo: 60 kg × 8. Hoy: 75 kg × 8»
//   · CifraObjetivo y TusEjercicios: arriba en Progreso, lo de su objetivo y sus tres ejercicios
import { useApp, useCarga, Icono, Avatar } from '../comunes.jsx';
import { LOBO } from '../marca-lobo.js';
import { textoMensajeCoach, mensajeDe, nombreSaludo, recordAlAlcance, recuerdoProgreso, textoSerieCorta, nombreMusica, cifraObjetivo } from '../../logica/personal.js';
import { OBJETIVOS } from '../../logica/cuestionario.js';
import { num } from '../../logica/calculos.js';
import { hoyISO } from '../../logica/fechas.js';

// Lo del atleta y los mensajes del coach (los dos se recuerdan un minuto en la api)
export function usePersonal() {
  const { api, atleta } = useApp();
  return useCarga(() => api.personal().then((p) => p || null).catch(() => null), [atleta?.id]);
}

export function MensajeCoach({ momento, ejercicio = '', semanas = '', clase = '' }) {
  const { api, atleta, propio } = useApp();
  const mensajes = useCarga(() => (propio ? Promise.resolve([]) : api.mensajesCoach().catch(() => [])), [momento]);
  const personal = usePersonal();
  const foto = useCarga(() => (propio ? Promise.resolve(null) : api.fotoCoach().catch(() => null)), []);
  const texto = textoMensajeCoach(mensajeDe(mensajes.datos, momento), { nombre: nombreSaludo(personal.datos, atleta?.nombre), ejercicio, semanas });
  if (!texto) return null;
  return (
    <figure class={`cita-coach mensaje-coach ${clase}`} data-momento={momento}>
      {foto.datos ? <Avatar nombre="Tu coach" foto={foto.datos} /> : <img class="avatar-coach" src={LOBO} alt="" width="44" height="44" aria-hidden="true" />}
      <div>
        <blockquote>{texto}</blockquote>
        <figcaption>Tu coach</figcaption>
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
              <span class="num"><b>{num(r.kg, 2)} kg × {r.reps}</b></span> en {r.ejercicio}
              <span class="mini terciario"> (tu mejor a {r.reps}: {num(r.antes, 2)} kg)</span>
            </li>
          ))}
        </ul>
        <span class="mini terciario">Sale de lo que has hecho estas semanas. Si el día no acompaña, no pasa nada: manda tu coach.</span>
      </div>
    </section>
  );
}

export function BotonMusica() {
  const personal = usePersonal();
  const url = personal.datos?.musica_url;
  if (!url) return null;
  return (
    <a class="btn btn-ancho boton-musica" href={url} target="_blank" rel="noopener noreferrer">
      <Icono n="altavoz" /> Tu música en {nombreMusica(url)}
    </a>
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

const NOMBRE_OBJETIVO = Object.fromEntries(OBJETIVOS);
export function CifraObjetivo({ progreso, constancia, salud }) {
  const { api, atleta } = useApp();
  const cuestionario = useCarga(() => api.cuestionario(atleta.id).catch(() => null), [atleta.id]);
  if (!cuestionario.datos || !progreso) return null;
  const c = cifraObjetivo({ cuestionario: cuestionario.datos, progreso, constancia, salud, hoy: hoyISO() });
  if (!c) return null;
  return (
    <section class="panel panel-pad cifra-objetivo" aria-labelledby="cifra-objetivo-t">
      <span class="t-sobre" id="cifra-objetivo-t">Tu objetivo: {c.titulo.toLowerCase()}</span>
      <span class="peq secundario">{c.etiqueta}</span>
      <p class="cifra-objetivo-v"><span class="num">{c.cifra}</span> <small>{c.unidad}</small></p>
      <span class={`chip ${c.sube === true ? 'ok' : c.sube === false ? 'aviso' : 'morado'} cifra-objetivo-cambio`}>{c.sube === true && <Icono n="arriba" />}{c.sube === false && <Icono n="abajo" />}{c.detalle}</span>
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
              <span class="num tu-ejercicio-v">{num(e.mejor)}<small> kg</small></span>
              <span class="mini terciario">mejor 1RM estimado</span>
              {cambio != null && cambio !== 0 && <span class={`mini num ${cambio > 0 ? 'ok-texto' : ''}`}>{cambio > 0 ? '+' : ''}{num(cambio)} kg en 4 semanas</span>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
