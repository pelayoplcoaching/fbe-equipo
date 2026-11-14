// (personalización 3, tanda 8) Que le acompañe más allá de la app: la voz de su coach en sus mensajes, el reto del mes
// hecho para él, su compañero afín y su álbum de hitos.
import { useRef, useState } from 'preact/hooks';
import { useApp, useCarga, Hoja, Icono, Avatar } from '../comunes.jsx';
import { retoDelMes, ordenarAfines, textoAfin, albumHitos, textoAlbum } from '../../logica/compania.js';
import { hoyISO, fmtCorta } from '../../logica/fechas.js';
import { useAgenda } from './Vida.jsx';
import { vibrar } from '../hapticos.js';

// ---------- 13. La voz de su coach ----------
export function VozCoach({ ruta, segundos }) {
  const { api } = useApp();
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(false);
  const ref = useRef(null);
  if (!ruta) return null;
  const oir = async () => {
    try {
      if (!url) { const u = await api.urlVozMensaje(ruta); setUrl(u); setTimeout(() => ref.current?.play().catch(() => {}), 50); return; }
      ref.current?.play().catch(() => {});
    } catch { setError(true); }
  };
  return (
    <span class="voz-coach">
      {url ? <audio ref={ref} src={url} controls preload="auto" aria-label="La voz de tu coach" data-pausa-musica />
        : <button type="button" class="btn btn-peq voz-coach-oir" onClick={oir}><Icono n="play" /> Escuchar a tu coach{segundos ? ` (${segundos} s)` : ''}</button>}
      {error && <span class="mini secundario">No se ha podido cargar el audio.</span>}
    </span>
  );
}

// ---------- 14. El reto del mes ----------
export function RetoDelMes() {
  const { api, atleta, propio } = useApp();
  const activa = !propio && atleta?.estado !== 'baja' && !!atleta?.id;
  const entrenos = useCarga(() => (activa ? api.entrenamientos(atleta.id).catch(() => []) : Promise.resolve([])), [atleta?.id, activa], { recuerdo: activa ? `reto-entrenos:${atleta.id}` : null });
  const agenda = useAgenda(null, { activa });
  if (!activa || !entrenos.datos) return null;
  const r = retoDelMes({ entrenos: entrenos.datos, agenda: agenda.datos || [], hoy: hoyISO() });
  if (!r) return null;
  const pct = r.objetivo ? Math.min(1, r.hechos / r.objetivo) : null;
  return (
    <section class="panel panel-pad reto-mes" aria-label={`Tu reto de ${r.mes}`}>
      <span class="t-sobre">Tu reto de {r.mes}{r.tipo === 'coach' ? ' · de tu coach' : ''}</span>
      <strong class="reto-mes-t">{r.titulo}</strong>
      {r.objetivo ? (
        <>
          <span class="reto-barra" role="progressbar" aria-valuemin={0} aria-valuemax={r.objetivo} aria-valuenow={r.hechos} aria-label={`${r.hechos} de ${r.objetivo}`}><span style={{ width: `${Math.round(pct * 100)}%` }} /></span>
          <span class="mini secundario num">{r.hechos} de {r.objetivo}{r.hechos >= r.objetivo ? ' · ¡conseguido!' : ''}</span>
        </>
      ) : null}
      {r.tipo === 'dia' && <span class="mini secundario">Es un reto, no un cambio en tu plan: si tu sesión de ese día no cuadra, habla con tu coach.</span>}
    </section>
  );
}

// ---------- 15. Su compañero afín (dentro de «Invitar a un compañero de racha») ----------
export function AfinesCompanero({ ya = [], invitar, ocupado = false }) {
  const { api, aviso } = useApp();
  const [vuelta, setVuelta] = useState(0);
  const r = useCarga(() => api.afinesComunidad(), [vuelta]);
  if (r.datos == null) return null;
  const { yo, afines } = ordenarAfines(r.datos);
  const lista = afines.filter((x) => !ya.includes(x.perfil_id));
  const cambiar = async (si) => {
    try { await api.buscoCompanero(si); vibrar('elegir'); setVuelta((v) => v + 1); } catch (e) { aviso(e.message, 'error'); }
  };
  return (
    <section class="afines pila-s" aria-labelledby="afines-t">
      <label class="fila-ocultar"><span class="pila-xs"><strong id="afines-t">Busco compañero</strong><span class="peq secundario">Te emparejamos con quien entrena como tú: los que también buscan ven tu franja, tus días habituales y cuántos días entrenas a la semana (y tú los suyos).</span></span>
        <input type="checkbox" switch role="switch" aria-label="Busco compañero" checked={!!r.datos.busca} disabled={r.datos.sin_ranking} onChange={(e) => cambiar(e.currentTarget.checked)} /></label>
      {r.datos.sin_ranking && <p class="mini secundario">Como no sales en el ranking, no te emparejamos.</p>}
      {r.datos.busca && (lista.length ? (
        <ul class="lista cp-invitar">
          {lista.map((x) => (
            <li key={x.perfil_id} class="cp-fila">
              <Avatar nombre={x.nombre} clase="peq" />
              <span class="pila-xs cp-texto"><strong>{x.nombre}</strong><span class="mini secundario">{textoAfin(x, yo)}</span></span>
              <button type="button" class="btn btn-peq btn-primario" disabled={ocupado} aria-label={`Invitar a ${x.nombre}`} onClick={() => invitar(x)}>Invitar</button>
            </li>
          ))}
        </ul>
      ) : <p class="peq secundario">De momento nadie más lo busca. Te avisaremos aquí cuando alguien entrene como tú.</p>)}
    </section>
  );
}

