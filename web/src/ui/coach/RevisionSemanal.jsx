import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useApp, useCarga, Siluetas, Vacio, Avatar, Icono, CabeceraGrande, ErrorCaja } from '../comunes.jsx';
import { fechaMadrid, sumarDias, desdeISO } from '../../logica/fechas.js';
import { ordenRevision, avisosRevision } from '../../logica/revision.js';

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const rango = (lunes) => {
  const a = desdeISO(lunes), b = desdeISO(sumarDias(lunes, 6));
  return a.getMonth() === b.getMonth() ? `${a.getDate()} al ${b.getDate()} ${MES[b.getMonth()]}` : `${a.getDate()} ${MES[a.getMonth()]} al ${b.getDate()} ${MES[b.getMonth()]}`;
};

// v0.67: «Revisión semanal». Todos tus atletas en una lista para la revisión del finde: sus sesiones de la semana, lo que
// pide tu atención (check-in, vídeos, mensajes, molestias), una casilla para darla por terminada y una nota corta que te sale
// la semana siguiente; y, de cada uno, chat, programar y seguimiento a un toque. La casilla y la nota se guardan en la base
// (040), por atleta y semana: el lunes empieza una semana nueva y la anterior queda en el historial.
export function RevisionSemanal({ abrirAtleta }) {
  const { api, aviso } = useApp();
  const res = useCarga(() => api.revisionSemanal(fechaMadrid()) /* (la semana de Madrid, también si abres la app de viaje) */, []);
  const [filtro, setFiltro] = useState('pendientes');
  const [cambios, setCambios] = useState({}); // atleta_id → { hecha?, nota? } (lo tocado aquí, encima de lo cargado)
  const datos = res.datos;
  const filas = useMemo(() => (datos?.filas || []).map((f) => ({ ...f, ...(cambios[f.atleta_id] || {}) })), [datos, cambios]);
  const ordenadas = useMemo(() => ordenRevision(filas), [filas]);
  const hechas = filas.filter((f) => f.hecha).length;
  const vista = ordenadas.filter((f) => filtro === 'todos' || (filtro === 'hechos' ? f.hecha : !f.hecha));

  const guardar = async (f, c) => {
    const antes = cambios[f.atleta_id] || {};
    setCambios((x) => ({ ...x, [f.atleta_id]: { ...antes, ...c } }));
    try {
      await api.marcarRevision(f.atleta_id, datos.lunes, c);
      // (al marcarlo, en «Pendientes» se va de la lista: por si fue sin querer, «Deshacer»)
      if (c.hecha === true) aviso(`${f.nombre.split(' ')[0]}, revisado`, 'ok', { texto: 'Deshacer', fn: () => guardar(f, { hecha: false }) });
    } catch (e) { setCambios((x) => ({ ...x, [f.atleta_id]: antes })); aviso(e?.message || 'No se ha podido guardar: vuelve a intentarlo', 'error'); }
  };

  return (
    <div class="contenido coach revision">
      <CabeceraGrande>
        <div class="titulo"><h1>Revisión semanal</h1>{datos && <div class="sub">Semana del {rango(datos.lunes)}</div>}</div>
      </CabeceraGrande>
      {res.cargando && !datos ? <Siluetas forma="lista" n={6} texto="Cargando la revisión" /> : res.error ? (
        <ErrorCaja error={res.error} reintentar={() => res.recargar()} />
      ) : !filas.length ? (
        <div class="panel"><Vacio icono="atletas" titulo="Aún no tienes atletas">Cuando des de alta a alguien, saldrá aquí para tu revisión de cada semana.</Vacio></div>
      ) : (
        <div class="pila">
          <div class="panel panel-pad revision-progreso">
            <div class="fila-entre"><strong>{hechas} de {filas.length} revisados</strong>{hechas === filas.length && <span class="chip ok"><Icono n="hecho" /> Todo revisado</span>}</div>
            <div class="barra-revision" role="progressbar" aria-label="Revisados" aria-valuemin="0" aria-valuemax={filas.length} aria-valuenow={hechas}><span style={{ width: `${Math.round((hechas / filas.length) * 100)}%` }} /></div>
            {!datos.revisiones && <p class="peq secundario">La casilla de revisado y las notas, disponibles tras la migración 040 (supabase/migraciones/040_revision_semanal.sql). Lo demás ya funciona.</p>}
          </div>
          <div class="selector-chips" role="group" aria-label="Qué ver">
            {[['pendientes', `Pendientes (${filas.length - hechas})`], ['hechos', `Hechos (${hechas})`], ['todos', 'Todos']].map(([k, t]) => (
              <button key={k} aria-pressed={filtro === k ? 'true' : 'false'} onClick={() => setFiltro(k)}>{t}</button>
            ))}
          </div>
          {!vista.length ? (
            <div class="panel"><Vacio icono="hecho" titulo={filtro === 'pendientes' ? '¡Revisión terminada!' : 'Nadie revisado aún'}>{filtro === 'pendientes' ? 'Has revisado a todos esta semana.' : 'Marca a cada atleta cuando acabes con él.'}</Vacio></div>
          ) : (
            <ul class="revision-lista">
              {vista.map((f) => <FilaRevision key={f.atleta_id} f={f} con040={datos.revisiones} guardar={(c) => guardar(f, c)} abrirAtleta={abrirAtleta} />)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function FilaRevision({ f, con040, guardar, abrirAtleta }) {
  const [nota, setNota] = useState(f.nota || '');
  const [verNota, setVerNota] = useState(!!f.nota);
  const area = useRef(null);
  useEffect(() => { setNota(f.nota || ''); }, [f.nota]);
  const avisos = avisosRevision(f);
  const { completadas, total } = f.sesiones;
  const idCasilla = `rev-${f.atleta_id}`;
  const soltarNota = () => { if ((nota || '').trim() !== (f.nota || '').trim()) guardar({ nota }); };
  return (
    <li class={`panel revision-fila ${f.hecha ? 'hecha' : ''}`}>
      <div class="revision-cab">
        <Avatar nombre={f.nombre} foto={f.foto} />
        <div class="pila-xs revision-quien">
          <strong>{f.nombre}</strong>
          <span class="peq secundario">{f.servicio === 'nutricion' ? 'Solo nutrición' : total ? `${completadas} de ${total} sesiones esta semana` : completadas ? `${completadas} sesiones esta semana` : 'Sin sesiones esta semana'}</span>
          {total > 0 && <span class="barra-sesiones" aria-hidden="true"><span style={{ width: `${Math.min(100, Math.round((completadas / total) * 100))}%` }} /></span>}
        </div>
        {con040 && (
          <label class="revision-casilla" for={idCasilla}>
            <input id={idCasilla} type="checkbox" checked={f.hecha} onChange={(e) => guardar({ hecha: e.currentTarget.checked })} aria-label={`Revisión de ${f.nombre} terminada`} />
            <span aria-hidden="true">Revisado</span>
          </label>
        )}
      </div>
      {avisos.length > 0 && (
        <ul class="revision-avisos" aria-label="Lo que pide tu atención">
          {avisos.map((a) => <li key={a.tipo} class={`chip ${a.nivel}`}>{a.texto}</li>)}
        </ul>
      )}
      {f.notaAnterior && <p class="peq revision-anterior"><Icono n="historial" /> La semana pasada: {f.notaAnterior}</p>}
      {con040 && (verNota ? (
        <label class="pila-xs revision-nota">
          <span class="peq secundario">Nota de esta semana (te saldrá la próxima)</span>
          <textarea ref={area} rows="2" maxLength={500} value={nota} onInput={(e) => setNota(e.currentTarget.value)} onBlur={soltarNota} placeholder="Ej.: subir 2,5 kg en sentadilla; preguntar por el hombro" />
        </label>
      ) : <button class="btn-texto mini" onClick={() => { setVerNota(true); requestAnimationFrame(() => area.current?.focus()); }}>Añadir nota</button>)}
      <div class="revision-acciones">
        <button class="btn btn-peq" onClick={() => abrirAtleta(f.atleta_id, 'mensajes', null)}><Icono n="mensaje" /> Chat</button>
        <button class="btn btn-peq" onClick={() => abrirAtleta(f.atleta_id, 'programa', null)}><Icono n="semana" /> Programar</button>
        <button class="btn btn-peq" onClick={() => abrirAtleta(f.atleta_id, 'seguimiento', null)}><Icono n="progreso" /> Seguimiento</button>
      </div>
    </li>
  );
}
