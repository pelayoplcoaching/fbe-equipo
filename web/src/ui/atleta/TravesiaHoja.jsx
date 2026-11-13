import { useEffect, useRef, useState } from 'preact/hooks';
import { Hoja, Icono, useApp } from '../comunes.jsx';
import { Imagen } from '../Imagen.jsx';
import { leerTravesia, manadaDe, leerDuelo, guardarDuelo, leerMeta, guardarMeta, sincronizarMeta, leerDia, aulladosHoy, apuntarAullado } from '../travesia.js';
import { Travesia } from './TravesiaTarjeta.jsx';
import { ETAPA_DIA } from '../../logica/travesia.js';
import { nombreRango, progresoMisiones, adornosDe, adornosPuestos, LOGROS, elegirRuta } from '../../logica/travesia-meta.js';
import { leerAjustes, guardarAjustes } from '../ajustes.js';
import { textoDistancia, rachaSemanas } from '../../logica/travesia.js';
import { posicionEnRuta, rutaPorElegir, RUTAS_NUEVAS, textoRuta, postales, lobosDe, loboElegido, constelaciones, manadaPropia, miPuesto, duelo, equipoDelMes, textoParaCompartir } from '../../logica/travesia-ruta.js';
import { hoyISO, lunesDe } from '../../logica/fechas.js';
import { pintarLobo } from './travesia-pinta.js';

// (tanda 3) «Tu travesía»: lo que el juego del descanso va dejando. El mapa (los kilómetros avanzan por una ruta de
// verdad), las postales de cada sitio al que llega, la manada (la clasificación de la semana, el duelo y lo que suma el
// equipo, si está en la comunidad), sus lobos y sus constelaciones. Va en su trozo: solo se pide al abrirla.
const km = (m) => String(Math.round(m / 100) / 10).replace('.', ',');

function LoboMuestra({ skin }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1), w = 96, h = 56;
    c.width = w * dpr; c.height = h * dpr;
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    pintarLobo(ctx, { w, h, skin });
  }, [skin?.claro, skin?.sombra]);
  return <canvas ref={ref} class="tv-lobo-lienzo" aria-hidden="true" />;
}

function Constelacion({ k }) {
  const x = (q) => 6 + q[0] * 88, y = (q) => 6 + q[1] * 60;
  return (
    <li class={`tv-constelacion${k.completa ? ' completa' : ''}`}>
      <svg viewBox="0 0 100 72" aria-hidden="true">
        {k.lineas.map(([a, b]) => (k.completa || (a < k.cogidas && b < k.cogidas)) && <line x1={x(k.puntos[a])} y1={y(k.puntos[a])} x2={x(k.puntos[b])} y2={y(k.puntos[b])} />)}
        {k.puntos.map((q, i) => <circle cx={x(q)} cy={y(q)} r={k.completa || i < k.cogidas ? 2.6 : 1.5} class={k.completa || i < k.cogidas ? 'mia' : ''} />)}
      </svg>
      <strong>{k.nombre}</strong>
      <span>{k.completa ? 'Completa' : `${k.cogidas} de ${k.puntos.length}`}</span>
    </li>
  );
}

