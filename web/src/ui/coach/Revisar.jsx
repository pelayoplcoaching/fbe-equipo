import { useEffect, useRef, useState } from 'preact/hooks';
import { ChipLlegada } from '../atleta/Preparacion.jsx';
import { CabeceraGrande, Siluetas, useApp, useCarga, Icono, ErrorCaja, cuando, Avatar, Hoja, usePreferencia, Vacio } from '../comunes.jsx';
import { agruparPorAtleta, textoTipos, esDeslizar, duracionCorta } from '../../logica/diseno.js';
import { vibrar } from '../hapticos.js';
import { cardioHechoValido, textoCardioHecho, NOMBRE_MODALIDAD } from '../../logica/cardio.js';
import { BandaDemo } from '../App.jsx';
import { Hilo } from '../Hilo.jsx';
import { VerArchivo } from '../Archivos.jsx';
import { ESCALAS, NOMBRE_ZONA, num } from '../../logica/calculos.js';
import { fmtConDia, rangoSemana } from '../../logica/fechas.js';
import { NOMBRE_TOMA } from '../../logica/comidas.js';
import { TarjetaTarea } from '../Tareas.jsx';

// «Deshacer» en el aviso: vuelve a dejarlo pendiente
// (los botones cuya acción tiene «Deshacer» llevan data-deshacer: solo esos se pueden pulsar deslizando la tarjeta)
const deshacer = (api, tipo, id, recargar) => ({ texto: 'Deshacer', fn: async () => { await api.marcarRevisado(tipo, id, false); recargar(); } });

