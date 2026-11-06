import { useEffect, useMemo, useState } from 'preact/hooks';
import { useApp, useCarga, useUnaVez, Icono, Hoja, Vacio, Segmentos, Siluetas } from './comunes.jsx';
import { NOMBRE_TOMA } from '../logica/comidas.js';
import { fmtKcal } from '../logica/nutricion.js';
import { hoyISO, fmtConDia, rangoSemana, sumarDias } from '../logica/fechas.js';
import { rellenarSemana, cambiarPropuesta, totalesDePropuesta, descuadreDePlan, textoPropuesta, MODOS_RELLENO, NOMBRE_MODO_RELLENO, DESCUADRE_AVISO } from '../logica/rellenar/index.js';
import { menuAnterior, guardarRelleno } from '../datos/rellenar.js';

const mayus = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// «Rellenar la semana» (para el atleta y para su coach): propone lo que falta del menú con las recetas de su recetario,
// se cambia o se quita lo que no guste y se guarda de una vez. Lo ya apuntado se queda; nunca borra nada.
// La lógica está en logica/rellenar (LEEME.md).
//   entradas: el menú de esa semana; recetario: el de api.recetario; diasSin: los días sin su comida opcional
export function HojaRellenar({ atletaId, lunes, entradas = [], recetario, diasSin = [], planes = [], esCoach = false, alCerrar, alGuardado }) {
  const { api, backend, aviso } = useApp();
  const hoy = hoyISO();
  const previa = useCarga(() => menuAnterior({ api }, atletaId, lunes), [atletaId, lunes]);
  const [modo, setModo] = useState('variada');
  const [intento, setIntento] = useState(0);
  const [propuestas, setPropuestas] = useState(null);
  const [vistas, setVistas] = useState({});
  const [ocupado, una] = useUnaVez();
  const base = { recetario, entradas, anteriores: previa.datos || [], diasSin, lunes };

  const r = useMemo(() => (previa.cargando && !previa.datos ? null : rellenarSemana({ ...base, hoy, modo, intento, atletaId })), [previa.datos, previa.cargando, modo, intento, entradas, recetario, diasSin, lunes]);
  useEffect(() => { if (r) { setPropuestas(r.propuestas); setVistas({}); } }, [r]);

  const lista = propuestas || [];
  const totales = useMemo(() => totalesDePropuesta({ recetario, entradas, diasSin, lunes, propuestas: lista }), [lista, entradas, recetario, diasSin, lunes]);
  const descuadre = esCoach ? descuadreDePlan(totales, planes) : null;
  const dias = [...new Set(lista.map((p) => p.fecha))];
  const resumen = { propuestas: lista, recetas: new Set(lista.map((p) => p.asignacion.receta_id)).size, cocinar: lista.filter((p) => ['comida', 'cena'].includes(p.toma) && !p.repite).length };

  const cambiar = (p) => {
    const k = `${p.fecha}|${p.toma}`;
    const x = cambiarPropuesta({ ...base, propuestas: lista }, { fecha: p.fecha, toma: p.toma, vistas: vistas[k] || [] });
    setPropuestas(x.propuestas); setVistas((v) => ({ ...v, [k]: x.vistas }));
  };
  const quitar = (p) => setPropuestas(lista.filter((q) => q !== p));
  const guardar = () => una(async () => {
    try {
      const { guardadas, saltadas } = await guardarRelleno({ api, backend }, atletaId, lunes, lista);
      aviso(`${guardadas === 1 ? '1 comida apuntada' : `${guardadas} comidas apuntadas`} en el menú${saltadas ? ` (${saltadas} ya ${saltadas === 1 ? 'estaba' : 'estaban'})` : ''}`, 'ok');
      alGuardado?.(); alCerrar();
    } catch (e) { aviso(e?.message || 'No se ha podido guardar: vuelve a intentarlo', 'error'); }
  });

  return (
    <Hoja titulo="Rellenar la semana" alCerrar={alCerrar}>
      <p class="peq secundario" style={{ margin: 0 }}>Semana del {rangoSemana(lunes)}. Te propongo lo que falta con las recetas {esCoach ? 'de su recetario' : 'de tu recetario'}; lo que ya está apuntado se queda como está.</p>
      <Segmentos etiqueta="Cómo repartir comidas y cenas" valor={modo} alCambiar={(v) => v && setModo(v)} opciones={MODOS_RELLENO.map((m) => [m, NOMBRE_MODO_RELLENO[m]])} />
      {!r ? <Siluetas forma="lista" n={4} texto="Preparando la propuesta" /> : !lista.length ? (
        <Vacio icono="hecho" titulo={!r.dias.length ? 'Esta semana ya ha pasado' : r.huecos ? 'No hay recetas para lo que falta' : propuestas && r.propuestas.length ? 'Has quitado todo' : 'Esta semana ya está completa'}>
          {!r.dias.length ? 'Pasa a la semana siguiente para rellenarla.' : r.huecos ? 'Los huecos que quedan son de comidas sin recetas en el recetario.' : propuestas && r.propuestas.length ? 'Pide otra propuesta o cierra.' : 'No queda ningún hueco desde hoy.'}
        </Vacio>
      ) : (
        <>
          <p class="peq" style={{ margin: 0 }}><strong>{mayus(textoPropuesta(resumen))}</strong></p>
          {dias.map((d) => (
            <section key={d} class="panel" aria-label={`Propuesta para el ${fmtConDia(d)}`}>
              <div class="panel-pad separa" style={{ paddingBottom: 0 }}>
                <h3 class="h-panel" style={{ margin: 0 }}>{d === hoy ? 'Hoy' : d === sumarDias(hoy, 1) ? 'Mañana' : mayus(fmtConDia(d))}</h3>
                {totales[d]?.kcal > 0 && <span class="mini terciario num">{totales[d].completo ? '' : 'de momento, '}{fmtKcal(totales[d].kcal)} kcal</span>}
              </div>
              <ul class="lista tomas-dia">
                {lista.filter((p) => p.fecha === d).map((p) => (
                  <li key={p.toma} class="toma-dia">
                    <div class="separa toma-cab"><span class="etq">{NOMBRE_TOMA[p.toma]}</span>
                      <span class="fila-envolver" style={{ gap: '2px' }}>
                        <button type="button" class="btn-texto" onClick={() => cambiar(p)} aria-label={`Cambiar ${NOMBRE_TOMA[p.toma].toLowerCase()} del ${fmtConDia(d)}`}><Icono n="intercambiar" /> Cambiar</button>
                        <button type="button" class="btn-texto" onClick={() => quitar(p)} aria-label={`Quitar ${NOMBRE_TOMA[p.toma].toLowerCase()} del ${fmtConDia(d)}`}>Quitar</button>
                      </span>
                    </div>
                    <span>{p.asignacion.receta.nombre}{p.repite && <span class="mini terciario"> · la misma que el día anterior</span>}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {r.sinRecetas.length > 0 && <p class="mini terciario" style={{ margin: 0 }}>Sin recetas en el recetario para {r.sinRecetas.map((t) => NOMBRE_TOMA[t].toLowerCase()).join(', ')}: {r.sinRecetas.length === 1 ? 'esa comida se queda' : 'esas comidas se quedan'} sin rellenar.</p>}
          {descuadre && Math.abs(descuadre.pct) >= DESCUADRE_AVISO && (
            <p class="peq aviso-t" style={{ margin: 0 }}>Con su recetario, los días completos salen un {String(Math.abs(descuadre.pct)).replace('.', ',')} % por {descuadre.pct > 0 ? 'encima' : 'debajo'} de su plan ({fmtKcal(descuadre.kcal)} frente a {fmtKcal(descuadre.objetivo)} kcal): revisa el factor de sus recetas.</p>
          )}
        </>
      )}
      <div class="fila-envolver hoja-pie-fijo">
        <button class="btn btn-primario" disabled={ocupado || !lista.length} onClick={guardar}><Icono n="hecho" /> {ocupado ? 'Guardando…' : lista.length === 1 ? 'Apuntar 1 comida' : `Apuntar ${lista.length} comidas`}</button>
        <button class="btn" disabled={ocupado || !r || !r.huecos} onClick={() => setIntento((n) => n + 1)}>Otra propuesta</button>
        <button class="btn plano" disabled={ocupado} onClick={alCerrar}>Cancelar</button>
      </div>
    </Hoja>
  );
}
