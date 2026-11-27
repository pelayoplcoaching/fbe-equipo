// v0.51: tres diales en Hoy, como los de WHOOP: Constancia (sesiones hechas de las de la semana), Carga (la de esta
// semana frente a lo que sueles llevar a estas alturas) y Cómo llegas (lo que contestaste hoy en «¿Cómo llegas hoy?»).
// Tocar uno abre una hoja con lo que lo alimenta y una explicación corta. Solo los ve el atleta (en su Hoy): «Cómo
// llegas» es dato de salud y solo sale con su consentimiento.
import { leerAjustes } from '../ajustes.js';
import { conTransicion } from '../transiciones.js';
import { useEffect, useId, useState } from 'preact/hooks';
import { useApp, useCarga, Icono, DegradadoAro } from '../comunes.jsx';
import { perezoso, precargarEnReposo } from '../perezoso.jsx';
import { prepMarcadas, marcarPrepHoy } from './prep-hoy.js';
import { dialConstancia, dialCarga, dialComoLlegas, dialComida, dialPasos, dialSueno, horasMin, relojDeUnVistazo, pasosCortos, preparacionDeHoy, sesionParaContestar, conSeriesDeHoy, arcoDial, BANDA_CARGA } from '../../logica/tablero.js';
import { objetivoDelDia, planVigente } from '../../logica/nutricion.js';
import { conNutricion } from '../../logica/nivel.js';
import { leerPreferencia, guardarPreferencia } from '../preferencias.js';
import { lunesDe, sumarDias } from '../../logica/fechas.js';
import { sesionesDeLaSemana, textoDiasSemana } from '../../logica/semana-natural.js';

// La esfera: un arco de 270° (abierto por abajo); con banda, la zona de «En tu media» y una aguja
// (vista 276, v0.277) las hojas, aparte (se piden al tocar un dial y, antes, en cuanto la app se queda quieta)
const HojaComida = perezoso(() => import('./DialesHojas.jsx'), 'HojaComida', { mientras: null });
const HojaReloj = perezoso(() => import('./DialesHojas.jsx'), 'HojaReloj', { mientras: null });
const HojaConstancia = perezoso(() => import('./DialesHojas.jsx'), 'HojaConstancia', { mientras: null });
const HojaCarga = perezoso(() => import('./DialesHojas.jsx'), 'HojaCarga', { mientras: null });
const HojaLlegas = perezoso(() => import('./DialesHojas.jsx'), 'HojaLlegas', { mientras: null });
// (lo que las hojas necesitan de dos módulos del arranque: se lo pasa Diales para que no se partan en más archivos)
const KIT = { horasMin, BANDA_CARGA, dialComoLlegas, textoDiasSemana };
precargarEnReposo([HojaCarga]);

function Esfera({ frac, banda = null, aguja = false, children }) {
  const T = 64, G = 7;
  const a = arcoDial(frac, T, G);
  const deg = `aro-${useId()}`;
  return (
    <span class={`dial-esfera ${!aguja && frac >= 1 ? 'completo' : ''}`} aria-hidden="true">
      <svg viewBox={`0 0 ${T} ${T}`}>
        <DegradadoAro id={deg} />
        <path class="dial-pista" d={a.d} stroke-width={G} />
        {banda && <path class="dial-banda" d={a.d} stroke-width={G} stroke-dasharray={`0 ${a.largo * banda[0]} ${a.largo * (banda[1] - banda[0])} ${a.largo}`} />}
        {!aguja && frac > 0 && <path class="dial-arco" style={{ stroke: `url(#${deg})` }} d={a.d} stroke-width={G} stroke-dasharray={`${a.lleno} ${a.largo + 10}`} />}
        {aguja && <circle class="dial-aguja" cx={a.punto.x} cy={a.punto.y} r="5.5" />}
      </svg>
      <span class="dial-centro marcador">{children}</span>
    </span>
  );
}

