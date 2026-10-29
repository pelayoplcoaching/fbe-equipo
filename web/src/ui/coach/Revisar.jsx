import { useEffect, useRef, useState } from 'preact/hooks';
import { ChipLlegada } from '../atleta/Preparacion.jsx';
import { Siluetas, useApp, useCarga, Icono, ErrorCaja, cuando, Avatar, Hoja, usePreferencia } from '../comunes.jsx';
import { cardioHechoValido, textoCardioHecho, NOMBRE_MODALIDAD } from '../../logica/cardio.js';
import { BandaDemo } from '../App.jsx';
import { Hilo } from '../Hilo.jsx';
import { VerArchivo } from '../Archivos.jsx';
import { ESCALAS, NOMBRE_ZONA, num } from '../../logica/calculos.js';
import { fmtConDia, rangoSemana } from '../../logica/fechas.js';
import { NOMBRE_TOMA } from '../../logica/comidas.js';

// «Deshacer» en el aviso: vuelve a dejarlo pendiente
const deshacer = (api, tipo, id, recargar) => ({ texto: 'Deshacer', fn: async () => { await api.marcarRevisado(tipo, id, false); recargar(); } });

// Atajos de teclado (como en Superhuman o Linear): j/k moverse, r responder, e revisado, o abrir la ficha
function useAtajos(caja, n) {
  const [i, setI] = useState(-1);
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
      else if (k >= 0 && t[k]) {
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

const FILTROS = [['todo', 'Todo'], ['mensajes', 'Mensajes'], ['sesiones', 'Sesiones'], ['checkins', 'Check-ins'], ['videos', 'Vídeos'], ['recetas', 'Recetas']];

// Bandeja del coach: todo lo que espera tu respuesta, de todos los atletas, en un sitio
export function Revisar({ bandeja, abrirAtleta }) {
  const [filtro, setFiltro] = useState('todo');
  const d = bandeja.datos;
  const caja = useRef(null);
  useAtajos(caja, d?.total || 0);
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
  const cuentas = { mensajes: hilos.length, sesiones: d?.sesiones.length || 0, checkins: d?.checkins.length || 0, videos: d?.archivos.length || 0, recetas: d?.recetas?.length || 0 };
  const ver = (k) => filtro === 'todo' || filtro === k;

  return (
    <div class="contenido coach">
      <header class="cabecera">
        <div class="titulo"><h1>Revisar</h1><div class="sub">{d?.total ? (d.total === 1 ? '1 cosa espera tu respuesta' : `${d.total} cosas esperan tu respuesta`) : 'Al día'}</div></div>
      </header>
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
          {ver('mensajes') && hilos.map((h) => <TarjetaMensaje key={h.clave} h={h} recargar={recargar} abrirAtleta={abrirAtleta} />)}
          {ver('sesiones') && d.sesiones.map((s) => <TarjetaSesion key={s.id} s={s} recargar={recargar} abrirAtleta={abrirAtleta} />)}
          {ver('checkins') && d.checkins.map((c) => <TarjetaCheckin key={c.id} c={c} recargar={recargar} abrirAtleta={abrirAtleta} />)}
          {ver('videos') && d.archivos.map((a) => <TarjetaVideo key={a.id} a={a} recargar={recargar} abrirAtleta={abrirAtleta} />)}
          {ver('recetas') && (d.recetas || []).map((r) => <TarjetaCambioReceta key={r.id} r={r} recargar={recargar} abrirAtleta={abrirAtleta} />)}
        </div>
      )}
      <p class="mini terciario">Comentar algo lo da por revisado. Las sesiones y los check-ins de más de 4 semanas salen de la bandeja solos.</p>
      {d?.total > 0 && <p class="mini terciario solo-ancho atajos">Con el teclado: <kbd>j</kbd> <kbd>k</kbd> para moverte, <kbd>r</kbd> responder, <kbd>e</kbd> revisado, <kbd>o</kbd> abrir su ficha.</p>}
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
      {revisar && <button class="btn btn-peq revisar-hecho" onClick={revisar}><Icono n="hecho" /> Revisado</button>}
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
      {a.nota_atleta && <p class="cita">«{a.nota_atleta}»</p>}
      {abierto && <><VerArchivo archivo={a} /><Hilo atletaId={a.atleta.id} archivoId={a.id} nombreAtleta={a.atleta.nombre} alCambiar={recargar} placeholder="Qué corregir, qué está bien…" /></>}
      <Acciones abierto={abierto} setAbierto={setAbierto} revisar={revisar} etiquetaComentar="Ver y comentar" />
    </article>
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

// Bandeja vacía: la barra en su sitio, en el soporte
function BandejaVacia() {
  return (
    <div class="panel bandeja-vacia">
      <svg viewBox="0 0 240 120" aria-hidden="true">
        <rect x="34" y="20" width="8" height="92" rx="3" class="bv-soporte" />
        <rect x="198" y="20" width="8" height="92" rx="3" class="bv-soporte" />
        <rect x="26" y="108" width="24" height="6" rx="3" class="bv-soporte" />
        <rect x="190" y="108" width="24" height="6" rx="3" class="bv-soporte" />
        <rect x="8" y="44" width="224" height="6" rx="3" class="bv-barra" />
        <rect x="52" y="22" width="12" height="50" rx="4" class="bv-rojo" /><rect x="66" y="27" width="10" height="40" rx="4" class="bv-azul" /><rect x="78" y="32" width="8" height="30" rx="3" class="bv-amarillo" />
        <rect x="176" y="22" width="12" height="50" rx="4" class="bv-rojo" /><rect x="164" y="27" width="10" height="40" rx="4" class="bv-azul" /><rect x="154" y="32" width="8" height="30" rx="3" class="bv-amarillo" />
      </svg>
      <h2>Todo revisado</h2>
      <p class="secundario">Tus atletas tienen respuesta. Aquí aparecerán sus sesiones, check-ins, mensajes y vídeos hasta que los revises o les contestes.</p>
    </div>
  );
}
