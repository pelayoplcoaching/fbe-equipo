// «Paleta» (color, mejora 20; color 2, 18): todo el color de la app de un vistazo, para revisarlo. Solo en la demo
// (?demo&paleta); las muestras son inventadas. Se puede cambiar el tema, el acento, el alto contraste y la ayuda para
// daltonismo aquí mismo (no se guarda nada): la tabla de contraste se recalcula con lo elegido.
import { useState, useEffect } from 'preact/hooks';
import { ESCALAS, PASOS, NOCHE, ACENTOS, SERIES, sobre, parejasPaleta } from '../logica/paleta.js';
import { cssAcento } from '../logica/acentos.js';

const ESTADOS = [['ok', 'Hecho'], ['aviso', 'Aviso'], ['alerta', 'Alerta'], ['info', 'Info']];
const GRADS = [['--grad-noche', 'Noche FBE'], ['--grad-amanecer', 'Amanecer'], ['--grad-record', 'Récord'], ['--grad-fuego', 'Fuego']];
const TONOS = [['fuerza', 'Fuerza'], ['cardio', 'Cardio'], ['movilidad', 'Movilidad'], ['descarga', 'Descarga'], ['descanso', 'Descanso'], ['hecha', 'Hecha']];
const nivel = (r) => (r >= 7 ? 'AAA' : r >= 4.5 ? 'AA' : r >= 3 ? '3:1' : 'no');

