// «Programar según FBE» (fase 1a): la hoja de revisión del coach. El motor propone la semana `destino` a partir de lo
// que el atleta hizo en la semana `base`; aquí se ve, ejercicio a ejercicio, lo que hizo, lo que se propone, el motivo,
// la confianza y las alternativas, y se elige qué aplicar. Aplicar solo cambia las pautas de la semana de destino
// (que sigue como estaba: en borrador, si lo era). Nunca publica nada.
// Las reglas son las de partida (por nivel) más las que el coach guarde para ese atleta y para cada ejercicio suyo
// (fase 1b: `atletas.reglas_motor`; se cambian aquí mismo y la propuesta se recalcula al guardar).
// Al aplicar se guarda también la nota de la semana, si se ha cambiado (con un borrador de lo que cambia), y queda
// apuntado en la semana qué propuso el motor y qué se aplicó (`semanas.propuesta_motor`), para medir el acuerdo real.
import { useMemo, useState } from 'preact/hooks';
import { useApp, useCarga, Hoja, Icono, Cargando } from '../comunes.jsx';
import { sumarDias, fmtCorta } from '../../logica/fechas.js';
import { num } from '../../logica/calculos.js';
import { proponerSemana, entradaDesdeBloque, pautasDeSemana, emparejar, cambiosDePropuesta, diferencias, textoPauta, esBasico, compararVolumen, pautasConPropuestas, NOMBRE_DESCARGA,
  leerGuardadas, paraGuardar, paraElMotor, tieneRegla, resumenRegla,
  notaDeSemana, claseParaNota, registroDePropuesta, fusionarRegistro, leerRegistro, acuerdoDeRegistro, textoAcuerdo } from '../../logica/motor/index.js';
import { ReglasAtleta, ReglaEjercicio } from './ReglasFBE.jsx';