// (top, tanda 3) Tu rango y sus tres misiones; los adornos que se ganan por rango; y los logros
function RangoYMisiones({ meta }) {
  const lista = progresoMisiones(meta);
  return (
    <section aria-labelledby="tv-rango-t">
      <h3 id="tv-rango-t">{nombreRango(meta.rango)} <span class="tv-cuenta">rango {meta.rango + 1}</span></h3>
      <ul class="tv-misiones">
        {lista.map((m) => (
          <li key={m.id} class={`tv-mision${m.hecha ? ' hecha' : ''}`}>
            <span class="tv-mision-marca" aria-hidden="true">{m.hecha ? <Icono n="hecho" /> : null}</span>
            <span class="tv-mision-texto"><span>{m.texto}</span>
              <span class="tv-barra" role="img" aria-label={m.hecha ? 'Cumplida' : `${m.valor} de ${m.meta}`}><span style={{ width: `${(m.valor / m.meta) * 100}%` }} /></span></span>
            <b class="num">{m.hecha ? '✓' : `${m.valor}/${m.meta}`}</b>
          </li>
        ))}
      </ul>
      <p class="mini terciario">Con las tres cumplidas, tu lobo sube de rango y salen tres nuevas. Solo cuentan las etapas de tus descansos.</p>
    </section>
  );
}
function Adornos({ meta }) {
  const [puestos, setPuestos] = useState(() => adornosPuestos(meta.rango, leerAjustes().adornosJuego));
  const cambiar = (id) => { const n = puestos.includes(id) ? puestos.filter((x) => x !== id) : [...puestos, id]; setPuestos(n); guardarAjustes({ ...leerAjustes(), adornosJuego: n }); };
  return (
    <section aria-labelledby="tv-adornos-t">
      <h3 id="tv-adornos-t">Adornos <span class="tv-cuenta">{adornosDe(meta.rango).filter((a) => a.tiene).length} de {adornosDe(meta.rango).length}</span></h3>
      <ul class="tv-adornos">
        {adornosDe(meta.rango).map((a) => (
          <li key={a.id}>
            <button type="button" class="tv-adorno" disabled={!a.tiene} aria-pressed={a.tiene && puestos.includes(a.id) ? 'true' : 'false'} onClick={() => cambiar(a.id)}>
              <strong>{a.nombre}</strong><span>{!a.tiene ? `Rango ${a.rango + 1}: ${nombreRango(a.rango)}` : puestos.includes(a.id) ? 'Puesto' : 'Ponérselo'}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
function Logros({ meta }) {
  const conseguidos = LOGROS.filter((l) => meta.logros[l.id]).length;
  return (
    <section aria-labelledby="tv-logros-t">
      <h3 id="tv-logros-t">Logros <span class="tv-cuenta">{conseguidos} de {LOGROS.length}</span></h3>
      <ul class="tv-logros">
        {LOGROS.map((l) => (
          <li key={l.id} class={`tv-logro${meta.logros[l.id] ? ' hecho' : ''}`}>
            <span class="tv-logro-ico" aria-hidden="true"><Icono n={meta.logros[l.id] ? 'trofeo' : 'candado'} /></span>
            <strong>{l.nombre}</strong><span>{l.como}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// (top, tanda 4) La etapa del día: el mismo terreno para todo el equipo, un minuto y tres intentos; y su clasificación
function EtapaDelDia({ atletaId, hoy }) {
  const { api } = useApp();
  const [dia, setDia] = useState(() => leerDia(atletaId, hoy));
  const [clasif, setClasif] = useState(null);
  const [jugando, setJugando] = useState(false);
  const traer = () => api.clasifEtapaDelDia().then(setClasif).catch(() => setClasif(null));
  useEffect(() => { traer(); }, []);
  const quedan = Math.max(0, ETAPA_DIA.intentos - dia.intentos);
  const cerrar = () => { setJugando(false); setDia(leerDia(atletaId, hoy)); setTimeout(traer, 600); };
  return (
    <section class="tv-dia" aria-labelledby="tv-dia-t">
      <h3 id="tv-dia-t">La etapa del día</h3>
      <p class="tv-donde">Hoy todo el equipo corre el mismo terreno: un minuto, tres intentos, cuenta el mejor.{dia.mejor > 0 ? <> Tu mejor de hoy: <b class="num">{textoDistancia(dia.mejor)}</b>.</> : ''}</p>
      <button type="button" class="btn btn-primario tv-dia-correr" disabled={!quedan} onClick={() => setJugando(true)}>
        <Icono n="play" />{quedan ? `Correrla (${quedan === 1 ? 'te queda un intento' : `quedan ${quedan} intentos`})` : 'Mañana, otra etapa'}
      </button>
      {clasif?.filas?.length > 0 && (
        <ol class="tv-clasif tv-dia-clasif">
          {clasif.filas.slice(0, 10).map((f, i) => (
            <li key={`${f.nombre}-${i}`} class={`tv-fila${f.yo ? ' yo' : ''}`}><span class="tv-puesto num">{i + 1}</span><span class="tv-nombre">{f.yo ? 'Tú' : f.nombre}</span><b class="num">{textoDistancia(f.metros)}</b></li>
          ))}
        </ol>
      )}
      <p class="mini terciario">No suma a tu travesía: es para picarse un rato. {clasif ? '' : 'La clasificación del día sale si estás en la comunidad.'}</p>
      {jugando && <Travesia atletaId={atletaId} delDia alCerrar={cerrar} />}
    </section>
  );
}

// (top, tanda 1: accesibilidad) «Cómo juegas»: tres ajustes de este móvil, que el juego lee al abrirse
const COMO_JUEGAS = [
  { clave: 'juegoUnToque', texto: 'Un solo toque', ayuda: 'Sin doble salto ni agacharse: nada lo pide, y los ríos son más estrechos' },
  { clave: 'juegoContraste', texto: 'Alto contraste', ayuda: 'Cada obstáculo, con un borde claro' },
  { clave: 'juegoSinTemblor', texto: 'Sin temblor', ayuda: 'Al tropezar, la pantalla no se sacude' },
  // (remate, tanda 5) para baja visión o con el móvil apoyado
  { clave: 'juegoSonar', texto: 'Jugar sin mirar', ayuda: 'Pitidos que avisan de cada obstáculo, más agudos cuanto más cerca (dos para el monte, grave para la rama). Con el sonido del juego puesto' },
];
function ComoJuegas() {
  const [a, setA] = useState(() => leerAjustes());
  const cambiar = (clave, v) => { const n = { ...leerAjustes(), [clave]: v }; guardarAjustes(n); setA(n); };
  return (
    <section aria-labelledby="tv-como-t">
      <h3 id="tv-como-t">Cómo juegas</h3>
      <ul class="lista tv-como">
        {COMO_JUEGAS.map((x) => (
          <li key={x.clave} class="panel-pad interruptor-fila">
            <label for={`tv-${x.clave}`} class="pila-xs"><span>{x.texto}</span><span class="peq terciario">{x.ayuda}</span></label>
            <input id={`tv-${x.clave}`} type="checkbox" role="switch" class="interruptor" checked={a[x.clave] === true} onChange={(ev) => cambiar(x.clave, ev.currentTarget.checked)} />
          </li>
        ))}
      </ul>
      <p class="mini terciario">Vale desde la próxima etapa. Con «reducir movimiento» en el móvil, el juego ya va sin animaciones de adorno.</p>
    </section>
  );
}

export function HojaTravesia({ alCerrar }) {
  const { atleta, api, aviso } = useApp();
  const hoy = hoyISO(), lunes = lunesDe(hoy);
  const t = leerTravesia(atleta.id);
  // (top, tanda 4) el rango, las misiones y los logros: lo del móvil, y en cuanto llega, junto con lo de la base
  const [meta, setMeta] = useState(() => leerMeta(atleta.id));
  useEffect(() => { let vivo = true; sincronizarMeta(api, atleta.id).then((m) => { if (vivo) setMeta(m); }).catch(() => {}); return () => { vivo = false; }; }, []);
  const [aullados, setAullados] = useState(() => aulladosHoy(atleta.id, hoyISO()));
  const aullar = async (f) => {
    try { await api.aullar(f.perfil); apuntarAullado(atleta.id, hoyISO(), f.perfil); setAullados(aulladosHoy(atleta.id, hoyISO())); aviso?.(`¡Auuu! A ${f.nombre} le saldrá en su próxima etapa`); }
    catch (e) { if (/ya le has aullado/i.test(e?.message || '')) { apuntarAullado(atleta.id, hoyISO(), f.perfil); setAullados(aulladosHoy(atleta.id, hoyISO())); } aviso?.(e?.message || 'No se ha podido aullar', 'error'); }
  };
  const pos = posicionEnRuta(t.total, meta.rutas), album = postales(t.total, meta.rutas);
  // (remate, tanda 6) desde la última ruta de siempre, se elige la siguiente (Picos de Europa, Pirineos o el Camino)
  const porElegir = rutaPorElegir(t.total, meta.rutas);
  const elegirSiguiente = (id) => { const m = guardarMeta(atleta.id, elegirRuta(meta, porElegir.n, id)); setMeta(m); sincronizarMeta(api, atleta.id).catch(() => {}); };
  const [manada, setManada] = useState(null);
  const [rival, setRival] = useState(() => leerDuelo(atleta.id, lunes));
  const [lobo, setLobo] = useState(() => loboElegido(t, leerAjustes().loboJuego).id);
  useEffect(() => { let vivo = true; manadaDe(api, atleta.id).then((m) => { if (vivo) setManada(m); }); return () => { vivo = false; }; }, []);
  const misMetros = t.semanas?.[lunes] || 0;
  const elDuelo = manada && rival ? duelo(manada.filas, rival, misMetros) : null;
  const equipo = manada ? equipoDelMes(manada.equipo) : null;
  const puesto = manada ? miPuesto(manada.filas) : null;
  const retar = (nombre) => { const r = guardarDuelo(atleta.id, rival === nombre ? '' : nombre, lunes); setRival(r); aviso?.(r ? `Duelo de la semana con ${r}` : 'Duelo retirado'); };
  const elegir = (id) => { setLobo(id); guardarAjustes({ ...leerAjustes(), loboJuego: id }); };
  const sigue = manadaPropia(rachaSemanas(t, hoy));
  const cielo = constelaciones(t.estrellas);
  const contar = async () => {
    const texto = textoParaCompartir(t);
    try {
      if (typeof navigator.share === 'function') { await navigator.share({ text: texto }); return; }
      await navigator.clipboard.writeText(texto);
      aviso?.('Copiado: pégalo donde quieras');
    } catch (e) { if (e?.name !== 'AbortError') aviso?.('No se ha podido compartir', 'error'); }
  };
  return (
    <Hoja titulo="Tu travesía" alCerrar={alCerrar} clase="hoja-travesia">
      <div class="pila tv-hoja">
        <section class="tv-mapa" aria-labelledby="tv-mapa-t">
          <h3 id="tv-mapa-t">{pos.ruta.nombre}</h3>
          <p class="tv-donde">{textoRuta(pos)}</p>
          <div class="tv-ruta" role="img" aria-label={`${km(pos.km * 1000)} de ${pos.largo} kilómetros`}>
            <span class="tv-ruta-hecho" style={{ width: `${pos.pct * 100}%` }} />
            {pos.ruta.hitos.map(([nombre, k], i) => <span key={nombre} class={`tv-hito${i < pos.pasados ? ' pasado' : ''}`} style={{ left: `${(k / pos.largo) * 100}%` }} />)}
            {/* (belleza) el lobo camina hasta su punto: va en un carril del ancho de la ruta, que es lo que se mueve */}
            <span class="tv-ruta-carril" style={{ '--tv-p': `${pos.pct * 100}%` }}><span class="tv-ruta-lobo" /></span>
          </div>
          <div class="tv-ruta-extremos"><span>{pos.ruta.hitos[0][0]}</span><span>{pos.ruta.hitos[pos.ruta.hitos.length - 1][0]} · {pos.largo} km</span></div>
          <p class="mini terciario">En total, {textoDistancia(t.total)}{t.estrellas > 0 ? ` y ${t.estrellas} ${t.estrellas === 1 ? 'estrella' : 'estrellas'}` : ''}. Solo avanza en los descansos de tus entrenos.</p>
        </section>

        {porElegir && (
          <section class="tv-rutas" aria-labelledby="tv-rutas-t">
            <h3 id="tv-rutas-t">Tu siguiente ruta</h3>
            <p class="tv-donde">Cuando acabes {pos.ruta.nombre.replace(/^De /, 'la de ').replace(/^El /, 'el ').replace(/^Por /, 'la de ')}, tu lobo sigue por la que elijas.</p>
            <div class="tv-rutas-lista">
              {RUTAS_NUEVAS.map((r) => (
                <button key={r.id} type="button" class="tv-ruta-op" aria-pressed={(porElegir.elegida || RUTAS_NUEVAS[(porElegir.n - 3) % 3].id) === r.id ? 'true' : 'false'} onClick={() => elegirSiguiente(r.id)}>
                  <strong>{r.nombre}</strong><span>{r.hitos[0][0]} – {r.hitos[r.hitos.length - 1][0]} · {r.hitos[r.hitos.length - 1][1]} km</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <RangoYMisiones meta={meta} />

        <EtapaDelDia atletaId={atleta.id} hoy={hoy} />

        <section aria-labelledby="tv-postales-t">
          <h3 id="tv-postales-t">Postales <span class="tv-cuenta">{album.length}</span></h3>
          <ul class="tv-postales">
            {album.slice(0, 12).map((p) => (
              <li key={p.id} class="tv-postal"><Imagen id={p.imagen} clase="tv-postal-img" tamanos="140px" alternativa={<span class="tv-postal-img vacia" aria-hidden="true" />} /><strong>{p.lugar}</strong><span>km {p.km}</span></li>
            ))}
            {pos.siguiente && <li class="tv-postal pendiente"><span class="tv-postal-img vacia" aria-hidden="true"><Icono n="candado" /></span><strong>{pos.siguiente[0]}</strong><span>a {String(pos.faltan).replace('.', ',')} km</span></li>}
          </ul>
        </section>

        {manada && manada.filas.length > 0 && (
          <section class="tv-manada" aria-labelledby="tv-manada-t">
            <h3 id="tv-manada-t">La manada, esta semana</h3>
            {(puesto || elDuelo) && <p class="tv-donde">{!puesto ? '' : puesto === 1 ? 'Vas el primero.' : `Vas el ${puesto}.º de ${manada.filas.length}.`}{elDuelo ? ` Duelo con ${elDuelo.rival}: ${elDuelo.diferencia === 0 ? 'igualados' : `${textoDistancia(Math.abs(elDuelo.diferencia))} por ${elDuelo.gano ? 'delante' : 'detrás'}`}.` : ''}</p>}
            <ol class="tv-clasif">
              {manada.filas.map((f, i) => (
                <li key={f.nombre} class={`tv-fila${f.yo ? ' yo' : ''}${rival === f.nombre ? ' rival' : ''}`}>
                  <span class="tv-puesto num">{i + 1}</span>
                  <span class="tv-nombre">{f.yo ? 'Tú' : f.nombre}{f.hoy && <small> · hoy</small>}</span>
                  <b class="num">{textoDistancia(f.yo ? Math.max(f.metros, misMetros) : f.metros)}</b>
                  {!f.yo && f.perfil && <button type="button" class="btn btn-peq tv-aullar" disabled={aullados.includes(f.perfil)} onClick={() => aullar(f)} aria-label={aullados.includes(f.perfil) ? `Ya has aullado hoy a ${f.nombre}` : `Aullar a ${f.nombre}`}>{aullados.includes(f.perfil) ? 'Auuu ✓' : 'Aullar'}</button>}
                  {!f.yo && <button type="button" class="btn btn-peq tv-retar" aria-pressed={rival === f.nombre ? 'true' : 'false'} onClick={() => retar(f.nombre)}>{rival === f.nombre ? 'En duelo' : 'Retar'}</button>}
                </li>
              ))}
            </ol>
            <p class="mini terciario">El duelo es cosa tuya: dura esta semana y a tu compañero no se le avisa.</p>
            {equipo && equipo.metros > 0 && (
              <div class="tv-equipo">
                <strong>Entre todos, este mes</strong>
                <div class="tv-barra" role="img" aria-label={`${km(equipo.metros)} de ${km(equipo.meta)} kilómetros`}><span style={{ width: `${equipo.pct * 100}%` }} /></div>
                <span>{equipo.hecho ? `Meta cumplida: ${km(equipo.metros)} km` : `${km(equipo.metros)} de ${km(equipo.meta)} km`} · {equipo.miembros} {equipo.miembros === 1 ? 'lobo' : 'lobos'}</span>
              </div>
            )}
          </section>
        )}

        <section aria-labelledby="tv-lobos-t">
          <h3 id="tv-lobos-t">Tus lobos</h3>
          <ul class="tv-lobos">
            {lobosDe(t).map((l) => (
              <li key={l.id}>
                <button type="button" class="tv-lobo" disabled={!l.tiene} aria-pressed={lobo === l.id ? 'true' : 'false'} onClick={() => elegir(l.id)}>
                  <LoboMuestra skin={l.tiene ? l : { claro: '#4B4580', sombra: '#3A3568' }} />
                  <strong>{l.nombre}</strong>
                  <span>{l.tiene ? (lobo === l.id ? 'Elegido' : 'Elegir') : l.como}</span>
                </button>
              </li>
            ))}
          </ul>
          <p class="mini terciario">{sigue > 0 ? `Te ${sigue === 1 ? 'sigue un lobo' : `siguen ${sigue} lobos`}: uno por cada semana seguida corriendo en tus descansos (hasta cuatro).` : 'Cada semana seguida que corras en tus descansos, un lobo más te sigue (hasta cuatro).'}</p>
        </section>

        <section aria-labelledby="tv-cielo-t">
          <h3 id="tv-cielo-t">Constelaciones <span class="tv-cuenta">{cielo.filter((k) => k.completa).length} de {cielo.length}</span></h3>
          <ul class="tv-constelaciones">{cielo.map((k) => <Constelacion key={k.id} k={k} />)}</ul>
          <p class="mini terciario">Cada cinco estrellas que coges, se enciende una del cielo.</p>
        </section>

        <Adornos meta={meta} />

        <Logros meta={meta} />

        <ComoJuegas />

        {t.total > 0 && <button type="button" class="btn btn-grande tv-contar" onClick={contar}><Icono n="compartir" /> Contarlo</button>}
      </div>
    </Hoja>
  );
}
