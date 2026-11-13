import { useEffect, useState } from 'preact/hooks';
import { useApp, useCarga, IcoIos } from '../comunes.jsx';
import { perezoso } from '../perezoso.jsx';
import { hoyISO } from '../../logica/fechas.js';
import { resumenApuntes, textoApuntes, apuntesDeNovedades, novedadPendiente, rachaAprendizaje, medallaApuntes, puedeExaminarse, ultimoExamen } from '../../logica/apuntes.js';
import { leerApuntes, sincronizarApuntes, recordarFuente, fuenteRecordada } from '../apuntes.js';
import { guiasConTexto } from '../../datos/guias.js';
import { semanaDeAprendizaje } from '../../logica/apuntes-arte.js';
import { Medalla } from './apuntes-arte.jsx';

// «Apuntes»: su pantalla (y la lectura de las guías que necesita) solo se pide al abrirla
export const Apuntes = perezoso(() => import('./Apuntes.jsx'), 'Apuntes', { mientras: null });

// La tarjeta de los apuntes fuera de la sesión. En Hoy, «El apunte de hoy» (una línea); en Semana, lo que lleva vistos
// y «Repasar» (los que no sabía y los de esta semana). Lo que enseña sale de lo guardado en el móvil.
// (tanda 4) En Semana, además: la racha de aprendizaje y la medalla, el curso de la semana y el examen (con `finBloque`,
// la última semana del bloque, se lo recuerda).
export function TarjetaApuntes({ repaso = false, finBloque = false }) {
  const { atleta, api, backend } = useApp() || {};
  const [abierta, setAbierta] = useState(false);   // false | true | 'guardados' | 'curso' | 'examen'
  const [r, setR] = useState(() => (atleta?.id ? resumenApuntes(leerApuntes(atleta.id), hoyISO()) : null));
  // (060) lo visto en otros móviles y, en Hoy, si hay una novedad de la semana que aún no ha leído
  const [vez, setVez] = useState(0);
  useEffect(() => {
    if (!atleta?.id) return undefined;
    let vivo = true;
    sincronizarApuntes(api, atleta.id).then((e) => { if (vivo) { setR(resumenApuntes(e, hoyISO())); setVez((n) => n + 1); } });
    return () => { vivo = false; };
  }, [atleta?.id]);
  // (apuntes, tanda A) con red, deja guardadas las guías (lo que usan los apuntes) para leerlos sin conexión; una vez al día
  useEffect(() => {
    if (!atleta?.id || !backend || (typeof navigator !== 'undefined' && navigator.onLine === false)) return undefined;
    const marca = `fbe-fuentes-apuntes-dia-${atleta.id}`;
    let hecho = null; try { hecho = localStorage.getItem(marca); } catch { /* sin almacenamiento */ }
    if (hecho === hoyISO() && fuenteRecordada(atleta.id, 'guias')) return undefined;
    const t = setTimeout(() => {
      guiasConTexto({ backend }).then((g) => { if (g?.length) { recordarFuente(atleta.id, 'guias', g); try { localStorage.setItem(marca, hoyISO()); } catch { /* nada */ } } }).catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [atleta?.id]);
  const novedades = useCarga(() => (!repaso && atleta?.id && api?.novedades ? api.novedades().then((n) => { recordarFuente(atleta.id, 'novedades', n); return n; }).catch(() => fuenteRecordada(atleta.id, 'novedades') || []) : Promise.resolve([])), [atleta?.id, repaso], { recuerdo: !repaso && atleta?.id ? 'apuntes-novedades' : null });
  const novedad = !repaso && atleta?.id && vez >= 0 ? novedadPendiente(apuntesDeNovedades(novedades.datos || []), leerApuntes(atleta.id), hoyISO(), 7) : null;
  if (!atleta?.id || !r) return null;
  const cerrar = () => { setAbierta(false); setR(resumenApuntes(leerApuntes(atleta.id), hoyISO())); setVez((n) => n + 1); };
  const nada = repaso && !r.vistos;
  const guardados = vez >= 0 ? (leerApuntes(atleta.id).guardados || []).length : 0;   // (tanda 2) los que guardó para luego
  // (tanda 4) la racha (semanas seguidas aprendiendo algo), la medalla y el último examen: de lo guardado en el móvil
  const estado = repaso && vez >= 0 ? leerApuntes(atleta.id) : null;
  const racha = estado ? rachaAprendizaje(estado, hoyISO()) : 0, medalla = estado ? medallaApuntes(estado) : null, ultimo = estado ? ultimoExamen(estado) : null;
  const conExamen = !!estado && puedeExaminarse(estado);
  return (
    <section class={`apuntes-tarjeta panel${repaso ? ' repaso' : ''}${novedad ? ' con-novedad' : ''}`} aria-label={repaso ? 'Tus apuntes' : 'El apunte de hoy'}>
      <IcoIos n="biblioteca" />
      {novedad && <span class="apuntes-cinta" aria-hidden="true">Nuevo</span>}
      <div class="apuntes-tarjeta-texto">
        <strong>{repaso ? 'Tus apuntes' : novedad ? 'Novedad de la semana' : 'El apunte de hoy'}</strong>
        <span class="peq secundario">{repaso
          ? (nada ? 'Lo que aprendes en los descansos, para repasarlo' : `${textoApuntes(r.semana)} esta semana · ${r.vistos} en total${r.repasar ? ` · ${r.repasar} por repasar` : ''}`)
          : novedad ? novedad.titulo : r.tocan > 0 ? (r.tocan === 1 ? 'Uno por repasar hoy' : `${r.tocan} por repasar hoy`) : 'Medio minuto para aprender algo'}</span>
      </div>
      <span class="apuntes-tarjeta-botones">
        {repaso && guardados > 0 && <button type="button" class="btn btn-peq" onClick={() => setAbierta('guardados')}>Guardados ({guardados})</button>}
        {!repaso && r.tocan > 0 && !novedad && <button type="button" class="btn btn-peq btn-primario" onClick={() => setAbierta('repaso')}>Repasar ({r.tocan})</button>}
        <button type="button" class={`btn btn-peq${repaso && r.tocan > 0 ? ' btn-primario' : ''}`} disabled={nada} onClick={() => setAbierta(true)}>{repaso ? (r.tocan > 0 ? `Repasar (${r.tocan})` : 'Repasar') : 'Leer'}</button>
      </span>
      {repaso && (
        <div class="apuntes-tarjeta-mas">
          {(racha > 0 || medalla?.nombre) && (
            <span class="apuntes-logros peq">
              {racha > 0 && <span class="apuntes-racha">{racha === 1 ? '1 semana aprendiendo' : `${racha} semanas seguidas aprendiendo`}</span>}
              {medalla?.nombre && <span class="apuntes-medalla"><Medalla nivel={medalla.nivel} />{medalla.nombre}</span>}
              {medalla?.siguiente && medalla.nombre && <span class="secundario">{medalla.faltan === 1 ? 'falta 1' : `faltan ${medalla.faltan}`} para «{medalla.siguiente.nombre}»</span>}
            </span>
          )}
          {/* (apuntes bellos) los siete días de esta semana, encendidos los que ha aprendido algo */}
          {estado && r.vistos > 0 && (
            <span class="apuntes-semana" role="img" aria-label={`Esta semana has aprendido algo ${semanaDeAprendizaje(estado, hoyISO()).filter((d) => d.hecho).length} de 7 días`}>
              {semanaDeAprendizaje(estado, hoyISO()).map((d) => <span key={d.fecha} class={`${d.hecho ? 'hecho' : ''}${d.hoy ? ' hoy' : ''}${d.futuro ? ' futuro' : ''}`}>{d.letra}</span>)}
            </span>
          )}
          {!medalla?.nombre && medalla?.vistos > 0 && <span class="apuntes-logros peq secundario">{medalla.faltan === 1 ? 'Falta 1 apunte' : `Faltan ${medalla.faltan} apuntes`} para tu primera medalla: «{medalla.siguiente.nombre}»</span>}
          <span class="apuntes-tarjeta-acciones">
            <button type="button" class="btn btn-peq" onClick={() => setAbierta('curso')}>Curso de la semana</button>
            {conExamen && <button type="button" class={`btn btn-peq${finBloque ? ' btn-primario' : ''}`} onClick={() => setAbierta('examen')}>{finBloque ? 'Examen del bloque' : 'Examen'}</button>}
            {ultimo && <span class="peq secundario apuntes-nota">Último examen: <b class="num">{ultimo.aciertos}/{ultimo.total}</b></span>}
          </span>
        </div>
      )}
      {abierta && <Apuntes atletaId={atleta.id} modo={typeof abierta === 'string' ? abierta : repaso ? 'repaso' : 'dia'} alCerrar={cerrar} />}
    </section>
  );
}
