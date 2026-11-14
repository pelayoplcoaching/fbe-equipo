import { useEffect, useRef, useState } from 'preact/hooks';
import { Icono, Capa, useApp } from '../comunes.jsx';
import { vibrar } from '../hapticos.js';
import { sinMovimiento } from '../transiciones.js';
import { nuevaEtapa, avanzar, saltar, agachar, pulsar, resultado, textoDistancia, ambiente, retoDelDia, progresoReto, hoyDe, rachaSemanas, semillaDelDia, marcasDelCamino, ETAPA_DIA } from '../../logica/travesia.js';
import { cartelDeHito, nombrePaisaje, suave, calidad, CALIDAD_INICIAL, cuentaVuelta, VUELTA, pitidos, PASO, fechaEspecial, NOMBRE_FECHA, apuntarRastro, enRastro, notaEscala, ESCALA_PAUSA, GOLPE, hayGolpe } from '../../logica/travesia-efectos.js';
import { crearSonido } from './travesia-sonido.js';
import { loboElegido, lobosDe, constelaciones, postalesNuevas, manadaPropia, correnHoy, duelo, proximoSitio } from '../../logica/travesia-ruta.js';
import { hoyISO, lunesDe } from '../../logica/fechas.js';
import { leerAjustes, guardarAjustes } from '../ajustes.js';
import { compartirArchivo, conFranja, crearGrabadora, extensionDe } from './travesia-compartir.js';
import { tono as tonoApp, prepararAudio } from './sesion-comun.jsx';
// (sonido, tanda 1) los tonos del juego, con el volumen de su apartado
const tono = (f, d, v) => tonoApp(f, d, v, 'juego');
import { apuntarEtapa, leerTravesia, sincronizarTravesia, manadaDe, manadaGuardada, leerDuelo, leerMeta, apuntarMeta, sincronizarMeta, empezarDia, cerrarDia, aullidosNuevos, equipoDe } from '../travesia.js';
import { adornosPuestos, mediaEtapa, selloDe } from '../../logica/travesia-meta.js';
import { crearMusica } from './travesia-musica.js';
import { nuevoPaisaje, pintar, acentoTravesia } from './travesia-pinta.js';
import { acentoDe } from '../../logica/acentos.js';

// «La travesía»: el juego del descanso, a pantalla completa. Un toque en cualquier sitio, salta; otro en el aire, doble
// salto. La etapa dura lo que queda de descanso (`fin`, el mismo final que lleva el temporizador: si se le suma o se le
// quita tiempo, o se pausa, el juego va con él) y al acabar se cierra sola: manda el descanso, no el juego.
//   · Con `sesion`, los metros se suman a la travesía de esa sesión. Sin ella (`practica`), es una carrera de un minuto
//     que no cuenta: solo guarda su mejor marca.
//   · alCerrar(motivo): 'fin' (se acabó el tiempo) o 'salir' (la cerró a mano).
const PRACTICA = 60;
const mmss = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;

// (dentro de su capa, en <body>: cuando corren sus efectos el lienzo ya existe, y ningún antepasado con transform la encierra)
// (tanda 5) La distancia de la tarjeta final sube rodando hasta su número (0,7 s; con «reducir movimiento», de golpe)
function Rueda({ valor }) {
  const [v, setV] = useState(() => (sinMovimiento() ? valor : Math.round(valor * 0.6)));
  useEffect(() => {
    if (sinMovimiento() || typeof requestAnimationFrame !== 'function') { setV(valor); return undefined; }
    let id = 0; const t0 = performance.now(), desde = Math.round(valor * 0.6);
    const paso = (ahora) => {
      const k = suave((ahora - t0) / 700);
      setV(Math.round(desde + (valor - desde) * k));
      if (k < 1) id = requestAnimationFrame(paso);
    };
    id = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(id);
  }, [valor]);
  return textoDistancia(v);
}
// (jugo, tanda 11) La cuenta del final: las estrellas de la etapa pasan una a una (con su nota, si hay sonido)
function CuentaEstrellas({ valor, suena }) {
  const [v, setV] = useState(() => (sinMovimiento() ? valor : 0));
  useEffect(() => {
    if (sinMovimiento() || valor <= 0) { setV(valor); return undefined; }
    const pasos = Math.min(valor, 24), cada = Math.max(35, Math.min(90, 1100 / pasos));
    let i = 0;
    const id = setInterval(() => {
      i += 1; setV(Math.round((valor * i) / pasos));
      if (suena) tono(notaEscala(Math.min(10, Math.floor((i * 11) / pasos))), 0.04, 0.08);
      if (i >= pasos) clearInterval(id);
    }, cada);
    return () => clearInterval(id);
  }, [valor]);
  return <span class={`num${v === valor ? ' tv-cuenta-hecha' : ''}`}>{v}</span>;
}

export function Travesia(props) { return <Capa><TravesiaDentro {...props} /></Capa>; }
// (al integrarla) lo que queda de descanso ya en el primer pintado (antes, 0:00 hasta el primer cuadro de la animación)
const cuentaInicial = (fin, pausa) => Math.max(0, Math.ceil(Number.isFinite(pausa) ? pausa / 1000 : Number.isFinite(fin) ? (fin - Date.now()) / 1000 : 0));

