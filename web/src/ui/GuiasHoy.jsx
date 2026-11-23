// (v0.208, rendimiento) Las dos piezas de las guías que salen en Hoy y en otras pantallas del día: la guía que viene a
// cuento (GuiaSugerida) y el mito de la semana. Antes estaban en Guias.jsx, con todo «Aprende» (el lector, las fichas, lo
// del coach…), que se cargaba entero al abrir la app; ahora la hoja de la guía se carga al abrirla.
import { useState, useMemo } from 'preact/hooks';
import { useApp, useCarga, Icono, Hoja, Cargando } from './comunes.jsx';
import { hoyISO } from '../logica/fechas.js';
import { Imagen, hayImagen } from './Imagen.jsx';
import { IMAGEN_MITO } from '../logica/imagenes.js';
import { mitosDeGuia, mitoDeLaSemana, numeroDeSemana, OCASIONES } from '../logica/guias.js';
import { guiaPorClave, guiasLigeras } from '../datos/guias.js';
import { perezoso } from './perezoso.jsx';

const HojaGuia = perezoso(() => import('./Guias.jsx'), 'HojaGuia', { mientras: null });
const Bloques = perezoso(() => import('./Guias.jsx'), 'Bloques', { mientras: <Cargando texto="Cargando" /> });

// La guía que viene a cuento (logica/guias.js, OCASIONES): una fila que abre esa sección en su hoja. Solo sale si la
// guía está y está publicada. Es una propuesta de lectura: no guarda nada ni cuenta nada a nadie.
export function GuiaSugerida({ ocasion }) {
  const { backend, api, perfil } = useApp();
  const o = OCASIONES[ocasion];
  const guias = useCarga(() => (o && perfil?.rol !== 'coach' ? guiasLigeras({ backend }).catch(() => []) : Promise.resolve([])), [!!o], { recuerdo: o ? `guias-ligeras:${api.uid()}` : null });
  const [abierta, setAbierta] = useState(false);
  const guia = o && (guias.datos || []).find((g) => g.clave === o.clave && g.publicada);
  if (!guia) return null;
  return (
    <>
      <button type="button" class="panel panel-pad por-que guia-sugerida" data-ocasion={ocasion} onClick={() => setAbierta(true)} aria-haspopup="dialog">
        <Icono n="biblioteca" />
        <span class="pila-xs"><span class="mini terciario">{o.cuando}</span><strong>{o.titulo}</strong><span class="peq secundario">{o.detalle}</span></span>
        <Icono n="derecha" />
      </button>
      {abierta && <HojaGuia guia={guia} soloSeccion={o.seccion} titulo={o.titulo} alCerrar={() => setAbierta(false)} />}
    </>
  );
}

// El mito de la semana (de la guía «mitos»): el mismo para todo el equipo, va rotando cada lunes. En Hoy, una tarjeta
// con el mito; al tocarla, lo que dice la evidencia. Una vez leído, se recoge hasta la semana siguiente (se apunta en
// este móvil, no en la base).
const claveMito = (uid) => `fbe-mito-visto:${uid}`;
const mitoVisto = (uid) => { try { return Number(localStorage.getItem(claveMito(uid))) || 0; } catch { return 0; } };
export function MitoDeLaSemana() {
  const { backend, api, perfil } = useApp();
  const hoy = hoyISO();
  const semana = numeroDeSemana(hoy);
  const [visto, setVisto] = useState(() => mitoVisto(api.uid()));
  const pedir = perfil?.rol !== 'coach' && visto !== semana;
  const guia = useCarga(() => (pedir ? guiaPorClave({ backend }, 'mitos').catch(() => null) : Promise.resolve(null)), [pedir], { recuerdo: pedir ? `guia-mitos:${api.uid()}` : null });
  const [abierto, setAbierto] = useState(false);
  const [entera, setEntera] = useState(false);
  const mito = useMemo(() => (guia.datos?.publicada ? mitoDeLaSemana(mitosDeGuia(guia.datos), hoy) : null), [guia.datos, hoy]);
  if (!mito || (visto === semana && !abierto && !entera)) return null;
  const cerrar = () => { setAbierto(false); try { localStorage.setItem(claveMito(api.uid()), String(semana)); } catch { /* sin sitio: saldrá otra vez */ } setVisto(semana); };
  return (
    <>
      {visto !== semana && (
        <button type="button" class={`panel panel-pad mito-semana${hayImagen(IMAGEN_MITO) ? ' con-ilu' : ''}`} onClick={() => setAbierto(true)} aria-haspopup="dialog">
          {hayImagen(IMAGEN_MITO) && <Imagen id={IMAGEN_MITO} clase="franja-ilu franja-pegada franja-mito" tamanos="(min-width: 720px) 640px, 100vw" />}
          <span class="mini mito-semana-k"><Icono n="pregunta" /> El mito de la semana</span>
          <strong class="mito-frase">«{mito.mito}»</strong>
          <span class="peq secundario mito-semana-pie">Qué dice la evidencia <Icono n="derecha" /></span>
        </button>
      )}
      {abierto && (
        <Hoja titulo="El mito de la semana" alCerrar={cerrar} ancho>
          <div class="pila lector-guia mito-hoja">
            <p class="mito-frase">«{mito.mito}»</p>
            {mito.tema && <p class="mini terciario">{mito.tema}</p>}
            <Bloques bloques={mito.bloques} />
            <button type="button" class="btn" style="justify-self:start" onClick={() => { cerrar(); setEntera(true); }}><Icono n="biblioteca" /> Ver todos los mitos</button>
          </div>
        </Hoja>
      )}
      {entera && <HojaGuia guia={guia.datos} alCerrar={() => setEntera(false)} />}
    </>
  );
}
