// «Paleta» (color, mejora 20): todas las escalas, los estados, los degradados, las gráficas y los acentos de un vistazo.
// Solo en la demo (?demo&paleta), para revisar el color; las muestras son inventadas. Sigue el tema y el acento del móvil.
import { ESCALAS, PASOS, NOCHE, ACENTOS, contraste, valor } from '../logica/paleta.js';
import { aplicarTema } from './ajustes.js';

const ESTADOS = [['ok', 'Hecho'], ['aviso', 'Aviso'], ['alerta', 'Alerta'], ['info', 'Info']];
const GRADS = [['--grad-noche', 'Noche FBE'], ['--grad-amanecer', 'Amanecer'], ['--grad-record', 'Récord'], ['--grad-fuego', 'Fuego']];

export function PaletaDemo() {
  aplicarTema();
  return (
    <main class="pal-pagina" aria-labelledby="pal-titulo">
      <h1 id="pal-titulo">Paleta de FBE Equipo</h1>
      <p class="secundario">Las escalas (de 50 a 950), los estados, los degradados, la paleta de las gráficas y los acentos. Generado desde <code>logica/paleta.js</code>.</p>

      <h2>Escalas</h2>
      {Object.entries(ESCALAS).map(([k, esc]) => (
        <section key={k} class="pal-escala" aria-label={`Escala ${k}`}>
          <h3>{k}</h3>
          <div class="pal-fila">
            {PASOS.map((p) => <div key={p} class="pal-muestra" style={{ background: `var(--${k}-${p})` }} title={`--${k}-${p} ${esc[p]}`}><span style={{ color: contraste(esc[p], '#FFFFFF') >= 4.5 ? '#FFFFFF' : ESCALAS.neutro[950] }}>{p}</span></div>)}
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

      <h2>Gráficas</h2>
      <div class="pal-fila">{[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <div key={i} class="pal-muestra" style={{ background: `var(--serie-${i})` }}><span style={{ color: '#FFFFFF' }}>{i}</span></div>)}</div>

      <h2>Acentos</h2>
      <div class="pal-acentos">
        {ACENTOS.map((a) => (
          <div key={a.id} class="pal-acento">
            <span class="pal-punto" style={{ background: a.claro.morado }} aria-hidden="true" />
            <span class="pal-punto" style={{ background: a.oscuro.morado }} aria-hidden="true" />
            <span>{a.nombre}</span>
          </div>
        ))}
      </div>
      <p class="peq terciario">Texto sobre el fondo: {contraste(valor('claro', 'tinta-3'), valor('claro', 'tiza'))}:1 (lo más flojo del tema claro).</p>
    </main>
  );
}
