// «Programar según FBE» (fase 1a): la hoja de revisión del coach. El motor propone la semana `destino` a partir de lo
// que el atleta hizo en la semana `base`; aquí se ve, ejercicio a ejercicio, lo que hizo, lo que se propone, el motivo,
// la confianza y las alternativas, y se elige qué aplicar. Aplicar solo cambia las pautas de la semana de destino
// (que sigue como estaba: en borrador, si lo era). Nunca publica nada.
// Usa las reglas FBE de partida (por nivel); las reglas por atleta y por ejercicio llegan con su migración.
import { useMemo, useState } from 'preact/hooks';
import { useApp, useCarga, Hoja, Icono, Cargando } from '../comunes.jsx';
import { sumarDias } from '../../logica/fechas.js';
import { proponerSemana, entradaDesdeBloque, pautasDeSemana, emparejar, cambiosDePropuesta, diferencias, textoPauta, NOMBRE_DESCARGA } from '../../logica/motor/index.js';

const TIPO = {
  subir: ['Sube kilos', 'ok'], reps: ['Más repeticiones', 'morado'], series: ['Una serie más', 'morado'], mantener: ['Igual', ''], bajar: ['Baja kilos', 'aviso'],
  tope: ['Al tope', 'aviso'], sin_tocar: ['A mano', ''], descarga: ['Descarga', 'aviso'], vuelta: ['Vuelta', 'aviso'], mantenimiento: ['Mantenimiento', ''],
};
const CONFIANZA = { alta: ['Confianza alta', 'ok'], media: ['Confianza media', 'aviso'], baja: ['Confianza baja', ''] };

// ¿Sobre qué semanas trabaja el botón del editor? La que se mira, si la anterior tiene series y ella no; si ella ya
// tiene series, la siguiente. Devuelve { base, destino: semana o null (hay que crearla) } o null si no hay de dónde partir.
export function semanasParaProgramar(d, semana) {
  if (!d || !semana || d.bloque?.es_plantilla) return null;
  const conSeries = (w) => !!w && (d.sesiones[w.id] || []).some((x) => (d.pautas[x.id] || []).some((p) => (d.series[p.id] || []).length));
  const anterior = d.semanas.find((w) => w.numero === semana.numero - 1);
  if (!conSeries(semana) && conSeries(anterior)) return { base: anterior, destino: semana };
  if (conSeries(semana)) {
    const siguiente = d.semanas.find((w) => w.numero === semana.numero + 1) || null;
    if (siguiente && conSeries(siguiente)) return null;
    return { base: semana, destino: siguiente };
  }
  return null;
}

