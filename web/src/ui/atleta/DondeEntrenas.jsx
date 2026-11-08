import { useState } from 'preact/hooks';
import { Hoja, Icono, Segmentos, usePreferencia } from '../comunes.jsx';
import { LUGARES_ENTRENO, MATERIAL_PERFIL, PERFILES_DEFECTO, textoAdaptacion } from '../../logica/material.js';
import { Imagen } from '../Imagen.jsx';
import { imagenLugar } from '../../logica/imagenes.js';

// «¿Dónde entrenas hoy?» (v0.48): Gimnasio (lo de siempre), Casa o Viaje, cada uno con su material (en este móvil)
export function DondeEntrenas({ atletaId, lugar, cambios = {}, sinAlternativa = [], alElegir }) {
  const [perfiles, setPerfiles] = usePreferencia(`fbe-material-${atletaId}`, PERFILES_DEFECTO);
  const [editar, setEditar] = useState(null);
  const nombre = Object.fromEntries(LUGARES_ENTRENO);
  return (
    <section class="panel panel-pad donde-entrenas pila-s" aria-labelledby="donde-entrenas">
      {/* (imágenes) arriba, el sitio elegido: la sala de racks, el salón con las mancuernas o el gimnasio del hotel */}
      <Imagen key={imagenLugar(lugar)} id={imagenLugar(lugar)} clase="franja-ilu franja-pegada" tamanos="(min-width: 720px) 640px, 100vw" />
      <div class="separa">
        <strong id="donde-entrenas">¿Dónde entrenas hoy?</strong>
        {lugar !== 'gimnasio' && <button class="btn-texto" onClick={() => setEditar(lugar)}><Icono n="ajustes" /> Tu material</button>}
      </div>
      <Segmentos opciones={LUGARES_ENTRENO} valor={lugar} etiqueta="Dónde entrenas hoy" alCambiar={(v) => alElegir(v || 'gimnasio', perfiles)} />
      {lugar === 'gimnasio'
        ? <span class="mini terciario">Fuera del gimnasio, la app cambia lo que no puedas hacer con tu material por las alternativas que ha marcado tu coach.</span>
        : <span class="mini terciario">{textoAdaptacion({ cambios, sinAlternativa }, lugar)}. Solo por las alternativas de tu coach; él verá el cambio en tu registro.</span>}
      {editar && (
        <Hoja titulo={`Tu material ${editar === 'casa' ? 'en casa' : 'de viaje'}`} alCerrar={() => setEditar(null)}>
          <fieldset class="pila-s material-perfil">
            <legend class="peq secundario">Marca lo que tienes. Se guarda en este móvil.</legend>
            {MATERIAL_PERFIL.map(([k, t]) => (
              <label class="casilla" key={k}>
                <input type="checkbox" checked={(perfiles[editar] || []).includes(k)}
                  onChange={(e) => {
                    const actual = new Set(perfiles[editar] || []);
                    if (e.currentTarget.checked) actual.add(k); else actual.delete(k);
                    setPerfiles({ ...perfiles, [editar]: [...actual] });
                  }} />
                <span>{t}</span>
              </label>
            ))}
          </fieldset>
          <button class="btn btn-primario btn-grande" onClick={() => { const l = editar; setEditar(null); alElegir(l, perfiles, { rehacer: true }); }}>Listo: adaptar la sesión</button>
          <p class="mini terciario">{nombre[editar]}: lo que no se pueda hacer con esto se cambia por una alternativa que tu coach haya marcado; si no hay ninguna, se queda y te lo dice.</p>
        </Hoja>
      )}
    </section>
  );
}