// (tanda 1) el tiempo que la app ya tiene guardado para esta hora (si el atleta usa «El tiempo para salir»): { codigo, esDia }
function tiempoGuardado() {
  try {
    const c = JSON.parse(localStorage.getItem('fbe-tiempo-cache') || 'null');
    const horas = c?.prev?.horas;
    if (!Array.isArray(horas) || Date.now() - (c.en || 0) > 3 * 3600000) return {};
    const ahora = new Date(Date.now() + (c.prev.offset || 0) * 1000).toISOString().slice(0, 13);
    const h = horas.find((x) => String(x.hora).slice(0, 13) === ahora);
    return h ? { codigo: h.codigo, esDia: typeof h.dia === 'boolean' ? h.dia : null } : {};
  } catch { return {}; }
}
// (tanda 1) los sonidos del juego (apagados de entrada): un toque al saltar, uno agudo en cada estrella y el aullido al acabar
const SONIDOS = { limpio: [740, 0.05, 0.09], constelacion: [1760, 0.32, 0.14], salto: [520, 0.05, 0.1], doble: [660, 0.05, 0.1], estrella: [1180, 0.06, 0.12], tropiezo: [150, 0.14, 0.16], escudo: [880, 0.1, 0.14], rio: [784, 0.12, 0.14], dorada: [1568, 0.25, 0.14], alcanzado: [196, 0.2, 0.16], escapado: [1046, 0.2, 0.14], roce: [988, 0.09, 0.13], combo: [1320, 0.1, 0.12], cabeza: [220, 0.08, 0.14], 'pot-iman': [1046, 0.14, 0.14], 'pot-luna': [698, 0.2, 0.14], 'pot-aullido': [440, 0.3, 0.16] };
// (top, tanda 3) El modo foto: la escena del final, con una franja abajo (los metros y el nombre del juego; ningún nombre
// de persona), como imagen para compartir o guardar
async function fotoDeEtapa(lienzo, metros) {
  return compartirArchivo(await conFranja(lienzo, `La travesía · ${textoDistancia(metros)}`), 'la-travesia.png');
}
// (remate, tanda 5) la vibración de cada cosa del juego (ui/hapticos.js)
const VIBRA = { limpio: 'tv-salto', constelacion: 'tv-combo', salto: 'tv-salto', doble: 'tv-doble', roce: 'tv-roce', estrella: 'tv-estrella', combo: 'tv-combo', tropiezo: 'tv-tropiezo' };
// (top, tanda 2) el cartel de cada momento raro, cuando asoma
const MOMENTO = { estampida: '¡Estampida!', tormenta: 'Se acerca la tormenta', puente: 'El puente colgante', ventisca: '¡Viene la ventisca!', lluvia: '¡Lluvia de estrellas!' };
// (remate, tanda 6) lo que dice el cartel con cada cosa nueva
const CARTEL = { ventisca: '¡La ventisca te persigue!', alcanzado: 'Te ha alcanzado: −3 estrellas', escapado: '¡Escapaste de la ventisca!', dorada: '¡Estrella dorada! +10' };
const aullar = () => { [[392, 0], [523, 260], [494, 620]].forEach(([f, ms]) => setTimeout(() => tono(f, ms ? 0.5 : 0.28, 0.16), ms)); };

