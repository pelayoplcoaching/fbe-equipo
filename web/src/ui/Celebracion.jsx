// v0.73 (migración 045): la quinta tanda de la comunidad, «momentos y celebración». Lo usan Comunidad.jsx (el muro, el ranking y
// Equipo), Hoy.jsx (la tarjeta del aniversario) y EquipoCoach.jsx:
//   · TarjetaAniversario: «¡Hoy hace 1 año que entrenas con FBE!» en Hoy y en Equipo (con la ficha propia: no hace falta la base),
//     con un poco de confeti (nunca con «reducir movimiento»); y su tarjeta en el muro (TarjetaAniversarioPost).
//   · MesEnEquipo: del 1 al 7, «Octubre en el equipo» (recuentos del equipo) y «Tu octubre» (solo para ti), con «Compartir» (la
//     imagen de siempre, Compartir.jsx).
//   · HitosEquipo (en Ranking) y CelebrarHito (al entrar en Equipo, una vez en este móvil, con «Compartir en el muro»).
//   · ReaccionesPost (las seis reacciones: las tres de siempre a la vista y «Más reacciones»), Pegatina y ElegirPegatina.
//   · TiraMomentos: los momentos de 24 horas en círculos, arriba de Equipo, con «Tu momento» y su hoja.
// Sin la 045, lo que la necesita no sale (las tres reacciones de siempre, sin pegatinas, momentos ni hitos).
import { sonarFBE } from './sonido.js';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useApp, useCarga, useUnaVez, Icono, Hoja, cuando } from './comunes.jsx';
import { HojaCompartir } from './Compartir.jsx';
import { reducirFoto } from './FotoPerfil.jsx';
import { lanzarConfeti } from './confeti.js';
import { leerPreferencia, guardarPreferencia } from './preferencias.js';
import { hoyISO } from '../logica/fechas.js';
import { nombreMes } from '../logica/mes.js';
import { REACCIONES } from '../logica/comunidad.js';
import { IMAGEN_ANIVERSARIO } from '../logica/imagenes.js';
import { Imagen, hayImagen } from './Imagen.jsx';
import {
  aniversarioDe, tituloAniversario, textoAniversario, textoAniversarioMuro, mesEquipoDe, tituloMesEquipo, cifrasMesEquipo, cifrasMiMes, datosImagenMes,
  hitoPorCelebrar, textoHito, miles, REACCIONES_TODAS, PEGATINAS, textoPegatina, MAX_MOMENTO, NORMA_MOMENTO, textoQueda, limpiarMomento,
} from '../logica/celebracion.js';

// ---------------------------------------------------------------- 1. El aniversario en FBE
// En Hoy y arriba de Equipo, todo el día de su aniversario (hasta que lo oculta). El confeti, una vez al día en este móvil
export function TarjetaAniversario() {
  const { api, atleta, propio } = useApp();
  const hoy = hoyISO();
  const an = !propio && atleta?.estado !== 'baja' ? aniversarioDe(atleta?.fecha_alta, hoy) : null;
  const clave = `fbe-aniversario:${api.uid() || ''}`;
  const [oculta, setOculta] = useState(() => leerPreferencia(clave, null) === `${hoy}:oculta`);
  useEffect(() => {
    if (!an || oculta || leerPreferencia(clave, null)?.startsWith(hoy)) return undefined;
    guardarPreferencia(clave, `${hoy}:visto`);
    const t = setTimeout(() => { lanzarConfeti({ vibracion: null }); sonarFBE('hito', { tipo: 'aniversario' }); }, 400);   // (sonido 2) con su fanfarria
    return () => clearTimeout(t);
  }, [an?.meses, oculta]);
  if (!an || oculta) return null;
  return (
    <section class={`panel panel-pad aniversario ${hayImagen(IMAGEN_ANIVERSARIO) ? 'con-ilu' : ''}`} aria-labelledby="aniversario-t">
      {/* (imágenes, bloque R) la tarta con su vela, en una franja arriba; con ella, sin el 🎉 */}
      <Imagen id={IMAGEN_ANIVERSARIO} clase="franja-ilu franja-pegada aniversario-ilu" tamanos="(min-width: 720px) 640px, 100vw" />
      {!hayImagen(IMAGEN_ANIVERSARIO) && <span class="aniversario-ico" aria-hidden="true">🎉</span>}
      <div class="pila-xs">
        <h2 id="aniversario-t" class="aniversario-t">{tituloAniversario(an.meses)}</h2>
        <p class="peq secundario">{an.meses >= 12 ? 'Gracias por la constancia: un año más entrenando con cabeza.' : 'Gracias por la constancia: lo difícil es empezar, y ya llevas ' + textoAniversario(an.meses) + '.'}</p>
      </div>
      <button type="button" class="btn btn-icono plano aniversario-cerrar" aria-label="Ocultar la tarjeta del aniversario" onClick={() => { guardarPreferencia(clave, `${hoy}:oculta`); setOculta(true); }}><Icono n="cerrar" /></button>
    </section>
  );
}