// ---------- 16. Su álbum de hitos ----------
export function AlbumHitos({ entrenos, progreso, hoy }) {
  const { api, atleta, aviso, propio } = useApp();
  const agenda = useAgenda(null, { activa: !propio });
  const [anadir, setAnadir] = useState(false);
  if (propio || !atleta?.id) return null;
  const hitos = albumHitos({ entrenos, progreso, fechaAlta: atleta.fecha_alta, agenda: agenda.datos || [], hoy });
  if (!hitos.length) return null;
  const compartir = async () => {
    const t = textoAlbum(hitos);
    try { if (navigator.share) await navigator.share({ title: 'Mi álbum en FBE', text: t }); else { await navigator.clipboard.writeText(t); aviso('Copiado: pégalo donde quieras'); } } catch { /* cancelado */ }
  };
  return (
    <section class="panel panel-pad album-hitos" aria-labelledby="album-t">
      <div class="separa"><h2 id="album-t" class="album-t">Tu álbum</h2><button type="button" class="btn-texto" onClick={compartir}><Icono n="compartir" /> Compartir</button></div>
      <ol class="album-lista">
        {hitos.slice(0, 12).map((x) => (
          <li key={x.clave} class={x.suyo ? 'suyo' : ''}>
            <span class="album-ico" aria-hidden="true"><Icono n={x.icono} /></span>
            <span class="pila-xs"><strong>{x.titulo}</strong><span class="mini secundario">{fmtCorta(x.fecha)}{x.suyo && x.autor === 'coach' ? ' · lo añadió tu coach' : ''}</span></span>
            {x.suyo && x.autor === 'atleta' && <button type="button" class="btn btn-icono plano" aria-label={`Quitar ${x.titulo}`} onClick={() => api.borrarAgenda(x.id).catch((e) => aviso(e.message, 'error'))}><Icono n="basura" /></button>}
          </li>
        ))}
      </ol>
      <button type="button" class="btn btn-peq" onClick={() => setAnadir(true)}><Icono n="mas" /> Añadir un hito tuyo</button>
      {anadir && <HojaHito alCerrar={() => setAnadir(false)} />}
    </section>
  );
}
function HojaHito({ alCerrar }) {
  const { api, aviso } = useApp();
  const [titulo, setTitulo] = useState('');
  const [fecha, setFecha] = useState(hoyISO());
  const guardar = async () => {
    try { await api.guardarAgenda(null, { tipo: 'hito', fecha, titulo }); vibrar('hecho'); aviso('Añadido a tu álbum'); alCerrar(); } catch (e) { aviso(e.message, 'error'); }
  };
  return (
    <Hoja titulo="Un hito tuyo" alCerrar={alCerrar}>
      <div class="pila">
        <p class="peq secundario">La carrera que terminaste, tu boda, volver tras una lesión… Lo verá también tu coach.</p>
        <div class="campo"><label for="hito-titulo">Qué</label><input id="hito-titulo" class="entrada" maxLength={80} placeholder="Mi primera media maratón" value={titulo} onInput={(e) => setTitulo(e.currentTarget.value)} /></div>
        <div class="campo"><label for="hito-fecha">Cuándo</label><input id="hito-fecha" class="entrada" type="date" max={hoyISO()} value={fecha} onInput={(e) => setFecha(e.currentTarget.value)} /></div>
        <button type="button" class="btn btn-primario" disabled={!titulo.trim() || !fecha} onClick={guardar}>Añadir</button>
      </div>
    </Hoja>
  );
}

// ---------- En la ficha del coach: ponerle el reto del mes ----------
export function PonerReto({ atleta }) {
  const { api, aviso } = useApp();
  const [t, setT] = useState('');
  const poner = async () => {
    try { await api.guardarAgenda(atleta.id, { tipo: 'reto', fecha: hoyISO(), titulo: t }); setT(''); aviso('Reto puesto: lo verá en Hoy este mes'); } catch (e) { aviso(e.message, 'error'); }
  };
  return (
    <details class="su-vida-anadir">
      <summary class="btn-texto"><Icono n="diana" /> Ponerle el reto de este mes</summary>
      <div class="pila-s">
        <input class="entrada" aria-label="Su reto de este mes" maxLength={80} placeholder="4 jueves seguidos" value={t} onInput={(e) => setT(e.currentTarget.value)} />
        <span class="mini secundario">Sustituye al que le propone la app. Es un reto, no cambia su programación.</span>
        <button type="button" class="btn btn-peq" disabled={!t.trim()} onClick={poner}>Ponerlo</button>
      </div>
    </details>
  );
}