// Atajos de teclado (como en Superhuman o Linear): j/k moverse, r responder, e revisado, o abrir la ficha
// v0.50: «r», «e» y «o» solo actúan sobre la tarjeta que tiene el foco (tras plegar un grupo o cambiar el filtro, la
// posición de antes ya no es la misma tarjeta); clave: lo que cambia la lista (filtro y grupos plegados)
function useAtajos(caja, n, clave = '') {
  const [i, setI] = useState(-1);
  useEffect(() => { setI(-1); }, [clave]);
  useEffect(() => {
    const tarjetas = () => [...(caja.current?.querySelectorAll('.tarjeta-revisar') || [])];
    const enfocar = (k) => { const t = tarjetas(); if (!t.length) return; const j = Math.max(0, Math.min(t.length - 1, k)); setI(j); t[j].focus({ preventScroll: true }); t[j].scrollIntoView({ block: 'nearest' }); };
    const tecla = (e) => {
      // El reproductor de vídeo usa sus propias teclas (k = reproducir): si ya las ha usado, aquí no se hace nada
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.('input, textarea, select, [contenteditable="true"], .reproductor') || document.querySelector('[aria-modal="true"]')) return;
      const t = tarjetas();
      const actual = t.indexOf(document.activeElement?.closest?.('.tarjeta-revisar'));
      const k = actual >= 0 ? actual : i;
      if (e.key === 'j' || (e.key === 'ArrowDown' && actual >= 0)) { e.preventDefault(); enfocar(k + 1); }
      else if (e.key === 'k' || (e.key === 'ArrowUp' && actual >= 0)) { e.preventDefault(); enfocar(k <= 0 ? 0 : k - 1); }
      else if (actual >= 0 && t[actual]) {
        const boton = (sel) => t[k].querySelector(sel);
        if (e.key === 'r') { e.preventDefault(); const b = boton('button[aria-expanded="false"]'); b?.click(); setTimeout(() => t[k].querySelector('textarea')?.focus(), 60); }
        else if (e.key === 'e') {
          const b = boton('button.revisar-hecho');
          if (b) {
            e.preventDefault();
            const antes = t[k];
            b.click();
            // El foco pasa a la tarjeta que ocupa su sitio cuando la lista se actualiza (con conexión lenta, tarda)
            const intentar = (n) => { if (!antes.isConnected || n >= 20) enfocar(k); else setTimeout(() => intentar(n + 1), 150); };
            setTimeout(() => intentar(0), 150);
          }
        }
        else if (e.key === 'o') { e.preventDefault(); boton('.nombre-atleta')?.click(); }
      }
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [i, n]);
  return i;
}

const FILTROS = [['todo', 'Todo'], ['mensajes', 'Mensajes'], ['sesiones', 'Sesiones'], ['checkins', 'Check-ins'], ['videos', 'Vídeos'], ['tareas', 'Tareas'], ['recetas', 'Recetas'], ['comunidad', 'Equipo']];

// Bandeja del coach: todo lo que espera tu respuesta, de todos los atletas, en un sitio.
// v0.50: agrupado por atleta (cada uno con su cabecera, que se pliega, y cuántas cosas tiene); deslizar una tarjeta a
// la derecha la da por revisada (con el «Deshacer» de siempre; el botón «Revisado» sigue ahí); los vídeos, con su
// miniatura y su duración.
export function Revisar({ bandeja, abrirAtleta }) {
  const [filtro, setFiltro] = useState('todo');
  const [plegados, setPlegados] = useState(() => new Set());
  const d = bandeja.datos;
  const caja = useRef(null);
  useAtajos(caja, d?.total || 0, `${filtro}|${[...plegados].sort().join(',')}`);
  const recargar = () => bandeja.recargar(true);
  if (bandeja.cargando && !d) return <div class="contenido coach"><Siluetas forma="tarjetas" n={3} texto="Cargando lo que tienes por revisar" /></div>;

  // Los mensajes se agrupan por conversación
  const hilos = [];
  for (const c of d?.comentarios || []) {
    const clave = c.sesion_id || c.checkin_id || c.archivo_id || `general-${c.atleta_id}`;
    let h = hilos.find((x) => x.clave === clave);
    if (!h) { h = { clave, ultimo: c, n: 0 }; hilos.push(h); }
    h.n++;
  }
  const cuentas = { mensajes: hilos.length, sesiones: d?.sesiones.length || 0, checkins: d?.checkins.length || 0, videos: d?.archivos.length || 0, recetas: d?.recetas?.length || 0, comunidad: d?.comunidad?.length || 0, tareas: d?.tareas?.length || 0 };
  const ver = (k) => filtro === 'todo' || filtro === k;
  const items = d ? [
    ...hilos.map((h) => ({ tipo: 'mensajes', clave: `m-${h.clave}`, atleta: h.ultimo.atleta ? { ...h.ultimo.atleta, id: h.ultimo.atleta.id || h.ultimo.atleta_id } : null, h })),
    ...d.sesiones.map((s) => ({ tipo: 'sesiones', clave: `s-${s.id}`, atleta: s.atleta, s })),
    ...d.checkins.map((c) => ({ tipo: 'checkins', clave: `c-${c.id}`, atleta: c.atleta, c })),
    ...d.archivos.map((a) => ({ tipo: 'videos', clave: `v-${a.id}`, atleta: a.atleta, a })),
    ...(d.tareas || []).map((t) => ({ tipo: 'tareas', clave: `t-${t.id}`, atleta: t.atleta, t })),
    ...(d.recetas || []).map((r) => ({ tipo: 'recetas', clave: `r-${r.id}`, atleta: r.atleta, r })),
    ...(d.comunidad || []).map((r) => ({ tipo: 'comunidad', clave: `e-${r.id}`, atleta: null, r })),
  ].filter((x) => ver(x.tipo)) : [];
  const grupos = agruparPorAtleta(items);
  const alternar = (id) => setPlegados((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const tarjeta = (x) => {
    if (x.tipo === 'mensajes') return <TarjetaMensaje h={x.h} recargar={recargar} abrirAtleta={abrirAtleta} />;
    if (x.tipo === 'sesiones') return <TarjetaSesion s={x.s} recargar={recargar} abrirAtleta={abrirAtleta} />;
    if (x.tipo === 'checkins') return <TarjetaCheckin c={x.c} recargar={recargar} abrirAtleta={abrirAtleta} />;
    if (x.tipo === 'videos') return <TarjetaVideo a={x.a} recargar={recargar} abrirAtleta={abrirAtleta} />;
    if (x.tipo === 'tareas') return <TarjetaTarea t={x.t} recargar={recargar} abrirAtleta={abrirAtleta} />;
    if (x.tipo === 'recetas') return <TarjetaCambioReceta r={x.r} recargar={recargar} abrirAtleta={abrirAtleta} />;
    return <TarjetaReporte r={x.r} recargar={recargar} />;
  };

  return (
    <div class="contenido coach">
      <CabeceraGrande>
        <div class="titulo"><h1>Revisar</h1><div class="sub">{d?.total ? (d.total === 1 ? '1 cosa espera tu respuesta' : `${d.total} cosas esperan tu respuesta`) : 'Al día'}</div></div>
      </CabeceraGrande>
      <BandaDemo />
      <ErrorCaja error={bandeja.error} reintentar={recargar} />
      <div class="selector-chips" role="group" aria-label="Qué revisar">
        {FILTROS.map(([k, t]) => (k === 'todo' || cuentas[k] > 0) && (
          <button key={k} aria-pressed={filtro === k ? 'true' : 'false'} onClick={() => setFiltro(k)}>{t}{k !== 'todo' ? ` (${cuentas[k]})` : ''}</button>
        ))}
      </div>
      {filtro === 'todo' && <VariantesPorRevisar abrirAtleta={abrirAtleta} />}
      {!d?.total ? <BandejaVacia /> : (
        <div class="rejilla-revisar" ref={caja}>
          {grupos.map((g) => (
            <GrupoRevisar key={g.id} g={g} abierto={!plegados.has(g.id)} alternar={() => alternar(g.id)}>
              {g.items.map((x) => <Deslizable key={x.clave}>{tarjeta(x)}</Deslizable>)}
            </GrupoRevisar>
          ))}
        </div>
      )}
      <p class="mini terciario">Comentar algo lo da por revisado; deslizar una tarjeta a la derecha, también. Las sesiones y los check-ins de más de 4 semanas salen de la bandeja solos.</p>
      {d?.total > 0 && <p class="mini terciario solo-ancho atajos">Con el teclado: <kbd>j</kbd> <kbd>k</kbd> para moverte, <kbd>r</kbd> responder, <kbd>e</kbd> revisado, <kbd>o</kbd> abrir su ficha.</p>}
    </div>
  );
}

// Lo de un atleta en la bandeja: su cabecera (que pliega y despliega) con cuántas cosas tiene y de qué
function GrupoRevisar({ g, abierto, alternar, children }) {
  const id = `rev-${g.id}`;
  const nombre = g.atleta?.nombre || 'El equipo';
  const tipos = textoTipos(g.tipos);
  return (
    <section class={`grupo-revisar ${abierto ? '' : 'plegado'}`} aria-labelledby={`${id}-cab`}>
      <h2 class="grupo-revisar-h">
        <button type="button" id={`${id}-cab`} class="grupo-revisar-cab" aria-expanded={abierto ? 'true' : 'false'} aria-controls={abierto ? id : undefined} onClick={alternar}>
          {g.atleta ? <Avatar nombre={nombre} foto={g.atleta.foto} /> : <span class="ico-reporte" aria-hidden="true"><Icono n="bandera" /></span>}
          <span class="pila-xs grupo-revisar-quien"><span class="grupo-revisar-nombre">{nombre}</span><span class="mini terciario">{tipos}</span></span>
          <span class="grupo-revisar-n num" aria-hidden="true">{g.n}</span>
          <span class="sr">, {g.n === 1 ? '1 pendiente' : `${g.n} pendientes`}</span>
          <Icono n="abajo" class="grupo-revisar-chevron" />
        </button>
      </h2>
      {abierto && <div id={id} class="grupo-revisar-items">{children}</div>}
    </section>
  );
}

// Deslizar a la derecha para dar por revisado (con el dedo; con el ratón, el botón): solo en las tarjetas cuyo botón
// tiene «Deshacer» (data-deshacer: sesiones, check-ins, vídeos y tareas; no las recetas ni los avisos del equipo), y
// lo que hace es pulsar ese botón, así el aviso y el «Deshacer» son los de siempre. Nada de lo que pasa dentro de una
// hoja cuenta (ya van en su capa, pero por si acaso).
function Deslizable({ children }) {
  const ref = useRef(null);
  const g = useRef(null);
  const [dx, setDx] = useState(0);
  const [hecho, setHecho] = useState(false);
  const boton = () => ref.current?.querySelector('.tarjeta-revisar button.revisar-hecho[data-deshacer]:not([disabled])');
  const fin = (e) => {
    const s = g.current;
    g.current = null;
    if (!s?.activo) { setDx(0); return; }
    const ancho = ref.current?.offsetWidth || 360;
    const x = Math.max(0, e.clientX - s.x), y = e.clientY - s.y;
    if (esDeslizar(x, y, ancho) && boton()) {
      setHecho(true); setDx(ancho);
      vibrar('serie');
      const b = boton();
      setTimeout(() => { b?.click(); setTimeout(() => { if (ref.current) { setHecho(false); setDx(0); } }, 400); }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 160);
    } else setDx(0);
  };
  return (
    <div ref={ref} class={`deslizable ${dx ? 'moviendo' : ''} ${hecho ? 'hecho' : ''} ${g.current?.activo ? 'arrastrando' : ''}`} style={{ '--dx': `${dx}px` }}
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse' || e.button > 0 || !boton() || e.target.closest('textarea, input, select, video, .reproductor, .rep-lienzo, .velo, [aria-modal="true"]')) return;
        g.current = { x: e.clientX, y: e.clientY, id: e.pointerId, activo: false };
      }}
      onPointerMove={(e) => {
        const s = g.current;
        if (!s || s.id !== e.pointerId) return;
        const x = e.clientX - s.x, y = e.clientY - s.y;
        if (!s.activo) {
          if (Math.abs(y) > 14 && Math.abs(y) > Math.abs(x)) { g.current = null; return; }
          if (x > 12 && x > Math.abs(y) * 1.4) { s.activo = true; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* */ } }
        }
        if (s.activo) setDx(Math.max(0, x));
      }}
      onPointerUp={fin} onPointerCancel={() => { g.current = null; setDx(0); }}>
      <div class="deslizable-fondo" aria-hidden="true"><Icono n="hecho" /><span>Revisado</span></div>
      {children}
    </div>
  );
}

