// FBE Esencial, tanda 9 (v0.250): «La comida, acompañada». En su trozo (solo para quien va por su cuenta y lleva
// nutrición): la comida en «Tu revisión de la semana» (con «¿Por qué no cambia?», los avisos del peso y cuatro lecciones),
// las hojas de comida de «¿Qué necesitas?», «¿Por qué no cambia tu plan?» y la comida de viaje en Hoy, y la comida de la
// semana en el cierre del domingo. Lógica: logica/esencial-comida.js. Estilos: comida.css (clases cmd-*).
// Lo apagado hasta que Pelayo lo vea (APAGADO) se enseña en la demo con «?previa=1».
import { useEffect, useState } from 'preact/hooks';
import { useApp, useCarga, useUnaVez, Icono, Hoja } from '../comunes.jsx';
import { hoyISO, sumarDias } from '../../logica/fechas.js';
import { fechaLarga } from '../../logica/esencial-alta.js';
import { encendido, textoAjuste } from '../../logica/esencial-respuestas.js';
import { comidaDeLaSemana, porQueNoCambia, proteinaDeHoy, momentoViaje, mantenimientoDe, avisoDelPeso, AVISOS_PESO, leccionComida, LECCIONES_COMIDA, HOJAS_COMIDA } from '../../logica/esencial-comida.js';
import { fmtKcal } from '../../logica/nutricion.js';
import * as datos from '../../datos/api-esencial.js';
// (v0.253) sus ilustraciones (F2): las hojas de comida, tu comida de la semana y la comida de viaje
import { Arte } from './EsencialArte.jsx';
import { ARTE_COMIDA } from '../../logica/esencial-arte.js';

function usePrevia() {
  const { modo } = useApp();
  try { return modo === 'demo' && /[?&]previa=1(&|$)/.test(location.search); } catch { return false; }
}
const leer = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };
// ¿Encendido de verdad (para todos o en su cuenta) o solo en la vista previa?
const pendiente = (clave, previa) => previa && !encendido(clave, false);
const Pendiente = () => <p class="mini cmd-pendiente">Pendiente del visto bueno de Pelayo: solo se ve en esta vista previa.</p>;

// Lo común: el resumen de su nutrición, su antecedente de TCA y su viaje (solo si la regla de los viajes está encendida)
function useComida(previa) {
  const { api, backend, atleta } = useApp();
  const hoy = hoyISO();
  const r = useCarga(() => api.resumenNutricion(atleta.id, hoy).catch(() => null), [atleta.id], { recuerdo: `comida-esencial:${atleta.id}:${hoy}` });
  const tca = useCarga(() => (api.esencialTca ? api.esencialTca(atleta.id).catch(() => null) : Promise.resolve(null)), [atleta.id]);
  const conViaje = encendido('comida_viaje', previa);
  const viajes = useCarga(() => (conViaje ? datos.notas(backend, atleta.id, 'viaje').catch(() => null) : Promise.resolve(null)), [atleta.id, conViaje]);
  const viaje = conViaje ? ((viajes.datos || []).map((n) => momentoViaje(n, hoy)).find(Boolean) || null) : null;
  return { r: r.datos, tca: tca.datos === true, listo: !r.cargando && !tca.cargando, viaje, recargar: () => r.recargar(true) };
}