// La tarjeta del muro (la pone la base el día de su aniversario): «Ana L. cumple 1 año en FBE 🎉»
export function TarjetaAniversarioPost({ post }) {
  const meses = Number(post.resumen?.meses) || 0;
  return (
    <div class="aniversario-post">
      <span class="ap-ico" aria-hidden="true">🎉</span>
      <div class="pila-xs">
        <strong class="ap-titulo">{textoAniversarioMuro(post.autor.nombre, meses)}</strong>
        <span class="mini secundario">{post.mio ? '¡Felicidades! Tu equipo lo está viendo.' : 'Felicítale con una reacción o un comentario.'}</span>
      </div>
    </div>
  );
}
export const resumenAniversario = (post) => (post?.tipo === 'aniversario' ? `Cumple ${textoAniversario(Number(post.resumen?.meses) || 1)} en FBE 🎉` : null);

// ---------------------------------------------------------------- 2. «<Mes> en el equipo»
// Del 1 al 7 de cada mes, arriba del muro: los recuentos del mes pasado del equipo y, en otra tarjeta (solo para ti), los tuyos
export function MesEnEquipo({ cambios = 0 }) {
  const { api } = useApp();
  const ventana = mesEquipoDe(hoyISO());
  const r = useCarga(() => (ventana ? api.mesEquipoComunidad().catch(() => null) : Promise.resolve(null)), [cambios, ventana?.mes]);
  const [compartir, setCompartir] = useState(null); // 'equipo' | 'mio'
  const x = r.datos;
  if (!ventana || !x?.equipo) return null;
  const mes = x.mes || ventana.mes;
  const titulo = tituloMesEquipo(mes);
  const cifras = cifrasMesEquipo(x.equipo);
  const mias = x.yo ? cifrasMiMes(x.yo) : null;
  const tuMes = `Tu ${nombreMes(mes)}`;
  return (
    <>
      <section class="panel panel-pad mes-equipo" aria-labelledby="mes-equipo-t">
        <div class="separa">
          <h2 id="mes-equipo-t" class="mes-equipo-t">{titulo}</h2>
          <button type="button" class="btn btn-peq" onClick={() => setCompartir('equipo')} aria-label={`Compartir «${titulo}»`}><Icono n="compartir" /> Compartir</button>
        </div>
        <dl class="mes-cifras">
          {cifras.map(([k, v, t]) => <div key={k} class={`mc-${k}`}><dt>{t}</dt><dd class="num">{v}</dd></div>)}
        </dl>
        <p class="mini terciario">Solo recuentos del equipo, sin nombres (sin quien no sale en el ranking).</p>
      </section>
      {mias && (
        <section class="panel panel-pad mes-equipo mes-mio" aria-labelledby="mes-mio-t">
          <div class="separa">
            <h2 id="mes-mio-t" class="mes-equipo-t">{tuMes} <span class="mini terciario">(solo lo ves tú)</span></h2>
            <button type="button" class="btn btn-peq" onClick={() => setCompartir('mio')} aria-label={`Compartir ${tuMes.toLowerCase()}`}><Icono n="compartir" /> Compartir</button>
          </div>
          <dl class="mes-cifras">
            {mias.map(([k, v, t]) => <div key={k}><dt>{t}</dt><dd class="num">{v}</dd></div>)}
          </dl>
        </section>
      )}
      {compartir && (
        <HojaCompartir tipo="mes" datos={datosImagenMes(x, { mio: compartir === 'mio' })} titulo={compartir === 'mio' ? `Compartir ${tuMes.toLowerCase()}` : `Compartir «${titulo}»`}
          nombreArchivo={`fbe-${mes}-${compartir === 'mio' ? 'mi-mes' : 'equipo'}.png`} alCerrar={() => setCompartir(null)}
          alt={`${compartir === 'mio' ? tuMes : titulo}: ${(compartir === 'mio' ? mias : cifras).map(([, v, t]) => `${v} ${t}`).join(', ')}`}
          nota="Solo lleva recuentos (sesiones, semanas completas, récords, retos, rachas y ánimos): nada de peso, cuerpo ni salud, ni nombres." />
      )}
    </>
  );
}

