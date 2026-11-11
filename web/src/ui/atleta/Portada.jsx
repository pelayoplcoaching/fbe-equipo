// v0.51: la portada de la sesión, antes de empezar (como en Ladder): arriba, a todo lo ancho, un dibujo de líneas que
// sale del nombre, el tipo y el patrón principal de la sesión (siempre el mismo para la misma sesión), con el nombre en
// grande, los minutos estimados y los músculos que más trabaja; debajo, la nota de tu coach como una cita con su foto,
// la lista de ejercicios con sus pictogramas y un «Empezar» grande. Al empezar, la sesión de siempre.
import { useApp, useCarga, Icono, Avatar, Disco } from '../comunes.jsx';
import { PictoEjercicio } from '../Pictograma.jsx';
import { TarjetaCardio } from './Sesion.jsx';
import { LOBO } from '../marca-lobo.js';
import { arteSesion } from '../../logica/arte.js';
import { resumenPautas } from '../../logica/diseno.js';
import { pauta, NOMBRE_GRUPO, NOMBRE_PRIORIDAD, NOMBRE_INTENCION, NOMBRE_TIPO_SESION } from '../../logica/calculos.js';
import { cardioValido } from '../../logica/cardio.js';
import { familiaPortada, imagenPortada, imagenEjercicio } from '../../logica/imagenes.js';
import { Imagen } from '../Imagen.jsx';
import { RecordAlAlcance } from './Personal.jsx';
import { MusicaSesion } from './Musica.jsx';

// El dibujo: solo geometría (logica/arte.js); los colores, del tema (el acento, claro y tenue sobre la tarjeta oscura)
export function ArteSesion({ nombre, tipo, patron, clase = 'portada-arte' }) {
  const a = arteSesion({ nombre, tipo, patron }, 400, 300);
  return (
    <svg class={clase} viewBox={`0 0 ${a.ancho} ${a.alto}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false" fill="none" stroke-linecap="round">
      {a.formas.map((f, i) => {
        const comun = { key: i, class: f.tono, 'stroke-width': f.grosor, opacity: f.opacidad };
        if (f.t === 'circulo') return <circle {...comun} cx={f.cx} cy={f.cy} r={f.r} />;
        if (f.t === 'elipse') return <ellipse {...comun} cx={f.cx} cy={f.cy} rx={f.rx} ry={f.ry} transform={`rotate(${f.giro} ${f.cx} ${f.cy})`} />;
        if (f.t === 'linea') return <line {...comun} x1={f.x1} y1={f.y1} x2={f.x2} y2={f.y2} />;
        if (f.t === 'trazo') return <path {...comun} d={f.d} />;
        return <circle key={i} class={`relleno-punto ${f.tono}`} cx={f.cx} cy={f.cy} r={f.r} opacity={f.opacidad} />;
      })}
    </svg>
  );
}

export function Portada({ sesion, semana, ejercicios, etiquetas = {}, alCerrar, alEmpezar }) {
  const { api, propio } = useApp();
  const foto = useCarga(() => (propio ? Promise.resolve(null) : api.fotoCoach().catch(() => null)), []);
  const r = resumenPautas(ejercicios.map((e) => ({ ...e, ejercicio: e.ejercicio })));
  const tipo = sesion.tipo || 'fuerza';
  const sobre = [tipo !== 'fuerza' ? NOMBRE_TIPO_SESION[tipo] : NOMBRE_INTENCION[sesion.intencion] || 'Sesión de fuerza', semana?.numero ? `Semana ${semana.numero}` : null].filter(Boolean).join(' · ');
  const nota = (sesion.dinamica || semana?.nota_coach || '').trim();
  const cardio = cardioValido(sesion.cardio) ? sesion.cardio : null;
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
        <Imagen key={imagenPortada(familia, cardio?.modalidad)} id={imagenPortada(familia, cardio?.modalidad)} clase="portada-arte portada-foto" tamanos="(min-width: 600px) 600px, 150vw" prioridad
          alternativa={<ArteSesion nombre={sesion.nombre} tipo={tipo} patron={r.patrones[0] || null} />} />
        <span />
        <div class="portada-texto">
          <span class="t-sobre">{sobre}</span>
          <h1 class="t-display">{sesion.nombre}</h1>
          <ul class="portada-meta" aria-label="De qué va">
            {r.minutos > 0 && <li><Icono n="reloj" />unos <span class="num">{r.minutos}</span> min</li>}
            {r.ejercicios > 0 && <li><span class="num">{r.ejercicios}</span> {r.ejercicios === 1 ? 'ejercicio' : 'ejercicios'}</li>}
            {r.grupos.map((g) => <li key={g}>{NOMBRE_GRUPO[g] || g}</li>)}
          </ul>
        </div>
      </header>
      {nota && (
        <figure class="cita-coach">
          {foto.datos ? <Avatar nombre="Tu coach" foto={foto.datos} /> : <img class="avatar-coach" src={LOBO} alt="" width="44" height="44" aria-hidden="true" />}
          <div>
            <blockquote>{nota}</blockquote>
            <figcaption>Tu coach</figcaption>
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
                const pa = pauta(e);
                return (
                  <li class="ej-fila" key={e.id}>
                    <span class="ej-marca"><Imagen id={imagenEjercicio(e.ejercicio)} clase="miniatura-ej ej-mini" tamanos="40px" alternativa={<PictoEjercicio ejercicio={e.ejercicio} />} /><Disco prioridad={e.prioridad} titulo={NOMBRE_PRIORIDAD[e.prioridad]} /></span>
                    <div>
                      <div class="nombre">{etiquetas[e.id] && <span class="ss-etq">{etiquetas[e.id]}</span>}{e.ejercicio.nombre}</div>
                      <div class="pauta"><span class="num">{pa.series}</span>{pa.esfuerzo && <span>{pa.esfuerzo}</span>}{pa.carga && <span class="num">{pa.carga}</span>}{e.variante && <span>{e.variante}</span>}</div>
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
      {/* (v0.104) la música de hoy: la del coach, la suya, la de descarga, la de su tipo de sesión o la del ritmo del cardio */}
      {!propio && !sesion.completada && <MusicaSesion sesion={sesion} semana={semana} familia={familia} cardio={cardio} alEmpezar={alEmpezar} />}
      <div class="portada-empezar">
        <button class="btn btn-primario btn-grande btn-ancho" onClick={alEmpezar}><Icono n="play" /> Empezar</button>
      </div>
    </div>
  );
}
