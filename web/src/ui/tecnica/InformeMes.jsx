// v0.61 (17): el «Informe del mes» de técnica. El coach lo ve por atleta y se lo manda (un mensaje del chat que la app enseña
// como una tarjeta con «Ver el informe»: un aviso, sin el texto); el atleta ve los suyos en «Mi técnica» y en esa tarjeta.
// Se calcula al abrirlo con lo que ya hay (logica/informeTecnica.js): no se guarda en ningún sitio. «Guardar como imagen» lo
// pinta en un lienzo del propio móvil (sin subir nada) y lo comparte o lo descarga. Sin datos de salud (ni molestias ni
// cómo lo ha notado).
import { useState } from 'preact/hooks';
import { useApp, useCarga, Icono, Hoja, Cargando } from '../comunes.jsx';
import { FUENTE } from '../Compartir.jsx';
import { LOBO } from '../marca-lobo.js';
import { guardarEnMovil } from './compositor.js';
import { fmtCorta } from '../../logica/fechas.js';
import { textoMes, textoDias, textoCambioNota, mesesConVideos } from '../../logica/informeTecnica.js';
import { NOMBRE_PUNTUACION } from '../../logica/tecnica.js';
import { textoKg } from '../../logica/cargaVelocidad.js';

// La lista de meses (en «Mi técnica»): los que tienen vídeos, el más reciente primero
export function InformesMes({ videos = [], atletaId, nombreAtleta, esCoach = false }) {
  const meses = mesesConVideos(videos).slice(0, 12);
  const [abierto, setAbierto] = useState(null);
  if (!meses.length) return null;
  return (
    <div class="informes-mes pila-xs">
      <span class="etq">Informe del mes</span>
      <div class="selector-chips" role="group" aria-label="Informe del mes">
        {meses.map((m) => <button key={m} type="button" onClick={() => setAbierto(m)} aria-haspopup="dialog">{textoMes(m)}</button>)}
      </div>
      {abierto && <HojaInforme atletaId={atletaId} mes={abierto} nombreAtleta={nombreAtleta} esCoach={esCoach} alCerrar={() => setAbierto(null)} />}
    </div>
  );
}

export function HojaInforme({ atletaId, mes, nombreAtleta = '', esCoach = false, alCerrar }) {
  const { api, aviso } = useApp();
  const datos = useCarga(() => api.informeTecnica(atletaId, mes), [atletaId, mes]);
  const enviado = useCarga(() => (esCoach ? api.informeEnviado(atletaId, mes).catch(() => false) : Promise.resolve(false)), [atletaId, mes, esCoach]);
  const [ocupado, setOcupado] = useState(false);
  const inf = datos.datos?.informe || null;
  const primero = String(nombreAtleta || '').split(' ')[0] || 'tu atleta';
  const enviar = async () => {
    setOcupado(true);
    try { await api.enviarInformeTecnica(atletaId, mes); aviso(`Informe enviado a ${primero}: lo tiene en el chat`); await enviado.recargar(true); }
    catch (e) { aviso(e.message, 'error'); } finally { setOcupado(false); }
  };
  const imagen = async () => {
    setOcupado(true);
    try {
      const blob = await dibujarInforme(inf);
      const como = await guardarEnMovil(new File([blob], `informe-tecnica-${mes}.png`, { type: 'image/png' }), `informe-tecnica-${mes}.png`);
      if (como === 'descargado') aviso(`Descargado: informe-tecnica-${mes}.png`);
    } catch (e) { aviso(e.message || 'No se ha podido preparar la imagen', 'error'); } finally { setOcupado(false); }
  };
  return (
    <Hoja titulo={`Informe de técnica · ${textoMes(mes)}`} alCerrar={alCerrar} ancho={640}>
      {datos.cargando && !datos.datos ? <Cargando texto="Preparando el informe" /> : datos.error ? <p class="error" role="alert">{datos.error.message || 'No se ha podido preparar'}</p> : inf && (
        <div class="informe-tecnica pila-s">
          <VistaInforme inf={inf} />
          <div class="fila-envolver">
            <button type="button" class="btn" disabled={ocupado} onClick={imagen}><Icono n="descargar" /> Guardar como imagen</button>
            {esCoach && (enviado.datos
              ? <span class="chip morado" role="status"><Icono n="hecho" /> Ya se lo has mandado</span>
              : <button type="button" class="btn btn-primario" disabled={ocupado || inf.vacio} onClick={enviar}><Icono n="enviar" /> Mandárselo a {primero}</button>)}
          </div>
          <p class="mini terciario">{esCoach ? `Le llega como una tarjeta en el chat, con un aviso sin el texto; lo abre en la app y lo ve como tú. ` : ''}Se calcula en el móvil con vuestros vídeos y sus correcciones: no se guarda aparte. La imagen se hace en este {esCoach ? 'dispositivo' : 'móvil'} y no se sube a ningún sitio.</p>
        </div>
      )}
    </Hoja>
  );
}