// Variantes de material que no cuadran (v0.30): en los bloques en marcha o por empezar, ejercicios cuya variante
// nombra otro material («Press militar sentado con mancuernas», variante «En máquina»). Se arreglan en todo el bloque.
// «Dejar así» se recuerda en este dispositivo.
function VariantesPorRevisar({ abrirAtleta }) {
  const { api, aviso } = useApp();
  const lista = useCarga(() => api.variantesPorRevisar(), []);
  const [ignoradas, setIgnoradas] = usePreferencia('fbe-variantes-ignoradas', []);
  const [abierto, setAbierto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const pendientes = (lista.datos || []).filter((x) => !ignoradas.includes(x.clave));
  if (!pendientes.length && !abierto) return null;
  async function corregir(x, nuevo) {
    if (ocupado) return;
    setOcupado(true);
    try {
      const n = await api.corregirVariante({ bloqueId: x.bloque.id, ejercicioId: x.ejercicio.id, variante: x.variante, nuevoEjercicioId: nuevo?.id || null });
      aviso(nuevo ? `${x.atleta.nombre}: cambiado a ${nuevo.nombre}${n > 1 ? ` en ${n} sesiones` : ''}` : `${x.atleta.nombre}: variante quitada`);
      await lista.recargar(true);
    } catch (e) { aviso(e.message, 'error'); } finally { setOcupado(false); }
  }
  return (
    <>
      {pendientes.length > 0 && (
        <div class="panel panel-pad aviso-variante" role="note">
          <span><b>{pendientes.length === 1 ? '1 ejercicio tiene' : `${pendientes.length} ejercicios tienen`} una variante con otro material</b> (por ejemplo, con mancuernas pero «En máquina»). Cada material es un ejercicio aparte: sus kilos no se mezclan.</span>
          <div class="aviso-variante-botones"><button type="button" class="btn btn-peq" onClick={() => setAbierto(true)}>Revisarlos</button></div>
        </div>
      )}
      {abierto && (
        <Hoja titulo="Variantes con otro material" alCerrar={() => setAbierto(false)}>
          {!pendientes.length ? <p class="peq secundario">Ya no queda ninguno.</p> : (
            <div class="lista-variantes">
              {pendientes.map((x) => (
                <div key={x.clave} class="fila-variante">
                  <button type="button" class="btn-texto nombre-atleta" onClick={() => { setAbierto(false); abrirAtleta(x.atleta.id, 'programa'); }}><Avatar nombre={x.atleta.nombre} foto={x.atleta.foto} clase="peq" />{x.atleta.nombre}</button>
                  <p class="peq"><b>{x.ejercicio.nombre}</b>, variante «{x.variante}»{x.sesion ? <span class="terciario"> ({x.sesion}{x.pautas > 1 ? `, ${x.pautas} veces en el bloque` : ''})</span> : null}</p>
                  <p class="mini secundario">{x.revision.texto}</p>
                  <div class="aviso-variante-botones">
                    {x.revision.propuestas.map((e) => <button key={e.id} type="button" class="btn btn-peq" disabled={ocupado} onClick={() => corregir(x, e)}>Cambiar a {e.nombre}</button>)}
                    <button type="button" class="btn btn-peq" disabled={ocupado} onClick={() => corregir(x, null)}>Quitar la variante</button>
                    <button type="button" class="btn btn-peq btn-texto" onClick={() => setIgnoradas([...ignoradas, x.clave])}>Dejar así</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p class="mini terciario">Se cambia en todas las semanas del bloque. Lo que el atleta ya ha registrado pasa al ejercicio nuevo, que es el que hizo de verdad.</p>
        </Hoja>
      )}
    </>
  );
}

function Cabecera({ atleta, tipo, cuando: c, abrirAtleta, pestana }) {
  return (
    <div class="separa revisar-cab">
      <button class="btn-texto nombre-atleta" onClick={() => abrirAtleta(atleta.id, pestana)}><Avatar nombre={atleta.nombre} foto={atleta.foto} clase="peq" />{atleta.nombre}</button>
      <span class="mini terciario">{tipo}{c ? `, ${c}` : ''}</span>
    </div>
  );
}

function Acciones({ abierto, setAbierto, revisar, etiquetaComentar = 'Comentar' }) {
  return (
    <div class="fila-envolver">
      <button class="btn btn-peq" aria-expanded={abierto ? 'true' : 'false'} onClick={() => setAbierto(!abierto)}><Icono n="mensaje" /> {abierto ? 'Cerrar' : etiquetaComentar}</button>
      {revisar && <button class="btn btn-peq revisar-hecho" data-deshacer="" onClick={revisar}><Icono n="hecho" /> Revisado</button>}
    </div>
  );
}

function TarjetaMensaje({ h, recargar, abrirAtleta }) {
  const [abierto, setAbierto] = useState(false);
  const leido = useRef(false);
  // Al abrirla se marcan como leídos; la bandeja se actualiza al cerrarla (no mientras lo lees)
  const alternar = (v) => { setAbierto(v); if (!v && leido.current) recargar(); };
  const c = h.ultimo;
  const contexto = c.sesion_id ? `en ${c.sesion?.nombre || 'una sesión'}` : c.checkin_id ? 'en su check-in' : c.archivo_id ? 'en un vídeo' : 'mensaje';
  return (
    <article tabIndex={-1} class="panel panel-pad pila-s tarjeta-revisar mensaje-pendiente">
      <Cabecera atleta={c.atleta} tipo={contexto} cuando={cuando(c.creado_en)} abrirAtleta={abrirAtleta} pestana={c.sesion_id ? 'registro' : c.checkin_id ? 'seguimiento' : c.archivo_id ? 'videos' : 'programa'} />
      {!abierto && <p class="cita">«{c.texto}»{h.n > 1 ? <span class="terciario"> y {h.n - 1} más</span> : ''}</p>}
      {abierto && <Hilo atletaId={c.atleta_id} sesionId={c.sesion_id} checkinId={c.checkin_id} archivoId={c.archivo_id} nombreAtleta={c.atleta.nombre} alCambiar={recargar} alLeer={() => { leido.current = true; }} />}
      <Acciones abierto={abierto} setAbierto={alternar} etiquetaComentar="Responder" />
    </article>
  );
}

function TarjetaSesion({ s, recargar, abrirAtleta }) {
  const { api, aviso } = useApp();
  const [abierto, setAbierto] = useState(false);
  const revisar = async () => { try { await api.marcarRevisado('sesion', s.id); aviso('Sesión revisada', 'ok', deshacer(api, 'sesion', s.id, recargar)); recargar(); } catch (e) { aviso(e.message, 'error'); } };
  return (
    <article tabIndex={-1} class="panel panel-pad pila-s tarjeta-revisar">
      <Cabecera atleta={s.atleta} tipo={`S${s.semana?.numero ?? '?'}`} cuando={fmtConDia(s.fecha_realizada)} abrirAtleta={abrirAtleta} pestana="registro" />
      <strong>{s.nombre}</strong>
      <div class="fila-envolver">
        <span class="chip num">{s.series.hechas}/{s.series.pautadas} series</span>
        {s.rpe_sesion && <span class={`chip num ${s.rpe_sesion >= 9 ? 'aviso' : ''}`}>Esfuerzo {num(s.rpe_sesion)}/10</span>}
        {cardioHechoValido(s.cardio_hecho) ? <span class="chip num">{NOMBRE_MODALIDAD[s.cardio_hecho.modalidad]}: {textoCardioHecho(s.cardio_hecho)}</span> : s.duracion_min && <span class="chip num">{s.duracion_min} min</span>}
        {s.rpeMax >= 10 && <span class="chip aviso">Alguna serie a RPE 10</span>}
        {s.cortas > 0 && <span class="chip aviso">{s.cortas} por debajo del rango</span>}
      </div>
      {s.preparacion && <ChipLlegada preparacion={s.preparacion} soloAvisos />}
      {s.nota_atleta && <p class="cita">«{s.nota_atleta}»</p>}
      {abierto && <Hilo atletaId={s.atleta.id} sesionId={s.id} nombreAtleta={s.atleta.nombre} alCambiar={recargar} />}
      <Acciones abierto={abierto} setAbierto={setAbierto} revisar={revisar} />
    </article>
  );
}

function TarjetaCheckin({ c, recargar, abrirAtleta }) {
  const { api, aviso } = useApp();
  const [abierto, setAbierto] = useState(false);
  const revisar = async () => { try { await api.marcarRevisado('checkin', c.id); aviso('Check-in revisado', 'ok', deshacer(api, 'checkin', c.id, recargar)); recargar(); } catch (e) { aviso(e.message, 'error'); } };
  const adh = [c.adherencia_desayuno, c.adherencia_comida, c.adherencia_merienda, c.adherencia_cena].filter(Boolean);
  const mediaAdh = adh.length ? Math.round(adh.reduce((a, b) => a + b, 0) / adh.length) : null;
  return (
    <article tabIndex={-1} class="panel panel-pad pila-s tarjeta-revisar">
      <Cabecera atleta={c.atleta} tipo="Check-in" cuando={rangoSemana(c.semana_inicio)} abrirAtleta={abrirAtleta} pestana="seguimiento" />
      <div class="fila-envolver">
        {c.horas_sueno && <span class="chip">Sueño {c.horas_sueno.replace('-', '–')} h</span>}
        {c.energia && <span class={`chip ${c.energia <= 2 ? 'aviso' : ''}`}>Energía {c.energia}/5</span>}
        {c.recuperacion && <span class={`chip ${c.recuperacion <= 2 ? 'aviso' : ''}`}>Recuperación {c.recuperacion}/5</span>}
        {c.motivacion && <span class={`chip ${c.motivacion <= 2 ? 'aviso' : ''}`}>{ESCALAS.motivacion[c.motivacion - 1]}</span>}
        {mediaAdh && <span class="chip">Dieta {ESCALAS.adherencia[mediaAdh - 1]}</span>}
        {c.molestias.map((m) => <span key={m.id} class={`chip ${m.intensidad >= 2 ? (m.intensidad >= 3 ? 'alerta' : 'aviso') : ''}`}>{NOMBRE_ZONA[m.zona]}: {ESCALAS.molestia[m.intensidad].toLowerCase()}</span>)}
        {(c.respuestasLeidas || []).filter((r) => r.pregunta.tipo !== 'texto').map((r) => <span key={r.pregunta.id} class="chip chip-respuesta">{r.pregunta.texto}: {r.texto}</span>)}
      </div>
      {(c.respuestasLeidas || []).filter((r) => r.pregunta.tipo === 'texto').map((r) => <p key={r.pregunta.id} class="peq"><span class="secundario">{r.pregunta.texto}</span> «{r.texto}»</p>)}
      {c.notas && <p class="cita">«{c.notas}»</p>}
      {abierto && <Hilo atletaId={c.atleta.id} checkinId={c.id} nombreAtleta={c.atleta.nombre} alCambiar={recargar} />}
      <Acciones abierto={abierto} setAbierto={setAbierto} revisar={revisar} />
    </article>
  );
}

function TarjetaVideo({ a, recargar, abrirAtleta }) {
  const { api, aviso } = useApp();
  const [abierto, setAbierto] = useState(false);
  const revisar = async () => { try { await api.marcarRevisado('archivo', a.id); aviso('Vídeo revisado', 'ok', deshacer(api, 'archivo', a.id, recargar)); recargar(); } catch (e) { aviso(e.message, 'error'); } };
  return (
    <article tabIndex={-1} class="panel panel-pad pila-s tarjeta-revisar">
      <Cabecera atleta={a.atleta} tipo={a.tipo === 'foto_progreso' ? 'Foto de progreso' : 'Vídeo de técnica'} cuando={fmtConDia(a.fecha)} abrirAtleta={abrirAtleta} pestana="videos" />
      {!abierto ? (
        <div class="revisar-video">
          <MiniaturaRevisar a={a} alAbrir={() => setAbierto(true)} />
          {a.nota_atleta ? <p class="cita">«{a.nota_atleta}»</p> : <p class="peq terciario">Sin nota.</p>}
        </div>
      ) : a.nota_atleta && <p class="cita">«{a.nota_atleta}»</p>}
      {abierto && <><VerArchivo archivo={a} /><Hilo atletaId={a.atleta.id} archivoId={a.id} nombreAtleta={a.atleta.nombre} alCambiar={recargar} placeholder="Qué corregir, qué está bien…" /></>}
      <Acciones abierto={abierto} setAbierto={setAbierto} revisar={revisar} etiquetaComentar="Ver y comentar" />
    </article>
  );
}

// v0.50: la miniatura del vídeo (la que guardó el móvil al subirlo) o, si no hay, un hueco neutro; con su duración.
// No descarga el vídeo: eso, al abrirlo. Las fotos de progreso se ven tal cual.
function MiniaturaRevisar({ a, alAbrir }) {
  const { api } = useApp();
  const esFoto = a.tipo === 'foto_progreso';
  // Las fotos de progreso (el cuerpo) no se cargan solas en una pantalla que puede ver otro: hueco hasta que la abres
  const ruta = esFoto ? null : a.poster_ruta;
  const [url, setUrl] = useState(null);
  const [fallo, setFallo] = useState(false);
  useEffect(() => {
    let vivo = true;
    setUrl(null); setFallo(false);
    if (ruta) api.urlArchivo(ruta).then((u) => vivo && setUrl(u)).catch(() => vivo && setFallo(true));
    return () => { vivo = false; };
  }, [ruta]);
  const nombre = a.atleta?.nombre?.split(' ')[0] || 'tu atleta';
  return (
    <button type="button" class={`revisar-mini ${esFoto ? 'foto' : ''}`} onClick={alAbrir}
      aria-label={esFoto ? `Ver la foto de ${nombre}` : `Reproducir el vídeo de ${nombre}${a.duracion_seg ? ` (${duracionCorta(a.duracion_seg)})` : ''}`}>
      {url && !fallo ? <img src={url} alt="" loading="lazy" onError={() => setFallo(true)} /> : <span class="revisar-mini-hueco" aria-hidden="true"><Icono n={esFoto ? 'imagen' : 'video'} /></span>}
      {!esFoto && <span class="revisar-mini-play" aria-hidden="true"><Icono n="play" /></span>}
      {!esFoto && a.duracion_seg ? <span class="revisar-mini-dur num" aria-hidden="true">{duracionCorta(a.duracion_seg)}</span> : null}
    </button>
  );
}

// Una receta que el atleta pide cambiar (v0.26): se ajusta en su ficha (Nutrición → Recetario) o se da por resuelta
function TarjetaCambioReceta({ r, recargar, abrirAtleta }) {
  const { api, aviso } = useApp();
  const resolver = async () => { try { await api.resolverCambioReceta(r.id); aviso('Petición resuelta'); recargar(); } catch (e) { aviso(e.message, 'error'); } };
  return (
    <article tabIndex={-1} class="panel panel-pad pila-s tarjeta-revisar">
      <Cabecera atleta={r.atleta} tipo={`Pide cambiar una receta (${NOMBRE_TOMA[r.toma]?.toLowerCase() || r.toma})`} cuando={cuando(r.cambio_pedido_en)} abrirAtleta={abrirAtleta} pestana="nutricion" />
      <p class="peq"><strong>{r.receta.nombre}</strong></p>
      {r.cambio_nota && <p class="cita">«{r.cambio_nota}»</p>}
      <div class="fila-envolver">
        <button class="btn btn-peq" onClick={() => abrirAtleta(r.atleta.id, 'nutricion')}><Icono n="receta" /> Ir a su recetario</button>
        <button class="btn btn-peq revisar-hecho" onClick={resolver}><Icono n="hecho" /> Resuelto</button>
      </div>
    </article>
  );
}

// «Avisar al coach» en la comunidad (v0.43): lo avisado, quién lo escribió y quién avisa. Ocultarlo (o borrarlo) lo
// quita del muro; «Resuelto», si está bien así. Si su autor lo ha borrado, sale la copia que guardó la base.
function TarjetaReporte({ r, recargar }) {
  const { api, aviso } = useApp();
  const [ocupado, setOcupado] = useState(false);
  const oculto = r.borrado ? false : r.de_comentario ? r.comentario.oculto : r.post.oculta;
  const hacer = async (fn, t) => {
    if (ocupado) return;
    setOcupado(true);
    try { await fn(); aviso(t); recargar(); } catch (e) { aviso(e.message, 'error'); } finally { setOcupado(false); }
  };
  const ocultar = () => hacer(async () => {
    if (r.de_comentario) await api.ocultarComentarioComunidad(r.comentario.id, true); else await api.ocultarEnComunidad(r.post.id, true);
    await api.resolverReporte(r);
  }, r.de_comentario ? 'Comentario oculto' : 'Publicación oculta');
  const borrar = () => hacer(async () => {
    if (r.de_comentario) await api.borrarComentarioComunidad(r.comentario.id); else await api.borrarDeComunidad(r.post);
    await api.resolverReporte({ ...r, post_id: r.de_comentario ? r.post_id : null });
  }, 'Borrado del muro');
  return (
    <article tabIndex={-1} class="panel panel-pad pila-s tarjeta-revisar tarjeta-reporte">
      <div class="revisar-cab">
        <span class="ico-reporte" aria-hidden="true"><Icono n="bandera" /></span>
        <span class="pila-xs"><strong>{r.de_comentario ? 'Un comentario en el equipo' : 'Una publicación en el equipo'}</strong><span class="mini terciario">De {r.autor} · avisa {r.quienAvisa} · {cuando(r.creado_en)}</span></span>
      </div>
      {r.borrado && <p class="mini terciario"><strong>Borrado por su autor</strong> después del aviso: esto es lo que había.</p>}
      {r.texto && <p class="cita">«{r.texto.length > 300 ? `${r.texto.slice(0, 300)}…` : r.texto}»</p>}
      {r.foto && <FotoAvisada ruta={r.foto} />}
      {r.motivo && <p class="peq"><strong>Por qué:</strong> {r.motivo}</p>}
      {oculto && <p class="mini terciario">Ya está oculto.</p>}
      <div class="fila-envolver">
        {!r.borrado && !oculto && <button class="btn btn-peq" disabled={ocupado} onClick={ocultar}><Icono n="ojo" /> Ocultar</button>}
        {!r.borrado && <button class="btn btn-peq btn-peligro" disabled={ocupado} onClick={borrar}><Icono n="basura" /> Borrar</button>}
        <button class="btn btn-peq revisar-hecho" disabled={ocupado} onClick={() => hacer(() => api.resolverReporte(r), 'Aviso resuelto')}><Icono n="hecho" /> Resuelto</button>
      </div>
    </article>
  );
}

// La foto de lo avisado (el coach la puede ver mientras el aviso esté abierto, aunque su autor la haya borrado)
function FotoAvisada({ ruta }) {
  const { api } = useApp();
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let vivo = true;
    api.urlFotoComunidad(ruta).then((u) => vivo && setUrl(u)).catch(() => vivo && setError(true));
    return () => { vivo = false; };
  }, [ruta]);
  if (error) return <p class="mini terciario">La foto ya no está disponible.</p>;
  return url ? <img class="post-foto" src={url} alt="La foto de lo avisado" loading="lazy" /> : null;
}

// Bandeja vacía (v0.50): «Todo al día», con la barra en su soporte en línea y el lobo
function BandejaVacia() {
  return (
    <div class="panel bandeja-vacia">
      <Vacio ilustracion="todo" titulo="Todo al día">Tus atletas tienen respuesta: aquí saldrá lo nuevo de sus sesiones, check-ins, mensajes y vídeos.</Vacio>
    </div>
  );
}