// natural (v0.53, con objetivo de días por semana): { semana (la de hoy, de semanasObjetivo), dias, semanas, sesionesPorSemana }
// (v0.140) ocultos: los diales que el atleta ha quitado («Ordenar Hoy»); entrenaHoy: para el objetivo de kcal de hoy.
// Comida (si lleva la nutrición con kcal) y Pasos (si llegan de Salud) solo piden lo suyo si se ven.
export function Diales({ sesiones = [], semana = null, siguiente = null, previstaHoy = null, ejerciciosSiguiente = [], bloques = [], salud = false, hoy, alContestar, natural = null, ocultos = new Set(), entrenaHoy = false }) {
  const { api, atleta, aviso } = useApp();
  const [abierto, setAbierto] = useState(null);
  const verComida = salud && conNutricion(atleta) && !ocultos.has('comida');
  const verPasos = salud && !ocultos.has('pasos');
  const verSueno = salud && !ocultos.has('sueno');
  const conSalud = verPasos || verSueno;
  const comida = useCarga(() => (verComida ? Promise.all([api.planesNutricion(atleta.id), api.registrosNutricion(atleta.id, hoy, hoy)]).catch(() => null) : Promise.resolve(null)),
    [atleta.id, hoy, verComida], { recuerdo: verComida ? `dial-comida:${atleta.id}:${hoy}` : null });
  const pasosDatos = useCarga(() => (conSalud ? api.saludDiaria(atleta.id, sumarDias(hoy, -14), hoy).catch(() => null) : Promise.resolve(null)),
    [atleta.id, hoy, conSalud], { recuerdo: conSalud ? `dial-salud:${atleta.id}:${hoy}` : null });
  // (como «Nutrición de hoy»: si ha dicho a mano si hoy entrena o descansa, eso manda)
  const elegidoDia = leerPreferencia(`fbe-nut-dia-${hoy}`, null);
  const objetivo = comida.datos ? objetivoDelDia(planVigente(comida.datos[0] || [], hoy), elegidoDia ? elegidoDia === 'entreno' : entrenaHoy) : null;
  const m = objetivo ? dialComida(objetivo, (comida.datos[1] || []).find((r) => r.fecha === hoy) || null) : null;
  const diasSalud = pasosDatos.datos?.conectada ? pasosDatos.datos.dias || [] : [];
  const ps = verPasos ? dialPasos(diasSalud, hoy) : null;
  const su = verSueno ? dialSueno(diasSalud, hoy) : null;
  const carga = useCarga(() => api.cargaHoy(atleta.id, { bloques, hoy }).catch(() => null), [atleta.id, hoy, sesiones.filter((s) => s.completada).length], { recuerdo: `carga-hoy:${atleta.id}:${hoy}` });
  const c = natural ? dialConstancia(sesiones, natural.semana) : dialConstancia(sesiones);
  const k = carga.datos ? dialCarga(carga.datos, hoy, 4) : null;
  // La regla de «de hoy» (la misma que la sesión): hecha hoy, con series de hoy o contestada hoy en este móvil
  const seriesHoy = siguiente && ejerciciosSiguiente.some((e) => conSeriesDeHoy(e.hechas)) ? [siguiente.id] : [];
  const prep = salud ? preparacionDeHoy(sesiones, hoy, { marcadas: prepMarcadas(), seriesHoy }) : null;
  const l = salud ? dialComoLlegas(prep) : null;
  // Solo se contesta desde aquí para la sesión prevista para hoy (o la que ya tiene series de hoy), y nunca de baja
  const pendiente = sesionParaContestar({ previstaHoy, siguiente, seriesHoy, baja: atleta.estado === 'baja' });
  const pct = k && k.ratio != null ? Math.round(k.ratio * 100) : null;
  // (v0.141) Los diales que llegan tarde (comida, pasos y sueño): si en este móvil salieron la última vez, mientras cargan
  // se guarda su sitio (así un quinto dial no añade una fila de golpe y no se mueve nada al abrir la app). Solo hasta la
  // primera vez que llegan en esta visita: después, al volver a Hoy, se ven como antes (lo recordado o nada)
  const claveVistos = `fbe-diales-vistos:${atleta.id}`;
  const vistos = leerPreferencia(claveVistos, []);
  const esperando = (id, cargaX) => !llegaronYa.has(atleta.id) && !cargaX.datos && cargaX.cargando && Array.isArray(vistos) && vistos.includes(id);
  const espera = { comida: !m && verComida && esperando('comida', comida), pasos: !ps && verPasos && esperando('pasos', pasosDatos), sueno: !su && verSueno && esperando('sueno', pasosDatos) };
  const llegados = !comida.cargando && !pasosDatos.cargando;
  const reales = [m && 'comida', ps && 'pasos', su && 'sueno'].filter(Boolean).join();
  useEffect(() => {
    if (!llegados) return;
    llegaronYa.add(atleta.id);
    if (reales !== (Array.isArray(vistos) ? vistos.join() : '')) guardarPreferencia(claveVistos, reales ? reales.split(',') : []);
  }, [llegados, reales]);
  const ver = { constancia: !ocultos.has('constancia'), carga: !ocultos.has('carga'), llegas: salud && !ocultos.has('llegas'), comida: (!!m || espera.comida) && !leerAjustes().ocultar?.kcal, pasos: !!ps || espera.pasos, sueno: !!su || espera.sueno };
  const n = Object.values(ver).filter(Boolean).length;
  if (!n) return null;
  const pc = ps ? pasosCortos(ps.pasos) : null;
  // (tacto 219) El dial que se toca sube a la cabecera de su hoja (que antes empezaba solo con texto): la misma esfera,
  // más grande. Cada esfera se pinta en dos sitios (su botón y su hoja), así que va en una función
  const esf = {
    constancia: () => <Esfera frac={c.valor}><span>{c.hechas}<span class="u">/{c.total}</span></span></Esfera>,
    carga: () => <Esfera frac={k?.valor || 0} banda={k && k.estado !== 'sin_media' ? [BANDA_CARGA[0] / 2, BANDA_CARGA[1] / 2] : null} aguja={!!k && k.estado !== 'sin_media'}> {!k || k.estado === 'sin_media' ? <span>—</span> : <span>{pct}<span class="u">%</span></span>} </Esfera>,
    llegas: () => <Esfera frac={l.valor}>{l.estado === 'sin_respuesta' ? <Icono n="pregunta" /> : <span>{l.total}<span class="u">/9</span></span>}</Esfera>,
    comida: () => <Esfera frac={m.valor}><span>{m.quedan < 0 ? `+${-m.quedan}` : m.quedan}<span class="u">kcal</span></span></Esfera>,
    pasos: () => <Esfera frac={ps.valor}><span>{pc.cifra}{pc.unidad && <span class="u">{pc.unidad}</span>}</span></Esfera>,
    sueno: () => <Esfera frac={su.valor}><span>{horasMin(su.min)}<span class="u">h</span></span></Esfera>,
  };
  const arriba = (id, estado) => <span class="dial dial-arriba" data-estado={estado}>{esf[id]()}</span>;
  const abrir = (id, ev) => conTransicion(() => setAbierto(id), 'morph', [{ nombre: 'vt-viaje', desde: ev.currentTarget.querySelector('.dial-esfera'), hasta: '.dial-arriba .dial-esfera' }]);
  return (
    <section class={`panel diales${n > 4 ? ' diales-dos-filas' : ''}`} style={{ '--n': n > 4 ? 3 : n }} aria-label="Tu día de un vistazo" onPointerDown={() => HojaCarga.precargar?.()}>
      {ver.constancia && <button type="button" class="dial" data-estado={c.estado} onClick={(ev) => abrir('constancia', ev)}
        aria-label={`Constancia: ${c.hechas} de ${c.total} sesiones ${natural ? 'de tu objetivo de esta semana' : 'de esta semana'}. ${c.etiqueta}. Ver de dónde sale`}>
        {esf.constancia()}
        <span class="dial-nombre">Constancia</span>
        <span class="dial-estado">{c.etiqueta}</span>
      </button>}
      {ver.carga && <button type="button" class="dial" data-estado={k ? k.estado : 'cargando'} onClick={(ev) => abrir('carga', ev)}
        aria-label={`Carga: ${!k ? 'cargando' : k.estado === 'sin_media' ? 'aún sin media para comparar' : `${pct} % de lo que sueles llevar a estas alturas, ${k.etiqueta.toLowerCase()}`}. Ver de dónde sale`}>
        {esf.carga()}
        <span class="dial-nombre">Carga</span>
        <span class="dial-estado">{k ? k.etiqueta : '…'}</span>
      </button>}
      {ver.llegas && (
        <button type="button" class="dial" data-estado={l.estado} onClick={(ev) => abrir('llegas', ev)}
          aria-label={l.estado === 'sin_respuesta' ? `Cómo llegas: sin contestar hoy. ${pendiente ? 'Contestar' : 'Ver qué es'}` : `Cómo llegas: ${l.etiqueta}. Ver tus respuestas`}>
          {esf.llegas()}
          <span class="dial-nombre">Cómo llegas</span>
          <span class="dial-estado">{l.estado === 'sin_respuesta' ? (pendiente ? 'Contestar' : 'Sin contestar') : l.etiqueta}</span>
        </button>
      )}
      {espera.comida && <DialEsperando nombre="Comida" />}
      {ver.comida && m && (
        <button type="button" class="dial" data-estado={m.estado} onClick={(ev) => abrir('comida', ev)}
          aria-label={`Comida: ${m.estado === 'sin_apuntar' ? `aún sin apuntar nada hoy, tu objetivo son ${m.objetivo} kcal` : m.quedan >= 0 ? `te quedan ${m.quedan} kcal de ${m.objetivo}` : `${-m.quedan} kcal por encima de ${m.objetivo}`}. Ver el detalle`}>
          {esf.comida()}
          <span class="dial-nombre">Comida</span>
          <span class="dial-estado">{m.etiqueta}</span>
        </button>
      )}
      {espera.pasos && <DialEsperando nombre="Pasos" />}
      {ver.pasos && ps && (
        <button type="button" class="dial" data-estado={ps.estado} onClick={(ev) => abrir('pasos', ev)}
          aria-label={`Pasos: ${ps.pasos} hoy${ps.media ? `, tu media es de ${ps.media}` : ''}. Ver el detalle`}>
          {esf.pasos()}
          <span class="dial-nombre">Pasos</span>
          <span class="dial-estado">{ps.etiqueta}</span>
        </button>
      )}
      {espera.sueno && <DialEsperando nombre="Sueño" />}
      {ver.sueno && su && (
        <button type="button" class="dial" data-estado={su.estado} onClick={(ev) => abrir('sueno', ev)}
          aria-label={`Sueño: ${horasMin(su.min)} horas anoche${su.media ? `, tu media es de ${horasMin(su.media)}` : ''}. Ver tu reloj de un vistazo`}>
          {esf.sueno()}
          <span class="dial-nombre">Sueño</span>
          <span class="dial-estado">{su.etiqueta}</span>
        </button>
      )}
      {abierto === 'comida' && m && <HojaComida arriba={arriba('comida', m.estado)} m={m} objetivo={objetivo} alCerrar={() => setAbierto(null)} />}
      {(abierto === 'pasos' || abierto === 'sueno') && (ps || su) && <HojaReloj kit={KIT} arriba={abierto === 'sueno' && su ? arriba('sueno', su.estado) : ps ? arriba('pasos', ps.estado) : null} filas={relojDeUnVistazo(diasSalud, hoy)} ultimo={pasosDatos.datos?.ultimo || null} alCerrar={() => setAbierto(null)} />}
      {abierto === 'constancia' && (natural
        ? <HojaConstancia kit={KIT} arriba={arriba('constancia', c.estado)} c={c} natural={natural} sesiones={sesionesDeLaSemana(natural.semanas, natural.sesionesPorSemana, c.total, hoy)} semana={{ fecha_inicio: lunesDe(hoy) }} alCerrar={() => setAbierto(null)} />
        : <HojaConstancia kit={KIT} arriba={arriba('constancia', c.estado)} c={c} sesiones={sesiones} semana={semana} alCerrar={() => setAbierto(null)} />)}
      {abierto === 'carga' && <HojaCarga kit={KIT} arriba={arriba('carga', k ? k.estado : 'cargando')} k={k} datos={carga.datos} hoy={hoy} alCerrar={() => setAbierto(null)} />}
      {abierto === 'llegas' && (
        <HojaLlegas kit={KIT} arriba={arriba('llegas', l.estado)} l={l} prep={prep} pendiente={pendiente} baja={atleta.estado === 'baja'} hoy={hoy} alCerrar={() => setAbierto(null)}
          alGuardar={async (p) => {
            // Como en la sesión: si no se puede guardar (sin conexión, sin el consentimiento), lo dice; el consejo vale igual
            try { await api.guardarPreparacion(pendiente.id, p); marcarPrepHoy(pendiente.id); alContestar?.(); return true; }
            catch (err) { aviso(`No se ha podido guardar (${err.message}). El consejo vale igual.`, 'error'); return false; }
          }} />
      )}
    </section>
  );
}

// (v0.141) Los atletas cuyos diales ya llegaron una vez en esta visita (desde entonces, sin huecos de espera)
const llegaronYa = new Set();
// (v0.141) El sitio de un dial que aún no ha llegado (la misma forma, sin cifra ni acción)
function DialEsperando({ nombre }) {
  return (
    <div class="dial" data-estado="cargando" aria-hidden="true">
      <Esfera frac={0}><span>&nbsp;</span></Esfera>
      <span class="dial-nombre">{nombre}</span>
      <span class="dial-estado">&nbsp;</span>
    </div>
  );
}