// ---------- (101, 102, 111, 112, 114) La comida, en «Tu revisión de la semana» ----------
export function ComidaRevision() {
  const { atleta } = useApp();
  const previa = usePrevia();
  const c = useComida(previa);
  const hoy = hoyISO();
  const k = `fbe-esencial-lecciones-comida:${atleta.id}`;
  const s = c.listo && c.r?.plan ? comidaDeLaSemana(c.r, { hoy, tca: c.tca, viaje: c.viaje === 'durante' || c.viaje === 'vuelta' }) : null;
  const aviso = s && encendido('aviso_peso', previa) ? avisoDelPeso(c.r, { hoy, tca: c.tca }) : null;
  // (las vistas, al abrir: la lección de hoy se queda mientras la hoja esté abierta y, la próxima vez, ya no sale)
  const [vistas] = useState(() => new Set((leer(k) || '').split(',').filter(Boolean)));
  const leccion = s && encendido('lecciones_comida', previa) ? leccionComida(c.r, { hoy, tca: c.tca, vistas, fuera: !!leer(`fbe-esencial-fuera:${atleta.id}`) }) : null;
  // (cada lección, una vez: se da por vista al enseñarla)
  useEffect(() => { if (leccion) guardar(k, [...vistas, leccion].join(',')); }, [leccion]);
  if (!s) return null;
  const l = leccion ? [textoAjuste(`leccion_comida:${leccion}`, 'titulo', LECCIONES_COMIDA[leccion][0]), textoAjuste(`leccion_comida:${leccion}`, 'texto', LECCIONES_COMIDA[leccion][1])] : null;
  return (
    <>
      <Arte id="esencial-comida-semana" />
      <aside class="cmd-semana" aria-labelledby="cmd-semana-t">
        <span class="cmd-semana-i"><Icono n="nutricion" width="18" height="18" /></span>
        <span class="pila-xs">
          <strong id="cmd-semana-t" class="peq">Tu comida esta semana</strong>
          {s.lineas.map((x) => <span key={x.k} class="peq cmd-linea" data-k={x.k}>{x.texto}</span>)}
        </span>
      </aside>
      {aviso && (
        <aside class="cmd-aviso" aria-labelledby="cmd-aviso-t">
          <strong id="cmd-aviso-t" class="peq">{textoAjuste(`aviso_peso:${aviso.clave}`, 'titulo', AVISOS_PESO[aviso.clave][0])}</strong>
          <span class="peq">{aviso.dato ? `${aviso.dato} ` : ''}{textoAjuste(`aviso_peso:${aviso.clave}`, 'texto', AVISOS_PESO[aviso.clave][1])}</span>
          {pendiente('aviso_peso', previa) && <Pendiente />}
        </aside>
      )}
      {l && (
        <aside class="cmd-leccion" aria-labelledby="cmd-leccion-t">
          <strong id="cmd-leccion-t" class="peq">{l[0]}</strong>
          <span class="peq">{l[1]}</span>
          {pendiente('lecciones_comida', previa) && <Pendiente />}
        </aside>
      )}
    </>
  );
}

// ---------- (102 y 109) En Hoy, debajo de «Nutrición de hoy»: por qué no cambia su plan y la comida de viaje ----------
export function ComidaHoyEsencial({ r }) {
  const previa = usePrevia();
  const { api, backend, atleta } = useApp();
  const hoy = hoyISO();
  const tca = useCarga(() => (api.esencialTca ? api.esencialTca(atleta.id).catch(() => null) : Promise.resolve(null)), [atleta.id]);
  const conViaje = encendido('comida_viaje', previa);
  const viajes = useCarga(() => (conViaje ? datos.notas(backend, atleta.id, 'viaje').catch(() => null) : Promise.resolve(null)), [atleta.id, conViaje]);
  if (!r?.plan || tca.cargando) return null;
  const viaje = conViaje ? ((viajes.datos || []).map((n) => momentoViaje(n, hoy)).find(Boolean) || null) : null;
  const p = porQueNoCambia(r, { hoy, tca: tca.datos === true, viaje: viaje === 'durante' || viaje === 'vuelta' });
  const mant = viaje === 'durante' ? mantenimientoDe(r) : null;
  if (!p && !mant) return null;
  return (
    <div class="cmd-hoy pila-xs">
      {mant && <Arte id="esencial-comida-viaje" />}
      {mant && (
        <p class="peq cmd-viaje"><Icono n="reloj" width="16" height="16" /> <span><strong>De viaje: come para mantener, unas {fmtKcal(mant)} kcal al día.</strong> La app no toca tu plan hasta una semana después de volver.{pendiente('comida_viaje', previa) ? ' (Vista previa: pendiente del visto bueno de Pelayo.)' : ''}</span></p>
      )}
      {p && (
        <details class="cmd-porque">
          <summary class="peq cmd-porque-s">¿Por qué no cambia tu plan?</summary>
          <p class="peq secundario">{p.texto}</p>
        </details>
      )}
    </div>
  );
}

