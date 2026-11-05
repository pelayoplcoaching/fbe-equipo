// «Programar según FBE»: el volumen de la semana, músculo a músculo. Solo enseña y avisa; nunca añade ni quita series.
//
// Decisión de Pelayo (5/11/2026), con sus datos delante: dentro de un bloque no cambia las series de una semana a
// otra (1058 de 1061 ejercicios emparejados las mantienen; ninguno gana una, tampoco en las semanas «Volumen»), ningún
// atleta tiene un objetivo propio y, con el rango general de 10 a 20, la mitad de los músculos sale «bajo» cada
// semana (abdominales y gemelo siempre). Por eso el motor no hace volumen guiado: compara las series por músculo de
// la semana propuesta con las de la anterior y con el rango del atleta, y avisa solo de lo que cambia y de lo que
// pasa del máximo. Quedarse por debajo del mínimo se ve, pero no se avisa (salvo que las reglas lo pidan).
//
// El recuento es el de la app: cada ejercicio cuenta entero en su músculo principal y a medias en los demás.
import { GRUPOS, NOMBRE_GRUPO, seriesPautadasPorGrupo, rangoVolumen, estadoVolumen, num } from '../calculos.js';
import { REGLAS_FBE } from './reglas.js';

const series = (n) => `${num(n)} ${n === 1 ? 'serie' : 'series'}`;
const totalDe = (pautas) => (pautas || []).reduce((t, p) => t + (Number(p.series) || 0), 0);

// Las series por músculo de dos semanas, frente al rango del atleta.
//   antes, despues: [{ ejercicio_id, series }] (pautas o lo que quedaría al aplicar una propuesta)
//   objetivo: atletas.volumen_objetivo · semana: 'normal' | 'descarga' | 'vuelta' | 'mantenimiento' | 'repetir'
// Devuelve { grupos: [{ grupo, nombre, antes, despues, cambio, rango, estado, estadoAntes }], total: { antes, despues },
//            cambia, avisos: [{ tipo: 'volumen', grupo?, texto }] }
export function compararVolumen({ antes = [], despues = [], ejercicios = {}, objetivo = null, semana = 'normal', reglas = REGLAS_FBE } = {}) {
  const a = seriesPautadasPorGrupo(antes, ejercicios), d = seriesPautadasPorGrupo(despues, ejercicios);
  const grupos = GRUPOS.filter(([g]) => a[g] || d[g]).map(([g]) => {
    const rango = rangoVolumen(objetivo, g), x = a[g] || 0, y = d[g] || 0;
    return { grupo: g, nombre: NOMBRE_GRUPO[g], antes: x, despues: y, cambio: Math.round((y - x) * 100) / 100, rango, estado: estadoVolumen(y, rango), estadoAntes: estadoVolumen(x, rango) };
  });
  const total = { antes: totalDe(antes), despues: totalDe(despues) };
  const cambian = grupos.filter((x) => x.cambio !== 0);
  const modo = reglas.volumen?.avisar || 'cambios';
  const avisos = [];
  if (modo !== 'nada') {
    const recorte = ['descarga', 'vuelta', 'mantenimiento'].includes(semana);
    // Un recorte de toda la semana (descarga, vuelta, mantenimiento) se cuenta de una vez, no músculo a músculo
    if (recorte && total.despues !== total.antes) {
      avisos.push({ tipo: 'volumen', texto: `La semana pasa de ${series(total.antes)} a ${num(total.despues)}${total.antes > 0 ? ` (${total.despues > total.antes ? '+' : '−'}${num(Math.round(Math.abs(1 - total.despues / total.antes) * 100))} %)` : ''}` });
    } else if (!recorte) {
      for (const x of cambian) {
        const cae = x.estado === 'bajo' && x.estadoAntes !== 'bajo';
        avisos.push({ tipo: 'volumen', grupo: x.grupo, texto: `${x.nombre}: de ${num(x.antes)} a ${series(x.despues)}${cae ? `, por debajo de su mínimo (${x.rango[0]})` : ''}` });
      }
    }
    // Pasarse del máximo se avisa siempre, haya cambiado o no (y no en un recorte, que va hacia abajo)
    if (!recorte) for (const x of grupos.filter((g) => g.estado === 'alto')) avisos.push({ tipo: 'volumen', grupo: x.grupo, texto: `${x.nombre}: ${series(x.despues)}, por encima de su máximo (${x.rango[1]})` });
    if (modo === 'todo' && !recorte) for (const x of grupos.filter((g) => g.estado === 'bajo' && !(g.cambio !== 0 && g.estadoAntes !== 'bajo'))) avisos.push({ tipo: 'volumen', grupo: x.grupo, texto: `${x.nombre}: ${series(x.despues)}, por debajo de su mínimo (${x.rango[0]})` });
  }
  return { grupos, total, cambia: cambian.length > 0 || total.antes !== total.despues, avisos };
}

// Lo que quedaría en la semana de destino al aplicar unas propuestas: sus pautas, con las series de las que se aplican
//   pautasDestino: las de la semana que se programa · aplicadas: { id de la pauta de destino: propuesta }
export function pautasConPropuestas(pautasDestino = [], aplicadas = {}) {
  return pautasDestino.map((p) => (aplicadas[p.id] ? { ejercicio_id: p.ejercicio_id, series: aplicadas[p.id].series ?? p.series } : { ejercicio_id: p.ejercicio_id, series: p.series }));
}
