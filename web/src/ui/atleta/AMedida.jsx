// «A su medida» (migración 080), en la app del atleta: lo que su coach le ha dejado escrito para sus momentos y sus
// imágenes propias. Si su coach no le ha puesto nada, nada de esto pinta nada: ve lo de siempre.
//   · FraseAMedida: la frase del momento (rota sin repetirse; la misma mientras dura su momento), como una cita de su
//     coach y, si ese momento tiene imagen propia, con ella.
//   · FraseDeHoy: el saludo de Hoy (o día de pierna, semana completa o, de vez en cuando, «varias»).
//   · AvisoRitmoPeso: el aviso de ritmo de peso, con la tendencia de varias semanas y los márgenes que puso su coach.
//   · useImagenPropia: su imagen de un hueco (perfil y carné, empezar antes, récord), o null.
//   · useGamberrada: la frase de cuando se pasa de lo pautado, una vez por sesión.
import { useEffect, useMemo, useRef } from 'preact/hooks';
import { useApp, useCarga, Avatar, Icono } from '../comunes.jsx';
import { LOBO } from '../marca-lobo.js';
import { leerPreferencia, guardarPreferencia } from '../preferencias.js';
import { frasesDe, elegirFrase, tocaVarias, esDiaDePierna, avisoRitmoPeso, gamberrada, leerPropio } from '../../logica/a-medida.js';
import { hoyISO } from '../../logica/fechas.js';
import { planVigente } from '../../logica/nutricion.js';
import { conNutricion } from '../../logica/nivel.js';

const CLAVE = (atletaId) => `fbe-a-medida:${atletaId}`;

// La frase que toca en un momento (null si no tiene). Lo que ya ha visto se recuerda en este móvil.
export function useFraseAMedida(momento, { clave = null, ejercicio = '', activa = true } = {}) {
  const { atleta } = useApp();
  const frases = activa && momento ? frasesDe(atleta?.propio, momento, { ejercicio }) : [];
  const firma = frases.join('\n');
  // (las de un ejercicio se recuerdan por su texto, para que cada ejercicio lleve su cuenta)
  const nombre = momento === 'ejercicio' ? `ejercicio:${firma.length}:${frases[0] || ''}` : momento;
  const eleccion = useMemo(() => {
    if (!frases.length || !atleta?.id) return null;
    return elegirFrase(frases, leerPreferencia(CLAVE(atleta.id), null), { momento: nombre, clave });
  }, [atleta?.id, nombre, clave, firma]);
  useEffect(() => { if (eleccion && atleta?.id) guardarPreferencia(CLAVE(atleta.id), eleccion.estado); }, [eleccion]);
  return eleccion?.frase || null;
}

// La imagen propia de un hueco (data URL) o null
export function useImagenPropia(hueco, activa = true) {
  const { api, atleta } = useApp();
  const img = useCarga(() => (activa && hueco && atleta?.id && api.imagenPropia ? api.imagenPropia(atleta.id, hueco).catch(() => null) : Promise.resolve(null)), [atleta?.id, hueco, activa],
    { recuerdo: activa && hueco && atleta?.id ? `a-medida-img:${atleta.id}:${hueco}` : null });
  return img.datos || null;
}

function Cita({ frase, imagen = null, clase = '', momento }) {
  const { api, propio } = useApp();
  const foto = useCarga(() => (propio ? Promise.resolve(null) : api.fotoCoach().catch(() => null)), []);
  return (
    <figure class={`cita-coach mensaje-coach a-medida ${imagen ? 'con-imagen' : ''} ${clase}`} data-momento={momento}>
      {imagen && <img class="a-medida-img" src={imagen} alt="" decoding="async" />}
      {foto.datos ? <Avatar nombre="Tu coach" foto={foto.datos} /> : <img class="avatar-coach" src={LOBO} alt="" width="44" height="44" aria-hidden="true" />}
      <div>
        <blockquote>{frase}</blockquote>
        <figcaption>Tu coach</figcaption>
      </div>
    </figure>
  );
}

// La frase de un momento (y su imagen, si ese momento tiene hueco). Sin frase no sale nada (tampoco la imagen sola,
// salvo `imagenSola`: en el récord, la imagen acompaña aunque no haya frase).
export function FraseAMedida({ momento, clave = null, ejercicio = '', hueco = null, clase = '', activa = true, imagenSola = false }) {
  const frase = useFraseAMedida(momento, { clave, ejercicio, activa });
  const imagen = useImagenPropia(hueco, activa && !!hueco && (!!frase || imagenSola));
  if (!activa) return null;
  if (!frase) return imagen && imagenSola ? <img class={`a-medida-img a-medida-sola ${clase}`} src={imagen} alt="" decoding="async" data-momento={momento} /> : null;
  return <Cita frase={frase} imagen={imagen} clase={clase} momento={momento} />;
}

