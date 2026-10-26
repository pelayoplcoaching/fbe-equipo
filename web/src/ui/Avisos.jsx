import { useState } from 'preact/hooks';
import { useApp, useCarga, Icono, Hoja, Cargando, usePreferencia } from './comunes.jsx';
import { hoyISO, desdeISO } from '../logica/fechas.js';

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const corta = (iso) => { const d = desdeISO(iso); return `${d.getDate()} ${MES[d.getMonth()]}`; };
export function textoVigencia(a, hoy = hoyISO()) {
  if (a.desde > hoy) return a.hasta ? `Del ${corta(a.desde)} al ${corta(a.hasta)}` : `Desde el ${corta(a.desde)}`;
  return a.hasta ? `Hasta el ${corta(a.hasta)}` : 'Sin fecha de fin';
}

// Atleta: los avisos en vigor de su coach, fijados arriba en Hoy hasta que los cierra (en este móvil)
export function AvisosCoach() {
  const { api, atleta } = useApp();
  const res = useCarga(() => api.avisos(atleta.id).catch(() => []), [atleta.id]);
  const [cerrados, setCerrados] = usePreferencia(`fbe-avisos-cerrados-${atleta.id}`, []);
  const lista = (res.datos || []).filter((a) => !cerrados.includes(a.id));
  if (!lista.length) return null;
  return (
    <div class="pila-s">
      {lista.map((a) => (
        <section key={a.id} class="aviso-coach" aria-label="Aviso de tu coach">
          <Icono n="altavoz" />
          <div class="pila-xs">
            <span class="mini aviso-de">De tu coach{a.atleta_id ? ', para ti' : ''}</span>
            <p>{a.texto}</p>
            {a.hasta && <span class="mini terciario">{textoVigencia(a)}</span>}
          </div>
          <button class="btn btn-icono plano" onClick={() => setCerrados([...cerrados, a.id].slice(-50))} aria-label="Ocultar el aviso"><Icono n="cerrar" /></button>
        </section>
      ))}
    </div>
  );
}

// Coach: crear, ver y quitar avisos
export function HojaAvisos({ alCerrar }) {
  const { api, aviso } = useApp();
  const avisos = useCarga(() => api.avisosCoach(), []);
  const atletas = useCarga(() => api.atletas(), []);
  const hoy = hoyISO();
  const [f, setF] = useState({ texto: '', para: '', desde: hoy, hasta: '' });
  const [ocupado, setOcupado] = useState(false);
  const nombre = Object.fromEntries((atletas.datos || []).map((a) => [a.id, a.nombre]));
  const valido = /[^\s\u200b\ufeff]/.test(f.texto) && f.desde && (!f.hasta || f.hasta >= f.desde);
  const [verCaducados, setVerCaducados] = useState(false);
  const todos = avisos.datos || [];
  const vigentes = todos.filter((a) => !a.hasta || a.hasta >= hoy);
  const caducados = todos.filter((a) => a.hasta && a.hasta < hoy).reverse();
  async function publicar(e) {
    e.preventDefault();
    if (!valido) return;
    setOcupado(true);
    try {
      await api.crear('avisos', { texto: f.texto.trim(), atleta_id: f.para || null, desde: f.desde, hasta: f.hasta || null });
      aviso('Aviso publicado');
      setF({ texto: '', para: '', desde: hoy, hasta: '' });
      avisos.recargar(true);
    } catch (err) { aviso(err.message, 'error'); } finally { setOcupado(false); }
  }
  async function quitar(a) {
    try { await api.borrar('avisos', a.id); aviso('Aviso quitado'); avisos.recargar(true); } catch (err) { aviso(err.message, 'error'); }
  }
  return (
    <Hoja titulo="Avisos para tus atletas" alCerrar={alCerrar} ancho={620}>
      <p class="peq secundario">Aparecen fijados arriba en su pantalla de Hoy mientras estén en vigor. Cada atleta puede cerrarlos.</p>
      {avisos.cargando && !avisos.datos ? <Cargando /> : vigentes.length > 0 && (
        <ul class="lista avisos-lista">
          {vigentes.map((a) => (
            <li key={a.id} class="panel-pad aviso-fila">
              <div class="pila-xs">
                <span class="mini terciario">{a.atleta_id ? `Para ${nombre[a.atleta_id] || 'un atleta'}` : 'Para todos'}. {a.desde > hoy ? 'Programado' : 'En vigor'}: {textoVigencia(a, hoy).toLowerCase()}</span>
                <span>{a.texto}</span>
              </div>
              <button class="btn btn-icono plano" onClick={() => quitar(a)} aria-label={`Quitar el aviso «${a.texto.slice(0, 40)}»`}><Icono n="basura" /></button>
            </li>
          ))}
        </ul>
      )}
      {caducados.length > 0 && (
        <div class="pila-s">
          <button type="button" class="btn-texto mini" style="justify-self:start" aria-expanded={verCaducados ? 'true' : 'false'} onClick={() => setVerCaducados(!verCaducados)}>{verCaducados ? 'Ocultar' : 'Ver'} los caducados ({caducados.length})</button>
          {verCaducados && (
            <ul class="lista avisos-lista caducados">
              {caducados.map((a) => (
                <li key={a.id} class="panel-pad aviso-fila">
                  <div class="pila-xs">
                    <span class="mini terciario">{a.atleta_id ? `Para ${nombre[a.atleta_id] || 'un atleta'}` : 'Para todos'}. Caducó el {corta(a.hasta)}</span>
                    <span>{a.texto}</span>
                  </div>
                  <button class="btn btn-icono plano" onClick={() => quitar(a)} aria-label={`Borrar el aviso caducado «${a.texto.slice(0, 40)}»`}><Icono n="basura" /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <form class="pila" onSubmit={publicar}>
        <div class="campo">
          <label for="av-texto">Nuevo aviso</label>
          <textarea id="av-texto" class="area" rows={3} maxLength={600} placeholder="Del 3 al 9 de noviembre estoy de congreso: os respondo por la tarde." value={f.texto} onInput={(e) => setF({ ...f, texto: e.currentTarget.value })} />
          <span class="ayuda num">{f.texto.length}/600</span>
        </div>
        <div class="campo">
          <label for="av-para">Para</label>
          <select id="av-para" class="selector" value={f.para} onChange={(e) => setF({ ...f, para: e.currentTarget.value })}>
            <option value="">Todos tus atletas</option>
            {(atletas.datos || []).filter((a) => a.estado !== 'baja').map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
        </div>
        <div class="fila-campos">
          <div class="campo"><label for="av-desde">Desde</label><input id="av-desde" class="entrada" type="date" required value={f.desde} onInput={(e) => setF({ ...f, desde: e.currentTarget.value })} /></div>
          <div class="campo"><label for="av-hasta">Hasta (opcional)</label><input id="av-hasta" class="entrada" type="date" value={f.hasta} min={f.desde} onInput={(e) => setF({ ...f, hasta: e.currentTarget.value })} /></div>
        </div>
        {f.hasta && f.hasta < f.desde && <span class="error-campo">La fecha de fin es anterior a la de inicio.</span>}
        <button class="btn btn-primario btn-grande" disabled={!valido || ocupado}><Icono n="altavoz" /> Publicar aviso</button>
      </form>
    </Hoja>
  );
}
