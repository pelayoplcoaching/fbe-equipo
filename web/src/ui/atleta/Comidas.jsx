// Comidas del atleta (v0.26): su semana (el menú que organiza él) y sus recetas (las que le pone su coach para
// cada comida del día). En Hoy, lo de hoy en una tarjeta.
import { useState } from 'preact/hooks';
import { useApp, useCarga, useUnaVez, Icono, Pestanas, Vacio, Siluetas, ErrorCaja, Pista, usePreferencia } from '../comunes.jsx';
import { MenuSemana, VistaRecetario, HojaReceta, HojaElegirDia, HojaTusComidas, FotoReceta } from '../ComidasComun.jsx';
import { NOMBRE_TOMA, ordenarTomas, totalesDia, textoMacros } from '../../logica/comidas.js';
import { planVigente, objetivoDelDia, fmtKcal } from '../../logica/nutricion.js';
import { hoyISO } from '../../logica/fechas.js';
import { num } from '../../logica/calculos.js';
import { BandaDemo } from '../App.jsx';

export function Comidas({ salud, recargarConsentimientos, irA }) {
  const { api, atleta } = useApp();
  const [vista, setVista] = usePreferencia('fbe-comidas-vista', 'menu');
  const recetario = useCarga(() => api.recetario(atleta.id), [atleta.id]);
  const planes = useCarga(() => api.planesNutricion(atleta.id).catch(() => []), [atleta.id]);
  const [receta, setReceta] = useState(null); // asignación abierta
  const [anadir, setAnadir] = useState(null); // { a, raciones }
  const [comidas, setComidas] = useState(false);
  const r = recetario.datos;
  const darConsentimiento = async () => { await api.darConsentimientos(['datos_salud']); recargarConsentimientos?.(); };
  return (
    <div class="contenido">
      <header class="cabecera">
        <div class="titulo"><h1>Comidas</h1><div class="sub">{vista === 'menu' ? 'Organiza lo que vas a comer cada día' : 'Las opciones de tu coach para cada comida'}</div></div>
        {r && <button class="btn btn-peq plano" onClick={() => setComidas(true)} aria-label={`Tus comidas del día: ${r.tomas.length}`}><Icono n="ajustes" /> {r.tomas.length} al día</button>}
      </header>
      <BandaDemo />
      <Pestanas opciones={[['menu', 'Tu semana'], ['recetas', 'Tus recetas']]} valor={vista} alCambiar={setVista} etiqueta="Comidas" idBase="comidas" />
      <div class="pestana-panel" role="tabpanel" id="comidas-panel" aria-labelledby={`comidas-${vista}`} key={vista}>
        <ErrorCaja error={recetario.error} reintentar={() => recetario.recargar(true)} />
        {!r ? (!recetario.error && <Siluetas forma="tarjetas" n={3} texto="Cargando tus comidas" />) : vista === 'menu' ? (
          !salud ? <SinConsentimiento darConsentimiento={darConsentimiento} /> : (
            <>
              <Pista id="menu-semana" icono="calendario">Elige qué vas a comer cada día de entre tus recetas (o escríbelo). Ves cómo cuadra con tu plan y, al final, la lista de la compra.</Pista>
              <MenuSemana atletaId={atleta.id} recetario={r} planes={planes.datos || []} />
            </>
          )
        ) : (
          <VistaRecetario recetario={r} alAbrir={setReceta} vacio={(
            <div class="panel"><Vacio icono="receta" titulo="Aún no tienes recetas">Tu coach te pondrá aquí las opciones para cada comida, con sus cantidades y cómo se preparan.</Vacio></div>
          )} />
        )}
      </div>
      {receta && <HojaReceta a={receta} alCerrar={() => setReceta(null)} alCambiar={() => { recetario.recargar(true); setReceta(null); }}
        alAnadir={salud ? (a, raciones) => { setReceta(null); setAnadir({ a, raciones }); } : null} />}
      {anadir && r && <HojaElegirDia a={anadir.a} raciones={anadir.raciones} tomas={r.tomas} alCerrar={() => setAnadir(null)} alGuardado={() => setVista('menu')} />}
      {comidas && r && <HojaTusComidas atletaId={atleta.id} tomas={r.tomas} alCerrar={() => setComidas(false)} alGuardado={() => recetario.recargar(true)} />}
    </div>
  );
}