// (top, tanda 4) delDia: «la etapa del día» (un minuto, el mismo terreno para todos, tres intentos; no cuenta para la travesía)
function TravesiaDentro({ atletaId, sesion = null, fin = null, pausa = null, total = null, despues = '', practica: practicaProp = false, delDia = false, empuje = null, alCerrar }) {
  const practica = practicaProp || delDia;
  const { api } = useApp() || {};
  const lienzo = useRef(null);
  const caja = useRef(null);
  const etapa = useRef(null);
  const paisaje = useRef(null);
  const marca = useRef({ fin, pausa });
  marca.current = { fin, pausa };
  const [ronda, setRonda] = useState(0);            // (práctica) otra carrera; (calma) al cambiar de modo
  const finPractica = useRef(0);
  // (remate, tanda 7) el clip de la etapa: { blob, motivo } si se ha grabado algo especial
  const [clip, setClip] = useState(null);
  const [clipTxt, setClipTxt] = useState('');
  const grabadora = useRef(null);
  const [final, setFinal] = useState(null);         // { metros, estrellas, hoy, mejor, marca, reto } al acabar la etapa
  const [tocado, setTocado] = useState(false);      // ya ha saltado una vez: fuera la pista
  const metros = useRef(null), cuenta = useRef(null), estrellas = useRef(null), retoTxt = useRef(null), cartel = useRef(null), comboTxt = useRef(null);
  // (jugo, tanda 11) la barra hacia el siguiente sitio de la ruta
  const rutaBarra = useRef(null), rutaTxt = useRef(null);
  const [sitio, setSitio] = useState(null);
  // (remate, tanda 5) la cuenta de la vuelta, el «prepárate» y el sonido del juego
  const vueltaTxt = useRef(null), preparaTxt = useRef(null), sonidoRef = useRef(null);
  // (top, tanda 1: accesibilidad) lo que el atleta ha elegido en «Tu travesía» → «Cómo juegas»
  const accesible = useRef(null);
  if (!accesible.current) { const a = leerAjustes(); accesible.current = { unToque: a.juegoUnToque === true, contraste: a.juegoContraste === true, temblor: a.juegoSinTemblor !== true, sonar: a.juegoSonar === true }; }
  // (travesia-bella) al cerrarse, la noche se va en un instante (y entonces avisa); con «reducir movimiento», al momento
  const yendose = useRef(false);
  const irse = (motivo) => {
    if (sinMovimiento() || !caja.current) { alCerrar?.(motivo); return; }
    if (yendose.current) return;
    yendose.current = true;
    caja.current.classList.add('se-va');
    setTimeout(() => alCerrar?.(motivo), 170);
  };
  const cerrar = useRef(irse);
  cerrar.current = irse;
  // (tanda 1) el modo calma (sin obstáculos, al paso) y el sonido, que se recuerdan en el móvil
  const [calma, setCalma] = useState(() => leerAjustes().calmaJuego === true);
  const [sonido, setSonido] = useState(() => leerAjustes().sonidoJuego === true);
  const suena = useRef(sonido);
  suena.current = sonido;
  // (top, tanda 3) la música (apagada de entrada, como el sonido) y los adornos que lleva su lobo según su rango
  const [musica, setMusica] = useState(() => leerAjustes().musicaJuego === true);
  const banda = useRef(null);
  const adornos = useRef(null);
  if (!adornos.current) adornos.current = adornosPuestos(leerMeta(atletaId).rango, leerAjustes().adornosJuego);
  const [foto, setFoto] = useState('');
  const [escudos, setEscudos] = useState(0);
  const guardado0 = useRef(null);
  if (!guardado0.current) guardado0.current = leerTravesia(atletaId);
  const conMovimientos = guardado0.current.total >= 1000;   // las ramas, cuando ya lleva un kilómetro (primero se aprende a saltar)
  // (top, tanda 2) el primer kilómetro que enseña: en las primeras etapas de quien empieza, los primeros obstáculos llevan su letrero
  const ensenando = !practica && !!sesion && guardado0.current.total < 300;
  const reto = !practica && sesion ? retoDelDia(hoyISO()) : null;
  // (tanda 3) la manada: quién más ha corrido hoy (sus siluetas van a lo lejos) y, si hay duelo esta semana, cómo va
  const [manada, setManada] = useState(() => (practica ? null : manadaGuardada(atletaId)));
  const corren = useRef(0);
  corren.current = manada ? correnHoy(manada.filas).length : 0;
  // (top, tanda 4) los aullidos de los compañeros que aún no ha visto: salen al empezar
  const [aullidos, setAullidos] = useState([]);
  useEffect(() => {
    if (practica || !sesion) return undefined;
    let vivo = true;
    manadaDe(api, atletaId).then((m) => { if (vivo) setManada(m); });
    api?.aullidosRecibidos?.().then((l) => { if (vivo) setAullidos([...new Set(aullidosNuevos(atletaId, l).map((x) => x.nombre))]); }).catch(() => {});
    return () => { vivo = false; };
  }, []);
  useEffect(() => { if (!aullidos.length) return undefined; const t = setTimeout(() => setAullidos([]), 6000); return () => clearTimeout(t); }, [aullidos.length]);
  const leerDiaHoy = useRef(0);
  const marcasRef = useRef([]);
  marcasRef.current = !practica && sesion ? marcasDelCamino(manada?.filas, guardado0.current.mejor) : [];
  // Cerrada a mano en mitad de un descanso: lo corrido hasta ahí cuenta (si ha llegado a algo); la práctica a medias, no
  const apuntada = useRef(false);
  const apuntar = (e) => {
    const r = resultado(e);
    const g = apuntarEtapa(atletaId, { sesion: practica ? null : sesion, metros: r.metros, estrellas: r.estrellas, segundos: r.segundos, tropiezos: r.tropiezos, rios: r.rios, calma: r.calma, dia: hoyISO() });
    if (!practica && sesion) sincronizarTravesia(api, atletaId);   // (060) a la base; si no se puede, se queda pendiente
    return { r, g };
  };
  const salir = () => {
    const e = etapa.current;
    if (!practica && sesion && e && !apuntada.current && e.x >= 20) { apuntada.current = true; apuntar(e); }
    irse('salir');
  };

  useEffect(() => {
    const semilla = delDia ? semillaDelDia(hoyISO()) : (Date.now() ^ (Math.random() * 1e9)) >>> 0;
    if (delDia) leerDiaHoy.current = empezarDia(atletaId, hoyISO()).mejor;   // (el intento cuenta al empezar)
    // (remate, tanda 8) en la etapa del día: su rastro (para el fantasma de los demás) y el lobo de un compañero
    const rastro = [];
    let amigo = null, vivoAmigo = true;
    if (delDia) api?.fantasmaDelDia?.().then((f) => { if (vivoAmigo && f?.rastro?.length) amigo = f; }).catch?.(() => {});
    const antesG = leerTravesia(atletaId);
    const quedanIni = practica ? PRACTICA : cuentaInicial(marca.current.fin, marca.current.pausa);
    // (tanda 1) el entreno empuja: tras un récord sale con el ritmo cogido; con la serie cumplida, un escudo. En un descanso
    // corto (45 s o menos) sale ya lanzado: no da tiempo a coger ritmo
    // (remate, tanda 6) la etapa dorada (tras un récord en la serie) y las fechas especiales (la luna llena: estrellas dobles)
    const amb0 = ambiente({ ...tiempoGuardado(), total: antesG.total });
    const especial = fechaEspecial(hoyISO(), amb0.luna, amb0.fase), dorada = !practica && !!empuje?.ritmo;
    const e = nuevaEtapa(semilla, {
      estrellasPor: dorada || especial === 'lunallena' ? 2 : 1,
      calma, movimientos: conMovimientos && !practica, km0: practica ? 0 : antesG.total, unToque: accesible.current.unToque,
      variedad: true, tutorial: ensenando && !calma, fija: delDia,
      racha0: practica ? 0 : empuje?.ritmo ? 10 : quedanIni <= 45 ? 6 : 0,
      escudos: practica ? 0 : empuje?.escudo ? 1 : 0,
    });
    etapa.current = e; apuntada.current = false;
    setEscudos(e.escudos);
    { const ac = acentoDe(leerAjustes().acento); acentoTravesia(ac.claro.morado, ac.oscuro.morado); }   // (color) el acento llega al juego
    paisaje.current = nuevoPaisaje(semilla % 1000);
    const pasadas = new Set();   // (top, tanda 4) las marcas del camino que ya ha pasado
    setFinal(null); setClip(null); setClipTxt('');
    if (practica) finPractica.current = Date.now() + PRACTICA * 1000;
    const amb = ambiente({ ...tiempoGuardado(), total: antesG.total });
    // (jugo, tanda 11) el próximo sitio de la ruta (su silueta, su cartel y la barra de arriba) y su media (para el sello)
    const prox = !practica && sesion ? proximoSitio(antesG.total, leerMeta(atletaId).rutas) : null;
    setSitio(prox);
    const media = !practica && sesion ? mediaEtapa(antesG, sesion) : null;
    let puebloDicho = false, rutaVisto = -1;
    // (remate, tanda 8) el día de la fiesta de la manada, aurora para todos (si llega a tiempo)
    equipoDe(api, atletaId).then((q2) => { if (q2?.fiesta?.dia === hoyISO()) amb.fiesta = true; }).catch(() => {});
    const ritmo = !calma && antesG.ritmo > 0 ? antesG.ritmo / 100 : 0;   // su fantasma
    const hoy0 = hoyDe(antesG, hoyISO());
    // (tanda 3) su lobo, los que le siguen (uno por semana seguida) y las constelaciones que lleva: la última completa y la que forma
    const skin = loboElegido(antesG, leerAjustes().loboJuego);
    const seguidores = practica ? 0 : manadaPropia(rachaSemanas(antesG, hoyISO()));
    const todas = constelaciones(antesG.estrellas), completas = todas.filter((k) => k.completa);
    const cielo = [completas[completas.length - 1], todas.find((k) => !k.completa && k.cogidas > 0)].filter(Boolean);
    const c = lienzo.current, ctx = c.getContext('2d');
    const quieto = sinMovimiento();
    grabadora.current = crearGrabadora(c, { alTener: (k) => setClip(k) });
    let w = 0, h = 0, id = 0, antes = performance.now(), acabada = false, visto = { m: -1, s: -1, e: -1, r: '', esc: e.escudos };
    // (tanda 5) dónde está el marcador de estrellas (allí vuelan las que coge) y los carteles de hito
    let metaE = null, relojE = null, hito = { metros: 0, racha: e.racha, combo: 1 };
    // (top, tanda 1) la calidad, a tres niveles: si el móvil va justo, se pinta sin lo más caro y, si aún va justo, sin adornos
    let cal = CALIDAD_INICIAL(), comboVisto = 1;
    const anunciar = (texto, grande = false) => {
      const el = cartel.current;
      if (!el || typeof el.animate !== 'function') return;
      el.textContent = texto; el.classList.toggle('grande', !!grande);
      el.getAnimations?.().forEach((a) => a.cancel());
      // (se ve mientras dura su animación; el texto no entra ni sale por opacidad: con movimiento, sube y crece; sin él, está y ya)
      el.animate(quieto
        ? [{ visibility: 'visible' }, { visibility: 'visible' }]
        : [{ visibility: 'visible', transform: 'translateY(14px) scale(.7)' }, { visibility: 'visible', transform: 'none', offset: 0.14 }, { visibility: 'visible', transform: 'none', offset: 0.78 }, { visibility: 'visible', transform: 'translateY(-10px) scale(.85)' }],
      { duration: 2200, easing: 'ease-out' });
    };
    // (el nombre del paisaje, al entrar; y después, si lo hay, lo especial de hoy: la etapa dorada o la fecha)
    const loEspecial = dorada ? 'Etapa dorada: tu récord vale doble' : especial ? NOMBRE_FECHA[especial] : '';
    let alEmpezar = setTimeout(() => { anunciar(nombrePaisaje(amb.paisaje)); if (loEspecial) alEmpezar = setTimeout(() => anunciar(loEspecial, true), 1900); }, 700);
    const medir = () => {
      const r = c.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
      w = Math.max(1, r.width); h = Math.max(1, r.height);
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const er = estrellas.current?.parentElement?.getBoundingClientRect();
      metaE = er ? { x: er.left + er.width / 2 - r.left, y: er.top + er.height / 2 - r.top } : null;
      // (travesia-bella) dónde está la cuenta del descanso: en los diez últimos segundos, un marco a su alrededor
      const cr = cuenta.current?.parentElement?.getBoundingClientRect();
      relojE = cr ? { x: cr.left + cr.width / 2 - r.left, y: cr.top + cr.height / 2 - r.top, w: cr.width, h: cr.height } : null;
    };
    medir();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null;
    ro?.observe(c);
    const quedan = () => {
      const m = marca.current;
      if (practica) return (finPractica.current - Date.now()) / 1000;
      return Number.isFinite(m.pausa) ? m.pausa / 1000 : (m.fin - Date.now()) / 1000;
    };
    const acabar = () => {
      acabada = true; apuntada.current = true;
      grabadora.current?.cerrar();
      if (preparaTxt.current) preparaTxt.current.hidden = true;
      if (!practica) vibrar('tv-meta');
      // (top, tanda 4) la etapa del día no cuenta para la travesía ni para la práctica: sus intentos, en el móvil y en la base
      if (delDia) {
        const r = resultado(e), antes = leerDiaHoy.current, d = cerrarDia(atletaId, hoyISO(), r.metros);
        vibrar('hecho', { sonido: false }); if (suena.current) aullar();
        setFinal({ ...r, delDia: true, mejorDia: d.mejor, quedan: Math.max(0, ETAPA_DIA.intentos - d.intentos), marca: antes > 0 && r.metros > antes });
        api?.etapaDelDia?.(r.metros, r.estrellas, rastro).catch?.(() => {});
        return;
      }
      const { r, g } = apuntar(e);
      // (top, tanda 3) las misiones, el rango y los logros (solo las etapas de una sesión)
      const mt = !practica && sesion ? apuntarMeta(atletaId, r, g, { fase: amb.fase, paisaje: amb.paisaje, dia: hoyISO(), dorada, fecha: especial }) : null;
      if (mt) sincronizarMeta(api, atletaId).catch?.(() => {});   // (062: a la base; si no se puede, se queda en el móvil)
      vibrar('hecho', { sonido: false });
      if (suena.current) aullar();
      setFinal({ ...r, hoy: !practica && sesion ? g.sesiones[sesion]?.metros ?? r.metros : null, etapas: !practica && sesion ? g.sesiones[sesion]?.etapas ?? 1 : null,
        marca: practica ? r.metros > antesG.practica && antesG.practica > 0 : !r.calma && r.metros > antesG.mejor && antesG.mejor > 0, mejor: practica ? g.practica : g.mejor,
        reto: !practica && sesion && g.hoy.retoHecho && !hoy0.retoHecho,
        // (tanda 3) lo que trae esta etapa: un hito del mapa (su postal), un lobo nuevo o una constelación completa
        postal: !practica && sesion ? postalesNuevas(antesG.total, g.total, leerMeta(atletaId).rutas)[0] || null : null,
        lobo: !practica && sesion ? lobosDe(g).find((l) => l.tiene && !lobosDe(antesG).find((x) => x.id === l.id)?.tiene) || null : null,
        constelacion: !practica && sesion ? constelaciones(g.estrellas).find((k, i) => k.completa && !todas[i].completa) || null : null,
        semana: g.semanas?.[lunesDe(hoyISO())] || 0,
        // (jugo, tanda 11) el sello de la etapa, frente a su propia media
        sello: media ? selloDe(r.metros, media) : null,
        cumplidas: mt?.cumplidas || [], rango: mt?.subeRango || null, adorno: mt?.adorno || null, logros: mt?.logros || [] });
    };
    // (remate, tanda 5) la vuelta suave (al volver de una pausa o a la app, 3, 2, 1 antes de seguir), las pisadas, el
    // «prepárate» de los cinco últimos segundos y el ahorro de batería (con la batería baja, la mitad de cuadros)
    let enPausa = false, vuelta = null, pisada = 0, preparado = false, ahorro = false, saltaCuadro = false;
    // (jugo, tanda 9) el golpe del momento (el juego se para un instante) y la escala de las estrellas seguidas
    let congela = 0, escala = 0, tEscala = -9;
    navigator.getBattery?.().then((b) => { const mira = () => { ahorro = !b.charging && b.level <= 0.2; }; mira(); b.addEventListener?.('levelchange', mira); b.addEventListener?.('chargingchange', mira); }).catch(() => {});
    const cuadro = (ahora) => {
      id = requestAnimationFrame(cuadro);
      if (ahorro && (saltaCuadro = !saltaCuadro)) return;   // (la mitad de cuadros; el tiempo se acumula en el siguiente)
      const dt = Math.min(0.1, (ahora - antes) / 1000);
      cal = calidad(cal, ahora - antes, document.visibilityState !== 'hidden');
      antes = ahora;
      const q = quedan();
      const pausado = (!practica && Number.isFinite(marca.current.pausa)) || document.visibilityState === 'hidden';
      if (pausado) enPausa = true;
      else if (enPausa) { enPausa = false; if (e.x > 5 && !quieto) vuelta = ahora; }
      const n = vuelta == null ? 0 : cuentaVuelta((ahora - vuelta) / 1000);
      if (n === 0) vuelta = null;
      if (vueltaTxt.current && vueltaTxt.current.textContent !== (n ? String(n) : '')) { vueltaTxt.current.textContent = n ? String(n) : ''; vueltaTxt.current.hidden = !n; }
      const parado = acabada || pausado || n > 0;
      if (!acabada && !pausado && q <= 0) acabar();
      else if (!parado) { if (congela > 0) congela -= dt; else avanzar(e, dt); }
      // (el sonido de verdad: cada cosa con su sonido, las pisadas según lo que pisa y el viento con la velocidad)
      const sn = sonidoRef.current;
      if (suena.current) for (const s of e.sucesos) {
        let son = SONIDOS[s];
        // (jugo, tanda 9) cada estrella seguida, una nota más aguda
        if (s === 'estrella') { if (e.t - tEscala > ESCALA_PAUSA) escala = 0; son = [notaEscala(escala), 0.06, 0.12]; escala += 1; tEscala = e.t; }
        if (s === 'tropiezo') escala = 0;
        if (son) { if (sn) sn.efecto(son); else tono(...son); }
      }
      if (sn && !parado) {
        if (e.saltos === 0 && !e.calma && e.x - pisada >= PASO) { pisada = e.x; sn.paso(e.sobre ? 'madera' : amb.paisaje === 2 ? 'nieve' : 'hierba'); }
        sn.viento(e.saltos ? e.v + 1.5 : e.v);
        if (accesible.current.sonar) for (const pt of pitidos(e.obstaculos, e.x, e.v)) sn.aviso(pt.tipo, pt.cerca);
      } else if (sn) sn.viento(0);
      const pasaron = e.sucesos.slice();   // (lo de este cuadro: pintar() lo vacía)
      if (!quieto && !parado && hayGolpe(pasaron)) congela = GOLPE.dura;
      if (delDia && !acabada) apuntarRastro(rastro, e.t, e.x, e.y);
      const amigoE = amigo ? { ...enRastro(amigo.rastro, e.t), nombre: amigo.nombre } : null;
      if (amigo && !amigo.dicho && e.t > 3.2 && !parado) { amigo.dicho = true; anunciar(`Hoy corres con el lobo de ${amigo.nombre}`); }
      // (las vibraciones: un patrón para cada cosa)
      for (const s of e.sucesos) { const v = VIBRA[s]; if (v) vibrar(v); }
      // (los cinco últimos segundos: «prepárate» con lo que toca después, y su vibración)
      if (!practica && !preparado && q <= 5 && q > 0 && !parado) { preparado = true; vibrar('tv-prepara'); if (preparaTxt.current) preparaTxt.current.hidden = false; }
      pintar(ctx, e, paisaje.current, { w, h, t: ahora / 1000, dt: parado ? 0 : dt, quieto, amb, fantasma: ritmo ? ritmo * e.t : null, amigo: amigoE, pueblo: prox ? { x: prox.metros, nombre: prox.nombre, tipo: prox.tipo } : null, skin, seguidores, corren: corren.current, cielo, meta: metaE, fin: acabada,
        ligero: cal.nivel < 2, minimo: cal.nivel === 0, contraste: accesible.current.contraste, temblor: accesible.current.temblor, combo: e.combo, adornos: adornos.current, marcas: marcasRef.current, reloj: relojE, quedan: q, especial, dorada });
      banda.current?.actualizar({ serie: acabada ? 0 : e.serie, combo: acabada ? 1 : e.combo });
      // (top, tanda 4) al pasar la marca de un compañero (o la suya), su cartel
      // (jugo, tanda 11) al pasar el sitio de la ruta, su cartel y unos fuegos; y la barra de arriba, cada 10 m
      if (prox && !parado) {
        if (!puebloDicho && e.x >= prox.metros) { puebloDicho = true; paisaje.current.tPueblo = ahora / 1000; anunciar(`¡${prox.nombre}!`, true); vibrar('tv-combo'); }
        const km = prox.km + e.x / 1000, dm = Math.floor(e.x / 10);
        if (dm !== rutaVisto && rutaBarra.current) {
          rutaVisto = dm;
          const k = Math.max(0, Math.min(1, (km - prox.desde) / Math.max(0.1, prox.hasta - prox.desde))), falta = prox.hasta - km;
          rutaBarra.current.style.transform = `scaleX(${k})`;
          if (rutaTxt.current) rutaTxt.current.textContent = falta > 0 ? `${String(Math.max(0.1, Math.round(falta * 10) / 10)).replace('.', ',')} km a ${prox.nombre}` : `En ${prox.nombre}`;
        }
      }
      if (!parado) for (const mk of marcasRef.current) if (!pasadas.has(mk.metros + mk.nombre) && e.x >= mk.metros) {
        pasadas.add(mk.metros + mk.nombre);
        // (jugo, tanda 11) récord en vivo: fuegos, un segundo a cámara lenta y un acorde
        if (mk.mia) { paisaje.current.tRecord = ahora / 1000; if (!quieto) e.lento = Math.max(e.lento || 0, 0.9); if (suena.current) [[523, 0], [659, 90], [784, 180], [1046, 300]].forEach(([fr, ms]) => setTimeout(() => tono(fr, 0.35, 0.12), ms)); vibrar('tv-meta'); }
        anunciar(mk.mia ? '¡Más allá de tu mejor etapa!' : `Pasas a ${mk.nombre}`, mk.mia); }
      // (remate, tanda 6) la ventisca, la estrella dorada: su cartel
      if (!parado) for (const sc of pasaron) if (CARTEL[sc]) anunciar(CARTEL[sc], sc !== 'alcanzado');
      // (top, tanda 2) el momento raro, cuando asoma
      if (!parado) for (const mo of e.momentos) if (!mo.dicho && mo.x - e.x < 16) { mo.dicho = true; anunciar(MOMENTO[mo.tipo], true); if (!ahorro && cal.nivel > 0) grabadora.current?.grabar(mo.tipo); }
      // (remate, tanda 7) el combo ×4 también se graba
      if (!parado && e.combo >= 4 && !ahorro && cal.nivel > 0) grabadora.current?.grabar('combo');
      // (tanda 5) los carteles: cada 250 m y (top, tanda 1) cada vez que sube el combo
      if (!parado) { const ahoraH = { metros: e.x, racha: e.racha, combo: e.combo }, k = cartelDeHito(hito, ahoraH); hito = ahoraH; if (k) anunciar(k.texto, k.grande); }
      // (top, tanda 1) el combo, junto a las estrellas: «×2» mientras dure (con un salto al subir)
      if (e.combo !== comboVisto && comboTxt.current) {
        const sube = e.combo > comboVisto; comboVisto = e.combo;
        comboTxt.current.textContent = e.combo > 1 ? `×${e.combo}` : '';
        comboTxt.current.hidden = e.combo <= 1;
        if (sube && !quieto) comboTxt.current.animate?.([{ transform: 'scale(1.6)' }, { transform: 'scale(1)' }], { duration: 320, easing: 'cubic-bezier(.3, 1.6, .5, 1)' });
      }
      // (los números de arriba, solo cuando cambian)
      const m = Math.round(e.x), s = Math.max(0, Math.ceil(q));
      if (m !== visto.m && metros.current) { visto.m = m; metros.current.textContent = textoDistancia(m); }
      if (s !== visto.s && cuenta.current) { visto.s = s; cuenta.current.textContent = mmss(s); cuenta.current.classList.toggle('ultimos', s <= 3 && s > 0); }
      if (e.estrellasCogidas !== visto.e && estrellas.current) {
        visto.e = e.estrellasCogidas; estrellas.current.textContent = String(e.estrellasCogidas);
        // (el marcador late cuando llega la estrella que volaba hacia él)
        if (e.estrellasCogidas > 0 && !quieto) estrellas.current.parentElement.animate?.([{ transform: 'scale(1)' }, { transform: 'scale(1.32)' }, { transform: 'scale(1)' }], { duration: 340, delay: 460, easing: 'ease-out' });
      }
      if (e.escudos !== visto.esc) { visto.esc = e.escudos; setEscudos(e.escudos); }
      if (reto && retoTxt.current) {
        // (el reto, con lo de hoy más lo de esta etapa)
        const ahoraH = { ...hoy0, metros: hoy0.metros + m, estrellas: hoy0.estrellas + e.estrellasCogidas, etapas: hoy0.etapas + 1, mejor: Math.max(hoy0.mejor, e.calma ? 0 : m) };
        const pr = hoy0.retoHecho ? { valor: reto.meta, meta: reto.meta, hecho: true } : progresoReto(reto, ahoraH);
        const txt = pr.hecho ? `Reto de hoy, cumplido: ${reto.texto.toLowerCase()}` : `Reto de hoy: ${reto.texto.toLowerCase()} (${pr.valor}/${pr.meta})`;
        if (txt !== visto.r) { visto.r = txt; retoTxt.current.textContent = txt; retoTxt.current.classList.toggle('hecho', pr.hecho); }
      }
    };
    id = requestAnimationFrame(cuadro);
    return () => { vivoAmigo = false; cancelAnimationFrame(id); ro?.disconnect(); clearTimeout(alEmpezar); if (!acabada) grabadora.current?.tirar(); };
  }, [ronda, calma]);

  // Al acabar el descanso se cierra sola al poco (da tiempo a ver la etapa); en práctica espera a que elija
  useEffect(() => {
    if (!final || practica) return undefined;
    const nuevo = final.postal || final.lobo || final.constelacion || final.rango || final.cumplidas?.length || final.logros?.length;
    const t = setTimeout(() => cerrar.current?.('fin'), nuevo ? 4800 : 3200);   // (con algo nuevo que leer, un poco más)
    return () => clearTimeout(t);
  }, [final]);

  useEffect(() => { caja.current?.focus({ preventScroll: true }); }, []);
  // (remate, tanda 5) el sonido de verdad: con el sonido del juego puesto, pisadas, viento y eco (y, con «jugar sin mirar», los pitidos)
  useEffect(() => {
    if (!sonido || final) return undefined;
    const sn = crearSonido();
    sonidoRef.current = sn;
    sn?.lugar(ambiente({ total: guardado0.current.total }).paisaje);
    return () => { sn?.parar(); if (sonidoRef.current === sn) sonidoRef.current = null; };
  }, [sonido, !!final]);
  // (top, tanda 3) la música: suena mientras se juega; al acabar la etapa o al quitarla, se apaga despacio
  useEffect(() => {
    if (!musica || final) return undefined;
    banda.current = crearMusica();
    return () => { banda.current?.parar(); banda.current = null; };
  }, [musica, !!final]);
  const cambiarMusica = () => { const v = !musica; setMusica(v); guardarAjustes({ ...leerAjustes(), musicaJuego: v }); };
  const compartirClip = async () => {
    try { const r = await compartirArchivo(clip.blob, `la-travesia.${extensionDe(clip.blob)}`); setClipTxt(r === 'compartida' ? 'Compartido' : 'Guardado en tus descargas'); }
    catch (err) { if (err?.name !== 'AbortError') setClipTxt('No se ha podido compartir el clip'); }
  };
  const hacerFoto = async () => {
    try { const r = await fotoDeEtapa(lienzo.current, final?.metros || 0); setFoto(r === 'compartida' ? 'Compartida' : 'Guardada en tus descargas'); }
    catch (err) { if (err?.name !== 'AbortError') setFoto('No se ha podido hacer la foto'); }
  };

  // Un toque salta (mantenerlo alarga el salto); deslizar hacia abajo, agacharse
  const dedo = useRef(null);
  const toque = (ev) => {
    if (ev.target.closest?.('button')) return;
    ev.preventDefault();
    if (final || !etapa.current) return;
    dedo.current = { id: ev.pointerId, y: ev.clientY, bajo: false };
    pulsar(etapa.current, true);
    if (suena.current) prepararAudio();
    if (saltar(etapa.current)) { if (!tocado) setTocado(true); }   // (su vibración, con la de cada cosa, en el cuadro)
  };
  const mueve = (ev) => {
    const d = dedo.current;
    if (!d || d.id !== ev.pointerId || d.bajo || !etapa.current || ev.clientY - d.y < 26) return;
    d.bajo = true;
    pulsar(etapa.current, false);
    if (agachar(etapa.current)) vibrar('elegir');
  };
  const suelta = () => { dedo.current = null; if (etapa.current) pulsar(etapa.current, false); };
  const tecla = (ev) => {
    if (ev.key === 'Escape') { ev.stopPropagation(); salir(); return; }
    if (ev.target.closest?.('button')) return;
    if (ev.key === 'ArrowDown') { ev.preventDefault(); if (!final && etapa.current) agachar(etapa.current); return; }
    if (ev.key === ' ' || ev.key === 'ArrowUp' || ev.key === 'Enter') { ev.preventDefault(); if (!final && etapa.current && saltar(etapa.current) && !tocado) setTocado(true); }
  };
  const cambiarCalma = () => {
    const e = etapa.current;
    // (lo corrido hasta aquí cuenta, como al cerrar a mano; y la etapa vuelve a empezar en el otro modo)
    if (!practica && sesion && e && !apuntada.current && e.x >= 20) { apuntada.current = true; apuntar(e); }
    const v = !calma; setCalma(v); guardarAjustes({ ...leerAjustes(), calmaJuego: v });
  };
  const cambiarSonido = () => { const v = !sonido; setSonido(v); guardarAjustes({ ...leerAjustes(), sonidoJuego: v }); if (v) { prepararAudio(); tono(...SONIDOS.estrella); } };

  // (tanda 3) el duelo de la semana, con lo mío al día
  const elDuelo = (misMetros) => {
    const rival = manada ? leerDuelo(atletaId, lunesDe(hoyISO())) : '';
    const d = rival ? duelo(manada.filas, rival, misMetros) : null;
    if (!d) return '';
    return d.diferencia === 0 ? `Duelo con ${d.rival}: vais igualados` : `Duelo con ${d.rival}: vas ${textoDistancia(Math.abs(d.diferencia))} por ${d.gano ? 'delante' : 'detrás'}`;
  };
  const companeros = manada ? correnHoy(manada.filas) : [];
  return (
    <div ref={caja} class={`travesia${calma ? ' en-calma' : ''}`} role="dialog" aria-modal="true" aria-label={delDia ? 'La travesía: la etapa del día' : practica ? 'La travesía: práctica de un minuto' : 'La travesía: el juego del descanso'} tabIndex={-1}
      onPointerDown={toque} onPointerMove={mueve} onPointerUp={suelta} onPointerCancel={suelta} onKeyDown={tecla}>
      <canvas ref={lienzo} class="travesia-lienzo" role="img" aria-label="Un lobo corre por la montaña. Toca la pantalla o pulsa la barra espaciadora para saltar; desliza hacia abajo o pulsa la flecha abajo para agacharte." />
      {/* (tanda 5) la viñeta: los bordes, un poco más oscuros; y el cartel de los hitos («500 m», «Racha ×10», el paisaje) */}
      <span class="travesia-vineta" aria-hidden="true" />
      <p ref={cartel} class="travesia-cartel" aria-hidden="true" />
      <div class="travesia-arriba">
        <span class="travesia-dato" aria-label="Distancia de esta etapa"><Icono n="pasos" /><b ref={metros} class="num">0 m</b></span>
        <span class="travesia-cuenta" role="timer" aria-live="off" aria-label={practica ? 'Tiempo de práctica' : 'Descanso'}><b ref={cuenta} class="num">{mmss(practica ? PRACTICA : cuentaInicial(fin, pausa))}</b><small>{delDia ? 'etapa del día' : practica ? 'práctica' : 'descanso'}</small></span>
        <span class="travesia-dato oro" aria-label="Estrellas"><Icono n="estrella" /><b ref={estrellas} class="num">0</b><i ref={comboTxt} class="travesia-combo num" aria-label="Combo: cada estrella vale más" hidden /></span>
        <button type="button" class="travesia-cerrar" onClick={salir} aria-label="Cerrar el juego"><Icono n="cerrar" /></button>
      </div>
      {/* (jugo, tanda 11) hacia el siguiente sitio de la ruta: la barra se llena mientras corre */}
      {!final && sitio && (
        <div class="travesia-ruta" aria-hidden="true">
          <span class="travesia-ruta-txt" ref={rutaTxt}>{String(Math.max(0.1, Math.round((sitio.hasta - sitio.km) * 10) / 10)).replace('.', ',')} km a {sitio.nombre}</span>
          <span class="travesia-ruta-pista"><span class="travesia-ruta-lleno" ref={rutaBarra} style={{ transform: `scaleX(${Math.max(0, Math.min(1, (sitio.km - sitio.desde) / Math.max(0.1, sitio.hasta - sitio.desde)))})` }} /></span>
        </div>
      )}
      {!final && (
        <div class="travesia-modos">
          <button type="button" class="travesia-modo" aria-pressed={calma ? 'true' : 'false'} onClick={cambiarCalma} title="Sin obstáculos y al paso, para respirar tras una serie dura"><Icono n="sueno" />Calma</button>
          <button type="button" class="travesia-modo" aria-pressed={sonido ? 'true' : 'false'} onClick={cambiarSonido} aria-label={sonido ? 'Quitar el sonido del juego' : 'Poner el sonido del juego'}><Icono n={sonido ? 'altavoz' : 'silencio'} /></button>
          <button type="button" class="travesia-modo" aria-pressed={musica ? 'true' : 'false'} onClick={cambiarMusica} aria-label={musica ? 'Quitar la música del juego' : 'Poner la música del juego'}><Icono n="musica" /></button>
          {escudos > 0 && <span class="travesia-escudo" role="status" aria-label={`${escudos === 1 ? 'Un escudo' : `${escudos} escudos`}: te perdona un tropiezo`}><Icono n="escudo" />{escudos}</span>}
        </div>
      )}
      {!final && !tocado && !calma && !ensenando && <p class="travesia-pista" aria-hidden="true">{accesible.current.unToque ? 'Toca para saltar · mantén para llegar más lejos' : <>Toca para saltar · otra vez en el aire, doble salto{conMovimientos && !practica ? ' · desliza abajo para agacharte' : ''}</>}</p>}
      {!final && calma && <p class="travesia-pista calma" aria-hidden="true">Respira: el lobo va al paso</p>}
      {!final && reto && <p ref={retoTxt} class="travesia-reto" role="status" />}
      {!final && aullidos.length > 0 && <p class="travesia-manada aullido" role="status">{aullidos.slice(0, 3).join(', ')} {aullidos.length === 1 ? 'te aúlla' : 'te aúllan'} desde la manada: ¡auuu!</p>}
      {!final && !tocado && !aullidos.length && companeros.length > 0 && <p class="travesia-manada" role="status">Hoy también {companeros.length === 1 ? 'ha corrido' : 'han corrido'}: {companeros.join(', ')}</p>}
      {!final && despues && !practica && <p class="travesia-despues">Después: {despues}</p>}
      {/* (remate, tanda 5) la cuenta de la vuelta y el «prepárate» de los cinco últimos segundos */}
      <p ref={vueltaTxt} class="travesia-vuelta num" aria-hidden="true" hidden />
      {!practica && <p ref={preparaTxt} class="travesia-prepara" role="status" hidden><small>Prepárate</small>{despues || 'La siguiente serie'}</p>}
      {final && (
        <div class="travesia-final" role="status">
          <span class="travesia-final-etq">{final.delDia ? 'La etapa del día' : practica ? 'Práctica' : '¡Vamos!'}</span>
          {final.sello && <span class={`travesia-sello sello-${final.sello}`} role="img" aria-label={`Sello de ${final.sello}: frente a tu media`}><b>{final.sello === 'oro' ? 'Oro' : final.sello === 'plata' ? 'Plata' : 'Bronce'}</b><small>tu media</small></span>}
          <strong class="num"><Rueda valor={final.metros} /></strong>
          <span class="travesia-final-det">
            {final.estrellas > 0 && <span class="oro"><Icono n="estrella" /><CuentaEstrellas valor={final.estrellas} suena={suena.current} /></span>}
            {final.constelaciones > 0 && <span class="oro">{final.constelaciones === 1 ? 'Una constelación en el camino' : `${final.constelaciones} constelaciones en el camino`}</span>}
            {final.limpios >= 3 && <span>{final.limpios} caídas limpias</span>}
            {final.rios > 0 && <span>{final.rios === 1 ? 'Un río cruzado' : `${final.rios} ríos cruzados`}</span>}
            {final.combo > 1 && <span class="oro">Combo ×{final.combo}</span>}
            {final.momentos?.includes('estampida') && <span class="oro">Estampida superada</span>}
            {final.momentos?.includes('puente') && <span class="oro">Puente cruzado</span>}
            {final.arriba >= 10 && <span>{textoDistancia(final.arriba)} por arriba</span>}
            {final.doradas > 0 && <span class="oro"><Icono n="estrella" />{final.doradas === 1 ? 'Una estrella dorada' : `${final.doradas} estrellas doradas`}</span>}
            {final.escapadas > 0 && <span class="oro">Escapaste de la ventisca</span>}
            {final.roces > 0 && <span>{final.roces === 1 ? 'Una vez por los pelos' : `${final.roces} veces por los pelos`}</span>}
            {final.marca && <span class="oro">Tu mejor {practica ? 'marca' : 'etapa'}</span>}
            {final.reto && <span class="oro">Reto del día, cumplido</span>}
            {final.postal && <span class="oro travesia-final-postal">Has llegado a {final.postal.lugar}</span>}
            {final.lobo && <span class="oro">Nuevo lobo: {final.lobo.nombre}</span>}
            {final.constelacion && <span class="oro">Constelación completa: {final.constelacion.nombre}</span>}
            {elDuelo(final.semana) && <span class="travesia-final-duelo">{elDuelo(final.semana)}</span>}
            {final.cumplidas?.map((m) => <span key={m} class="travesia-final-mision"><Icono n="hecho" />{m}</span>)}
            {final.rango && <span class="oro travesia-final-rango">Nuevo rango: {final.rango}</span>}
            {final.adorno && <span class="oro">Nuevo adorno: {final.adorno}</span>}
            {final.logros?.map((l) => <span key={l} class="oro"><Icono n="trofeo" />{l}</span>)}
            {final.hoy != null && final.etapas > 1 && <span>Hoy llevas {textoDistancia(final.hoy)}</span>}
            {practica && !final.delDia && !final.marca && final.mejor > final.metros && <span>Tu marca: {textoDistancia(final.mejor)}</span>}
            {final.delDia && <span>Tu mejor de hoy: <b class="num">{textoDistancia(final.mejorDia)}</b></span>}
            {final.delDia && <span>{final.quedan ? `Te ${final.quedan === 1 ? 'queda un intento' : `quedan ${final.quedan} intentos`}` : 'Mañana, otra etapa'}</span>}
          </span>
          {practica
            ? <div class="travesia-final-botones">{(!final.delDia || final.quedan > 0) && <button type="button" class="btn btn-primario" onClick={() => setRonda((n) => n + 1)}>Otra</button>}<button type="button" class="btn" onClick={() => irse('salir')}>Cerrar</button></div>
            : <button type="button" class="btn btn-primario" onClick={() => irse('fin')}>A por la serie</button>}
          {/* (top, tanda 3) el modo foto: la escena del final, para compartirla o guardarla */}
          <button type="button" class="btn-texto travesia-foto" onClick={hacerFoto}><Icono n="camara" />{foto || 'Guardar la foto'}</button>
          {/* (remate, tanda 7) el clip de la etapa, si ha pasado algo especial y el navegador ha podido grabarlo */}
          {clip && <button type="button" class="btn-texto travesia-foto travesia-clip" onClick={compartirClip}><Icono n="video" />{clipTxt || (clip.motivo === 'combo' ? 'Compartir el clip del combo' : 'Compartir el clip')}</button>}
        </div>
      )}
    </div>
  );
}
