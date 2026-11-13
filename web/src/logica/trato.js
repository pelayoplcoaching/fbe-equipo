// (personalización 2, tanda 1) Cómo le hablamos a cada atleta: su nombre (o su apodo) en los momentos que cuentan, su
// género gramatical (si lo ha elegido: nunca se deduce del nombre), su tono (cercano, directo o a tope), el saludo de su
// hora y de su día y qué celebrar y cómo. Lógica pura: los textos salen de aquí.
import { nombreDePila } from './bienvenida.js';

export const GENEROS = [['f', 'En femenino'], ['m', 'En masculino'], ['n', 'Sin marcar']];
export const TONOS = [['cercano', 'Cercano', 'Como hasta ahora: amable y con ánimo'], ['directo', 'Directo', 'Sin adornos: lo que toca y los datos'], ['tope', 'A tope', 'Más energía y más celebración']];
export const generoValido = (g) => (['f', 'm', 'n'].includes(g) ? g : 'n');
export const tonoValido = (t) => (['cercano', 'directo', 'tope'].includes(t) ? t : 'cercano');

// El trato de un atleta: { nombre (apodo o nombre de pila), genero, tono }
export function tratoDe(personal = null, nombre = '') {
  return { nombre: String(personal?.apodo || '').trim() || nombreDePila(nombre), genero: generoValido(personal?.genero), tono: tonoValido(personal?.tono) };
}
// La palabra según su género: g(t, 'lista', 'listo', 'a punto'). Sin marcar, la tercera (una forma sin género)
export const g = (t, f, m, n) => (t?.genero === 'f' ? f : t?.genero === 'm' ? m : n);
// El texto según su tono: segunTono(t, { cercano, directo, tope }) (sin ese tono, el cercano)
export const segunTono = (t, textos) => (tonoValido(t?.tono) in textos ? textos[tonoValido(t?.tono)] : textos.cercano);
// «Ana, » delante (o nada sin nombre)
export const conNombre = (t, texto) => (t?.nombre ? `${t.nombre}, ${texto.charAt(0).toLocaleLowerCase('es')}${texto.slice(1)}` : texto);

// ---------- El saludo de su hora y de su día ----------
// hora: 0–23 del móvil; dow: 0 lunes … 6 domingo; costumbre: { franja } (perfil.js: manana, mediodia, tarde, noche)
export function saludoDeHora({ hora = 12, dow = 0, costumbre = null, primeraDeSemana = false } = {}, t = null) {
  const base = hora >= 5 && hora < 13 ? 'Buenos días' : hora >= 13 && hora < 21 ? 'Buenas tardes' : 'Buenas noches';
  const madruga = costumbre?.franja === 'manana' && hora >= 5 && hora < 9;
  const extra = madruga ? g(t, 'madrugadora', 'madrugador', null) : null;
  let detalle = null;
  if (primeraDeSemana) detalle = segunTono(t, { cercano: 'Primer entreno de la semana: a por ello.', directo: 'Primera sesión de la semana.', tope: '¡Primer entreno de la semana: a romperla!' });
  else if (dow === 5 || dow === 6) detalle = segunTono(t, { cercano: dow === 5 ? 'Sábado: buen día para entrenar con calma.' : 'Domingo: lo que hagas hoy suma doble.', directo: null, tope: dow === 5 ? '¡Sábado de entreno!' : '¡Domingo de entreno: eso es constancia!' });
  return { saludo: extra ? `${base}, ${extra}:` : `${base},`, detalle };
}

