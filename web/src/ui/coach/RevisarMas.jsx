// (v0.196) «Revisar», segunda tanda: lo apartado y lo fijado (en la base con la 083), uno a uno, la vista en dos
// columnas, tus frases por tipo y tu «Visto», tus tiempos, las teclas, la nota para la revisión semanal, las fotos de
// progreso lado a lado, lo último que os habéis dicho y el menú «Más» de cada tarjeta.
import { useEffect, useRef, useState } from 'preact/hooks';
import { useApp, useCarga, Icono, Hoja, useUnaVez, usePreferencia, cuando, Avatar } from '../comunes.jsx';
import {
  mapaDesdeLocal, apartadaHoy, sumarDiasRevisar, OPCIONES_APARTAR, TIPOS_FRASES, conFraseTipo, sinFraseTipo, textoVisto, EMOJIS_REVISAR, ATAJOS_REVISAR,
  urgenciaItem, resumenItem,
} from '../../logica/revisar.js';
import { textoHoras } from '../../logica/correccion.js';
import { conFrase, sinFrase, conNombre } from '../../logica/revision.js';

// ---------------------------------------------------------------- lo apartado y lo fijado
// Con la 083, en la base (igual en todos tus aparatos); sin ella, en este aparato (como en la v0.195)
export function useApartados(hoy) {
  const { api, aviso } = useApp();
  const [local, setLocal] = usePreferencia('fbe-revisar-pospuestos', {});
  const [fijLocal, setFijLocal] = usePreferencia('fbe-revisar-fijadas', []);
  const remoto = useCarga(() => api.apartadosRevisar(hoy).catch(() => null), []);
  const [mapa, setMapa] = useState(null);
  const enBase = remoto.datos != null && typeof remoto.datos === 'object';
  useEffect(() => {
    if (!enBase) return;
    // Lo que estaba en este aparato pasa a la base (una vez)
    const deAqui = mapaDesdeLocal(local, fijLocal, hoy);
    const nuevas = Object.entries(deAqui).filter(([k]) => !remoto.datos[k]);
    setMapa({ ...deAqui, ...remoto.datos });
    if (nuevas.length) {
      (async () => { for (const [k, v] of nuevas) await api.guardarApartado(k, v).catch(() => {}); })();
      setLocal({}); setFijLocal([]);
    }
  }, [remoto.datos]);
  const actual = enBase ? (mapa || remoto.datos) : mapaDesdeLocal(local, fijLocal, hoy);
  const ref = useRef(actual);
  ref.current = actual;
  const poner = async (clave, valor) => {
    const antes = ref.current;
    const nuevo = { ...antes };
    if (valor && (valor.hasta || valor.fijada)) nuevo[clave] = { hasta: valor.hasta || null, fijada: !!valor.fijada }; else delete nuevo[clave];
    if (enBase) {
      setMapa(nuevo);
      ref.current = nuevo;
      try { await api.guardarApartado(clave, valor || {}); } catch (e) { setMapa(antes); aviso(e.message, 'error'); }
    } else {
      const loc = {}, fij = [];
      for (const [k, v] of Object.entries(nuevo)) { if (v.hasta) loc[k] = v.hasta; if (v.fijada) fij.push(k); }
      setLocal(loc); setFijLocal(fij);
    }
  };
  const apartar = (clave, dias = 1) => { const m = ref.current[clave]; return poner(clave, { hasta: sumarDiasRevisar(hoy, dias), fijada: !!m?.fijada }); };
  const fijar = (clave) => { const m = ref.current[clave]; return poner(clave, { hasta: apartadaHoy(ref.current, clave, hoy) ? m.hasta : null, fijada: !m?.fijada }); };
  return { mapa: actual, poner, apartar, fijar, enBase, previo: (clave) => ref.current[clave] || null };
}

