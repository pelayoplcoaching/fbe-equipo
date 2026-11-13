import { useEffect, useRef, useState } from 'preact/hooks';
import { Hoja, Icono, useApp } from '../comunes.jsx';
import { Imagen } from '../Imagen.jsx';
import { leerTravesia, manadaDe, leerDuelo, guardarDuelo } from '../travesia.js';
import { leerAjustes, guardarAjustes } from '../ajustes.js';
import { textoDistancia, rachaSemanas } from '../../logica/travesia.js';
import { posicionEnRuta, textoRuta, postales, lobosDe, loboElegido, constelaciones, manadaPropia, miPuesto, duelo, equipoDelMes, textoParaCompartir } from '../../logica/travesia-ruta.js';
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

export function HojaTravesia({ alCerrar }) {
  const { atleta, api, aviso } = useApp();
  const hoy = hoyISO(), lunes = lunesDe(hoy);
  const t = leerTravesia(atleta.id);
  const pos = posicionEnRuta(t.total), album = postales(t.total);
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

        {t.total > 0 && <button type="button" class="btn btn-grande tv-contar" onClick={contar}><Icono n="compartir" /> Contarlo</button>}
      </div>
    </Hoja>
  );
}
