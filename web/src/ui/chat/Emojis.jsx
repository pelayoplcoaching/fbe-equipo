import { useMemo, useState } from 'preact/hooks';
import { CATEGORIAS_EMOJI, leerRecientes, TONOS_PIEL, conTono, admiteTono, leerTono, guardarTono, leerReacciones, guardarReacciones, REACCIONES_DEFECTO } from '../../logica/emojis.js';
import { Icono, Hoja } from '../comunes.jsx';

// El selector de emojis del chat (v0.55), como WhatsApp: en el móvil ocupa el sitio del teclado. Las categorías (con
// «Recientes» primero si hay), y una rejilla de botones; tocar uno lo mete donde está el cursor. Sin librerías: la
// lista es nuestra (logica/emojis.js) y los pinta el sistema.
const almacen = () => { try { return window.localStorage; } catch { return null; } };

export function PanelEmojis({ alElegir, recientes: recientesDados = null }) {
  const recientes = recientesDados || leerRecientes(almacen());
  const cats = useMemo(() => [...(recientes.length ? [['recientes', 'Recientes', '🕘', recientes]] : []), ...CATEGORIAS_EMOJI], [recientes.join('')]);
  const [cat, setCat] = useState(cats[0][0]);
  // v0.56: el tono de piel (como WhatsApp: el elegido lo llevan las manos y las personas que lo admiten)
  const [tono, setTono] = useState(() => leerTono(almacen()));
  const [verTonos, setVerTonos] = useState(false);
  const elegirTono = (t) => { setTono(t); guardarTono(almacen(), t); setVerTonos(false); };
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
      <div class="panel-emojis-tonos">
        <button type="button" class="btn btn-peq panel-emojis-tono" aria-expanded={verTonos ? 'true' : 'false'} onClick={() => setVerTonos((v) => !v)}
          aria-label={`Tono de piel: ${TONOS_PIEL.find(([k]) => k === tono)?.[1] || TONOS_PIEL[0][1]}. Cambiar`}><span aria-hidden="true">{conTono('✋', tono)}</span></button>
        {verTonos && (
          <div class="fila" role="radiogroup" aria-label="Tono de piel">
            {TONOS_PIEL.map(([k, t, e]) => (
              <button key={k || 'sin'} type="button" role="radio" class="emoji-boton" aria-checked={tono === k ? 'true' : 'false'} aria-label={t} onMouseDown={(ev) => ev.preventDefault()} onClick={() => elegirTono(k)}>{e}</button>
            ))}
          </div>
        )}
      </div>
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
        {actual[3].map((e0) => {
          const e = admiteTono(e0) ? conTono(e0, tono) : e0;
          return <button key={e0} type="button" class="emoji-boton" onMouseDown={(ev) => ev.preventDefault()} onClick={() => alElegir(e)}>{e}</button>;
        })}
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

// v0.56: tus seis reacciones rápidas (las del menú de cada mensaje): toca una casilla y elige el emoji que va en ella.
// Se guardan en este móvil, para tu cuenta.
export function HojaReaccionesRapidas({ uid, alCerrar }) {
  const [lista, setLista] = useState(() => leerReacciones(almacen(), uid));
  const [hueco, setHueco] = useState(0);
  const poner = (e) => {
    const n = [...lista];
    const ya = n.indexOf(e);
    if (ya >= 0 && ya !== hueco) n[ya] = n[hueco];
    n[hueco] = e;
    setLista(guardarReacciones(almacen(), uid, n));
    setHueco((h) => (h + 1) % 6);
  };
  return (
    <Hoja titulo="Tus reacciones rápidas" alCerrar={alCerrar}>
      <p class="peq secundario">Las seis que salen al mantener pulsado un mensaje. Toca una casilla y después el emoji que quieres en ella.</p>
      <div class="reacciones-huecos" role="radiogroup" aria-label="Casilla que cambias">
        {lista.map((e, i) => (
          <button key={i} type="button" role="radio" aria-checked={hueco === i ? 'true' : 'false'} class={`menu-reaccion ${hueco === i ? 'activa' : ''}`} aria-label={`Casilla ${i + 1}: ${e}`} onClick={() => setHueco(i)}>
            <span aria-hidden="true">{e}</span>
          </button>
        ))}
      </div>
      <PanelEmojis alElegir={poner} />
      <div class="fila-envolver">
        <button type="button" class="btn btn-peq" onClick={() => setLista(guardarReacciones(almacen(), uid, REACCIONES_DEFECTO))}><Icono n="reiniciar" /> Las de siempre</button>
        <button type="button" class="btn btn-primario" onClick={alCerrar}><Icono n="hecho" /> Listo</button>
      </div>
    </Hoja>
  );
}
