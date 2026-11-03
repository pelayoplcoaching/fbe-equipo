import { useMemo, useState } from 'preact/hooks';
import { CATEGORIAS_EMOJI, leerRecientes } from '../../logica/emojis.js';
import { Icono } from '../comunes.jsx';

// El selector de emojis del chat (v0.55), como WhatsApp: en el móvil ocupa el sitio del teclado. Las categorías (con
// «Recientes» primero si hay), y una rejilla de botones; tocar uno lo mete donde está el cursor. Sin librerías: la
// lista es nuestra (logica/emojis.js) y los pinta el sistema.
const almacen = () => { try { return window.localStorage; } catch { return null; } };

export function PanelEmojis({ alElegir, recientes: recientesDados = null }) {
  const recientes = recientesDados || leerRecientes(almacen());
  const cats = useMemo(() => [...(recientes.length ? [['recientes', 'Recientes', '🕘', recientes]] : []), ...CATEGORIAS_EMOJI], [recientes.join('')]);
  const [cat, setCat] = useState(cats[0][0]);
  const actual = cats.find(([k]) => k === cat) || cats[0];
  const tecla = (e) => {
    const i = cats.findIndex(([k]) => k === actual[0]);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const j = (i + (e.key === 'ArrowRight' ? 1 : -1) + cats.length) % cats.length;
      setCat(cats[j][0]);
      setTimeout(() => document.getElementById(`emoji-tab-${cats[j][0]}`)?.focus(), 0);
    }
  };
  return (
    <div class="panel-emojis" role="group" aria-label="Emojis">
      <div class="panel-emojis-cats" role="tablist" aria-label="Categorías de emojis" onKeyDown={tecla}>
        {cats.map(([k, t, ico]) => (
          <button key={k} type="button" role="tab" id={`emoji-tab-${k}`} aria-selected={k === actual[0] ? 'true' : 'false'} aria-controls="emoji-panel"
            tabIndex={k === actual[0] ? 0 : -1} aria-label={t} title={t} onClick={() => setCat(k)}>
            <span aria-hidden="true">{ico}</span>
          </button>
        ))}
      </div>
      <div class="panel-emojis-rejilla" role="tabpanel" id="emoji-panel" aria-labelledby={`emoji-tab-${actual[0]}`}>
        <p class="sr">{actual[1]}</p>
        {actual[3].map((e) => (
          <button key={e} type="button" class="emoji-boton" onMouseDown={(ev) => ev.preventDefault()} onClick={() => alElegir(e)}>{e}</button>
        ))}
      </div>
    </div>
  );
}

// El botón de la izquierda del cuadro de escribir: 😊 abre el panel; con él abierto, ⌨️ vuelve al teclado
export function BotonEmojis({ abierto, alCambiar, disabled = false }) {
  return (
    <button type="button" class="btn btn-icono plano chat-emoji-boton" aria-label={abierto ? 'Volver al teclado' : 'Emojis'} aria-expanded={abierto ? 'true' : 'false'}
      disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={alCambiar}>
      <Icono n={abierto ? 'teclado' : 'cara'} />
    </button>
  );
}