// ---------- (103 a 110) Las hojas de comida de «¿Qué necesitas?» ----------
const CLAVE_HOJA = { fuera: 'comida_fuera', hambre: 'hambre', pasado: 'me_he_pasado', celebracion: 'celebracion' };
export function HojaComida({ que, alCerrar }) {
  const previa = usePrevia();
  const { atleta } = useApp();
  useEffect(() => { if (que === 'fuera') guardar(`fbe-esencial-fuera:${atleta.id}`, hoyISO()); }, [que]);
  if (que === 'proteina') return <HojaProteina alCerrar={alCerrar} />;
  const h = HOJAS_COMIDA[que];
  if (!h) return null;
  const clave = CLAVE_HOJA[que] || null;
  const lineas = (clave ? textoAjuste(`hoja:${que}`, 'texto', h.lineas.join('\n')) : h.lineas.join('\n')).split('\n').map((x) => x.trim()).filter(Boolean);
  return (
    <Hoja titulo={h.titulo} alCerrar={alCerrar}>
      <div class="pila cmd-hoja" data-que={que}>
        <Arte id={ARTE_COMIDA[que]} />
        <ul class="cmd-lineas">{lineas.map((x) => <li key={x} class="peq">{x}</li>)}</ul>
        {que === 'celebracion' && <Celebraciones />}
        {clave && pendiente(clave, previa) && <Pendiente />}
      </div>
    </Hoja>
  );
}

// (105) «No llego a la proteína»: lo de hoy y tres recetas del recetario con mucha proteína por caloría
function HojaProteina({ alCerrar }) {
  const { api, backend, atleta } = useApp();
  const hoy = hoyISO();
  const r = useCarga(() => api.resumenNutricion(atleta.id, hoy).catch(() => null), [atleta.id], { recuerdo: `comida-esencial:${atleta.id}:${hoy}` });
  // (las del recetario del equipo, migración 055; sin él, ninguna)
  const rec = useCarga(() => backend.select('recetas', { eq: { para_todos: true }, cols: 'id,nombre,kcal,proteina_g' }).then((recetas) => ({ recetas })).catch(() => ({ recetas: [] })), [atleta.id]);
  const x = r.datos ? proteinaDeHoy({ reg: r.datos.hoy, obj: r.datos.objetivoHoy, plan: r.datos.plan, recetas: rec.datos?.recetas || [] }) : null;
  const irA = () => { alCerrar(); try { location.hash = '#comidas'; } catch { /* */ } };
  return (
    <Hoja titulo="No llego a la proteína" alCerrar={alCerrar}>
      <div class="pila cmd-hoja" data-que="proteina" aria-busy={r.cargando ? 'true' : 'false'}>
        <Arte id="esencial-comida-proteina" />
        {r.cargando && !x && <p class="peq secundario" role="status">Mirando lo de hoy…</p>}
        {!r.cargando && !x && <p class="peq secundario">Cuando tengas tu plan de comida, aquí verás lo que llevas de proteína cada día.</p>}
        {x && (
          <>
            <p class="cmd-prot" data-falta={x.falta}>{x.texto}</p>
            {x.lleva != null && <div class="cmd-barra" role="img" aria-label={`${x.lleva} de ${x.objetivo} gramos`}><i class="cmd-barra-l" style={`width:${Math.min(100, Math.round((x.lleva / x.objetivo) * 100))}%`} /></div>}
            {x.ideas.length > 0 ? (
              <section class="pila-s" aria-labelledby="cmd-ideas-t">
                <strong id="cmd-ideas-t" class="peq">Tres recetas del recetario con mucha proteína</strong>
                <div class="cmd-ideas" role="list">
                  {x.ideas.map((i) => (
                    <div key={i.id} role="listitem" class="cmd-idea">
                      <span class="peq cmd-idea-n">{i.nombre}</span>
                      <span class="mini terciario num">{i.proteina_g} g de proteína · {fmtKcal(i.kcal)} kcal por ración</span>
                    </div>
                  ))}
                </div>
                <button type="button" class="btn btn-peq" style="justify-self:start" onClick={irA}><Icono n="receta" /> Ver el recetario</button>
              </section>
            ) : <p class="peq secundario">En Comidas tienes tu semana para organizar lo que comes y la lista de la compra.</p>}
          </>
        )}
      </div>
    </Hoja>
  );
}

