// Limpiar vídeos antiguos y el aviso del almacenamiento (v0.57, migración 035; solo el coach). Primero se ve qué se
// borraría (cuántos, cuánto ocupan y cuáles), y se confirma en la app. Nunca los destacados, ni los que aún no ha revisado,
// ni los que tienen una conversación o una corrección de los últimos días, ni los de una tarea por revisar. Sus archivos
// van a la cola de Storage, que la app del coach vacía al momento (y, si falla, la siguiente vez). La base borra como
// mucho 300 de una vez (los más antiguos): si hay más, se dice y se confirma justo eso, y después se ven los que quedan.
import { useState } from 'preact/hooks';
import { useApp, useCarga, Icono, Hoja } from '../comunes.jsx';
import { avisoAlmacenamiento, MESES_LIMPIEZA } from '../../logica/tecnica.js';
import { AVISO_035 } from '../../datos/api.js';
import { fmtCorta } from '../../logica/fechas.js';
import { num } from '../../logica/calculos.js';

const GB = 1024 ** 3;
export const fmtTam = (b) => (b >= GB ? `${num(b / GB, 2)} GB` : b >= 1048576 ? `${num(b / 1048576, 0)} MB` : `${num(b / 1024, 0)} KB`);
export const leerPlanGb = () => { try { return Number(localStorage.getItem('fbe-plan-gb')) || 1; } catch { return 1; } };

// El aviso (en el panel y en Cuenta): a partir del 80 % del plan
export function AvisoAlmacenamiento({ bytes, planGb = leerPlanGb(), alLimpiar = null }) {
  const a = avisoAlmacenamiento(bytes, planGb);
  if (a.nivel === 'ok') return null;
  return (
    <div class={`panel panel-pad aviso-almacen ${a.nivel}`} role="status">
      <Icono n="alerta" />
      <span class="peq">{a.texto}</span>
      {alLimpiar && <button type="button" class="btn btn-peq" onClick={alLimpiar}>Limpiar vídeos antiguos</button>}
    </div>
  );
}
// El aviso del panel del coach: lo que ocupa todo (una consulta pequeña: bytes de cada archivo)
export function AvisoAlmacenamientoPanel({ abrirCuenta }) {
  const { api } = useApp();
  const esp = useCarga(() => api.bytesUsados().catch(() => null), []);
  if (esp.datos == null) return null;
  return <AvisoAlmacenamiento bytes={esp.datos} alLimpiar={abrirCuenta} />;
}

export function LimpiarVideos({ alCerrar, alTerminar }) {
  const { api, aviso } = useApp();
  const con035 = useCarga(() => api.video035().catch(() => false), []);
  const [meses, setMeses] = useState(6);
  const [dias, setDias] = useState(30);
  const [vista, setVista] = useState(null);
  const [confirmar, setConfirmar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  // Lo que se borra al confirmar: los que enseña la lista (la base, como mucho 300, los más antiguos)
  const lote = vista ? (vista.lote || { n: vista.lista.length, bytes: vista.bytes }) : { n: 0, bytes: 0 };
  const parcial = !!vista && vista.n > lote.n;
  const ver = async () => {
    setOcupado(true); setConfirmar(false);
    try { setVista(await api.limpiezaVideos({ meses, dias })); } catch (e) { aviso(e.message, 'error'); } finally { setOcupado(false); }
  };
  const borrar = async () => {
    setOcupado(true);
    try {
      const r = await api.borrarVideosViejos({ meses, dias, ids: vista.lista.map((x) => x.id) });
      const quedan = Math.max(0, vista.n - vista.lista.length);
      aviso(r.n ? `${r.n === 1 ? '1 vídeo borrado' : `${r.n} vídeos borrados`} (${fmtTam(r.bytes)})${quedan ? `: quedan ${quedan}` : ''}` : 'No se ha borrado nada: ya no cumplían las condiciones');
      setVista(null); setConfirmar(false); alTerminar?.();
      // Si quedaban más (de 300 en 300), se ven los siguientes para decidir otra vez
      if (quedan) setVista(await api.limpiezaVideos({ meses, dias }).catch(() => null));
    } catch (e) { aviso(e.message, 'error'); } finally { setOcupado(false); }
  };
  return (
    <Hoja titulo="Limpiar vídeos antiguos" alCerrar={alCerrar}>
      {con035.datos === false ? <p class="peq secundario">{AVISO_035}.</p> : (
        <>
          <div class="campo">
            <label for="limpiar-meses">Vídeos de técnica de hace más de</label>
            <select id="limpiar-meses" class="selector" value={meses} onChange={(e) => { setMeses(Number(e.currentTarget.value)); setVista(null); }}>
              {MESES_LIMPIEZA.map((m) => <option key={m} value={m}>{m} meses</option>)}
            </select>
          </div>
          <div class="campo">
            <label for="limpiar-dias">Que no tengan conversación ni corrección de los últimos</label>
            <select id="limpiar-dias" class="selector" value={dias} onChange={(e) => { setDias(Number(e.currentTarget.value)); setVista(null); }}>
              {[7, 30, 90].map((d) => <option key={d} value={d}>{d} días</option>)}
            </select>
            <span class="ayuda">Nunca se borran los destacados, los que aún no has revisado, los de una tarea por revisar ni los que se están repitiendo ahora.</span>
          </div>
          <button type="button" class="btn" disabled={ocupado} onClick={ver}><Icono n="buscar" /> Ver qué se borraría</button>
          {vista && (
            <div class="pila-s" role="status">
              <p><strong class="num">{vista.n}</strong> {vista.n === 1 ? 'vídeo' : 'vídeos'}, <strong class="num">{fmtTam(vista.bytes)}</strong>.</p>
              {vista.lista.length > 0 && (
                <ul class="lista limpiar-lista">
                  {vista.lista.slice(0, 40).map((x) => <li key={x.id} class="peq separa"><span>{x.atleta?.nombre || 'Atleta'}, {fmtCorta(x.fecha)}</span><span class="num terciario">{fmtTam(Number(x.bytes) || 0)}</span></li>)}
                  {vista.lista.length > 40 && <li class="mini terciario">Y {vista.lista.length - 40} más.</li>}
                </ul>
              )}
              {parcial && <p class="peq secundario">Se borran de {lote.n} en {lote.n}: ahora, los {lote.n} más antiguos ({fmtTam(lote.bytes)}). Después verás los que quedan.</p>}
              {vista.n > 0 && lote.n > 0 && (!confirmar
                ? <button type="button" class="btn btn-peligro" onClick={() => setConfirmar(true)}><Icono n="basura" /> {parcial ? `Borrar los ${lote.n} más antiguos de ${vista.n}` : `Borrar ${lote.n === 1 ? 'este vídeo' : `estos ${lote.n} vídeos`}`}</button>
                : (
                  <div class="panel-pad nota pila-s">
                    <p class="peq"><strong>¿Seguro?</strong> Se borran {lote.n === 1 ? 'el vídeo' : `los ${lote.n} vídeos`}{parcial ? ` más antiguos (de ${vista.n})` : ''}, con su miniatura y su corrección (los mensajes sobre ellos se quedan en el chat). No se puede deshacer.</p>
                    <div class="fila-envolver">
                      <button type="button" class="btn btn-peligro" disabled={ocupado} onClick={borrar}>Sí, borrar {fmtTam(lote.bytes)}</button>
                      <button type="button" class="btn" onClick={() => setConfirmar(false)}>No</button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </>
      )}
    </Hoja>
  );
}
