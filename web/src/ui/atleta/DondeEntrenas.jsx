import { useState, useEffect } from 'preact/hooks';
import { Hoja, Icono, Segmentos, usePreferencia, useApp, useSinCoach } from '../comunes.jsx';
import { usePersonal } from './Personal.jsx';
import { materialDe, mismoMaterial } from '../../logica/perfil-mas.js';
import { LUGARES_ENTRENO, MATERIAL_PERFIL, PERFILES_DEFECTO, textoAdaptacion } from '../../logica/material.js';
import { Imagen, hayImagen } from '../Imagen.jsx';
import { imagenLugar } from '../../logica/imagenes.js';
import { useDeViaje } from './Viaje.jsx';

// (ilustraciones vivas) La franja del sitio elegido. Al cambiar de sitio, la imagen nueva se funde encima de la anterior
// cuando ha cargado (no se precarga nada: se pide al elegirla, como siempre); la anterior se quita al acabar el fundido.
// El hueco es el mismo de siempre (3:1); si una imagen no carga, se queda la anterior, y si no hay ninguna, nada.
const FUNDIDO_MS = 420;   // (lo que dura el fundido en imagenes.css: .cruce-capa)
function FranjaLugar({ id }) {
  const [capas, setCapas] = useState(() => [{ id, lista: true, primera: true }]);
  const [rotas, setRotas] = useState([]);
  // Otro sitio: su imagen entra encima (aún sin verse) y debajo queda solo la última que se veía
  useEffect(() => { setCapas((c) => (c[c.length - 1].id === id ? c : [...c.filter((x) => x.lista).slice(-1), { id, lista: false }])); }, [id]);
  const arriba = capas[capas.length - 1];
  // Acabado el fundido de la de arriba, la de debajo sobra
  useEffect(() => {
    if (!arriba.lista || capas.length < 2) return undefined;
    const t = setTimeout(() => setCapas((c) => c.slice(-1)), FUNDIDO_MS + 60);
    return () => clearTimeout(t);
  }, [arriba.id, arriba.lista, capas.length]);
  const vivas = capas.filter((c) => !rotas.includes(c.id));
  if (!hayImagen(id) || !vivas.length) return null;
  return (
    <div class="franja-ilu franja-pegada franja-cruce" aria-hidden="true">
      {vivas.map((c) => (
        <Imagen key={c.id} id={c.id} clase={`cruce-capa${c.primera ? ' primera' : ''}${c.lista ? ' lista' : ''}`} tamanos="(min-width: 720px) 640px, 100vw"
          alCargar={() => setCapas((cs) => cs.map((x) => (x.id === c.id ? { ...x, lista: true } : x)))} alFallar={(x) => setRotas((r) => [...r, x])} />
      ))}
    </div>
  );
}

// «¿Dónde entrenas hoy?» (v0.48): Gimnasio (lo de siempre), Casa o Viaje, cada uno con su material (en este móvil)
export function DondeEntrenas({ atletaId, lugar, cambios = {}, sinAlternativa = [], alElegir }) {
  const sinCoach = useSinCoach();
  const [perfiles, setPerfiles] = usePreferencia(`fbe-material-${atletaId}`, PERFILES_DEFECTO);
  const [editar, setEditar] = useState(null);
  const nombre = Object.fromEntries(LUGARES_ENTRENO);
  // (perfil, tanda 4, migración 073) el material también se guarda en su perfil (lo ve su coach y vale en todos sus
  // móviles): si allí hay otro, manda el de allí; al cambiarlo aquí, se guarda allí también
  const { api, propio } = useApp();
  const personal = usePersonal();
  useEffect(() => {
    const m = materialDe(personal.datos);
    if (m.deLaBase && !mismoMaterial(m, perfiles)) setPerfiles({ casa: m.casa, viaje: m.viaje });
  }, [personal.datos]);
  const guardarEnPerfil = () => {
    if (propio || !api?.guardarPerfil4) return;
    api.guardarPerfil4({ material: { casa: perfiles.casa || [], viaje: perfiles.viaje || [], mancuernas_kg: materialDe(personal.datos).mancuernas_kg } }).catch(() => {});
  };
  const viaje = useDeViaje();
  return (
    <section class="panel panel-pad donde-entrenas pila-s" aria-labelledby="donde-entrenas">
      {/* (imágenes) arriba, el sitio elegido: la sala de racks, el salón con las mancuernas o el gimnasio del hotel */}
      <FranjaLugar id={imagenLugar(lugar)} />
      <div class="separa">
        <strong id="donde-entrenas">¿Dónde entrenas hoy?</strong>
        {lugar !== 'gimnasio' && <button class="btn-texto" onClick={() => setEditar(lugar)}><Icono n="ajustes" /> Tu material</button>}
      </div>
      <Segmentos opciones={LUGARES_ENTRENO} valor={lugar} etiqueta="Dónde entrenas hoy" alCambiar={(v) => alElegir(v || 'gimnasio', perfiles)} />
      {/* (v0.143) de viaje (en otra zona horaria), a un toque el material de viaje */}
      {lugar === 'gimnasio' && viaje.deViaje && (
        <button type="button" class="btn-texto viaje-material" onClick={() => alElegir('viaje', perfiles)}><Icono n="ubicacion" /> Estás de viaje: entrenar con tu material de viaje</button>
      )}
      {lugar === 'gimnasio'
        ? <span class="mini terciario">Fuera del gimnasio, la app cambia lo que no puedas hacer con tu material por {sinCoach ? 'su alternativa' : 'las alternativas que ha marcado tu coach'}.</span>
        : <span class="mini terciario">{textoAdaptacion({ cambios, sinAlternativa }, lugar)}. {sinCoach ? 'Solo por las alternativas de cada ejercicio.' : 'Solo por las alternativas de tu coach; él verá el cambio en tu registro.'}</span>}
      {editar && (
        <Hoja titulo={`Tu material ${editar === 'casa' ? 'en casa' : 'de viaje'}`} alCerrar={() => setEditar(null)}>
          <fieldset class="pila-s material-perfil">
            <legend class="peq secundario">Marca lo que tienes. Se guarda en tu perfil{sinCoach ? '' : ' (tu coach lo ve)'}.</legend>
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
          <button class="btn btn-primario btn-grande" onClick={() => { const l = editar; setEditar(null); guardarEnPerfil(); alElegir(l, perfiles, { rehacer: true }); }}>Listo: adaptar la sesión</button>
          <p class="mini terciario">{nombre[editar]}: lo que no se pueda hacer con esto se cambia por {sinCoach ? 'su alternativa' : 'una alternativa que tu coach haya marcado'}; si no hay ninguna, se queda y te lo dice.</p>
        </Hoja>
      )}
    </section>
  );
}