function SinConsentimiento({ darConsentimiento }) {
  const [ocupado, una] = useUnaVez();
  return (
    <div class="panel"><Vacio icono="candado" titulo="Tu menú es un dato de salud" accion={<button class="btn btn-primario" disabled={ocupado} onClick={() => una(darConsentimiento)}>Dar el consentimiento</button>}>
      Para organizar lo que comes cada día hace falta tu consentimiento de datos de salud (lo puedes retirar cuando quieras en Perfil). Tus recetas las puedes ver igual.
    </Vacio></div>
  );
}

// En Hoy: lo que tienes en el menú para hoy, para ir marcando. Sin nada (y si solo llevas la nutrición), un
// acceso para organizarlo. compacto: sin menú, no sale.
export function MenuHoy({ irA, salud, darConsentimiento, compacto = false }) {
  const { api, atleta, aviso } = useApp();
  const hoy = hoyISO();
  const menu = useCarga(() => (salud ? api.menuSemana(atleta.id, hoy).catch(() => []) : Promise.resolve([])), [atleta.id, salud]);
  const recetario = useCarga(() => api.recetario(atleta.id).catch(() => null), [atleta.id]);
  const planes = useCarga(() => (compacto ? Promise.resolve([]) : api.planesNutricion(atleta.id).catch(() => [])), [atleta.id]);
  const [ocupado, una] = useUnaVez();
  const deHoy = (menu.datos || []).filter((e) => e.fecha === hoy);
  if (compacto && !deHoy.length) return null;
  if (!salud) {
    return compacto ? null : (
      <section class="seccion seccion-menu-hoy"><div class="seccion-cab"><h2>Tu menú de hoy</h2></div>
        <div class="panel panel-pad pila-s"><p class="peq">Para organizar tu menú hace falta tu consentimiento de datos de salud.</p>
          <button class="btn" disabled={ocupado} onClick={() => una(darConsentimiento)}>Dar el consentimiento</button></div></section>
    );
  }
  const tomas = ordenarTomas([...(recetario.datos?.tomas || []), ...deHoy.map((e) => e.toma)]);
  const t = totalesDia(deHoy);
  const obj = objetivoDelDia(planVigente(planes.datos || [], hoy), true);
  const marcar = (e) => una(async () => { try { await api.cambiarMenu(e, { hecho: !e.hecho }); menu.recargar(true); } catch (err) { aviso(err.message, 'error'); } });
  return (
    <section class="seccion seccion-menu-hoy">
      <div class="seccion-cab"><h2>Tu menú de hoy</h2><button class="btn-texto" onClick={() => irA('comidas')}><Icono n="calendario" /> Tu semana</button></div>
      {!deHoy.length ? (
        <button class="panel panel-pad menu-hoy-vacio" onClick={() => irA('comidas')}>
          <Icono n="receta" />
          <span class="pila-xs"><strong>Organiza lo que vas a comer</strong><span class="peq secundario">{recetario.datos?.asignaciones.length ? 'Elige de tus recetas para cada comida del día.' : 'Cuando tu coach te ponga recetas, las elegirás de aquí. También puedes escribirlo.'}</span></span>
          <Icono n="derecha" />
        </button>
      ) : (
        <div class="panel">
          <ul class="lista">
            {tomas.filter((x) => deHoy.some((e) => e.toma === x)).map((x) => (
              <li key={x} class="panel-pad pila-xs">
                <span class="etq">{NOMBRE_TOMA[x]}</span>
                {deHoy.filter((e) => e.toma === x).map((e) => (
                  <div class={`entrada-menu ${e.hecho ? 'hecha' : ''}`} key={e.id}>
                    <button type="button" class="casilla-redonda" aria-pressed={e.hecho ? 'true' : 'false'} aria-label={`${e.texto}: ${e.hecho ? 'comida' : 'sin comer'}`} disabled={ocupado} onClick={() => marcar(e)}>{e.hecho && <Icono n="hecho" />}</button>
                    <span class="entrada-texto"><span class={e.hecho ? 'tachado' : ''}>{e.texto}{Number(e.raciones) !== 1 ? <span class="terciario num"> ×{num(e.raciones, 2)}</span> : ''}</span>{e.kcal != null && <span class="mini terciario num">{textoMacros(e, true)}</span>}</span>
                  </div>
                ))}
              </li>
            ))}
          </ul>
          {t.conDatos > 0 && <div class="panel-pad mini secundario num">En el menú: {fmtKcal(t.kcal)} kcal y {num(t.proteina_g, 0)} g de proteína{obj ? <> <span class="terciario">(tu objetivo: {fmtKcal(obj.kcal)} y {num(obj.proteina, 0)} g)</span></> : ''}</div>}
        </div>
      )}
    </section>
  );
}

export { FotoReceta };