function VistaInforme({ inf }) {
  return (
    <>
      <dl class="informe-cifras">
        <div><dt>Vídeos enviados</dt><dd class="num">{inf.enviados}</dd></div>
        <div><dt>Revisados</dt><dd class="num">{inf.revisados}</dd></div>
        <div><dt>Se revisan en</dt><dd class="num">{textoDias(inf.medianaDias)}</dd></div>
        <div><dt>Recordatorios activos</dt><dd class="num">{inf.recordatorios}</dd></div>
      </dl>
      {inf.vacio && <p class="peq secundario">Este mes no hay vídeos de técnica.</p>}
      {inf.ejercicios.some((e) => e.notas.length) && (
        <section class="pila-xs" aria-labelledby="inf-notas">
          <h3 class="etq" id="inf-notas">La nota de técnica, por ejercicio</h3>
          <ul class="lista informe-lista">
            {inf.ejercicios.filter((e) => e.notas.length).map((e) => (
              <li key={e.id} class="separa">
                <span class="peq"><b>{e.nombre}</b> <span class="mini terciario">({e.videos === 1 ? '1 vídeo' : `${e.videos} vídeos`})</span></span>
                <span class="num peq informe-notas" aria-label={`Notas: ${e.notas.map((x) => x.nota).join(', ')}${e.cambio != null ? `; cambio ${textoCambioNota(e.cambio)}` : ''}`}>
                  {e.notas.map((x) => x.nota).join(' → ')}/5{e.cambio != null && <span class={`chip num ${e.cambio > 0 ? 'ok' : e.cambio < 0 ? 'aviso' : ''}`}>{textoCambioNota(e.cambio)}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {inf.aCorregir.length > 0 && (
        <section class="pila-xs" aria-labelledby="inf-mal">
          <h3 class="etq" id="inf-mal">Lo que más sale «a corregir»</h3>
          <ol class="informe-lista-num peq">{inf.aCorregir.map((x) => <li key={x.texto}>{x.texto} <span class="mini terciario num">({x.n === 1 ? '1 vez' : `${x.n} veces`})</span></li>)}</ol>
        </section>
      )}
      {inf.mejor && (
        <p class="peq informe-mejor"><Icono n="libre" /> <b>El mejor vídeo del mes:</b> {inf.mejor.ejercicio}, {fmtCorta(inf.mejor.fecha)}{inf.mejor.porque === 'destacado' ? ' (destacado)' : inf.mejor.nota != null ? ` (${inf.mejor.nota}/5, ${NOMBRE_PUNTUACION[inf.mejor.nota].toLowerCase()})` : ''}</p>
      )}
      {inf.e1rm.length > 0 && (
        <section class="pila-xs" aria-labelledby="inf-e1rm">
          <h3 class="etq" id="inf-e1rm">1RM estimado por la velocidad <span class="chip aviso experimental">Experimental</span></h3>
          <ul class="lista informe-lista">
            {inf.e1rm.map((x) => (
              <li key={x.id} class="separa"><span class="peq"><b>{x.nombre}</b></span>
                <span class="num peq">{x.antes != null ? `${textoKg(x.antes)} → ` : ''}{textoKg(x.ahora)}{x.cambio != null ? ` (${x.cambio > 0 ? '+' : x.cambio < 0 ? '−' : '±'}${textoKg(Math.abs(x.cambio))})` : ''}</span></li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

// ---------------------------------------------------------------- la imagen (1080 × 1350, en el propio móvil)
const C = { fondo: '#151423', tinta: '#EEECFF', tinta2: '#AAA9B5', morado: '#A49CFF', linea: '#2A283D', verde: '#48C77C', ambar: '#EBC166' };
export async function dibujarInforme(inf) {
  if (!inf) throw new Error('No hay informe');
  try { await Promise.all([document.fonts.load(`800 80px ${FUENTE}`), document.fonts.load(`500 30px ${FUENTE}`)]); } catch { /* la del sistema */ }
  const W = 1080, H = 1350, M = 80;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const x = cv.getContext('2d');
  const letra = (p, t) => { x.font = `${p} ${t}px ${FUENTE}`; };
  const cortar = (t, ancho) => { let s = String(t); if (x.measureText(s).width <= ancho) return s; while (s.length > 1 && x.measureText(`${s}…`).width > ancho) s = s.slice(0, -1); return `${s.trimEnd()}…`; };
  x.fillStyle = C.fondo; x.fillRect(0, 0, W, H);
  const lobo = await new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => ok(null); im.src = LOBO; });
  if (lobo) x.drawImage(lobo, M, M, 56, 56);
  letra(800, 34); x.fillStyle = C.tinta; x.fillText('FBE Equipo', M + 74, M + 40);
  letra(500, 30); x.fillStyle = C.tinta2; x.textAlign = 'right'; x.fillText(textoMes(inf.mes), W - M, M + 40); x.textAlign = 'left';
  let y = 260;
  letra(800, 84); x.fillStyle = C.tinta; x.fillText('Informe de técnica', M, y);
  y += 120;
  const cifras = [[String(inf.enviados), 'vídeos'], [String(inf.revisados), 'revisados'], [inf.medianaDias == null ? '—' : inf.medianaDias === 0 ? '0' : String(Math.round(inf.medianaDias * 10) / 10).replace('.', ','), inf.medianaDias === 1 ? 'día en revisarse' : 'días en revisarse']];
  cifras.forEach(([v, k], i) => { const cx = M + i * ((W - 2 * M) / 3); letra(800, 92); x.fillStyle = C.tinta; x.fillText(v, cx, y); letra(500, 28); x.fillStyle = C.tinta2; x.fillText(k, cx + 2, y + 42); });
  y += 90; x.fillStyle = C.linea; x.fillRect(M, y, W - 2 * M, 2); y += 70;
  const titulo = (t) => { letra(700, 32); x.fillStyle = C.morado; x.fillText(t, M, y); y += 54; };
  const fila = (a, b, color = C.tinta) => { letra(650, 36); x.fillStyle = color; x.fillText(cortar(a, W - 2 * M - 260), M, y); if (b) { letra(700, 36); x.fillStyle = C.tinta; x.textAlign = 'right'; x.fillText(b, W - M, y); x.textAlign = 'left'; } y += 54; };
  const conNotas = inf.ejercicios.filter((e) => e.notas.length).slice(0, 4);
  if (conNotas.length) { titulo('Nota de técnica'); for (const e of conNotas) fila(e.nombre, `${e.notas.map((n) => n.nota).join(' → ')}/5`); y += 16; }
  if (inf.aCorregir.length && y < H - 340) { titulo('A corregir'); for (const a of inf.aCorregir.slice(0, 3)) fila(`· ${a.texto}`, `${a.n}×`, C.tinta2); y += 16; }
  if (inf.e1rm.length && y < H - 260) { titulo('1RM por la velocidad (experimental)'); for (const e of inf.e1rm.slice(0, 2)) fila(e.nombre, `${e.antes != null ? `${Math.round(e.antes)} → ` : ''}${Math.round(e.ahora)} kg`); y += 16; }
  if (inf.mejor && y < H - 180) { titulo('El mejor vídeo'); fila(`${inf.mejor.ejercicio}, ${fmtCorta(inf.mejor.fecha)}`, inf.mejor.nota != null ? `${inf.mejor.nota}/5` : '★'); }
  letra(500, 26); x.fillStyle = C.tinta2; x.fillText('Hecho en el móvil con FBE Equipo', M, H - M);
  return new Promise((ok, mal) => cv.toBlob((b) => (b ? ok(b) : mal(new Error('No se ha podido crear la imagen'))), 'image/png'));
}