export function ProgramarFBE({ d, base, destino, ejercicios, atleta, alCerrar, alAplicar }) {
  const { api } = useApp();
  // El check-in y las molestias de la semana hecha (y el check-in de la anterior, para las señales de descarga)
  const contexto = useCarga(async () => {
    const lunes = base.fecha_inicio;
    if (!atleta?.id || !lunes) return { checkins: [], molestias: [] };
    const [esa, previa] = await Promise.all([api.checkin(atleta.id, lunes).catch(() => null), api.checkin(atleta.id, sumarDias(lunes, -7)).catch(() => null)]);
    return { checkins: [previa?.checkin, esa?.checkin].filter(Boolean), molestias: (esa?.molestias || []).map((m) => ({ ...m, semana_inicio: lunes })) };
  }, [atleta?.id, base.id]);

  const calculo = useMemo(() => {
    if (!contexto.datos) return null;
    const entrada = entradaDesdeBloque({ d, base, destino, ejercicios, atleta: { nivel: atleta?.nivel ?? null, volumen_objetivo: atleta?.volumen_objetivo ?? null }, checkins: contexto.datos.checkins, molestias: contexto.datos.molestias });
    const r = proponerSemana(entrada);
    const dest = pautasDeSemana(d, destino);
    return { r, entrada, dest, pares: emparejar(entrada.pautas, entrada.sesiones, dest.pautas, dest.sesiones) };
  }, [contexto.datos, d, base.id, destino.id]);

  // otra: la versión alternativa de la semana (la de descarga si hay señales; la normal si la semana está marcada como descarga)
  const [otra, setOtra] = useState(false);
  const [eleccion, setEleccion] = useState({}); // pauta de la base → id de la alternativa elegida
  const [marcas, setMarcas] = useState(null);   // null: las de partida

  if (contexto.cargando || !calculo) return <Hoja titulo={`Programar la semana ${destino.numero} según FBE`} alCerrar={alCerrar} ancho={760}><Cargando texto="Preparando la propuesta" /></Hoja>;
  const { r, entrada, dest, pares } = calculo;
  const hayOtra = r.semana.tipo === 'descarga' ? r.sinDescarga : r.descarga.filas;
  const filas = (otra && hayOtra) || r.filas;
  const esDescarga = (r.semana.tipo === 'descarga') !== (otra && !!hayOtra);

  const vistas = filas.map((f) => {
    const actual = pares[f.pauta_id] || null;
    const alternativa = f.alternativas.find((a) => a.id === eleccion[f.pauta_id]) || null;
    const propuesta = alternativa ? alternativa.propuesta : f.propuesta;
    const cambia = actual ? diferencias(actual, propuesta).length > 0 : false;
    return { f, actual, propuesta, cambia, alternativa };
  });
  const dePartida = new Set(vistas.filter((v) => v.cambia && v.f.confianza !== 'baja').map((v) => v.f.pauta_id));
  const marcadas = new Set([...(marcas || dePartida)].filter((id) => vistas.find((v) => v.f.pauta_id === id)?.cambia));
  const alternar = (id) => { const n = new Set(marcadas); if (n.has(id)) n.delete(id); else n.add(id); setMarcas(n); };
  const aplicables = vistas.filter((v) => v.cambia);
  const cuenta = (tipos) => filas.filter((f) => tipos.includes(f.tipo)).length;
  const sinPareja = dest.pautas.filter((p) => !Object.values(pares).some((q) => q.id === p.id));
  const publicada = destino.programacion === 'programada';
  const cambiarVersion = () => { setOtra((x) => !x); setEleccion({}); setMarcas(null); };

  return (
    <Hoja titulo={`Programar la semana ${destino.numero} según FBE`} alCerrar={alCerrar} ancho={760}>
      <p class="peq secundario">A partir de lo que registró en la semana {base.numero}. Marca lo que quieras aplicar; lo demás se queda como está en la semana {destino.numero}.
        {publicada ? ' ' : ' La semana sigue en borrador: el atleta no ve nada hasta que la publiques.'}</p>
      {publicada && <p class="banda-conexion" role="note"><Icono n="alerta" /><span>La semana {destino.numero} ya está publicada: lo que apliques lo verá el atleta en cuanto se guarde.</span></p>}
      {r.semana.motivo && r.semana.tipo !== 'normal' && !otra && (
        <p class="nota-coach" role="note"><Icono n="diana" /><span><strong>{{ descarga: 'Semana de descarga', vuelta: 'Vuelta tras un parón', repetir: 'Semana a medias: se repite', mantenimiento: 'Mantenimiento' }[r.semana.tipo]}.</strong> {r.semana.motivo}.</span></p>
      )}
      {r.descarga.propuesta && (
        <div class="nota-coach" role="note"><Icono n="diana" />
          <div class="pila-s">
            <span><strong>{r.descarga.recomendada ? 'Descarga recomendada' : 'Podría tocar descarga'}</strong> ({NOMBRE_DESCARGA[r.descarga.tipo]}): {r.descarga.senales.map((s) => s.texto.charAt(0).toLowerCase() + s.texto.slice(1)).join('; ')}.</span>
          </div>
        </div>
      )}
      {hayOtra && (
        <button type="button" class="btn btn-peq" style="justify-self:start" aria-pressed={otra ? 'true' : 'false'} onClick={cambiarVersion}>
          <Icono n="intercambiar" /> {esDescarga ? 'Ver la semana sin descarga' : 'Ver la semana como descarga'}
        </button>
      )}

      {!filas.length ? <p class="peq">La semana {base.numero} no tiene ejercicios de fuerza de los que partir.</p> : (
        <>
          <div class="fila-envolver" style="align-items:center">
            <span class="chip ok num">{cuenta(['subir', 'series'])} suben</span>
            <span class="chip num">{cuenta(['reps', 'mantener', 'tope', 'sin_tocar'])} siguen con su carga</span>
            {cuenta(['bajar', 'descarga', 'vuelta', 'mantenimiento']) > 0 && <span class="chip aviso num">{cuenta(['bajar', 'descarga', 'vuelta', 'mantenimiento'])} bajan</span>}
          </div>
          <div class="selector-chips" role="group" aria-label="Qué marcar">
            <button type="button" aria-pressed="false" onClick={() => setMarcas(new Set(aplicables.filter((v) => v.f.confianza === 'alta').map((v) => v.f.pauta_id)))}>Solo confianza alta</button>
            <button type="button" aria-pressed="false" onClick={() => setMarcas(new Set(aplicables.map((v) => v.f.pauta_id)))}>Todas</button>
            <button type="button" aria-pressed="false" onClick={() => setMarcas(new Set())}>Ninguna</button>
          </div>
          {entrada.sesiones.map((s) => {
            const suyas = vistas.filter((v) => v.f.sesion_id === s.id);
            if (!suyas.length) return null;
            return (
              <section key={s.id} class="pila-s" aria-label={`Propuesta para ${s.nombre}`}>
                <strong class="peq">{s.nombre}</strong>
                <ul class="lista cargas-sug" style="max-height:none">
                  {suyas.map(({ f, actual, propuesta, cambia }) => {
                    const [tTipo, cTipo] = TIPO[f.tipo] || [f.tipo, ''];
                    const [tConf, cConf] = CONFIANZA[f.confianza] || [f.confianza, ''];
                    const notas = [...f.frenos.map((x) => x.texto), ...f.avisos.map((x) => x.texto)];
                    return (
                      <li key={f.pauta_id} class={`carga-sug ${cambia ? '' : 'sin'}`} style="grid-template-columns:24px minmax(0,1fr);align-items:start">
                        {cambia
                          ? <input type="checkbox" style="margin-top:3px" checked={marcadas.has(f.pauta_id)} onChange={() => alternar(f.pauta_id)} aria-label={`Aplicar la propuesta en ${f.ejercicio}`} />
                          : <span />}
                        <div class="pila-xs" style="gap:5px">
                          <span class="fila-envolver" style="align-items:center;gap:6px">
                            <strong>{f.ejercicio}</strong>
                            <span class={`chip ${cTipo}`}>{tTipo}</span>
                            <span class={`chip ${cConf}`}>{tConf}</span>
                          </span>
                          <span class="mini secundario">Hizo: {f.hecho || 'sin registrar'}</span>
                          {!actual ? <span class="mini secundario">Este ejercicio ya no está en la semana {destino.numero}: no se aplica.</span>
                            : cambia ? <span class="peq"><span class="secundario">{textoPauta(actual)} →</span> <b class="num">{textoPauta(propuesta)}</b></span>
                              : <span class="mini secundario">Sin cambios: {textoPauta(actual)}</span>}
                          <span class="mini secundario">{f.motivo}{f.orientativa != null ? ` (carga orientativa: ${String(f.orientativa).replace('.', ',')} kg)` : ''}</span>
                          {notas.length > 0 && <span class="fila-envolver" style="gap:6px">{notas.map((t) => <span key={t} class="chip aviso">{t}</span>)}</span>}
                          {actual && f.alternativas.length > 0 && (
                            <div class="selector-chips" role="group" aria-label={`Qué hacer con ${f.ejercicio}`}>
                              <button type="button" aria-pressed={!eleccion[f.pauta_id] ? 'true' : 'false'} onClick={() => setEleccion((e) => ({ ...e, [f.pauta_id]: null }))}>Propuesta</button>
                              {f.alternativas.map((a) => (
                                <button type="button" key={a.id} aria-pressed={eleccion[f.pauta_id] === a.id ? 'true' : 'false'} onClick={() => setEleccion((e) => ({ ...e, [f.pauta_id]: a.id }))}>{a.etiqueta}</button>
                              ))}
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
          {sinPareja.length > 0 && <p class="mini secundario">{sinPareja.length === 1 ? 'Hay un ejercicio' : `Hay ${sinPareja.length} ejercicios`} en la semana {destino.numero} que no {sinPareja.length === 1 ? 'estaba' : 'estaban'} en la {base.numero}: {sinPareja.length === 1 ? 'se queda' : 'se quedan'} como {sinPareja.length === 1 ? 'está' : 'están'}.</p>}
          {r.semana.avisos.map((a) => <p key={a.texto} class="mini secundario">{a.texto}.</p>)}
        </>
      )}
      <div class="fila-envolver">
        <button class="btn" onClick={alCerrar}>Cancelar</button>
        <button class="btn btn-primario" disabled={!marcadas.size} onClick={() => alAplicar(vistas.filter((v) => marcadas.has(v.f.pauta_id)).map((v) => ({ id: v.actual.id, cambios: cambiosDePropuesta(v.propuesta) })))}>
          <Icono n="hecho" /> {marcadas.size ? `Aplicar ${marcadas.size} ${marcadas.size === 1 ? 'cambio' : 'cambios'}` : 'Marca lo que quieras aplicar'}
        </button>
      </div>
    </Hoja>
  );
}
