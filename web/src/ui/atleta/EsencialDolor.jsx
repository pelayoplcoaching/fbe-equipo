// (v0.256) El motor de molestias de FBE Esencial, la base (reglas de Pelayo del 26/11/2026, formulario 2, bloque A;
// «claude/motores-plan.md»): «Me duele algo» con las diez zonas del cuestionario de lesiones y de 0 a 10 con el semáforo
// del dolor de la web (M1, M2), qué hacer con su plan según el color, con el margen de Pelayo (hasta 3; M4 y M7), las
// señales para parar y consultar ya (M9), sus molestias abiertas con su tendencia y cuándo ver a un profesional (M10); y,
// en su check-in, las mismas zonas de 0 a 10. Con la migración 109 se guarda (datos/api-dolor.js), con su consentimiento de
// salud; sin ella, la hoja dice qué hacer igual y no guarda nada. Estilos: dolor.css (clases dol-*, escritas tal cual).
import { useState, useEffect } from 'preact/hooks';
import { useApp, useCarga, useUnaVez, Hoja, Icono } from '../comunes.jsx';
import { Arte } from './EsencialArte.jsx';
import * as D from '../../logica/dolor.js';
import { URL_SEMAFORO } from '../../logica/esencial-checkin.js';
import { encendido } from '../../logica/esencial-respuestas.js';
import { hoyISO, sumarDias, lunesDe } from '../../logica/fechas.js';
import { fechaLarga } from '../../logica/esencial-alta.js';
import { perezoso } from '../perezoso.jsx';

const CentroRespuestas = perezoso(() => import('./EsencialAyuda.jsx'), 'CentroRespuestas', { mientras: null });
function usePrevia() {
  const { modo } = useApp();
  try { return modo === 'demo' && /[?&]previa=1(&|$)/.test(location.search); } catch { return false; }
}
const guardarLocal = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };
const TENDENCIA = { mejor: 'mejor que la semana anterior', igual: 'igual que la semana anterior', peor: 'peor que la semana anterior' };

// De 0 a 10, con el color del semáforo
export function EscalaDolor({ valor = null, alCambiar, etiqueta }) {
  return (
    <div class="dol-escala" role="group" aria-label={etiqueta}>
      {D.ESCALA.map((n) => {
        const s = D.semaforo(n), si = valor === n;
        return (
          <button type="button" key={n} class={si ? `dol-n dol-n-${s} dol-n-si` : `dol-n dol-n-${s}`} aria-pressed={si ? 'true' : 'false'} aria-label={`${n} de 10`}
            onClick={() => alCambiar(n)}>{n}</button>
        );
      })}
    </div>
  );
}
// La leyenda: 0-2 verde, 3-5 ámbar, 6 o más rojo
function Leyenda() {
  return (
    <span class="dol-leyenda mini">
      <span class="dol-ley"><span class="dol-punto dol-punto-verde" aria-hidden="true" />0 a 2, verde</span>
      <span class="dol-ley"><span class="dol-punto dol-punto-ambar" aria-hidden="true" />3 a 5, ámbar</span>
      <span class="dol-ley"><span class="dol-punto dol-punto-rojo" aria-hidden="true" />6 a 10, rojo</span>
    </span>
  );
}
// Qué hacer, con el color de su valor
function QueHacer({ valor }) {
  const s = D.semaforo(valor);
  if (!s) return null;
  const q = D.QUE_HACER[s];
  return (
    <div class={`dol-que dol-que-${s}`} role="status">
      <strong>{q.titulo}</strong>
      <ul class="lista-puntos dol-pasos">{q.pasos.map((t) => <li key={t} class="peq">{t}</li>)}</ul>
    </div>
  );
}

// ---------- En su check-in (con la 109): las zonas del cuestionario de lesiones y, en las que toque, de 0 a 10 ----------
// valores: { zona: 0-10 } (0, sin molestia); alCambiar(nuevos)
export function MolestiasDolor({ valores = {}, alCambiar }) {
  const marcadas = D.ZONAS_DOLOR.filter(([z]) => Number(valores[z]) > 0);
  return (
    <div class="pila">
      <span class="peq secundario" id="ck-zonas10">Toca las zonas donde hayas notado molestias esta semana y di cuánto, de 0 a 10.</span>
      <div class="dol-zonas" role="group" aria-labelledby="ck-zonas10">
        {D.ZONAS_DOLOR.map(([z, nombre]) => {
          const si = Number(valores[z]) > 0;
          return <button type="button" key={z} class={si ? 'dol-zona dol-zona-si' : 'dol-zona'} aria-pressed={si ? 'true' : 'false'} onClick={() => alCambiar({ ...valores, [z]: si ? 0 : 1 })}>{nombre}</button>;
        })}
      </div>
      {marcadas.map(([z, nombre]) => (
        <div class="dol-fila" key={z}>
          <span class="peq dol-fila-t"><strong>{nombre}</strong>: <span class="num">{valores[z]}</span> de 10</span>
          <EscalaDolor etiqueta={`Cuánto en ${nombre}, de 0 a 10`} valor={Number(valores[z])} alCambiar={(n) => alCambiar({ ...valores, [z]: n })} />
        </div>
      ))}
      {marcadas.length > 0 && <Leyenda />}
    </div>
  );
}