export function PaletaDemo() {
  const [tema, setTema] = useState('claro');
  const [acento, setAcento] = useState('morado');
  const [alto, setAlto] = useState(false);
  const [dalt, setDalt] = useState(false);
  useEffect(() => {
    const r = document.documentElement;
    r.setAttribute('data-theme', tema === 'oscuro' ? 'dark' : 'light');
    if (alto) r.setAttribute('data-contraste', 'alto'); else r.removeAttribute('data-contraste');
    if (dalt) r.setAttribute('data-daltonismo', ''); else r.removeAttribute('data-daltonismo');
    let hoja = document.getElementById('fbe-acento');
    if (!hoja) { hoja = document.createElement('style'); hoja.id = 'fbe-acento'; document.head.appendChild(hoja); }
    hoja.textContent = cssAcento(acento, { alto });
  }, [tema, acento, alto, dalt]);
  const a = ACENTOS.find((x) => x.id === acento) || ACENTOS[0];
  const parejas = parejasPaleta({ tema, acento: a, alto, daltonismo: dalt });
  return (
    <main class="pal-pagina" aria-labelledby="pal-titulo">
      <h1 id="pal-titulo">Paleta de FBE Equipo</h1>
      <p class="secundario">Las escalas (de 50 a 950), los estados, los degradados, la paleta de las gráficas y los acentos. Generado desde <code>logica/paleta.js</code>.</p>

      <div class="pal-controles" role="group" aria-label="Ver la paleta con">
        <label>Tema <select class="selector" value={tema} onChange={(e) => setTema(e.currentTarget.value)}><option value="claro">Claro</option><option value="oscuro">Oscuro</option></select></label>
        <label>Acento <select class="selector" value={acento} onChange={(e) => setAcento(e.currentTarget.value)}>{ACENTOS.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}</select></label>
        <label class="casilla"><input type="checkbox" checked={alto} onChange={(e) => setAlto(e.currentTarget.checked)} /> Alto contraste</label>
        <label class="casilla"><input type="checkbox" checked={dalt} onChange={(e) => setDalt(e.currentTarget.checked)} /> Daltonismo</label>
      </div>

      <h2>Contraste</h2>
      <table class="pal-tabla">
        <caption class="sr">Contraste de cada color de texto sobre la tarjeta y sobre el fondo de la página</caption>
        <thead><tr><th scope="col">Color</th><th scope="col">Sobre la tarjeta</th><th scope="col">Sobre el fondo</th></tr></thead>
        <tbody>
          {parejas.map((p) => (
            <tr key={p.nombre}>
              <th scope="row"><span class="pal-punto" style={{ background: p.color }} aria-hidden="true" /> {p.nombre}</th>
              {[p.tarjeta, p.fondo].map((r, i) => <td key={i}><span class="num">{r.toFixed(2)}</span> <span class={`pal-nivel pal-nivel-${nivel(r) === 'no' ? 'no' : 'si'}`}>{nivel(r)}</span></td>)}
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Componentes</h2>
      <div class="pal-componentes panel panel-pad">
        <div class="fila-envolver">
          <button type="button" class="btn btn-primario">Primario</button>
          <button type="button" class="btn">Normal</button>
          <button type="button" class="btn-texto">De texto</button>
          <button type="button" class="btn btn-primario" disabled>Desactivado</button>
        </div>
        <div class="fila-envolver">
          <span class="chip ok">Al día</span><span class="chip aviso">Vence pronto</span><span class="chip alerta">Retrasado</span><span class="chip info">Sin datos</span><span class="chip">Neutro</span>
        </div>
        <div class="fila-envolver">
          <input class="entrada" type="text" placeholder="Un campo de texto" aria-label="Campo de muestra" style="max-width:14rem" />
          <input type="checkbox" role="switch" class="interruptor" checked aria-label="Interruptor de muestra" readOnly />
          <input type="range" aria-label="Deslizador de muestra" style="max-width:9rem" />
        </div>
        <div class="progreso-barra" role="presentation"><span style="width:62%" /></div>
      </div>

      <h2>La tarjeta del día, según lo que toca</h2>
      <div class="pal-grads">{TONOS.map(([k, n]) => <div key={k} class="pal-grad pal-tono" data-tono={k}><span>{n}</span></div>)}</div>

      <h2>Escalas</h2>
      {Object.entries(ESCALAS).map(([k, esc]) => (
        <section key={k} class="pal-escala" aria-label={`Escala ${k}`}>
          <h3>{k}</h3>
          <div class="pal-fila">
            {PASOS.map((p) => <div key={p} class="pal-muestra" style={{ background: `var(--${k}-${p})` }} title={`--${k}-${p} ${esc[p]}`}><span style={{ color: sobre(esc[p]) }}>{p}</span></div>)}
          </div>
        </section>
      ))}
      <section class="pal-escala" aria-label="Noche (superficies del tema oscuro)">
        <h3>noche</h3>
        <div class="pal-fila">{Object.entries(NOCHE).map(([i, hex]) => <div key={i} class="pal-muestra" style={{ background: `var(--noche-${i})` }} title={`--noche-${i} ${hex}`}><span style={{ color: '#FFFFFF' }}>{i}</span></div>)}</div>
      </section>

      <h2>Estados</h2>
      <div class="pal-estados">
        {ESTADOS.map(([k, n]) => (
          <div key={k} class="pal-estado" style={{ background: `var(--${k}-suave)`, borderColor: `var(--${k}-borde)` }}>
            <b style={{ color: `var(--${k})` }}>{n}</b>
            <span class="pal-solido" style={{ background: `var(--${k}-solido)` }} aria-hidden="true" />
          </div>
        ))}
      </div>

      <h2>Degradados</h2>
      <div class="pal-grads">{GRADS.map(([v, n]) => <div key={v} class="pal-grad" style={{ background: `var(${v})` }}><span>{n}</span></div>)}</div>

      <h2>Gráficas y zonas</h2>
      <div class="pal-fila">{SERIES.claro.map((_, i) => <div key={i} class="pal-muestra" style={{ background: `var(--serie-${i + 1})` }}><span style={{ color: '#FFFFFF' }}>{i + 1}</span></div>)}</div>
      <div class="pal-fila">{[1, 2, 3, 4, 5].map((i) => <div key={i} class="pal-muestra" style={{ background: `color-mix(in srgb, var(--zona-${i}) 22%, var(--hoja))`, boxShadow: `inset 0 0 0 2px var(--zona-${i})` }}><span style={{ color: `var(--zona-${i}-t)` }}>Z{i}</span></div>)}</div>

      <h2>Acentos</h2>
      <div class="pal-acentos">
        {ACENTOS.map((x) => (
          <button type="button" key={x.id} class={`pal-acento${x.id === acento ? ' activo' : ''}`} aria-pressed={x.id === acento ? 'true' : 'false'} onClick={() => setAcento(x.id)}>
            <span class="pal-punto" style={{ background: x.claro.morado }} aria-hidden="true" />
            <span class="pal-punto" style={{ background: x.oscuro.morado }} aria-hidden="true" />
            <span>{x.nombre}</span>
          </button>
        ))}
      </div>
    </main>
  );
}