// ---------------------------------------------------------------- 3. Los hitos del equipo
const claveHitos = (uid) => `fbe-equipo-hitos:${uid || ''}`;
// En Ranking: la lista, con lo que lleva cada uno (los conseguidos, marcados)
export function HitosEquipo() {
  const { api } = useApp();
  const h = useCarga(() => api.hitosComunidad().catch(() => null), []);
  if (!h.datos) return null;
  return (
    <section class="panel panel-pad pila-s hitos-equipo" aria-labelledby="hitos-t">
      <h2 id="hitos-t" class="hitos-t">Hitos del equipo</h2>
      <ul class="hitos-lista">
        {h.datos.map((x) => (
          <li key={x.clave} class={x.alcanzado ? 'hecho' : ''} style={{ '--f': x.meta ? Math.min(1, x.valor / x.meta) : 0 }}>
            <span class="he-ico" aria-hidden="true">{x.alcanzado ? '🏅' : '○'}</span>
            <span class="he-texto">{x.titulo}</span>
            <span class="mini terciario num">{x.alcanzado ? 'Conseguido' : `${miles(Math.min(x.valor, x.meta))} de ${miles(x.meta)}`}</span>
          </li>
        ))}
      </ul>
      <p class="mini terciario">Entre todo el equipo, desde que se abrió la comunidad (sin quien no sale en el ranking).</p>
    </section>
  );
}

// Al entrar en Equipo (un atleta): el último hito conseguido que aún no ha celebrado en este móvil, con la hoja de celebración
// de siempre. pausado: otra hoja (la del logro) está abierta
export function CelebrarHito({ pausado = false, alCompartir }) {
  const { api, aviso } = useApp();
  const h = useCarga(() => api.hitosComunidad().catch(() => null), []);
  const [abierto, setAbierto] = useState(null);
  const [texto, setTexto] = useState('');
  const [ocupado, una] = useUnaVez();
  const yo = api.uid();
  useEffect(() => {
    if (pausado || abierto || !h.datos) return;
    let ya = [];
    try { ya = JSON.parse(leerPreferencia(claveHitos(yo), '[]') || '[]'); } catch { ya = []; }
    const p = hitoPorCelebrar(h.datos, Array.isArray(ya) ? ya : []);
    if (p) setAbierto(p);
  }, [h.datos, pausado]);
  if (!abierto) return null;
  const cerrar = () => { guardarPreferencia(claveHitos(yo), JSON.stringify(abierto.marcar)); setAbierto(null); };
  const linea = textoHito(abierto.hito.medida, abierto.hito.meta);
  const compartir = (e) => {
    e.preventDefault();
    una(async () => {
      try {
        await api.publicarEnComunidad({ texto: `${linea} 🎉${texto.trim() ? ` ${texto.trim()}` : ''}`, tema: 'logros' });
        aviso('Compartido en el muro');
        cerrar();
        alCompartir?.();
      } catch (err) { aviso(err.message, 'error'); }
    });
  };
  return (
    <Hoja titulo="¡Hito del equipo!" alCerrar={cerrar}>
      <form class="pila celebracion" onSubmit={compartir}>
        <div class="celebracion-medalla" aria-hidden="true">
          <span class="cm-rayos" />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <span key={i} class={`cm-confeti c${i}`} />)}
          <span class="cm-disco"><Icono n="equipo" /></span>
        </div>
        <p class="celebracion-titulo">{abierto.hito.titulo}</p>
        <p class="secundario celebracion-texto">{linea} Gracias a cada sesión de cada uno.</p>
        <div class="campo"><label for="eq-hito-texto">Unas palabras (opcional)</label>
          <textarea id="eq-hito-texto" class="area" rows={2} maxLength={300} placeholder="¿Qué le dirías al equipo?" value={texto} onInput={(e) => setTexto(e.currentTarget.value)} /></div>
        <button class="btn btn-primario btn-grande" disabled={ocupado}><Icono n="equipo" /> {ocupado ? 'Compartiendo…' : 'Compartir en el muro'}</button>
        <button type="button" class="btn" onClick={cerrar}>Ahora no</button>
      </form>
    </Hoja>
  );
}

