// (v0.140) «Ordenar Hoy»: qué diales salen arriba y qué secciones de Hoy se ven y en qué orden. En este móvil, al momento
// (cada cambio se ve detrás de la hoja). Las secciones con «Subir» / «Bajar» (como «Cambiar el orden» de la sesión);
// el cambio se anuncia. La tarjeta del día, los avisos de tu coach y «Tu día» no se mueven ni se quitan.
import { useRef, useState } from 'preact/hooks';
import { Hoja, Icono } from '../comunes.jsx';
import { Interruptor } from '../Ajustes.jsx';
import { ARRIBA_HOY, DIALES_HOY, leerPanel, moverSeccion, alternarSeccion, alternarDial, panelPorDefecto, nombreSeccion } from '../../logica/hoy-panel.js';

// pref / fijar: lo guardado (usePreferencia); disponibles: las secciones que hoy tienen algo; diales: los que puede tener
export function OrdenarHoy({ pref, fijar, disponibles, arriba = [], diales = [], alCerrar }) {
  const p = leerPanel(pref);
  const lista = useRef(null);
  const [anuncio, setAnuncio] = useState('');
  const secciones = p.orden.filter((id) => disponibles.includes(id));
  const mover = (id, d) => {
    const nuevo = moverSeccion(pref, id, d, disponibles);
    fijar(nuevo);
    const orden = leerPanel(nuevo).orden.filter((x) => disponibles.includes(x));
    const i = orden.indexOf(id);
    setAnuncio(`${nombreSeccion(id)}: ahora ${i === 0 ? 'la primera' : i === orden.length - 1 ? 'la última' : `la ${i + 1}.ª`} de ${orden.length}`);
    // el foco sigue al botón tocado, en su fila nueva (o al otro, si ya no se puede seguir en esa dirección)
    requestAnimationFrame(() => {
      const fila = lista.current?.querySelector(`[data-seccion-hoy="${id}"]`);
      const btn = fila?.querySelector(d < 0 ? '.ord-subir' : '.ord-bajar');
      (btn && btn.getAttribute('aria-disabled') !== 'true' ? btn : fila?.querySelector(d < 0 ? '.ord-bajar' : '.ord-subir'))?.focus({ preventScroll: true });
    });
  };
  const verArriba = ARRIBA_HOY.filter((s) => arriba.includes(s.id));
  const verDiales = DIALES_HOY.filter((d) => diales.includes(d.id));
  return (
    <Hoja titulo="Ordenar Hoy" alCerrar={alCerrar}>
      <p class="peq secundario">Solo en este móvil. La tarjeta de tu sesión, los avisos de tu coach y «Tu día» se quedan siempre arriba. Lo que quites no se pierde: queda plegado al final, en «Lo que has ocultado».</p>
      {verDiales.length > 0 && (
        <section class="pila-s">
          <h3 class="ordenar-hoy-tit">De un vistazo</h3>
          <div class="panel"><ul class="lista">
            {verDiales.map((d) => (
              <Interruptor key={d.id} id={`oh-dial-${d.id}`} texto={d.nombre} valor={!p.dialesOcultos.has(d.id)} alCambiar={() => fijar(alternarDial(pref, d.id))}
                ayuda={{ constancia: 'Las sesiones hechas de tu semana', carga: 'Tu carga frente a lo habitual', llegas: 'Lo que contestas en «¿Cómo llegas hoy?»', comida: 'Las kcal que te quedan hoy', pasos: 'Tus pasos de hoy, de Salud' }[d.id]} />
            ))}
          </ul></div>
        </section>
      )}
      {verArriba.length > 0 && (
        <section class="pila-s">
          <h3 class="ordenar-hoy-tit">Tarjetas</h3>
          <div class="panel"><ul class="lista">
            {verArriba.map((s) => <Interruptor key={s.id} id={`oh-${s.id}`} texto={s.nombre} valor={!p.ocultas.has(s.id)} alCambiar={() => fijar(alternarSeccion(pref, s.id))} />)}
          </ul></div>
        </section>
      )}
      {secciones.length > 0 && (
        <section class="pila-s">
          <h3 class="ordenar-hoy-tit">Secciones, en este orden</h3>
          <ol class="lista ord-lista ordenar-hoy-lista" ref={lista} aria-label="Secciones de Hoy, en orden">
            {secciones.map((id, i) => {
              const nombre = nombreSeccion(id);
              const oculta = p.ocultas.has(id);
              return (
                <li key={id} data-seccion-hoy={id} class={`ord-fila${oculta ? ' oculta' : ''}`}>
                  <span class="ord-pos num" aria-hidden="true">{i + 1}</span>
                  <span class="ord-nombre"><span>{nombre}</span>{oculta && <span class="mini terciario">Oculta</span>}</span>
                  <span class="ord-flechas">
                    <button type="button" class="btn btn-icono ordenar-hoy-ver" aria-pressed={oculta ? 'false' : 'true'} aria-label={`${oculta ? 'Mostrar' : 'Ocultar'} ${nombre}`}
                      onClick={() => fijar(alternarSeccion(pref, id))}><Icono n={oculta ? 'ojo' : 'ojo-abierto'} /></button>
                    {/* (aria-disabled y no disabled: el botón sigue enfocable al llegar arriba o abajo) */}
                    <button type="button" class="btn btn-icono ord-subir" aria-disabled={i === 0 ? 'true' : undefined} aria-label={`Subir ${nombre}`} onClick={() => i > 0 && mover(id, -1)}><Icono n="arriba" /></button>
                    <button type="button" class="btn btn-icono ord-bajar" aria-disabled={i === secciones.length - 1 ? 'true' : undefined} aria-label={`Bajar ${nombre}`} onClick={() => i < secciones.length - 1 && mover(id, 1)}><Icono n="abajo" /></button>
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      )}
      <p class="sr" aria-live="polite">{anuncio}</p>
      {!panelPorDefecto(pref) && <button type="button" class="btn btn-ancho plano" onClick={() => { fijar(null); setAnuncio('Hoy, como venía'); }}>Dejarlo como venía</button>}
      <button type="button" class="btn btn-primario btn-ancho" onClick={alCerrar}>Listo</button>
    </Hoja>
  );
}