// ---------------------------------------------------------------- tus frases por tipo y tu «Visto»
export function usePreferenciasFrases() {
  const [porTipo, setPorTipo] = usePreferencia('fbe-revisar-frases-tipo', {});
  const [visto, setVisto] = usePreferencia('fbe-revisar-visto', '');
  return { porTipo, setPorTipo, visto: textoVisto(visto), vistoPropio: visto, setVisto };
}
export function HojaFrases({ generales, guardarGenerales, porTipo, setPorTipo, vistoPropio, setVisto, alCerrar }) {
  const [tipo, setTipo] = useState('sesiones');
  const [texto, setTexto] = useState('');
  const [visto, setV] = useState(vistoPropio || '');
  const lista = tipo === 'todo' ? generales : (porTipo?.[tipo] || []);
  const anadir = (e) => {
    e.preventDefault();
    const t = texto.trim();
    if (!t) return;
    if (tipo === 'todo') guardarGenerales(conFrase(generales, t)); else setPorTipo(conFraseTipo(porTipo, tipo, t));
    setTexto('');
  };
  const quitar = (fr) => { if (tipo === 'todo') guardarGenerales(sinFrase(generales, fr)); else setPorTipo(sinFraseTipo(porTipo, tipo, fr)); };
  return (
    <Hoja titulo="Tus frases" alCerrar={alCerrar} ancho={620}>
      <div class="pila">
        <div class="segmentos segmentos-envolver" role="group" aria-label="Para qué son">
          {TIPOS_FRASES.map(([k, t]) => <button key={k} type="button" aria-pressed={tipo === k ? 'true' : 'false'} onClick={() => setTipo(k)}>{t}</button>)}
        </div>
        {lista.length ? (
          <ul class="rev-frases-lista">{lista.map((fr) => (
            <li key={fr}><span class="chip rev-frase">{conNombre(fr, 'Ana')}</span><button type="button" class="btn-icono plano rev-frase-quitar" aria-label={`Quitar la frase: ${fr.slice(0, 40)}`} onClick={() => quitar(fr)}><Icono n="cerrar" /></button></li>
          ))}</ul>
        ) : <p class="peq secundario">Aún no tienes frases {tipo === 'todo' ? 'para todo' : TIPOS_FRASES.find(([k]) => k === tipo)[1].toLowerCase()}.</p>}
        <form class="fila revisar-frase-nueva" onSubmit={anadir}>
          <input class="entrada" maxLength={300} value={texto} onInput={(e) => setTexto(e.currentTarget.value)} aria-label="Frase nueva" placeholder="¡Buen trabajo, {nombre}!" />
          <button class="btn btn-primario" disabled={!texto.trim()}>Añadir</button>
        </form>
        <p class="mini terciario">Escribe {'{nombre}'} donde quieras su nombre. Al contestar salen primero las de ese tipo y luego las de todo. Las de todo son las de la revisión semanal{'; '}las demás se guardan en este aparato.</p>
        <div class="campo"><label for="revisar-visto">Tu «Visto» (el botón que contesta y lo da por revisado)</label>
          <div class="fila">
            <input id="revisar-visto" class="entrada" maxLength={60} value={visto} placeholder="Visto 💪" onInput={(e) => setV(e.currentTarget.value)} />
            <button type="button" class="btn" onClick={() => { setVisto(visto.trim()); alCerrar(); }}>Guardar</button>
          </div>
        </div>
      </div>
    </Hoja>
  );
}

