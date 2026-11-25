// Comidas del atleta (v0.26): su semana (el menú que organiza él) y sus recetas (las que le pone su coach para
// cada comida del día). En Hoy, lo de hoy en una tarjeta.
import { useState } from 'preact/hooks';
import { usePestanasDeslizables } from '../deslizar.js';
import { CabeceraGrande, useApp, useCarga, useUnaVez, Icono, Pestanas, Vacio, Siluetas, ErrorCaja, Pista, usePreferencia, useApuntar } from '../comunes.jsx';
import { MenuSemana, VistaRecetario, HojaReceta, HojaElegirDia, HojaTusComidas, FotoReceta } from '../ComidasComun.jsx';
import { NOMBRE_TOMA, ordenarTomas, totalesDia, textoMacros, tomaDeLaHora } from '../../logica/comidas.js';
import { usePlatos, BotonesPlato, HojaFotoPlato, HojaFuera } from '../Platos.jsx';
import { planVigente, objetivoDelDia, fmtKcal } from '../../logica/nutricion.js';
import { hoyISO } from '../../logica/fechas.js';
import { num } from '../../logica/calculos.js';
import { BandaDemo } from '../App.jsx';
import { RecetarioEquipo, useRecetarioEquipo } from '../RecetarioEquipo.jsx';
import { comoAsignacion, ajusteParaTi } from '../../logica/recetario-equipo.js';
import { GuiaSugerida } from '../Guias.jsx';
import { OCASIONES } from '../../logica/guias.js';
const VISTAS_COMIDAS = [['menu', 'Tu semana'], ['recetas', 'Tus recetas']];
// (055) con recetas para todo el equipo, una vista más
const VISTAS_CON_EQUIPO = [...VISTAS_COMIDAS, ['equipo', 'Recetario']];
const SUB_COMIDAS = { menu: 'Organiza lo que vas a comer cada día', recetas: 'Las opciones de tu coach para cada comida', equipo: 'Las recetas del equipo, para todos' };