// ---------- Los momentos con su nombre ----------
// La portada de la sesión: «Ana, hoy toca»
export const antesDelTitulo = (t, { esHoy = true } = {}) => (t?.nombre ? `${t.nombre}, ${esHoy ? 'hoy toca' : 'te espera'}` : null);
// El récord, en el aviso: «¡Récord en press banca, Ana!»
export function avisoRecord(t, ejercicio) {
  const base = `¡Récord en ${ejercicio}`;
  return segunTono(t, { cercano: `${base}${t?.nombre ? `, ${t.nombre}` : ''}!`, directo: `Récord: ${ejercicio}.`, tope: `${base}${t?.nombre ? `, ${t.nombre}` : ''}! 🔥` });
}
// El titular del resumen de la sesión: { titulo, sub? }
export function titularResumen(t, { records = 0, completa = true } = {}) {
  const n = t?.nombre;
  if (records > 0) return segunTono(t, {
    cercano: { titulo: n ? `¡Qué sesión, ${n}!` : '¡Qué sesión!', sub: records === 1 ? 'Con récord incluido.' : `Con ${records} récords.` },
    directo: { titulo: 'Sesión hecha', sub: records === 1 ? '1 récord.' : `${records} récords.` },
    tope: { titulo: n ? `¡Brutal, ${n}!` : '¡Brutal!', sub: records === 1 ? `Récord incluido: ${g(t, 'estás imparable', 'estás imparable', 'sin freno')}.` : `${records} récords: ${g(t, 'imparable', 'imparable', 'sin freno')}.` },
  });
  if (!completa) return segunTono(t, { cercano: { titulo: n ? `Bien hecho, ${n}` : 'Bien hecho', sub: 'Lo que has hecho cuenta.' }, directo: { titulo: 'Sesión guardada', sub: null }, tope: { titulo: n ? `¡Eso suma, ${n}!` : '¡Eso suma!', sub: 'Cada serie cuenta.' } });
  return segunTono(t, {
    cercano: { titulo: n ? `Sesión redonda, ${n}` : 'Sesión redonda', sub: null },
    directo: { titulo: 'Sesión hecha', sub: null },
    tope: { titulo: n ? `¡Sesión hecha, ${n}!` : '¡Sesión hecha!', sub: `${g(t, 'Estás hecha una máquina', 'Estás hecho una máquina', 'Eso es ser una máquina')}.` },
  });
}
// La primera vez: «Bienvenida, Ana» / «Te damos la bienvenida»
export const bienvenidaPrimera = (t) => (t?.genero === 'f' ? '¡Bienvenida,' : t?.genero === 'm' ? '¡Bienvenido,' : 'Te damos la bienvenida,');
// Lo de la bienvenida del día, en su tono (el mensaje de siempre se queda; el tono cambia el remate)
export function rematePorTono(t, mensaje) {
  if (!mensaje) return mensaje;
  return segunTono(t, { cercano: mensaje, directo: mensaje.replace(/\s*\u00a1[^!]*!\s*$/, '').replace(/\u00a1|!/g, '').trim() || mensaje, tope: /[!.]$/.test(mensaje) ? `${mensaje.replace(/\.$/, '!')} 💪` : `${mensaje} 💪` });
}

// ---------- La voz del entrenador, con su nombre ----------
export const vozRecord = (t) => (t?.nombre ? `¡Récord, ${t.nombre}!` : '¡Récord!');
export const vozUltima = (t, voz) => `${t?.nombre ? `Última serie, ${t.nombre}. ` : 'Última serie. '}${voz || ''}`.trim();
export const vozFin = (t) => segunTono(t, { cercano: `Sesión hecha${t?.nombre ? `, ${t.nombre}` : ''}. Buen trabajo.`, directo: 'Sesión hecha.', tope: `¡Sesión hecha${t?.nombre ? `, ${t.nombre}` : ''}! ¡Enorme!` });

// ---------- Qué celebrar y cómo ----------
export const MOMENTOS_CELEBRAR = [['record', 'Récords'], ['racha', 'Hitos de racha'], ['semana', 'Semanas completas'], ['bloque', 'Bloques terminados'], ['otros', 'Lo demás (aniversarios, logros)']];
export const MODOS_CELEBRAR = [['todo', 'Con todo'], ['vibrar', 'Solo vibración'], ['nada', 'Nada']];
export function limpiarCelebrar(c) {
  const out = {};
  for (const [k] of MOMENTOS_CELEBRAR) out[k] = ['todo', 'vibrar', 'nada'].includes(c?.[k]) ? c[k] : 'todo';
  return out;
}
export const modoCelebrar = (ajustes, momento) => limpiarCelebrar(ajustes?.celebrar)[momento] || 'todo';