// ---------- Sus molestias: las abiertas, con su color y su tendencia; y si toca ver a un profesional ----------
function useDolor(vuelta = 0) {
  const { backend, atleta } = useApp();
  return useCarga(async () => {
    const m = await import('../../datos/api-dolor.js');
    const hay = await m.hay109(backend).catch(() => false);
    if (!hay) return { m, hay };
    const hoy = hoyISO();
    const [registros, checkins] = await Promise.all([
      m.registros(backend, atleta.id, sumarDias(hoy, -42)).catch(() => []),
      m.molestiasCheckin(backend, atleta.id, sumarDias(lunesDe(hoy), -42)).catch(() => []),
    ]);
    return { m, hay, registros, checkins };
  }, [atleta.id, vuelta]);
}
export function TusMolestias({ d, senal = false }) {
  if (!d?.hay) return null;
  const hoy = hoyISO();
  const estado = D.estadoZonas({ registros: d.registros, checkins: d.checkins, hoy });
  const abiertas = estado.filter((z) => z.abierta);
  const desde = sumarDias(lunesDe(hoy), -35);
  const semanas = (d.checkins || []).filter((c) => String(c.semana_inicio).slice(0, 10) >= desde);
  const pro = D.profesional({ semanas, estado, senal, hoy });
  if (!abiertas.length && !pro) return null;
  return (
    <section class="dol-tuyas" aria-labelledby="dol-tuyas-t">
      <Arte id="esencial-dolor-semana" />
      <strong id="dol-tuyas-t">{abiertas.length ? 'Tus molestias abiertas' : 'Tus molestias'}</strong>
      {abiertas.length > 0 && (
        <ul class="lista-puntos dol-lista">
          {abiertas.map((z) => (
            <li key={z.zona} class="dol-item">
              <span class={`dol-badge dol-badge-${z.semaforo} num`} aria-hidden="true">{z.valor}</span>
              <span class="pila-xs">
                <strong class="peq">{z.nombre}: {z.valor} de 10, {D.NOMBRE_SEMAFORO[z.semaforo].toLowerCase()}</strong>
                <span class="mini terciario">{`Desde el ${fechaLarga(z.desde)}`}{z.tendencia ? `; ${TENDENCIA[z.tendencia]}` : ''}.</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {pro && <p class="peq dol-pro" role="note"><Icono n="alerta" width="18" height="18" /><span>{pro.texto}</span></p>}
    </section>
  );
}

// ---------- «Me duele algo» ----------
export function HojaMolestia({ alCerrar, alAccion = null }) {
  const { backend, atleta, aviso } = useApp();
  const previa = usePrevia();
  const [vuelta, setVuelta] = useState(0);
  const d = useDolor(vuelta);
  const [zona, setZona] = useState(null);
  const [valor, setValor] = useState(null);
  const [senales, setSenales] = useState(() => new Set());
  const [centro, setCentro] = useState(false);
  const [apuntada, setApuntada] = useState(false);
  const [borrar, setBorrar] = useState(false);
  const [error, setError] = useState(null);
  const [ocupado, una] = useUnaVez();
  const hay = d.datos?.hay === true;
  const listo = zona && valor != null;
  // (apagado) a los tres y a los siete días, la app pregunta cómo va: en este móvil se guarda solo la fecha
  useEffect(() => { if (zona && valor >= D.MARGEN && encendido('molestia_sigue', previa)) guardarLocal(`fbe-esencial-molestia:${atleta.id}`, JSON.stringify({ dicho: hoyISO(), respondido: [] })); }, [zona, valor]);
  const marcar = (id) => setSenales((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const apuntar = () => una(async () => {
    setError(null);
    if (!d.datos?.m || !listo) return;
    try {
      const r = await d.datos.m.apuntarDolor(backend, { zona, valor, momento: 'ahora' });
      if (r?.falta109) { setError('Para guardarla falta una actualización en la base: dísela a Pelayo.'); return; }
      setApuntada(true); setVuelta((x) => x + 1); aviso('Molestia apuntada');
    } catch (e) {
      setError(/consentimiento/i.test(e?.message || '') ? 'Para apuntarla hace falta tu consentimiento de datos de salud (en Perfil). Lo de qué hacer te sirve igual.' : e.message);
    }
  });
  const borrarTodo = () => una(async () => {
    setError(null);
    try { await d.datos.m.borrarDolor(backend, atleta.id); setBorrar(false); setVuelta((x) => x + 1); aviso('Borrado'); } catch (e) { setError(e.message); }
  });
  const conSenal = senales.size > 0;
  return (
    <Hoja titulo="Me duele algo" alCerrar={alCerrar}>
      <div class="pila dol-hoja">
        <Arte id="esencial-dolor-zona" />
        <p class="secundario">{hay
          ? 'Di dónde y cuánto, de 0 a 10. La app no valora el dolor: te dice qué hacer con tu plan mientras tanto. Si la apuntas, aquí ves cómo va.'
          : 'Di dónde y cuánto, de 0 a 10. La app no valora el dolor: te dice qué hacer con tu plan mientras tanto. Nada de esto se guarda.'}</p>
        <div class="pila-s"><strong class="peq" id="dol-donde-t">¿Dónde?</strong>
          <div class="dol-zonas" role="group" aria-labelledby="dol-donde-t">
            {D.ZONAS_DOLOR.map(([id, t]) => <button type="button" key={id} class={zona === id ? 'dol-zona dol-zona-si' : 'dol-zona'} aria-pressed={zona === id ? 'true' : 'false'} onClick={() => { setZona(id); setApuntada(false); }}>{t}</button>)}
          </div>
        </div>
        <div class="pila-s"><strong class="peq">¿Cuánto, de 0 a 10?</strong>
          <EscalaDolor etiqueta="Cuánto te duele, de 0 a 10" valor={valor} alCambiar={(n) => { setValor(n); setApuntada(false); }} />
          <Leyenda />
        </div>
        {listo && <QueHacer valor={valor} />}
        {listo && (
          <section class="dol-senales" aria-labelledby="dol-senales-t">
            <strong class="peq" id="dol-senales-t">¿Tienes alguna de estas?</strong>
            {D.SENALES.map(([id, t]) => (
              <label key={id} class="dol-check peq"><input type="checkbox" checked={senales.has(id)} onChange={() => marcar(id)} /><span>{t}</span></label>
            ))}
            <span class="mini terciario">Lo que marques aquí no se guarda.</span>
          </section>
        )}
        {conSenal && (
          <div class="dol-para" role="alert">
            <Arte id="esencial-consulta-ya" />
            <strong>{D.PARA_YA.titulo}</strong>
            <span class="peq">{D.PARA_YA.texto}</span>
            {senales.has('pecho') && <span class="peq">{D.PARA_YA.pecho}</span>}
          </div>
        )}
        {error && <p class="error" role="alert">{error}</p>}
        {listo && (
          <div class="fila-envolver dol-acciones">
            {hay && !apuntada && <button type="button" class="btn btn-primario btn-peq" disabled={ocupado} onClick={apuntar}><Icono n="guardar" /> Apuntarla</button>}
            {apuntada && <span class="peq dol-hecho" role="status"><Icono n="hecho" width="18" height="18" /> Apuntada</span>}
            {alAccion && <button type="button" class="btn btn-peq" onClick={() => alAccion('ejercicios')}><Icono n="reiniciar" /> Cambiar un ejercicio</button>}
            <a class="btn btn-peq" href={URL_SEMAFORO} target="_blank" rel="noopener">El semáforo del dolor</a>
            <button type="button" class="btn-texto" onClick={() => setCentro(true)}>¿Cuándo preocuparse?</button>
          </div>
        )}
        {!hay && listo && valor >= D.MARGEN && <p class="mini terciario">Si quieres que la app lo tenga en cuenta, apúntala también en tu check-in de la semana.</p>}
        <TusMolestias d={d.datos} senal={conSenal} />
        {hay && (d.datos.registros || []).length > 0 && !borrar && (
          <button type="button" class="btn-texto mini dol-quitar" onClick={() => setBorrar(true)}><Icono n="basura" /> Borrar lo que he apuntado aquí</button>
        )}
        {borrar && (
          <div class="dol-borrar" role="group" aria-label="Borrar tus molestias apuntadas">
            <span class="peq">¿Borrar todas las molestias que has apuntado aquí? Las de tu check-in se quedan. No se puede deshacer.</span>
            <div class="fila-envolver">
              <button type="button" class="btn btn-peq btn-peligro" disabled={ocupado} onClick={borrarTodo}>Borrar</button>
              <button type="button" class="btn btn-peq" onClick={() => setBorrar(false)}>Cancelar</button>
            </div>
          </div>
        )}
      </div>
      {centro && <CentroRespuestas inicial="dolor" alCerrar={() => setCentro(false)} />}
    </Hoja>
  );
}
