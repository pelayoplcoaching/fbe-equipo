import { useEffect, useRef, useState } from 'preact/hooks';
import { useApp, useCarga, Icono, Cargando } from '../comunes.jsx';
import { construirResultados } from '../../logica/busqueda.js';

// Búsqueda rápida (Ctrl/Cmd + K): saltar a un atleta (o a una de sus pestañas), una sección,
// una plantilla, un ejercicio o una acción, sin soltar el teclado.

export function Buscador({ alCerrar, ir }) {
  const { api } = useApp();
  const datos = useCarga(() => Promise.all([api.atletas(), api.plantillas(), api.biblioteca()])
    .then(([atletas, plantillas, ejercicios]) => ({ atletas, plantillas, ejercicios })), []);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const entrada = useRef(null);
  const lista = useRef(null);
  const items = construirResultados(datos.datos, q);
  useEffect(() => { setSel(0); }, [q]);
  useEffect(() => { lista.current?.querySelector(`[data-i="${sel}"]`)?.scrollIntoView({ block: 'nearest' }); }, [sel]);
  const elegir = (it) => { if (!it) return; alCerrar({ navegar: true }); ir(it.destino); };
  const tecla = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(items.length - 1, s + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); elegir(items[sel]); }
    else if (e.key === 'Escape') { e.preventDefault(); alCerrar(); }
  };
  let grupo = null;
  return (
    <div class="buscador-velo" onClick={(e) => { if (e.target === e.currentTarget) alCerrar(); }}>
      <div class="paleta" role="dialog" aria-modal="true" aria-label="Búsqueda rápida">
        <div class="paleta-entrada">
          <Icono n="buscar" />
          <input ref={(el) => {
            // Foco en cuanto existe (sin esperar al efecto), para no perder la primera tecla de quien escribe rápido
            if (el && entrada.current !== el) el.focus();
            entrada.current = el;
          }} type="text" role="combobox" aria-expanded="true" aria-controls="paleta-lista" aria-autocomplete="list"
            aria-activedescendant={items[sel] ? `paleta-op-${sel}` : undefined} aria-label="Buscar atletas, plantillas, ejercicios o acciones"
            placeholder="Busca un atleta, una plantilla, un ejercicio…" value={q} onInput={(e) => setQ(e.currentTarget.value)} onKeyDown={tecla} />
          <kbd>Esc</kbd>
        </div>
        {datos.cargando && !datos.datos ? <Cargando /> : (
          <ul class="paleta-lista" id="paleta-lista" role="listbox" ref={lista} aria-label="Resultados">
            {!items.length && <li class="paleta-vacio" role="presentation">Nada coincide con «{q}».</li>}
            {items.map((it, i) => {
              const cab = it.grupo !== grupo ? (grupo = it.grupo) : null;
              return [
                cab && <li key={`g-${cab}`} class="paleta-grupo" role="presentation">{cab}</li>,
                <li key={it.id} id={`paleta-op-${i}`} data-i={i} role="option" aria-selected={i === sel ? 'true' : 'false'}
                  class={`paleta-op ${i === sel ? 'sel' : ''}`} onMouseMove={() => setSel(i)} onClick={() => elegir(it)}>
                  <span class="paleta-ico"><Icono n={it.icono} /></span>
                  <span class="pila-xs"><span class="paleta-titulo">{it.titulo}</span>{it.detalle && <span class="mini terciario">{it.detalle}</span>}</span>
                  {i === sel && <Icono n="derecha" />}
                </li>,
              ];
            })}
          </ul>
        )}
        <div class="paleta-pie mini terciario"><span><kbd>↑</kbd><kbd>↓</kbd> elegir</span><span><kbd>Enter</kbd> abrir</span><span>Prueba «ana seguimiento»</span></div>
      </div>
    </div>
  );
}
