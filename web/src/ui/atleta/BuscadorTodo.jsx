// (tacto 243, v0.273) Un solo buscador, en «Más»: tus sesiones, tus ejercicios, las recetas, las guías, las secciones y
// los ajustes, desde el mismo sitio. Una sesión se abre; un ejercicio enseña su ficha (gráficas, récords e historial);
// una receta o una guía llevan a su pantalla con el texto ya buscado; un ajuste, a Ajustes, con su fila a la vista.
// Va aparte: se pide al tocar «Buscar en la app».
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useApp, useCarga, Hoja, Icono } from '../comunes.jsx';
import { FichaEjercicio } from '../FichaEjercicio.jsx';
import { listaGuias } from '../../datos/guias.js';
import { fmtConDia } from '../../logica/fechas.js';
import { buscarTodo, ejerciciosDeHistorial } from '../../logica/buscar-todo.js';
import { pedirBusqueda } from '../busqueda-pedida.js';

// secciones: [[id, texto, icono]] (todas sus pestañas); irA(id); abrirSesion(id); alCerrar(); leerRecetas(): las del
// recetario (la pide AtletaApp, que ya tiene ese módulo: importarlo aquí lo sacaría a un archivo más del arranque)
export function BuscadorTodo({ secciones, irA, abrirSesion, alCerrar, leerRecetas }) {
  const { api, atleta, backend } = useApp();
  const [q, setQ] = useState('');
  const [ejercicio, setEjercicio] = useState(null);
  const entrada = useRef(null);
  const hay = (id) => secciones.some(([t]) => t === id);
  // Lo que se busca se pide una vez, al abrirlo (lo que ya estaba pedido en otra pantalla sale de lo recordado)
  const d = useCarga(() => Promise.all([
    api.entrenamientos(atleta.id).catch(() => []),
    api.historial(atleta.id).catch(() => []),
    hay('recetas') && leerRecetas ? leerRecetas().then((r) => r?.recetas || []).catch(() => []) : Promise.resolve([]),
    hay('aprende') ? listaGuias({ backend }).then((gs) => gs.filter((g) => g.publicada)).catch(() => []) : Promise.resolve([]),
  ]).then(([sesiones, series, recetas, guias]) => ({ sesiones, ejercicios: ejerciciosDeHistorial(series), recetas, guias })), [atleta.id]);
  useEffect(() => { entrada.current?.focus({ preventScroll: true }); }, []);
  const grupos = useMemo(() => buscarTodo(q, { secciones, ...(d.datos || {}) }, { fecha: fmtConDia }), [q, d.datos, secciones]);
  const abrir = (it) => {
    if (it.tipo === 'ejercicio') { setEjercicio(it.dato); return; }
    alCerrar();
    if (it.tipo === 'sesion') abrirSesion(it.id);
    else if (it.tipo === 'seccion') irA(it.id);
    else if (it.tipo === 'receta') { pedirBusqueda('recetas', it.titulo); irA('recetas'); }
    else if (it.tipo === 'guia') { pedirBusqueda('aprende', it.titulo); irA('aprende'); }
    else if (it.tipo === 'ajuste') {
      location.hash = '#ajustes';
      // (su fila, a la vista y marcada un instante, en cuanto Ajustes esté pintado)
      const fin = Date.now() + 4000;
      const mirar = () => {
        const el = it.ancla ? document.getElementById(it.ancla) : [...document.querySelectorAll('main .fila-ios, main li')].find((x) => x.textContent.trim().startsWith(it.titulo.split(' (')[0]));
        const fila = el?.closest('li, .fila-ios, label') || el;
        if (!fila) { if (Date.now() < fin) setTimeout(mirar, 150); return; }
        fila.scrollIntoView({ block: 'center', behavior: 'auto' });
        try { fila.animate([{ outline: '2px solid var(--morado)', outlineOffset: '2px' }, { outline: '2px solid transparent', outlineOffset: '2px' }], { duration: 1400, easing: 'ease-out' }); } catch { /* sin marca */ }
      };
      setTimeout(mirar, 350);
    }
  };
  const escrito = q.trim().length >= 2;
  return (
    <Hoja titulo="Buscar en la app" alCerrar={alCerrar} clase="hoja-completa bus-hoja">
      <div class="pila bus-raiz">
        <div class="buscador"><Icono n="buscar" /><input ref={entrada} class="entrada" type="search" enterkeyhint="search" maxLength={60} value={q} onInput={(e) => setQ(e.currentTarget.value)}
          placeholder="Una sesión, un ejercicio, una receta, un ajuste…" aria-label="Buscar en toda la app" /></div>
        <p class="sr" role="status">{escrito ? (grupos.length ? `${grupos.reduce((t, g) => t + g.total, 0)} resultados` : 'Sin resultados') : ''}</p>
        {!escrito && <p class="peq secundario">Escribe al menos dos letras. Busca en tus sesiones, tus ejercicios{hay('recetas') ? ', las recetas' : ''}{hay('aprende') ? ', las guías' : ''}, las secciones y los ajustes.</p>}
        {escrito && !grupos.length && <p class="peq secundario">{d.cargando && !d.datos ? 'Buscando…' : `Nada con «${q.trim()}».`}</p>}
        {grupos.map((g) => (
          <section key={g.grupo} class="pila-s" aria-label={g.grupo}>
            <h3 class="mes-etq bus-grupo">{g.grupo}{g.total > g.items.length && <span class="mini terciario num"> · {g.items.length} de {g.total}</span>}</h3>
            <div class="panel"><ul class="lista">
              {g.items.map((it) => (
                <li key={`${it.tipo}-${it.id}`}>
                  <button type="button" class="bus-fila" data-tipo={it.tipo} onClick={() => abrir(it)}>
                    <span class="bus-ico" aria-hidden="true"><Icono n={it.icono} /></span>
                    <span class="pila-xs bus-texto"><span class="bus-titulo">{it.titulo}</span>{it.detalle && <span class="mini terciario">{it.detalle}</span>}</span>
                    <Icono n="derecha" />
                  </button>
                </li>
              ))}
            </ul></div>
          </section>
        ))}
      </div>
      {ejercicio && <FichaEjercicio atletaId={atleta.id} ejercicio={ejercicio} alCerrar={() => setEjercicio(null)} />}
    </Hoja>
  );
}