// En Hoy, arriba: según cómo va el día. Semana completa → su frase; el día que toca pierna → la de pierna; si no, el
// saludo (o, uno de cada cuatro días, una de «varias»). Una al día.
export function FraseDeHoy({ estado, sesion = null, ejercicios = [], semanaId = null }) {
  const { atleta } = useApp();
  const hoy = hoyISO();
  const p = leerPropio(atleta?.propio);
  if (!p) return null;
  const pierna = estado === 'entreno' && !!p.frases.pierna?.length && esDiaDePierna(sesion, ejercicios);
  const momento = estado === 'semana' && p.frases.semana?.length ? 'semana' : pierna ? 'pierna' : tocaVarias(hoy, p) ? 'varias' : 'saludo';
  return <FraseAMedida key={momento} momento={momento} clave={momento === 'semana' ? `semana:${semanaId || hoy}` : hoy} clase="a-medida-hoy" />;
}

// El aviso de ritmo de peso: solo si su coach le ha puesto márgenes, ha dado su consentimiento de datos de salud y su
// tendencia de varias semanas se sale. Con la frase de su coach para ese caso, si la tiene.
export function AvisoRitmoPeso({ salud }) {
  const { api, atleta } = useApp();
  const margenes = leerPropio(atleta?.propio)?.peso || null;
  const activo = !!salud && !!margenes;
  const nutri = conNutricion(atleta);
  // (las mismas consultas y el mismo recuerdo que «Tu peso» en Hoy: no se pide nada dos veces)
  const pesos = useCarga(() => (activo ? api.pesos(atleta.id, 60).catch(() => []) : Promise.resolve([])), [atleta.id, activo], { recuerdo: activo ? `pesos-hoy:${atleta.id}` : null });
  const planes = useCarga(() => (activo && nutri ? api.planesNutricion(atleta.id).catch(() => []) : Promise.resolve([])), [atleta.id, activo && nutri], { recuerdo: activo ? `planes-hoy:${atleta.id}:${nutri}` : null });
  const hoy = hoyISO();
  const a = activo && pesos.datos && planes.datos ? avisoRitmoPeso(pesos.datos, atleta.propio, { fase: planVigente(planes.datos, hoy)?.fase || null, hoy }) : null;
  // (la misma frase mientras dure el aviso esa semana)
  const frase = useFraseAMedida(a ? `peso_${a.tipo}` : null, { clave: a ? `${a.tipo}:${hoy.slice(0, 8)}${Math.ceil(Number(hoy.slice(8)) / 7)}` : null, activa: !!a });
  if (!a) return null;
  return (
    <section class="panel panel-pad a-medida-peso" data-tipo={a.tipo} aria-labelledby="a-medida-peso-t">
      <span class="a-medida-peso-ico" aria-hidden="true"><Icono n="bascula" /></span>
      <div class="pila-xs">
        <strong id="a-medida-peso-t">{a.tipo === 'baja' ? 'Bajas más rápido de la cuenta' : 'Subes más rápido de la cuenta'}</strong>
        {frase && <p class="a-medida-peso-frase">{frase}</p>}
        <span class="mini secundario">{a.texto}</span>
        <span class="mini terciario">Sale de la tendencia de tus últimas semanas, no de una pesada. Tu plan no cambia solo: lo decide tu coach.</span>
      </div>
    </section>
  );
}

// Al apuntar una serie: ¿se ha pasado de lo pautado? Devuelve la frase de su coach para eso (o null). Como mucho una
// vez por sesión, para no cansar.
export function useGamberrada(sesionId) {
  const { atleta } = useApp();
  const dicha = useRef(null);
  return ({ pauta, numero, rpe }) => {
    if (dicha.current === sesionId || !atleta?.id) return null;
    const frases = frasesDe(atleta.propio, 'gamberrada');
    if (!frases.length || !gamberrada({ pauta, numero, rpe })) return null;
    const { frase, estado } = elegirFrase(frases, leerPreferencia(CLAVE(atleta.id), null), { momento: 'gamberrada' });
    if (!frase) return null;
    guardarPreferencia(CLAVE(atleta.id), estado);
    dicha.current = sesionId;
    return frase;
  };
}