// (110) Tengo una celebración: apunta el día (hoy o más adelante); la regla, apagada, hace que esos pesos no cuenten
function Celebraciones() {
  const { backend, atleta, aviso } = useApp();
  const hoy = hoyISO();
  const [fecha, setFecha] = useState(hoy);
  const [ocupado, una] = useUnaVez();
  const l = useCarga(() => datos.notas(backend, atleta.id, 'celebracion').catch(() => null), [atleta.id]);
  const proximas = (l.datos || []).filter((n) => n.desde && n.desde >= sumarDias(hoy, -2)).sort((a, b) => (a.desde < b.desde ? -1 : 1));
  const apuntar = () => una(async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || fecha < hoy || fecha > sumarDias(hoy, 120)) { aviso('Elige un día de hoy en adelante', 'error'); return; }
    try {
      const n = await datos.anotar(backend, atleta.id, 'celebracion', { desde: fecha, hasta: fecha });
      if (n?.falta100) { aviso('Aún no se puede apuntar: falta poner al día la base.', 'error'); return; }
      aviso(`Apuntada: el ${fechaLarga(fecha)}`); l.recargar(true);
    } catch { aviso('No se ha podido apuntar: inténtalo más tarde.', 'error'); }
  });
  const quitar = (n) => una(async () => { try { await datos.quitarNota(backend, n.id); l.recargar(true); } catch (e) { aviso(e.message, 'error'); } });
  if (l.datos === null && !l.cargando) return null;
  return (
    <section class="pila-s cmd-celebra" aria-labelledby="cmd-celebra-t">
      <strong id="cmd-celebra-t" class="peq">¿Qué día es?</strong>
      <div class="fila-envolver">
        <input type="date" class="entrada cmd-fecha" value={fecha} min={hoy} max={sumarDias(hoy, 120)} onInput={(e) => setFecha(e.currentTarget.value)} aria-label="El día de la celebración" />
        <button type="button" class="btn btn-primario" disabled={ocupado} onClick={apuntar}><Icono n="calendario" /> Apuntarla</button>
      </div>
      {proximas.length > 0 && (
        <div class="cmd-lista" role="list" aria-label="Tus celebraciones">
          {proximas.map((n) => (
            <div key={n.id} role="listitem" class="cmd-celebra-f">
              <span class="peq">{fechaLarga(n.desde)}</span>
              <button type="button" class="btn-texto mini" disabled={ocupado} onClick={() => quitar(n)}>Quitar</button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ---------- (115) El domingo, la comida de la semana a un toque (en el cierre de la semana) ----------
export function ComidaDomingo() {
  const ir = () => { try { location.hash = '#comidas'; } catch { /* */ } };
  return (
    <p class="peq cmd-domingo"><Icono n="receta" width="16" height="16" /> <span>Y tu comida de la semana: en Comidas, «Rellenar la semana» y la lista de la compra. <button type="button" class="btn-texto" onClick={ir}>Ir a Comidas</button></span></p>
  );
}