// ---------------------------------------------------------------- el menú «Más» de cada tarjeta
// opciones: { emoji, tarea, video, nota, fijada, fijar, apartar }
export function MasAcciones({ hoy, emoji = null, tarea = null, video = null, nota = null, fijada = false, fijar = null, apartar = null }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <button type="button" class="btn btn-peq btn-texto revisar-mas-btn" aria-expanded={abierto ? 'true' : 'false'} onClick={() => setAbierto(!abierto)}><Icono n="opciones" /> Más</button>
      {abierto && (
        <div class="revisar-mas" role="group" aria-label="Más acciones">
          {emoji && <span class="revisar-emojis">{EMOJIS_REVISAR.map((e) => <button key={e} type="button" class="btn btn-peq revisar-emoji" aria-label={`Contestar con ${e}`} onClick={() => emoji(e)}>{e}</button>)}</span>}
          {tarea && <button type="button" class="btn btn-peq btn-texto" onClick={tarea}><Icono n="hecho" /> Mandarle una tarea</button>}
          {video && <button type="button" class="btn btn-peq btn-texto" onClick={video}><Icono n="video" /> Pedirle un vídeo</button>}
          {nota && <button type="button" class="btn btn-peq btn-texto" onClick={nota}><Icono n="editar" /> Para la revisión semanal</button>}
          {fijar && <button type="button" class="btn btn-peq btn-texto revisar-fijar" aria-pressed={fijada ? 'true' : 'false'} onClick={fijar}><Icono n="chincheta" /> {fijada ? 'Quitar de arriba' : 'Fijar arriba'}</button>}
          {apartar && OPCIONES_APARTAR(hoy).slice(1).map(([k, t, dias]) => <button key={k} type="button" class="btn btn-peq btn-texto" onClick={() => apartar(dias)}><Icono n="reloj" /> {t}</button>)}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------- la nota para su revisión semanal
export function HojaNotaRevision({ atleta, texto = '', alCerrar }) {
  const { api, aviso } = useApp();
  const [t, setT] = useState(texto);
  const [ocupado, una] = useUnaVez();
  const guardar = () => una(async () => {
    try { await api.notaParaRevision(atleta.id, t); aviso('Te saldrá en su revisión semanal', 'ok'); alCerrar(); } catch (e) { aviso(e.message, 'error'); }
  });
  return (
    <Hoja titulo={`Para la revisión semanal de ${atleta.nombre.split(' ')[0]}`} alCerrar={alCerrar}>
      <div class="pila">
        <label class="pila-xs"><span class="peq secundario">Se suma a la nota de su revisión de esta semana.</span>
          <textarea class="area" rows={3} maxLength={300} value={t} onInput={(e) => setT(e.currentTarget.value)} aria-label="Nota para la revisión semanal" /></label>
        <button type="button" class="btn btn-primario" disabled={ocupado || !t.trim()} onClick={guardar}><Icono n="guardar" /> Guardar la nota</button>
      </div>
    </Hoja>
  );
}

// ---------------------------------------------------------------- tus tiempos, de todo
const NOMBRE_TIEMPO = [['todo', 'Todo'], ['sesiones', 'Sesiones'], ['checkins', 'Check-ins'], ['videos', 'Vídeos'], ['mensajes', 'Mensajes']];
export function HojaTiempos({ alCerrar, racha = '' }) {
  const { api } = useApp();
  const t = useCarga(() => api.tiemposRevisar(), []);
  const e = t.datos;
  return (
    <Hoja titulo="Tus tiempos en Revisar" alCerrar={alCerrar}>
      {!e ? <p class="peq secundario" role="status">Calculando...</p> : (
        <div class="pila">
          <div class="rev-tabla-env">
            <table class="rev-tabla revisar-tiempos">
              <caption class="sr">De que llega a que lo revisas o lo contestas, en los últimos 30 días</caption>
              <thead><tr><th scope="col">Qué</th><th scope="col">Mediana</th><th scope="col">P90</th><th scope="col">Cuántas</th></tr></thead>
              <tbody>{NOMBRE_TIEMPO.map(([k, n]) => <tr key={k}><th scope="row">{n}</th><td class="num">{e[k]?.n ? textoHoras(e[k].mediana) : '—'}</td><td class="num">{e[k]?.n ? textoHoras(e[k].p90) : '—'}</td><td class="num">{e[k]?.n || 0}</td></tr>)}</tbody>
            </table>
          </div>
          <p class="peq"><strong class="num">{e.semana}</strong> revisadas esta semana.{racha ? ` ${racha}.` : ''}</p>
          <p class="mini terciario">De que llega a que lo das por revisado o lo contestas, en los últimos 30 días. La mediana es lo normal; el P90, tus días más lentos (9 de cada 10, antes de eso). Las sesiones cuentan desde el mediodía del día que se hicieron.</p>
        </div>
      )}
    </Hoja>
  );
}

// ---------------------------------------------------------------- las teclas
export function HojaAtajos({ alCerrar }) {
  return (
    <Hoja titulo="Teclas de Revisar" alCerrar={alCerrar}>
      <dl class="revisar-atajos">{ATAJOS_REVISAR.map(([k, t]) => <div key={k}><dt><kbd>{k}</kbd></dt><dd class="peq">{t}</dd></div>)}</dl>
      <p class="mini terciario">En uno a uno, también las flechas izquierda y derecha.</p>
    </Hoja>
  );
}

// ---------------------------------------------------------------- las fotos de progreso, lado a lado
export function HojaFotos({ foto, alCerrar }) {
  const { api } = useApp();
  const d = useCarga(async () => {
    const otra = await api.fotoAnterior(foto);
    const [a, b] = await Promise.all([api.urlArchivo(foto.ruta), otra ? api.urlArchivo(otra.ruta) : Promise.resolve(null)]);
    return { otra, a, b };
  }, [foto.id]);
  const x = d.datos;
  return (
    <Hoja titulo={`Fotos de ${foto.atleta?.nombre?.split(' ')[0] || 'progreso'}`} alCerrar={alCerrar} ancho={900}>
      {!x ? <p class="peq secundario" role="status">Cargando las fotos...</p> : !x.otra ? <p class="peq">Es su primera foto de progreso: no hay otra con que compararla.</p> : (
        <div class="revisar-fotos">
          <figure><img src={x.b} alt={`La anterior, del ${x.otra.fecha || cuando(x.otra.creado_en)}`} /><figcaption class="peq secundario">Antes ({x.otra.fecha || cuando(x.otra.creado_en)})</figcaption></figure>
          <figure><img src={x.a} alt={`Esta, del ${foto.fecha || cuando(foto.creado_en)}`} /><figcaption class="peq secundario">Ahora ({foto.fecha || cuando(foto.creado_en)})</figcaption></figure>
        </div>
      )}
    </Hoja>
  );
}

// ---------------------------------------------------------------- lo último que os habéis dicho
export function UltimosMensajes({ atletaId, nombre }) {
  const { api } = useApp();
  const d = useCarga(() => api.ultimosMensajes(atletaId, 5), [atletaId]);
  if (d.cargando && !d.datos) return <p class="mini secundario" role="status">Cargando...</p>;
  const xs = d.datos || [];
  if (!xs.length) return <p class="mini secundario">Aún no os habéis escrito.</p>;
  return (
    <ol class="revisar-ultimos" aria-label="Lo último que os habéis dicho">
      {xs.map((m) => <li key={m.id} class={m.autor === 'coach' ? 'mio' : 'suyo'}><span class="mini terciario">{m.autor === 'coach' ? 'Tú' : nombre.split(' ')[0]}, {cuando(m.creado_en)}</span><span class="peq">{m.texto || (m.audio ? 'Nota de voz' : m.adjunto ? 'Un archivo' : '')}</span></li>)}
    </ol>
  );
}

// ---------------------------------------------------------------- uno a uno, para todo
export function UnoAUno({ items, render, alCerrar }) {
  const [i, setI] = useState(0);
  const claveRef = useRef(items[0]?.clave || null);
  // Si la que estaba se va (revisada), se queda en su sitio: entra la siguiente
  let k = items.findIndex((x) => x.clave === claveRef.current);
  if (k < 0) k = Math.min(i, items.length - 1);
  const x = items[k];
  claveRef.current = x?.clave || null;
  const ir = (n) => { const j = Math.max(0, Math.min(items.length - 1, n)); setI(j); claveRef.current = items[j]?.clave || null; };
  const caja = useRef(null);
  useEffect(() => { if (i !== k) setI(k); }, [k]);
  const tecla = (e) => {
    if (e.target.closest?.('input, textarea, select, [contenteditable="true"], .reproductor')) return;
    if (e.key === 'ArrowRight' || e.key === 'j') { e.preventDefault(); ir(k + 1); }
    else if (e.key === 'ArrowLeft' || e.key === 'k') { e.preventDefault(); ir(k - 1); }
    else if (['e', 'v', 'm'].includes(e.key)) {
      const b = caja.current?.querySelector(e.key === 'e' ? 'button.revisar-hecho' : e.key === 'v' ? 'button.revisar-visto' : 'button.revisar-manana');
      if (b) { e.preventDefault(); b.click(); }
    }
  };
  return (
    <Hoja titulo="Uno a uno" alCerrar={alCerrar} ancho={860} clase="revisar-uno-hoja">
      <div class="revisar-uno" ref={caja} onKeyDown={tecla}>
        {!x ? (
          <div class="pila revisar-uno-fin" role="status"><p class="peq"><strong>Ya no queda nada en esta lista.</strong></p><button type="button" class="btn btn-primario" onClick={alCerrar}>Volver</button></div>
        ) : (
          <>
            <div class="fila-entre revisar-uno-nav">
              <button type="button" class="btn btn-peq" disabled={k <= 0} onClick={() => ir(k - 1)}><Icono n="atras" /> Anterior</button>
              <span class="peq num" aria-live="polite">{k + 1} de {items.length}</span>
              <button type="button" class="btn btn-peq" disabled={k >= items.length - 1} onClick={() => ir(k + 1)}>Siguiente <Icono n="derecha" /></button>
            </div>
            <div key={x.clave}>{render(x)}</div>
          </>
        )}
      </div>
    </Hoja>
  );
}

// ---------------------------------------------------------------- la vista en dos columnas
export function ListaColumnas({ items, sel, alElegir, ahora = new Date() }) {
  return (
    <nav class="revisar-col-lista" aria-label="Lo que hay por revisar">
      <ul>
        {items.map((x) => {
          const u = urgenciaItem(x, ahora);
          const activa = sel === x.clave;
          return (
            <li key={x.clave}>
              <button type="button" class={`revisar-fila ${activa ? 'activa' : ''}`} aria-current={activa ? 'true' : undefined} onClick={() => alElegir(x.clave)}>
                {x.atleta ? <Avatar nombre={x.atleta.nombre} foto={x.atleta.foto} clase="peq" /> : <span class="revisar-fila-equipo" aria-hidden="true"><Icono n="bandera" /></span>}
                <span class="pila-xs revisar-fila-txt">
                  <span class="peq revisar-fila-nombre">{x.atleta?.nombre || 'El equipo'}{u.nivel && <span class={`revisar-urg urg-${u.nivel}`} aria-hidden="true" />}</span>
                  <span class="mini secundario revisar-fila-que">{resumenItem(x)}</span>
                </span>
                {u.nivel && <span class="sr">, {u.nivel === 'alta' ? 'urgente' : 'a mirar pronto'}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