const TIPO = {
  subir: ['Sube kilos', 'ok'], reps: ['Más repeticiones', 'morado'], series: ['Una serie más', 'morado'], mantener: ['Igual', ''], bajar: ['Baja kilos', 'aviso'],
  tope: ['Al tope', 'aviso'], peaking: ['Menos repeticiones', 'morado'], sin_tocar: ['A mano', ''], descarga: ['Descarga', 'aviso'], vuelta: ['Vuelta', 'aviso'], mantenimiento: ['Mantenimiento', ''],
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
  const { api, aviso } = useApp();
  // El check-in y las molestias de la semana hecha (y el check-in de la anterior, para las señales de descarga), y la
  // ficha del atleta, de donde salen su nombre y sus reglas guardadas
  const contexto = useCarga(async () => {
    const lunes = base.fecha_inicio;
    const ficha = atleta?.id ? await api.ficha(atleta.id).then((x) => x?.atleta || null).catch(() => null) : null;
    const suyo = { nombre: ficha?.nombre || null, reglas: ficha?.reglas_motor ?? null };
    if (!atleta?.id || !lunes) return { checkins: [], molestias: [], ...suyo };
    const [esa, previa] = await Promise.all([api.checkin(atleta.id, lunes).catch(() => null), api.checkin(atleta.id, sumarDias(lunes, -7)).catch(() => null)]);
    return { checkins: [previa?.checkin, esa?.checkin].filter(Boolean), molestias: (esa?.molestias || []).map((m) => ({ ...m, semana_inicio: lunes })), ...suyo };
  }, [atleta?.id, base.id]);

  // Las reglas guardadas del atleta: las de su ficha hasta que se cambien aquí
  const [propias, setPropias] = useState(null);
  const guardadas = useMemo(() => propias || leerGuardadas(contexto.datos?.reglas), [propias, contexto.datos]);
  const [ocupado, setOcupado] = useState(false);
  const [editando, setEditando] = useState(null); // la fila cuya regla se está cambiando
  const [nota, setNota] = useState(null);         // la nota de la semana; null: la que ya tiene

  // Peaking: de partida, lo que diga el foco de la semana que se programa; se puede probar aquí sin cambiar el foco
  const [pico, setPico] = useState(destino.foco === 'peaking');
  const calculo = useMemo(() => {
    if (!contexto.datos) return null;
    const suyas = paraElMotor(guardadas);
    const leida = entradaDesdeBloque({ d, base, destino, ejercicios, atleta: { nivel: atleta?.nivel ?? null, perfil: suyas.perfil, volumen_objetivo: atleta?.volumen_objetivo ?? null }, reglas: suyas.reglas,
      checkins: contexto.datos.checkins, molestias: contexto.datos.molestias });
    const foco = leida.contexto.focoSiguiente;
    const entrada = { ...leida, contexto: { ...leida.contexto, focoSiguiente: pico ? (foco === 'descarga' ? foco : 'peaking') : foco === 'peaking' ? null : foco } };
    const r = proponerSemana(entrada);
    const dest = pautasDeSemana(d, destino);
    return { r, entrada, dest, pares: emparejar(entrada.pautas, entrada.sesiones, dest.pautas, dest.sesiones) };
  }, [contexto.datos, d, base.id, destino.id, pico, guardadas]);

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
  // El volumen por músculo de la semana de destino con lo marcado, frente a la semana hecha (solo se enseña y se avisa)
  const volumen = compararVolumen({ antes: entrada.pautas, ejercicios, objetivo: atleta?.volumen_objetivo ?? null, semana: esDescarga ? 'descarga' : r.semana.tipo,
    despues: pautasConPropuestas(dest.pautas, Object.fromEntries(vistas.filter((v) => v.actual && marcadas.has(v.f.pauta_id)).map((v) => [v.actual.id, v.propuesta]))) });
  // El peaking solo tiene sentido si hay básicos con kilos y la semana no es de descarga, vuelta ni a medias
  const puedePico = r.semana.tipo === 'normal' && entrada.pautas.some((p) => esBasico(ejercicios[p.ejercicio_id]));
  const cambiarPico = () => { setPico((x) => !x); setOtra(false); setEleccion({}); setMarcas(null); };
  // La nota de la semana para el atleta: la que tenga, con un borrador de lo que cambia según lo marcado
  const notaGuardada = destino.nota_coach || '';
  const textoNota = nota ?? notaGuardada;
  const notaCambiada = textoNota.trim() !== notaGuardada.trim();
  const borrador = notaDeSemana({ semana: esDescarga ? 'descarga' : r.semana.tipo, descarga: r.descarga.tipo, total: dest.pautas.length,
    filas: vistas.filter((v) => marcadas.has(v.f.pauta_id)).map((v) => ({ ejercicio: v.f.ejercicio, clase: claseParaNota({ fila: v.f, alternativa: v.alternativa, propuesta: v.propuesta, hechas: entrada.series[v.f.pauta_id] }) })).filter((x) => x.clase) });
  // Lo que ya se aplicó en esta semana, si quedó apuntado
  const registro = leerRegistro(destino.propuesta_motor);
  const aplicar = async () => {
    setOcupado(true);
    try {
      const lista = vistas.filter((v) => marcadas.has(v.f.pauta_id)).map((v) => ({ id: v.actual.id, cambios: cambiosDePropuesta(v.propuesta) }));
      if (notaCambiada) await api.actualizar('semanas', destino.id, { nota_coach: textoNota.trim() || null });
      // Qué se propuso y qué se aplicó: si la base aún no tiene esa columna, no pasa nada
      if (lista.length) {
        const nuevo = registroDePropuesta({ vistas, marcadas, base, semana: r.semana, descarga: esDescarga, guardadas });
        await api.actualizar('semanas', destino.id, { propuesta_motor: fusionarRegistro(registro, nuevo) }).catch(() => {});
      }
      await alAplicar(lista, { nota: notaCambiada });
    } catch (e) { aviso(e?.message || 'No se ha podido guardar', 'error'); } finally { setOcupado(false); }
  };
  // Guardar las reglas en la ficha del atleta: la propuesta se recalcula con ellas y se vuelve a marcar de partida
  const guardarReglas = async (nuevas) => {
    setOcupado(true);
    try {
      const valor = paraGuardar(nuevas);
      await api.actualizar('atletas', atleta.id, { reglas_motor: valor });
      setPropias(leerGuardadas(valor)); setEleccion({}); setMarcas(null);
      aviso(valor ? 'Reglas guardadas' : 'Reglas de partida');
      return true;
    } catch (e) {
      aviso(/reglas_motor|schema cache|column|columna/i.test(e?.message || '') ? 'Para guardar reglas falta aplicar en la base la migración 046' : (e?.message || 'No se han podido guardar las reglas'), 'error');
      return false;
    } finally { setOcupado(false); }
  };

  return (
    <Hoja titulo={`Programar la semana ${destino.numero} según FBE`} alCerrar={alCerrar} ancho={760}>
      <p class="peq secundario">A partir de lo que registró en la semana {base.numero}. Marca lo que quieras aplicar; lo demás se queda como está en la semana {destino.numero}.
        {publicada ? ' ' : ' La semana sigue en borrador: el atleta no ve nada hasta que la publiques.'}</p>
      {registro && <p class="mini secundario">Ya aplicaste una propuesta en esta semana el {fmtCorta(registro.en.slice(0, 10))}. {textoAcuerdo(acuerdoDeRegistro(registro, Object.fromEntries(dest.pautas.map((p) => [p.id, p]))))}</p>}
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
      {r.semana.peaking != null && !otra && (
        <p class="nota-coach" role="note"><Icono n="diana" /><span><strong>Semana de peaking.</strong> {r.semana.peaking
          ? 'En los básicos, la serie top baja una repetición y lleva los kilos que mantienen el esfuerzo; las back-off y el resto de ejercicios siguen como siempre.'
          : 'No hay ningún básico con kilos registrados del que partir: la propuesta es la de una semana normal.'}{destino.foco !== 'peaking' ? ` El foco de la semana ${destino.numero} no cambia: si quieres que conste, márcalo en el editor.` : ''}</span></p>
      )}
      {(hayOtra || puedePico) && (
        <div class="fila-envolver">
          {hayOtra && (
            <button type="button" class="btn btn-peq" aria-pressed={otra ? 'true' : 'false'} onClick={cambiarVersion}>
              <Icono n="intercambiar" /> {esDescarga ? 'Ver la semana sin descarga' : 'Ver la semana como descarga'}
            </button>
          )}
          {puedePico && (
            <button type="button" class="btn btn-peq" aria-pressed={pico ? 'true' : 'false'} onClick={cambiarPico}>
              <Icono n="intercambiar" /> {pico ? 'Ver la semana sin peaking' : 'Ver la semana como peaking'}
            </button>
          )}
        </div>
      )}

      {atleta?.id && <ReglasAtleta nombre={contexto.datos?.nombre} nivel={atleta?.nivel ?? null} guardadas={guardadas} ocupado={ocupado} alGuardar={guardarReglas} />}

      {!filas.length ? <p class="peq">La semana {base.numero} no tiene ejercicios de fuerza de los que partir.</p> : (
        <>
          <div class="fila-envolver" style="align-items:center">
            <span class="chip ok num">{cuenta(['subir', 'series'])} suben</span>
            <span class="chip num">{cuenta(['reps', 'mantener', 'tope', 'peaking', 'sin_tocar'])} siguen con su carga</span>
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
                            {f.fase === 'peaking' && <span class="chip morado">Peaking</span>}
                            <span class={`chip ${cConf}`}>{tConf}</span>
                            {tieneRegla(guardadas, f.ejercicio_id) && <span class="chip morado">Regla propia</span>}
                          </span>
                          <span class="mini secundario">Hizo: {f.hecho || 'sin registrar'}</span>
                          {!actual ? <span class="mini secundario">Este ejercicio ya no está en la semana {destino.numero}: no se aplica.</span>
                            : cambia ? <span class="peq"><span class="secundario">{textoPauta(actual)} →</span> <b class="num">{textoPauta(propuesta)}</b></span>
                              : <span class="mini secundario">Sin cambios: {textoPauta(actual)}</span>}
                          <span class="mini secundario">{f.motivo}{f.orientativa != null ? ` (carga orientativa: ${String(f.orientativa).replace('.', ',')} kg)` : ''}</span>
                          {notas.length > 0 && <span class="fila-envolver" style="gap:6px">{notas.map((t) => <span key={t} class="chip aviso">{t}</span>)}</span>}
                          {tieneRegla(guardadas, f.ejercicio_id) && editando !== f.pauta_id && <span class="mini secundario">Regla propia: {resumenRegla(guardadas, f.ejercicio_id)}.</span>}
                          {atleta?.id && (editando === f.pauta_id
                            ? <ReglaEjercicio clave={f.pauta_id} ejercicioId={f.ejercicio_id} nombre={f.ejercicio} guardadas={guardadas} ocupado={ocupado} alGuardar={guardarReglas} alCerrar={() => setEditando(null)} />
                            : <button type="button" class="btn-texto" style="justify-self:start;min-height:28px;padding-block:2px" aria-label={`${tieneRegla(guardadas, f.ejercicio_id) ? 'Cambiar la regla' : 'Poner una regla propia'} de ${f.ejercicio}`} onClick={() => setEditando(f.pauta_id)}>{tieneRegla(guardadas, f.ejercicio_id) ? 'Cambiar la regla' : 'Regla propia'}</button>)}
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
          {volumen.grupos.length > 0 && (
            <div class="pila-xs">
              <details class="vol-desglose">
                <summary class="mini terciario">Series por músculo en la semana {destino.numero} con lo marcado: {volumen.cambia ? `cambian frente a la semana ${base.numero}` : `las mismas que en la semana ${base.numero}`}</summary>
                <div class="vol-chips" style="margin-top:6px">
                  {volumen.grupos.map((x) => (
                    <span key={x.grupo} class={`vol-chip vol-${x.estado}`} title={x.estado === 'bajo' ? 'Por debajo del rango' : x.estado === 'alto' ? 'Por encima del rango' : 'Dentro del rango'}>
                      {x.nombre} <strong>{x.cambio ? `${num(x.antes)} → ${num(x.despues)}` : num(x.despues)}</strong><span class="mini">{x.rango[0]}–{x.rango[1]}</span>
                    </span>
                  ))}
                </div>
              </details>
              {volumen.avisos.length > 0 && <span class="fila-envolver" style="gap:6px">{volumen.avisos.map((a) => <span key={a.texto} class="chip aviso">{a.texto}</span>)}</span>}
            </div>
          )}
          {sinPareja.length > 0 && <p class="mini secundario">{sinPareja.length === 1 ? 'Hay un ejercicio' : `Hay ${sinPareja.length} ejercicios`} en la semana {destino.numero} que no {sinPareja.length === 1 ? 'estaba' : 'estaban'} en la {base.numero}: {sinPareja.length === 1 ? 'se queda' : 'se quedan'} como {sinPareja.length === 1 ? 'está' : 'están'}.</p>}
          {r.semana.avisos.map((a) => <p key={a.texto} class="mini secundario">{a.texto}.</p>)}
        </>
      )}
      {filas.length > 0 && (
        <div class="campo">
          <label for="fbe-nota">Nota de la semana {destino.numero} para {contexto.datos?.nombre || 'el atleta'}</label>
          <textarea id="fbe-nota" class="area" style="min-height:76px" maxLength={1000} value={textoNota} placeholder="Aparece arriba en su pantalla de hoy" onInput={(e) => setNota(e.currentTarget.value)} />
          <span class="ayuda">Borrador con lo marcado: «{borrador}»</span>
          <div class="fila-envolver">
            <button type="button" class="btn btn-peq" disabled={textoNota.trim() === borrador} onClick={() => setNota(borrador)}>Usar el borrador</button>
            {notaCambiada && <button type="button" class="btn btn-peq" onClick={() => setNota(null)}>{notaGuardada ? 'Volver a la nota que tenía' : 'Dejarla vacía'}</button>}
          </div>
          <span class="ayuda">{notaCambiada ? `La nota se guarda con el botón de abajo${publicada ? ' y el atleta la ve al momento.' : '; el atleta la verá cuando publiques la semana.'}` : 'Si la cambias, se guarda con el botón de abajo.'}</span>
        </div>
      )}
      <div class="fila-envolver">
        <button class="btn" onClick={alCerrar}>Cancelar</button>
        <button class="btn btn-primario" disabled={ocupado || (!marcadas.size && !notaCambiada)} onClick={aplicar}>
          <Icono n="hecho" /> {marcadas.size ? `Aplicar ${marcadas.size} ${marcadas.size === 1 ? 'cambio' : 'cambios'}${notaCambiada ? ' y guardar la nota' : ''}` : notaCambiada ? 'Guardar la nota' : 'Marca lo que quieras aplicar'}
        </button>
      </div>
    </Hoja>
  );
}
