// v0.51: la portada de la sesión, antes de empezar (como en Ladder): arriba, a todo lo ancho, un dibujo de líneas que
// sale del nombre, el tipo y el patrón principal de la sesión (siempre el mismo para la misma sesión), con el nombre en
// grande, los minutos estimados y los músculos que más trabaja; debajo, la nota de tu coach como una cita con su foto,
// la lista de ejercicios con sus pictogramas y un «Empezar» grande. Al empezar, la sesión de siempre.
import { useApp, useCarga, Icono, Avatar, Disco } from '../comunes.jsx';
import { PictoEjercicio } from '../Pictograma.jsx';
import { TarjetaCardio } from './TarjetaCardio.jsx';
import { LOBO } from '../marca-lobo.js';
import { ArteSesion } from './ArteSesion.jsx';
import { resumenPautas } from '../../logica/diseno.js';
import { pauta, NOMBRE_GRUPO, NOMBRE_PRIORIDAD, NOMBRE_INTENCION, NOMBRE_TIPO_SESION } from '../../logica/calculos.js';
import { esPorSuCuenta } from '../../logica/esencial.js';
import { cardioValido } from '../../logica/cardio.js';
import { familiaPortada, imagenPortada, imagenEjercicio } from '../../logica/imagenes.js';
import { Imagen } from '../Imagen.jsx';
import { RecordAlAlcance } from './Personal.jsx';
import { MusicaSesion } from './Musica.jsx';
import { useTrato } from '../trato.js';
import { antesDelTitulo } from '../../logica/trato.js';
import { hoyISO, diasEntre } from '../../logica/fechas.js';
import { porQueSesion, nivelLenguaje, explicarEsfuerzo, metaDe } from '../../logica/rumbo.js';
import { objetivosDe } from '../../logica/cuestionario.js';
import { HoyComoEstas } from './Conocerte.jsx';
import { FotoMotivacion } from './Suyo.jsx';
import { TiempoHoy, Calentamiento } from './SesionTuya.jsx';
import { useMarcaPagina } from '../marca-pagina.js';
import { perezoso } from '../perezoso.jsx';

// (v0.245) FBE Esencial: «Lo de hoy, en 20 segundos», antes de empezar
const LoDeHoy = perezoso(() => import('./EsencialAyuda.jsx'), 'LoDeHoy', { mientras: null });

// El dibujo de la sesión, en su propio archivo (ArteSesion.jsx); se sigue exportando desde aquí
export { ArteSesion };

