import { useEffect, useRef, useState } from 'preact/hooks';
import { useApp } from '../comunes.jsx';
import { perezoso } from '../perezoso.jsx';
import { leerTravesia, sincronizarTravesia } from '../travesia.js';
import { textoDistancia, metrosDeLaSemana, retoDelDia, progresoReto, hoyDe, ambiente } from '../../logica/travesia.js';
import { posicionEnRuta } from '../../logica/travesia-ruta.js';
import { hoyISO, lunesDe } from '../../logica/fechas.js';

// «La travesía», el juego del descanso: su trozo (el juego y cómo se pinta) solo se pide al abrirlo
export const Travesia = perezoso(() => import('./Travesia.jsx'), 'Travesia', { mientras: null });
// (tanda 3) «Tu travesía»: el mapa, las postales, la manada, los lobos y las constelaciones
const HojaTravesia = perezoso(() => import('./TravesiaHoja.jsx'), 'HojaTravesia', { mientras: null });

// (belleza) El lobo de la tarjeta: su silueta al trote, cruzando por el pie de la tarjeta (decorativa; quieta con
// «reducir movimiento» y con la app en segundo plano). Las mismas formas que el del juego, sin pedir su trozo.
function LoboAlTrote() {
  return (
    <span class="travesia-tarjeta-paso" aria-hidden="true">
      <svg class="travesia-tarjeta-lobo" viewBox="-1.6 -1.6 3.1 1.65" width="46" height="24">
        <g transform="scale(1 -1)" fill="currentColor" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
          <path stroke="none" d="M-0.84 0.66C-0.88 1.02 -0.3 0.98 0.18 0.98C0.42 1 0.5 1.06 0.62 1.2L0.7 1.52L0.84 1.26L0.96 1.2L1.3 1.02L1.38 0.95L1.28 0.87L0.94 0.84C0.76 0.56 0.66 0.4 0.42 0.36C0.1 0.32 -0.3 0.44 -0.56 0.38C-0.76 0.4 -0.84 0.52 -0.84 0.66Z" />
          <path stroke="none" d="M-0.6 0.92Q-1.06 1.12 -1.5 0.74Q-1.1 0.5 -0.62 0.58Z" />
          <path fill="none" stroke-width="0.17" d="M-0.56 0.52L-0.74 0.3L-0.62 0.04M0.42 0.52L0.6 0.3L0.5 0.04M-0.4 0.5L-0.3 0.26L-0.42 0.04M0.3 0.5L0.2 0.26L0.3 0.04" />
        </g>
      </svg>
    </span>
  );
}

// La tarjeta del juego fuera de la sesión (en Hoy, en una línea; en Semana, con sus marcas): lo que lleva recorrido su
// lobo en los descansos y un minuto de práctica, que no cuenta para la travesía. Todo sale de lo guardado en el móvil.
export function TarjetaTravesia({ compacta = false }) {
  const { atleta, api } = useApp() || {};
  const [abierta, setAbierta] = useState(false);
  const [mapa, setMapa] = useState(false);
  const [t, setT] = useState(() => (atleta?.id ? leerTravesia(atleta.id) : null));
  // (060) sube lo pendiente y trae lo de la base (otro móvil): el total y lo de esta semana
  const [semana, setSemana] = useState(null);
  useEffect(() => {
    if (!atleta?.id) return undefined;
    let vivo = true;
    sincronizarTravesia(api, atleta.id, { traer: true }).then((r) => { if (!vivo) return; setT(r.travesia); if (r.semanas) setSemana(metrosDeLaSemana(r.travesia, r.semanas, lunesDe(hoyISO()))); });
    return () => { vivo = false; };
  }, [atleta?.id]);
  // (belleza) el lobo de la tarjeta cruza una vez, cuando la tarjeta se ve (no se queda moviéndose todo el rato)
  const tarjeta = useRef(null);
  const [vista, setVista] = useState(false);
  useEffect(() => {
    const el = tarjeta.current;
    if (!el || vista || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) { io.disconnect(); setVista(true); } }, { threshold: 0.6 });
    io.observe(el);
    return () => io.disconnect();
  }, [vista, !!t]);
  if (!atleta?.id || !t) return null;
  const cerrar = () => { setAbierta(false); setT(leerTravesia(atleta.id)); };
  // (tanda 1) el reto del día, con lo jugado hoy en los descansos
  const reto = retoDelDia(hoyISO()), pr = progresoReto(reto, hoyDe(t, hoyISO()));
  const pos = posicionEnRuta(t.total);
  // (belleza) el cielo de la tarjeta, el de esta hora (como en el juego): de noche, al alba, de día o al atardecer
  const fase = ambiente({ total: t.total }).fase;
  return (
    <section ref={tarjeta} class={`travesia-tarjeta${compacta ? ' compacta' : ''}${vista ? ' tv-vista' : ''}`} data-fase={fase} aria-label="La travesía, el juego de tus descansos">
      <LoboAlTrote />
      <span class="travesia-tarjeta-luna" aria-hidden="true" />
      <div class="travesia-tarjeta-texto">
        <button type="button" class="travesia-tarjeta-abrir" onClick={() => setMapa(true)} aria-label="Ver tu travesía: el mapa, las postales, la manada y tus lobos" />
        <strong>La travesía</strong>
        <span>{t.total > 0 ? <>Tu lobo lleva <b class="num">{textoDistancia(t.total)}</b>{t.estrellas > 0 ? <> y <b class="num">{t.estrellas}</b> {t.estrellas === 1 ? 'estrella' : 'estrellas'}</> : null}</>
          : 'El juego de tus descansos: avanza solo cuando entrenas'}</span>
        {!compacta && <span class={`travesia-tarjeta-reto${pr.hecho ? ' hecho' : ''}`}>{pr.hecho ? 'Reto de hoy, cumplido' : `Reto de hoy: ${reto.texto.toLowerCase()}`}{!pr.hecho && pr.valor > 0 ? ` (${pr.valor}/${pr.meta})` : ''}{t.retos > 0 ? ` · ${t.retos} ${t.retos === 1 ? 'cumplido' : 'cumplidos'}` : ''}</span>}
        {!compacta && t.total > 0 && pos.siguiente && <span class="travesia-tarjeta-ruta">{pos.ruta.nombre}: a {String(pos.faltan).replace('.', ',')} km de {pos.siguiente[0]}</span>}
        {!compacta && (t.mejor > 0 || t.practica > 0 || semana > 0) && (
          <span class="travesia-tarjeta-marcas">
            {semana > 0 && <span>Esta semana: <b class="num">{textoDistancia(semana)}</b></span>}
            {t.mejor > 0 && <span>Mejor etapa: <b class="num">{textoDistancia(t.mejor)}</b></span>}
            {t.practica > 0 && <span>Práctica: <b class="num">{textoDistancia(t.practica)}</b></span>}
          </span>
        )}
      </div>
      <button type="button" class="btn btn-peq travesia-tarjeta-boton" onClick={() => setAbierta(true)} aria-label="Practicar un minuto en La travesía (no cuenta para la travesía)">Practicar</button>
      {abierta && <Travesia atletaId={atleta.id} practica alCerrar={cerrar} />}
      {mapa && <HojaTravesia alCerrar={() => setMapa(false)} />}
    </section>
  );
}
