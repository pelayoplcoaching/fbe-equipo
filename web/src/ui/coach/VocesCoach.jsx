// Tus frases, con tu voz (sonido, tanda 3; migración 068): el coach graba unas frases cortas y suenan en la sesión de sus
// atletas en su momento (al acabar el descanso, en la última serie, al batir un récord y al terminar), en lugar de la voz
// del móvil. Se graba aquí mismo (MediaRecorder, solo audio, 6 s como mucho), se escucha antes de guardarla y se puede
// cambiar o quitar cuando quiera.
import { useEffect, useRef, useState } from 'preact/hooks';
import { useApp, useCarga, Icono } from '../comunes.jsx';
import { FRASES_VOZ, MAX_VOZ_MS, olvidarVocesCoach } from '../voces-coach.js';
import { contexto } from '../sonido.js';

const TIPOS = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/ogg'];
const puedeGrabarVoz = () => typeof globalThis.MediaRecorder === 'function' && !!navigator.mediaDevices?.getUserMedia;

export function VocesCoach() {
  const { api, aviso } = useApp();
  const lista = useCarga(() => api.vocesCoach().catch(() => null), []);
  const [grabando, setGrabando] = useState(null);   // clave que se graba
  const [nueva, setNueva] = useState(null);         // { clave, blob, url, ms } a punto de guardar
  const [ocupado, setOcupado] = useState(false);
  const rec = useRef(null);
  // (revisión) al salir se suelta la grabación pendiente (la de ese momento, no la del principio)
  const nuevaRef = useRef(null);
  nuevaRef.current = nueva;
  useEffect(() => () => { try { rec.current?.stop(); } catch { /* */ } if (nuevaRef.current?.url) URL.revokeObjectURL(nuevaRef.current.url); }, []);
  const guardadas = Object.fromEntries((lista.datos || []).map((f) => [f.clave, f]));

  const grabar = async (clave) => {
    if (rec.current) { try { rec.current.stop(); } catch { /* */ } return; }
    let flujo;
    try { flujo = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch { aviso('Sin permiso para el micrófono: dalo en los ajustes del navegador', 'error'); return; }
    const tipo = TIPOS.find((t) => globalThis.MediaRecorder.isTypeSupported?.(t)) || '';
    const r = new globalThis.MediaRecorder(flujo, tipo ? { mimeType: tipo } : {});
    const partes = [], t0 = Date.now();
    r.ondataavailable = (e) => { if (e.data?.size) partes.push(e.data); };
    r.onstop = () => {
      flujo.getTracks().forEach((t) => t.stop());
      clearTimeout(r.tope); rec.current = null; setGrabando(null);
      const blob = new Blob(partes, { type: (r.mimeType || tipo || 'audio/webm').split(';')[0] });
      if (blob.size < 800) { aviso('No se ha oído nada: prueba otra vez', 'error'); return; }
      setNueva((n) => { if (n?.url) URL.revokeObjectURL(n.url); return { clave, blob, url: URL.createObjectURL(blob), ms: Math.min(MAX_VOZ_MS, Date.now() - t0) }; });
    };
    r.start();
    r.tope = setTimeout(() => { try { r.stop(); } catch { /* */ } }, MAX_VOZ_MS);
    rec.current = r; setGrabando(clave);
  };
  const escuchar = async (url) => { contexto(); try { await new Audio(url).play(); } catch { aviso('No se ha podido reproducir', 'error'); } };
  const escucharGuardada = async (f) => { try { escuchar(await api.urlVozCoach(f.ruta)); } catch (e) { aviso(e.message || 'No se ha podido reproducir', 'error'); } };
  const guardar = async () => {
    setOcupado(true);
    try { await api.guardarVozCoach(nueva.clave, nueva.blob, nueva.ms); URL.revokeObjectURL(nueva.url); setNueva(null); olvidarVocesCoach(); aviso('Guardada: tus atletas la oirán en su próxima sesión'); lista.recargar(true); }
    catch (e) { aviso(e.message || 'No se ha podido guardar', 'error'); }
    setOcupado(false);
  };
  const quitar = async (clave) => {
    setOcupado(true);
    try { await api.quitarVozCoach(clave); olvidarVocesCoach(); aviso('Quitada: vuelve a sonar la voz del móvil'); lista.recargar(true); }
    catch (e) { aviso(e.message || 'No se ha podido quitar', 'error'); }
    setOcupado(false);
  };

  return (
    <section class="seccion voces-coach" aria-labelledby="voces-coach-t">
      <h2 id="voces-coach-t">Tus frases, con tu voz</h2>
      <p class="secundario">Graba frases cortas y tus atletas las oirán en su sesión, en su momento, en lugar de la voz del móvil. Cada una, de 6 segundos como mucho.</p>
      {!lista.cargando && lista.datos === null && <p class="peq terciario">Para grabarlas falta ejecutar la migración 068 en Supabase.</p>}
      <p class="peq terciario">Las cuatro últimas («¡Hola! A por ello», «Mitad de la sesión», «A por el récord» y «Último ejercicio») necesitan además la migración 071.</p>
      {!puedeGrabarVoz() && <p class="peq terciario">Este navegador no puede grabar audio: prueba desde el móvil.</p>}
      <div class="panel">
        <ul class="lista">
          {FRASES_VOZ.map(([clave, frase, cuando]) => {
            const f = guardadas[clave], esta = nueva?.clave === clave;
            return (
              <li key={clave} class="panel-pad pila-s voz-frase">
                <div class="fila-envolver voz-frase-cab">
                  <span class="pila-xs"><strong>«{frase}»</strong><span class="peq terciario">{cuando}{f ? ` · grabada (${(f.duracion_ms / 1000).toFixed(1).replace('.', ',')} s)` : ''}</span></span>
                  <span class="fila voz-frase-botones">
                    {f && !esta && <button type="button" class="btn btn-peq btn-icono plano" onClick={() => escucharGuardada(f)} aria-label={`Escuchar «${frase}»`}><Icono n="play" /></button>}
                    <button type="button" class={`btn btn-peq${grabando === clave ? ' btn-primario grabando' : ''}`} disabled={!puedeGrabarVoz() || lista.datos === null || ocupado || (grabando && grabando !== clave)} onClick={() => grabar(clave)}>
                      <Icono n={grabando === clave ? 'parar' : 'micro'} />{grabando === clave ? 'Parar' : f ? 'Volver a grabar' : 'Grabar'}
                    </button>
                    {f && !esta && <button type="button" class="btn btn-peq plano" disabled={ocupado} onClick={() => quitar(clave)}>Quitar</button>}
                  </span>
                </div>
                {esta && (
                  <div class="fila-envolver voz-frase-nueva" role="group" aria-label="La que acabas de grabar">
                    <button type="button" class="btn btn-peq" onClick={() => escuchar(nueva.url)}><Icono n="play" /> Escuchar</button>
                    <button type="button" class="btn btn-peq btn-primario" disabled={ocupado} onClick={guardar}>Guardar</button>
                    <button type="button" class="btn btn-peq plano" disabled={ocupado} onClick={() => { URL.revokeObjectURL(nueva.url); setNueva(null); }}>Descartar</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
