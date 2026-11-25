// FBE Esencial (alta, tanda 3): lo de la primera semana dentro de la sesión de quien va por su cuenta. La guía corta de la
// primera vez (dónde se apunta, qué es «te sobran», el ✓ y pedir que le ajusten las máquinas), «¿Qué peso pongo?» junto a
// un ejercicio sin kilos y, al terminar su primera sesión, cuándo es la siguiente y las agujetas. Va en su trozo.
import { useState } from 'preact/hooks';
import { useApp, useCarga, Icono } from '../comunes.jsx';
import { textoQuePeso, textoSiguiente, TEXTO_AGUJETAS } from '../../logica/esencial-primera.js';
import { fechaLarga } from '../../logica/esencial-alta.js';
import { Arte, ArteDuo } from './EsencialArte.jsx';
import { hoyISO } from '../../logica/fechas.js';
import { perezoso } from '../perezoso.jsx';

// (v0.248, apagado) sus kilos de partida (quien ya entrena), dentro de «¿Qué peso pongo?»
const KilosPartidaPista = perezoso(() => import('./EsencialEspera.jsx'), 'KilosPartidaPista', { mientras: null });

const clave = (id) => `fbe-esencial-guia:${id}`;
const vista = (id) => { try { return localStorage.getItem(clave(id)) === '1'; } catch { return false; } };

// (41 y 45) La primera vez: cómo se apunta, qué es «te sobran», el ✓ y lo de las máquinas. «Entendido» la quita (en este
// móvil); hasta entonces sale arriba en cada sesión.
export function GuiaPrimeraSesion() {
  const { atleta } = useApp();
  const [fuera, setFuera] = useState(() => vista(atleta.id));
  if (fuera) return null;
  const quitar = () => { try { localStorage.setItem(clave(atleta.id), '1'); } catch { /* */ } setFuera(true); };
  return (
    <section class="panel panel-pad pila-s alta-guia" aria-labelledby="alta-guia-t">
      <Arte id="esencial-primera-sesion" />
      <strong id="alta-guia-t">Tu primera sesión, en tres cosas</strong>
      <ol class="alta-guia-pasos">
        <li><strong>Apunta cada serie:</strong> los kilos y las repeticiones que has hecho.</li>
        <li><strong>«Te sobran 4-5»</strong> son las repeticiones que podrías haber hecho de más al acabar la serie: no se va al límite.</li>
        <li><strong>Si haces justo lo que te propone la app,</strong> basta con tocar ✓.</li>
      </ol>
      <ArteDuo ids={['esencial-te-sobran', 'esencial-ajustar-maquina']} />
      <p class="peq secundario">Y el primer día, pide a alguien de sala que te ajuste las máquinas: son cinco minutos y te ahorran un mes de dudas.</p>
      <button type="button" class="btn btn-peq" style="justify-self:start" onClick={quitar}>Entendido</button>
    </section>
  );
}

// (42) Junto a un ejercicio sin kilos, la primera vez que lo hace
export function QuePesoPongo({ rir, ejercicioId = null }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div class="alta-que-peso">
      <button type="button" class="btn-texto" aria-expanded={abierto ? 'true' : 'false'} onClick={() => setAbierto(!abierto)}><Icono n="pregunta" /> ¿Qué peso pongo?</button>
      {abierto && <Arte id="esencial-que-peso" />}
      {abierto && <p class="peq">{textoQuePeso(rir)}</p>}
      {abierto && ejercicioId && <KilosPartidaPista ejercicioId={ejercicioId} />}
    </div>
  );
}

// (46 y 49) Al terminar su primera sesión (la 1 de su semana 1, una vez en este móvil): la celebración, cuándo es la
// siguiente y las agujetas
export function FinPrimeraSesion({ sesion }) {
  const { api, atleta } = useApp();
  const ya = (() => { try { return localStorage.getItem(`fbe-esencial-primera:${atleta.id}`) === '1'; } catch { return false; } })();
  const d = useCarga(async () => {
    if (ya || !sesion?.semana_id) return null;
    const p = await api.programa(atleta.id);
    const w = (p.semanas || []).find((x) => x.id === sesion.semana_id);
    if (!w || w.numero !== 1 || p.bloque?.id !== w.bloque_id) return null;
    const ss = p.sesiones?.[w.id] || [];
    if (ss.filter((s) => s.completada && s.id !== sesion.id).length) return null;
    try { localStorage.setItem(`fbe-esencial-primera:${atleta.id}`, '1'); } catch { /* */ }
    return { siguiente: ss.filter((s) => s.id !== sesion.id && !s.completada).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))[0] || null };
  }, [sesion?.id]);
  if (!d.datos) return null;
  const sig = textoSiguiente(d.datos.siguiente, hoyISO(), fechaLarga);
  return (
    <section class="panel panel-pad pila-s alta-fin-primera" aria-labelledby="alta-fin-t">
      <Arte id="esencial-fin-primera" />
      <strong id="alta-fin-t"><Icono n="estrella" /> Tu primera sesión, hecha</strong>
      <span class="peq">Lo más difícil era empezar. {sig}</span>
      <span class="peq secundario">{TEXTO_AGUJETAS}</span>
    </section>
  );
}