// ---------------------------------------------------------------- 4. Reacciones y pegatinas
// Las reacciones de una publicación: las tres de siempre a la vista, las nuevas si alguien las ha puesto (o son mías) y, con la
// 045, «Más reacciones» para ver las seis
export function ReaccionesPost({ post, con045 = false, ocupado = false, alReaccionar }) {
  const [todas, setTodas] = useState(false);
  const lista = (con045 ? REACCIONES_TODAS : REACCIONES).filter(([k], i) => i < 3 || todas || (post.reacciones[k] || []).length || post.miReaccion === k);
  const quedan = con045 && REACCIONES_TODAS.some(([k]) => !lista.some(([j]) => j === k));
  return (
    <div class="reacciones" role="group" aria-label="Reacciones">
      {lista.map(([k, emoji, nombre]) => {
        const l = post.reacciones[k] || [];
        return (
          <button key={k} type="button" class="reaccion" aria-pressed={post.miReaccion === k ? 'true' : 'false'} disabled={ocupado}
            aria-label={`${nombre}: ${l.length}${l.length ? ` (${l.join(', ')})` : ''}`} onClick={() => alReaccionar(k)}>
            <span aria-hidden="true">{emoji}</span>{l.length > 0 && <span class="num" aria-hidden="true">{l.length}</span>}
          </button>
        );
      })}
      {(quedan || todas) && con045 && (
        <button type="button" class="reaccion reaccion-mas" aria-expanded={todas ? 'true' : 'false'} aria-label={todas ? 'Menos reacciones' : 'Más reacciones'} onClick={() => setTodas(!todas)}>
          <Icono n={todas ? 'menos' : 'mas'} />
        </button>
      )}
    </div>
  );
}