export function Comidas({ salud, recargarConsentimientos, irA }) {
  const { api, atleta } = useApp();
  const [vistaGuardada, setVista] = usePreferencia('fbe-comidas-vista', 'menu');
  // (055) el recetario del equipo, si lo hay: una vista más, y sus recetas cuentan para la lista de la compra
  const equipo = useRecetarioEquipo(atleta.id);
  const hayEquipo = (equipo.datos?.recetas.length || 0) > 0;
  const recetario = useCarga(() => api.recetario(atleta.id), [atleta.id], { recuerdo: `recetario:${api.uid()}:${atleta.id}` });
  // (FBE Esencial) a quien va por su cuenta nadie le pone recetas: sin ninguna suya y con recetario del equipo, sin «Tus recetas»
  const suyo = atleta?.modalidad === 'por_su_cuenta';
  const sinSuyas = suyo && hayEquipo && !!recetario.datos && !recetario.datos.recetas.length;
  const VISTAS = sinSuyas ? VISTAS_CON_EQUIPO.filter(([v]) => v !== 'recetas') : hayEquipo ? VISTAS_CON_EQUIPO : VISTAS_COMIDAS;
  const vista = VISTAS.some(([v]) => v === vistaGuardada) ? vistaGuardada : 'menu';
  const desliz = usePestanasDeslizables(VISTAS, vista, setVista);
  const planes = useCarga(() => api.planesNutricion(atleta.id).catch(() => []), [atleta.id], { recuerdo: `planes-comidas:${atleta.id}` });
  const [receta, setReceta] = useState(null); // asignación abierta
  const [anadir, setAnadir] = useState(null); // { a, raciones }
  const [comidas, setComidas] = useState(false);
  const r = recetario.datos;
  // Lo apuntado del recetario del equipo también sale, con sus ingredientes, en la lista de la compra
  // y se pueden elegir al añadir una comida al menú
  // (recetas ajustadas) con kcal en su plan, las del equipo se escalan a las kcal de cada comida (las de un día de entreno)
  const kcalDia = objetivoDelDia(planVigente(planes.datos || [], hoyISO()), true)?.kcal || null;
  const ajusteEquipo = r && kcalDia ? (receta, toma = null) => ajusteParaTi(receta, { tomas: r.tomas, kcalDia, toma }) : null;
  const rMenu = r && hayEquipo ? { ...r, ajusteEquipo, equipo: equipo.datos.recetas, recetas: [...r.recetas, ...equipo.datos.recetas.filter((x) => !r.recetas.some((y) => y.id === x.id))] } : r;
  const darConsentimiento = async () => { await api.darConsentimientos(['datos_salud']); recargarConsentimientos?.(); };
  return (
    <div class="contenido">
      <CabeceraGrande>
        <div class="titulo"><h1>Comidas</h1><div class="sub">{suyo && vista === 'recetas' ? 'Tus recetas para cada comida' : SUB_COMIDAS[vista]}</div></div>
        {r ? <button class="btn btn-peq plano" onClick={() => setComidas(true)} aria-label={`Tus comidas del día: ${r.tomas.length}`}><Icono n="ajustes" /> {r.tomas.length} al día</button>
          /* (pulido 2.3) mientras carga, su sitio ya está: la cabecera no cambia de alto al llegar */
          : !recetario.error && <span class="btn btn-peq plano" style="visibility:hidden" aria-hidden="true"><Icono n="ajustes" /> 4 al día</span>}
      </CabeceraGrande>
      <BandaDemo />
      <Pestanas opciones={VISTAS} valor={vista} alCambiar={desliz.cambiar} etiqueta="Comidas" idBase="comidas" />
      <div class="pestana-panel deslizable" role="tabpanel" id="comidas-panel" aria-labelledby={`comidas-${vista}`} key={vista} ref={desliz.panel} {...desliz.gesto}>
        <ErrorCaja error={recetario.error} reintentar={() => recetario.recargar(true)} />
        {!r ? (!recetario.error && <Siluetas forma="tarjetas" n={3} texto="Cargando tus comidas" />) : vista === 'menu' ? (
          !salud ? <SinConsentimiento darConsentimiento={darConsentimiento} /> : (
            <>
              <Pista id="menu-semana" icono="calendario">Elige qué vas a comer cada día de entre tus recetas (o escríbelo). Ves cómo cuadra con tu plan y, al final, la lista de la compra.</Pista>
              <MenuSemana atletaId={atleta.id} recetario={rMenu} planes={planes.datos || []} />
            </>
          )
        ) : vista === 'equipo' ? (
          <RecetarioEquipo atletaId={atleta.id} ajuste={salud ? ajusteEquipo : null} alAnadir={salud ? (receta, raciones, factor = 1) => setAnadir({ a: { ...comoAsignacion(receta, r.tomas), factor }, raciones }) : null} />
        ) : (
          <VistaRecetario recetario={r} alAbrir={setReceta} vacio={(
            <div class="panel"><Vacio ilustracion="recetas" titulo="Aún no tienes recetas">{suyo ? 'En «Tu semana» puedes escribir lo que vas a comer cada día y ver cómo cuadra con tu plan.' : 'Tu coach te pondrá aquí las opciones para cada comida, con sus cantidades y cómo se preparan.'}</Vacio></div>
          )} />
        )}
      </div>
      {/* (filosofía) la guía de la fase en la que está su dieta, para quien quiera leer por qué */}
      {vista === 'menu' && r && OCASIONES[planVigente(planes.datos || [], hoyISO())?.fase] && <GuiaSugerida ocasion={planVigente(planes.datos || [], hoyISO()).fase} />}
      {receta && <HojaReceta a={receta} opcional={r?.opcional} alCerrar={() => setReceta(null)} alCambiar={() => { recetario.recargar(true); setReceta(null); }}
        alAnadir={salud ? (a, raciones) => { setReceta(null); setAnadir({ a, raciones }); } : null} />}
      {anadir && r && <HojaElegirDia a={anadir.a} raciones={anadir.raciones} tomas={r.tomas} ajustar={anadir.a.factor !== 1 && ajusteEquipo ? (t) => ajusteEquipo(anadir.a.receta, t)?.factor : null} alCerrar={() => setAnadir(null)} alGuardado={() => setVista('menu')} />}
      {comidas && r && <HojaTusComidas atletaId={atleta.id} tomas={r.tomas} alCerrar={() => setComidas(false)} alGuardado={() => recetario.recargar(true)} />}
    </div>
  );
}

function SinConsentimiento({ darConsentimiento }) {
  const [ocupado, una] = useUnaVez();
  return (
    <div class="panel"><Vacio icono="candado" imagen="menu-privado" titulo="Tu menú es un dato de salud" accion={<button class="btn btn-primario" disabled={ocupado} onClick={() => una(darConsentimiento)}>Dar el consentimiento</button>}>
      Para organizar lo que comes cada día hace falta tu consentimiento de datos de salud (lo puedes retirar cuando quieras en Perfil). Tus recetas las puedes ver igual.
    </Vacio></div>
  );
}

// (v0.207) MenuHoy, en su propio archivo (Hoy lo usa y así no carga Comidas entera al abrir la app)
export { MenuHoy } from './MenuHoy.jsx';

// (055) Recetas: el recetario del equipo para quien no lleva la nutrición con su coach (solo consulta y se las guarda)
export function Recetas() {
  const { atleta } = useApp();
  return (
    <div class="contenido">
      <CabeceraGrande>
        <div class="titulo"><h1>Recetas</h1><div class="sub">El recetario del equipo</div></div>
      </CabeceraGrande>
      <BandaDemo />
      <RecetarioEquipo atletaId={atleta.id} />
    </div>
  );
}

export { FotoReceta };