export function Portada({ sesion, semana, ejercicios, etiquetas = {}, alCerrar, alEmpezar, salud = false, prep = null, corta = null, alCorta = null }) {
  // (personalización 2) «Ana, hoy toca»: con su nombre (o su apodo), encima del nombre de la sesión
  useMarcaPagina('hay-portada-sesion');
  const trato = useTrato();
  const paraTi = antesDelTitulo(trato, { esHoy: !sesion.dia_previsto || sesion.dia_previsto === hoyISO() });
  const { api, propio, atleta } = useApp();
  // (personalización 2, tanda 2) por qué esta sesión es para él (su objetivo del cuestionario) y el lenguaje de su nivel
  const cuest = useCarga(() => (propio || !atleta?.id ? Promise.resolve(null) : api.cuestionario(atleta.id).catch(() => null)), [atleta?.id]);
  const meses = atleta?.fecha_alta ? Math.max(0, Math.floor(diasEntre(String(atleta.fecha_alta).slice(0, 10), hoyISO()) / 30.44)) : 0;
  const nivel = nivelLenguaje({ experiencia: cuest.datos?.experiencia || null, meses, nivel: null });
  const foto = useCarga(() => (propio ? Promise.resolve(null) : api.fotoCoach().catch(() => null)), []);
  const r = resumenPautas(ejercicios.map((e) => ({ ...e, ejercicio: e.ejercicio })));
  const tipo = sesion.tipo || 'fuerza';
  const sobre = [tipo !== 'fuerza' ? NOMBRE_TIPO_SESION[tipo] : NOMBRE_INTENCION[sesion.intencion] || 'Sesión de fuerza', semana?.numero ? `Semana ${semana.numero}` : null].filter(Boolean).join(' · ');
  const nota = (sesion.dinamica || semana?.nota_coach || '').trim();
  const cardio = cardioValido(sesion.cardio) ? sesion.cardio : null;
  // (FBE Esencial) quien va por su cuenta lee «te sobran»; en las semanas de aprender (te sobran 3 o más) no sale el porqué
  // de su objetivo («las primeras series, las pesadas…»), que no encaja con ir sobrado
  const suyo = esPorSuCuenta(atleta);
  const aprender = suyo && ejercicios.some((e) => Number(e.rir_objetivo) >= 3);
  const porQue = sesion.completada || aprender ? null : porQueSesion({ objetivos: objetivosDe(cuest.datos), tipo, conCardio: !!cardio, meta: metaDe(trato.personal) }, trato);
  const familia = familiaPortada({ tipo, pautas: ejercicios, cardio: !!cardio });
  return (
    <div class="contenido portada-vista">
      {/* v0.52: la barra de arriba: el botón de volver y, al bajar, la portada se recoge en ella con el nombre (con las
          animaciones ligadas al scroll, donde las hay; si no, se va con la portada, como antes) */}
      <div class="portada-barra">
        <button class="btn btn-icono" onClick={alCerrar} aria-label="Volver"><Icono n="atras" /></button>
        <span class="portada-barra-titulo" aria-hidden="true"><span>{sesion.nombre}</span></span>
      </div>
      <header class="portada-sesion">
        {/* (imágenes) la ilustración de su familia (empuje, tirón, pierna, core, full body, cardio o movilidad); si no
            se puede cargar, el dibujo de líneas de siempre */}
        <Imagen key={imagenPortada(familia, cardio?.modalidad, sesion.id)} id={imagenPortada(familia, cardio?.modalidad, sesion.id)} clase="portada-arte portada-foto" tamanos="(min-width: 600px) 600px, 150vw" prioridad
          alternativa={<ArteSesion nombre={sesion.nombre} tipo={tipo} patron={r.patrones[0] || null} />} />
        <span />
        <div class="portada-texto">
          <span class="t-sobre">{sobre}</span>
          {paraTi && <span class="portada-para">{paraTi}</span>}
          <h1 class="t-display">{sesion.nombre}</h1>
          <ul class="portada-meta" aria-label="De qué va">
            {r.minutos > 0 && <li><Icono n="reloj" />unos <span class="num">{r.minutos}</span> min</li>}
            {r.ejercicios > 0 && <li><span class="num">{r.ejercicios}</span> {r.ejercicios === 1 ? 'ejercicio' : 'ejercicios'}</li>}
            {r.grupos.map((g) => <li key={g}>{NOMBRE_GRUPO[g] || g}</li>)}
          </ul>
        </div>
      </header>
      {!sesion.completada && <FotoMotivacion clase="en-portada" />}
      {!sesion.completada && <HoyComoEstas salud={salud} prep={prep || sesion.preparacion || null} />}
      {porQue && <p class="portada-porque"><Icono n="diana" /><span><strong>Por qué es para ti. </strong>{porQue}</span></p>}
      {nivel === 'principiante' && r.ejercicios > 0 && ejercicios.some((e) => /RIR|RPE/.test(pauta(e)?.esfuerzo || '')) && (
        <p class="portada-nivel peq secundario">{suyo ? 'Cuando veas «Te sobran 2», significa que acabes la serie cuando aún podrías hacer 2 repeticiones más.'
          : 'Cuando veas «RIR 2», significa que acabes la serie cuando aún podrías hacer 2 repeticiones más. Te lo explicamos en cada ejercicio.'}</p>
      )}
      {/* (personalización 3, tanda 5) con el tiempo que tiene y su calentamiento: consejo, la sesión no cambia */}
      {suyo && !propio && !sesion.completada && r.ejercicios > 0 && <LoDeHoy sesion={sesion} ejercicios={ejercicios} />}
      {!sesion.completada && r.ejercicios > 0 && <TiempoHoy ejercicios={ejercicios} corta={corta} alCorta={alCorta} />}
      {!sesion.completada && r.ejercicios > 0 && <Calentamiento clave={sesion.id} ejercicios={ejercicios} zonas={salud ? (cuest.datos?.lesiones || []).map((l) => l?.zona).filter(Boolean) : []} />}
      {nota && (
        <figure class="cita-coach">
          {foto.datos && !suyo ? <Avatar nombre="Tu coach" foto={foto.datos} /> : <img class="avatar-coach" src={LOBO} alt="" width="44" height="44" aria-hidden="true" />}
          <div>
            <blockquote>{nota}</blockquote>
            {/* (FBE Esencial) la nota de la semana la escribe la app: sin la firma de un coach */}
            <figcaption>{suyo ? 'Esta semana' : 'Tu coach'}</figcaption>
          </div>
        </figure>
      )}
      {cardio && <TarjetaCardio pauta={cardio} hecho={sesion.cardio_hecho} completada={sesion.completada} sesionId={sesion.id} />}
      {/* (v0.104) la carga que batiría su récord, si lo reciente dice que la tiene a mano */}
      {!sesion.completada && !propio && ejercicios.length > 0 && <RecordAlAlcance ejercicios={ejercicios} />}
      {ejercicios.length > 0 && (
        <section class="seccion">
          <h2>Lo que vas a hacer</h2>
          <div class="panel portada-lista">
            <ul class="lista">
              {ejercicios.map((e) => {
                const pa = pauta(e, { sobran: esPorSuCuenta(atleta) });
                return (
                  <li class="ej-fila" key={e.id} data-asoma={`ejercicio:${e.ejercicio_id}`}>
                    <span class="ej-marca"><Imagen id={imagenEjercicio(e.ejercicio)} clase="miniatura-ej ej-mini" tamanos="40px" alternativa={<PictoEjercicio ejercicio={e.ejercicio} />} /><Disco prioridad={e.prioridad} titulo={NOMBRE_PRIORIDAD[e.prioridad]} /></span>
                    <div>
                      <div class="nombre">{etiquetas[e.id] && <span class="ss-etq">{etiquetas[e.id]}</span>}{e.ejercicio.nombre}</div>
                      <div class="pauta"><span class="num">{pa.series}</span>{pa.esfuerzo && <span>{explicarEsfuerzo(pa.esfuerzo, nivel)}</span>}{pa.carga && <span class="num">{pa.carga}</span>}{e.variante && <span>{e.variante}</span>}</div>
                    </div>
                    <span />
                  </li>
                );
              })}
            </ul>
          </div>
          <p class="mini terciario">El disco de color marca la prioridad: rojo obligatorio, azul muy importante, amarillo accesorio, verde prescindible.</p>
        </section>
      )}
      {/* (v0.104) la música de hoy: la del coach, la suya, la de descarga, la de su tipo de sesión o la del ritmo del cardio
          (en el modo atleta del coach, sus propias listas de Cuenta › Música) */}
      {!sesion.completada && <MusicaSesion sesion={sesion} semana={semana} familia={familia} cardio={cardio} alEmpezar={alEmpezar} prep={prep} />}
      <div class="portada-empezar">
        <button class="btn btn-primario btn-grande btn-ancho" onClick={alEmpezar}><Icono n="play" /> Empezar</button>
      </div>
    </div>
  );
}