// Las pegatinas de FBE, dibujadas aquí (SVG en línea, originales): un disco o una forma con su texto. Los colores son de papel
// (iguales en claro y oscuro) y el texto, blanco sobre color o tinta oscura sobre amarillo
// (tam: el tamaño de la letra; ancho: lo que ocupa como mucho, para que no se salga de su forma)
const DIBUJOS = {
  pr: { fondo: '#F2C230', tinta: '#1B1730', forma: 'estrella', linea: 'PR', tam: 26, sub: 'récord', tamSub: 11 },
  a_tope: { fondo: '#F0495C', tinta: '#FFFFFF', forma: 'rayo', linea: 'A TOPE', tam: 17, ancho: 72 },
  semana_completa: { fondo: '#3DC27B', tinta: '#0F2A1C', forma: 'semana', linea: 'SEMANA', tam: 16, ancho: 70, sub: 'completa', tamSub: 12 },
  constancia: { fondo: '#5438D8', tinta: '#FFFFFF', forma: 'llama', linea: 'CONSTANCIA', tam: 13, ancho: 76 },
  vamos: { fondo: '#5B8FF2', tinta: '#FFFFFF', forma: 'explosion', linea: '¡VAMOS!', tam: 14, ancho: 54 },
  dia_pierna: { fondo: '#1B1730', tinta: '#FFFFFF', forma: 'barra', linea: 'DÍA DE', tam: 15, ancho: 62, sub: 'PIERNA', tamSub: 15, anchoSub: 62 },
};
const LETRA_PEGATINA = "'Archivo Variable', Archivo, system-ui, sans-serif";
function FormaPegatina({ forma, d }) {
  if (forma === 'estrella') {
    const pts = Array.from({ length: 16 }, (_, i) => { const r = i % 2 ? 36 : 46, a = (Math.PI * 2 * i) / 16 - Math.PI / 2; return `${50 + r * Math.cos(a)},${50 + r * Math.sin(a)}`; }).join(' ');
    return <polygon points={pts} fill={d.fondo} stroke="#fff" stroke-width="4" stroke-linejoin="round" />;
  }
  if (forma === 'explosion') {
    const pts = Array.from({ length: 22 }, (_, i) => { const r = i % 2 ? 34 : 47, a = (Math.PI * 2 * i) / 22; return `${50 + r * Math.cos(a)},${50 + r * Math.sin(a)}`; }).join(' ');
    return <polygon points={pts} fill={d.fondo} stroke="#fff" stroke-width="4" stroke-linejoin="round" />;
  }
  return <rect x="5" y="17" width="90" height="66" rx="20" fill={d.fondo} stroke="#fff" stroke-width="4" />;
}
function AdornoPegatina({ forma, d }) {
  const c = d.tinta;
  if (forma === 'rayo') return <path d="M54 22 L38 50 H50 L44 72 L64 42 H52 Z" fill="#FFC94D" opacity=".95" transform="translate(28 -6) scale(.55)" />;
  if (forma === 'llama') return <path d="M50 20 C58 32 66 38 62 52 C60 60 54 64 50 64 C44 64 38 58 38 50 C38 42 46 38 46 30 C48 34 50 36 52 38 C54 32 52 26 50 20 Z" fill="#FF8A3D" transform="translate(30 -4) scale(.6)" />;
  if (forma === 'semana') return <g>{Array.from({ length: 7 }, (_, i) => <circle key={i} cx={23 + i * 9} cy="27" r="3.2" fill={c} opacity=".85" />)}</g>;
  if (forma === 'barra') return <g fill="#F2C230"><rect x="22" y="25" width="56" height="3" rx="1.5" /><rect x="26" y="19" width="6" height="15" rx="2" /><rect x="68" y="19" width="6" height="15" rx="2" /></g>;
  return null;
}
export function Pegatina({ k, clase = '' }) {
  const d = DIBUJOS[k];
  const texto = textoPegatina(k);
  if (!d) return null;
  return (
    <svg class={`pegatina ${clase}`} viewBox="0 0 100 100" role="img" aria-label={`Pegatina: ${texto}`}>
      <FormaPegatina forma={d.forma} d={d} />
      <AdornoPegatina forma={d.forma} d={d} />
      <text x="50" y={d.sub ? 56 : 60} text-anchor="middle" font-family={LETRA_PEGATINA} font-weight="900" font-size={d.tam} fill={d.tinta} aria-hidden="true"
        {...(d.ancho ? { textLength: d.ancho, lengthAdjust: 'spacingAndGlyphs' } : {})}>{d.linea}</text>
      {d.sub && <text x="50" y="72" text-anchor="middle" font-family={LETRA_PEGATINA} font-weight="800" font-size={d.tamSub} fill={d.tinta} aria-hidden="true"
        {...(d.anchoSub ? { textLength: d.anchoSub, lengthAdjust: 'spacingAndGlyphs' } : {})}>{d.sub}</text>}
    </svg>
  );
}
// Elegir una pegatina para mandarla como comentario
export function ElegirPegatina({ ocupado = false, alElegir }) {
  return (
    <div class="elegir-pegatina" role="group" aria-label="Pegatinas de FBE">
      {PEGATINAS.map(([k, t]) => (
        <button key={k} type="button" class="btn-pegatina" disabled={ocupado} aria-label={`Mandar la pegatina «${t}»`} onClick={() => alElegir(k)}>
          <Pegatina k={k} />
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- 5. Momentos del día (24 h)
function FotoMomento({ ruta, alt, clase = '' }) {
  const { api } = useApp();
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let vivo = true;
    api.urlFotoComunidad(ruta).then((u) => vivo && setUrl(u)).catch(() => vivo && setError(true));
    return () => { vivo = false; };
  }, [ruta]);
  if (error || !url) return <span class={`foto-momento vacia ${clase}`} role={error ? 'img' : undefined} aria-label={error ? `${alt} (no disponible)` : undefined} />;
  return <img class={`foto-momento ${clase}`} src={url} alt={alt} />;
}

// Arriba de Equipo: «Tu momento» y los momentos de las últimas 24 horas (el tuyo primero), en círculos. silencio: no publica
export function TiraMomentos({ coach = false, silencio = null, cambios = 0 }) {
  const { api } = useApp();
  const [vuelta, setVuelta] = useState(0);
  const lista = useCarga(() => api.momentosComunidad().catch(() => null), [vuelta, cambios]);
  const [nuevo, setNuevo] = useState(false);
  const [abierto, setAbierto] = useState(null); // id
  if (!lista.datos) return null;
  const momentos = lista.datos;
  const actual = momentos.find((m) => m.id === abierto) || null;
  const recargar = () => setVuelta((v) => v + 1);
  return (
    <section class="tira-momentos" aria-labelledby="momentos-t">
      <h2 id="momentos-t" class="sr">Momentos de hoy (se ven 24 horas)</h2>
      <ul class="tm-lista">
        {!silencio && (
          <li>
            <button type="button" class="tm-item tm-nuevo" onClick={() => setNuevo(true)}>
              <span class="tm-circulo" aria-hidden="true"><Icono n="mas" /></span>
              <span class="tm-nombre">Tu momento</span>
            </button>
          </li>
        )}
        {momentos.map((m) => (
          <li key={m.id}>
            <button type="button" class={`tm-item ${m.retenida ? 'retenido' : ''}`} onClick={() => setAbierto(m.id)} aria-label={`Momento de ${m.mio ? 'ti' : m.autor.nombre}, ${cuando(m.creado_en)}${m.retenida ? ' (pendiente de revisión)' : ''}`}>
              <span class="tm-circulo" aria-hidden="true"><FotoMomento ruta={m.foto_ruta} alt="" /></span>
              <span class="tm-nombre" aria-hidden="true">{m.mio ? 'Tú' : m.autor.nombre}</span>
            </button>
          </li>
        ))}
      </ul>
      {!momentos.length && <p class="mini terciario tm-vacio">Una foto de tu día con el equipo: se ve 24 horas.</p>}
      {nuevo && <HojaNuevoMomento coach={coach} alCerrar={() => setNuevo(false)} alPublicar={() => { setNuevo(false); recargar(); }} />}
      {actual && <HojaMomento m={actual} coach={coach} alCerrar={() => setAbierto(null)} alCambiar={recargar} />}
    </section>
  );
}

function HojaNuevoMomento({ alCerrar, alPublicar }) {
  const { api, aviso } = useApp();
  const [foto, setFoto] = useState(null); // { blob, url }
  const [texto, setTexto] = useState('');
  const [ocupado, una] = useUnaVez();
  const input = useRef(null);
  const url = useRef(null);
  useEffect(() => () => { if (url.current) URL.revokeObjectURL(url.current); }, []);
  const elegir = async (e) => {
    const f = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!f) return;
    try {
      const blob = await reducirFoto(f);
      if (url.current) URL.revokeObjectURL(url.current);
      url.current = URL.createObjectURL(blob);
      setFoto({ blob, url: url.current });
    } catch (err) { aviso(err.message, 'error'); }
  };
  const l = limpiarMomento(texto);
  const publicar = (e) => {
    e.preventDefault();
    una(async () => {
      try {
        const p = await api.publicarMomento({ foto: foto.blob, texto });
        aviso(p?.retenida ? 'Tu momento está pendiente de revisión' : 'Momento publicado: se verá 24 horas');
        alPublicar();
      } catch (err) { aviso(err.message, 'error'); }
    });
  };
  return (
    <Hoja titulo="Tu momento" alCerrar={alCerrar}>
      <form class="pila nuevo-momento" onSubmit={publicar}>
        <p class="peq secundario">Una foto de tu día (el gimnasio, la ruta, el desayuno de antes de entrenar) que verá el equipo durante 24 horas. Después se borra.</p>
        <input ref={input} type="file" accept="image/*" class="sr" tabIndex={-1} aria-label="Foto del momento" onChange={elegir} />
        {foto ? (
          <div class="nm-previa">
            <img src={foto.url} alt="La foto de tu momento" />
            <button type="button" class="btn btn-peq" onClick={() => input.current?.click()}><Icono n="camara" /> Cambiar la foto</button>
          </div>
        ) : <button type="button" class="btn btn-grande" onClick={() => input.current?.click()}><Icono n="camara" /> Elegir una foto</button>}
        <div class="campo">
          <label for="eq-momento-texto">Una línea (opcional)</label>
          <input id="eq-momento-texto" class="entrada" maxLength={MAX_MOMENTO + 20} value={texto} placeholder="¿Qué está pasando?" onInput={(e) => setTexto(e.currentTarget.value)} aria-describedby="eq-momento-norma" />
          <span class="ayuda" aria-live="polite">{l.error || `${MAX_MOMENTO - [...String(l.texto || '')].length} letras más como mucho`}</span>
        </div>
        <p class="mini nm-norma" id="eq-momento-norma"><Icono n="escudo" /> {NORMA_MOMENTO}</p>
        <button class="btn btn-primario btn-grande" disabled={ocupado || !foto || !!l.error}>{ocupado ? 'Publicando…' : 'Publicar momento'}</button>
      </form>
    </Hoja>
  );
}

function HojaMomento({ m, coach, alCerrar, alCambiar }) {
  const { api, aviso } = useApp();
  const [ocupado, una] = useUnaVez();
  const [avisar, setAvisar] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [borrar, setBorrar] = useState(false);
  const hacer = (fn, texto, cerrar = false) => una(async () => {
    try { await fn(); if (texto) aviso(texto); alCambiar(); if (cerrar) alCerrar(); } catch (e) { aviso(e.message, 'error'); }
  });
  const quien = m.mio ? 'ti' : m.autor.nombre;
  return (
    <Hoja titulo={`Momento de ${quien}`} alCerrar={alCerrar}>
      <div class="pila ver-momento">
        <FotoMomento ruta={m.foto_ruta} alt={`Foto del momento de ${quien}${m.texto ? `: ${m.texto}` : ''}`} clase="vm-foto" />
        {m.texto && <p class="post-texto">{m.texto}</p>}
        <p class="mini terciario">{cuando(m.creado_en)} · {textoQueda(m)}</p>
        {m.retenida && <p class="nota peq retenida-linea" role="status">{coach ? 'Pendiente de revisión (lleva una palabra filtrada): los atletas no lo ven.' : 'Tu momento está pendiente de revisión: lo verá el equipo cuando tu coach lo apruebe.'}</p>}
        <ReaccionesPost post={m} con045 ocupado={ocupado} alReaccionar={(k) => hacer(() => api.reaccionar(m.id, k))} />
        <p class="mini terciario">Los momentos no llevan comentarios: reacciona.</p>
        {avisar ? (
          <form class="pila-s" onSubmit={(e) => { e.preventDefault(); hacer(() => api.avisarAlCoach({ postId: m.id, motivo }), 'Hecho: tu coach lo mirará', true); }}>
            <div class="campo"><label for="eq-momento-motivo">Por qué (si quieres)</label>
              <textarea id="eq-momento-motivo" class="area" rows={2} maxLength={300} value={motivo} onInput={(e) => setMotivo(e.currentTarget.value)} /></div>
            <button class="btn btn-primario" disabled={ocupado}><Icono n="bandera" /> Avisar al coach</button>
          </form>
        ) : borrar ? (
          <div class="fila-envolver">
            <span class="peq">¿Borrar este momento?</span>
            <button type="button" class="btn btn-peq" onClick={() => setBorrar(false)}>Cancelar</button>
            <button type="button" class="btn btn-peq btn-peligro" disabled={ocupado} onClick={() => hacer(() => api.borrarDeComunidad(m), 'Momento borrado', true)}><Icono n="basura" /> Sí, borrar</button>
          </div>
        ) : (
          <div class="fila-envolver">
            {coach && m.retenida && <button type="button" class="btn btn-peq btn-primario" disabled={ocupado} onClick={() => hacer(() => api.aprobarComunidad({ postId: m.id }), 'Aprobado: ya se ve')}><Icono n="hecho" /> Aprobar</button>}
            {coach && !m.mio && <button type="button" class="btn btn-peq" disabled={ocupado} onClick={() => hacer(() => api.ocultarEnComunidad(m.id, true), 'Oculto para los atletas', true)}><Icono n="ojo" /> Ocultarlo</button>}
            {!coach && !m.mio && !m.autor.coach && <button type="button" class="btn btn-peq" onClick={() => setAvisar(true)}><Icono n="bandera" /> Avisar al coach</button>}
            {(coach || m.mio) && <button type="button" class="btn btn-peq btn-peligro" onClick={() => setBorrar(true)}><Icono n="basura" /> Borrar</button>}
          </div>
        )}
      </div>
    </Hoja>
  );
}

