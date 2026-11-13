import { useEffect, useState } from 'preact/hooks';
import { useApp } from '../comunes.jsx';
import { perezoso } from '../perezoso.jsx';
import { leerTravesia, sincronizarTravesia } from '../travesia.js';
import { textoDistancia, metrosDeLaSemana, retoDelDia, progresoReto, hoyDe } from '../../logica/travesia.js';
import { posicionEnRuta } from '../../logica/travesia-ruta.js';
import { hoyISO, lunesDe } from '../../logica/fechas.js';

// «La travesía», el juego del descanso: su trozo (el juego y cómo se pinta) solo se pide al abrirlo
export const Travesia = perezoso(() => import('./Travesia.jsx'), 'Travesia', { mientras: null });
// (tanda 3) «Tu travesía»: el mapa, las postales, la manada, los lobos y las constelaciones
const HojaTravesia = perezoso(() => import('./TravesiaHoja.jsx'), 'HojaTravesia', { mientras: null });

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
  if (!atleta?.id || !t) return null;
  const cerrar = () => { setAbierta(false); setT(leerTravesia(atleta.id)); };
  // (tanda 1) el reto del día, con lo jugado hoy en los descansos
  const reto = retoDelDia(hoyISO()), pr = progresoReto(reto, hoyDe(t, hoyISO()));
  const pos = posicionEnRuta(t.total);
  return (
    <section class={`travesia-tarjeta${compacta ? ' compacta' : ''}`} aria-label="La travesía, el juego de tus descansos">
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
