// Datos raros (v0.210): la demo llevada al extremo, para la auditoría (node scripts/auditoria.mjs --raros).
// - Ana: dos años de historia (17 bloques más, todos hechos), un pesaje y un check-in por semana y un chat de 1.500
//   mensajes (palabras larguísimas, enlaces, emojis, saltos de línea).
// - Rubén: un nombre larguísimo con emojis.
// - Iván: sin programa ni nada apuntado.
// - El coach: 60 atletas (los de la demo y 53 más, con nombres largos, emojis y estados distintos); diez con programa.
// - Un ejercicio con un nombre larguísimo, y notas largas del coach y del atleta.
// Solo cambia la copia de la demo que se le da al navegador: no toca nada de la app.
import { randomUUID as uuid } from 'node:crypto';

const dia = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
function azar(semilla) {
  let a = semilla >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const redondear = (kg, paso = 2.5) => Math.round(kg / paso) * paso;

const TEXTOS_CHAT = [
  'Hecho 👍',
  'Hoy me ha costado muchísimo la última serie de sentadilla, creo que dormí poco. ¿Bajo un poco el peso el jueves o lo mantengo y vemos cómo sale? También noto la rodilla derecha un poco cargada al bajar escaleras, nada grave.',
  'Supercalifragilisticoespialidosoooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo',
  'Mira este vídeo: https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa&t=123s',
  'Lunes: bien\nMiércoles: regular\nViernes: genial 💪\n\nLa semana que viene viajo.',
  '🔥🔥🔥💪🏋️‍♀️🥇',
  '¿?',
  'Perfecto. Mantén el peso y céntrate en que la barra baje controlada: tres segundos abajo, una pausa breve y sube fuerte. Si la rodilla molesta más de un 3 sobre 10, cambia la sentadilla por prensa esa semana y me lo cuentas.',
  'OK',
  'Te mando la foto del menú de esta semana para que la mires cuando puedas, que no sé si voy bien de proteína en las cenas (sobre todo los días que llego tarde del trabajo y ceno lo primero que pillo).',
];
const NOMBRES = ['Lucas', 'Martina', 'Hugo', 'Sofía', 'Mateo', 'Valeria', 'Leo', 'Daniela', 'Álvaro', 'Paula', 'Manuel', 'Carmen', 'Pablo', 'Irene',
  'Javier', 'Noa', 'Adrián', 'Elena', 'Diego', 'Alba', 'Mario', 'Claudia', 'Jorge', 'Laura', 'Nicolás', 'Sara', 'Gonzalo', 'Nerea', 'Íñigo', 'Ainhoa',
  'Xabier', 'Begoña', 'Jesús', 'Rocío', 'Fermín', 'Maite', 'Óscar', 'Pilar', 'Ramón', 'Inés', 'Tomás', 'Lourdes', 'Héctor', 'Amaia', 'Raúl', 'Rosa',
  'Sebastián', 'Montserrat', 'Bartolomé', 'Encarnación', 'Maximiliano', 'Inmaculada', 'Ángel'];
const APELLIDOS = ['García', 'Fernández de Córdoba y Arrieta', 'López', 'Martínez-Villaseñor', 'Sánchez', 'Pérez', 'Gómez del Castillo', 'Ruiz',
  'Díaz', 'Moreno', 'Muñoz', 'Álvarez de Toledo', 'Romero', 'Alonso', 'Gutiérrez', 'Navarro', 'Torres', 'Domínguez', 'Vázquez', 'Ramos'];

export function rarificar(db, { hoy, ahora = new Date().toISOString() } = {}) {
  const r = azar(20261123);
  const tabla = (t) => (db[t] ||= []);
  const porEmail = (e) => db.atletas.find((a) => a.email === e);
  const ana = porEmail('ana@fbe.demo'), ruben = porEmail('ruben@fbe.demo'), ivan = porEmail('ivan@fbe.demo');
  const cuenta = {};

  // Ana: dos años de historia. Su bloque de ahora, copiado hacia atrás 17 veces, con todo hecho y revisado
  const bloque = db.bloques.find((b) => b.atleta_id === ana.id && b.estado === 'activo');
  const semanas = db.semanas.filter((s) => s.bloque_id === bloque.id).sort((a, b) => a.numero - b.numero);
  const N = 17;
  const NOMBRES_BLOQUE = ['Fuerza base', 'Hipertrofia', 'Fuerza máxima', 'Técnica y volumen', 'Recomposición'];
  bloque.numero = N + 1;
  let nSeries = 0;
  for (let k = 1; k <= N; k++) {
    const corre = -7 * semanas.length * k;
    const factor = Math.max(0.55, 1 - 0.025 * k);
    const nb = { ...bloque, id: uuid(), numero: N + 1 - k, nombre: NOMBRES_BLOQUE[k % NOMBRES_BLOQUE.length], estado: 'finalizado',
      fecha_inicio: dia(bloque.fecha_inicio, corre), fecha_fin: dia(bloque.fecha_fin, corre), creado_en: `${dia(bloque.fecha_inicio, corre - 3)}T10:00:00.000Z` };
    db.bloques.push(nb);
    for (const s of semanas) {
      const ns = { ...s, id: uuid(), bloque_id: nb.id, fecha_inicio: dia(s.fecha_inicio, corre), programacion: 'programada' };
      db.semanas.push(ns);
      const sesiones = db.sesiones.filter((x) => x.semana_id === s.id).sort((a, b) => a.orden - b.orden);
      sesiones.forEach((x, i) => {
        const fecha = dia(ns.fecha_inicio, x.tipo === 'cardio' ? 5 : [0, 2, 4, 5][i] ?? i);
        const nx = { ...x, id: uuid(), semana_id: ns.id, completada: true, fecha_realizada: fecha, revisada_en: ahora,
          rpe_sesion: 7 + Math.round(r() * 2), duracion_min: 50 + Math.round(r() * 25), nota_atleta: r() < 0.08 ? TEXTOS_CHAT[1] : null,
          preparacion: { sueno: 1 + Math.floor(r() * 3), energia: 1 + Math.floor(r() * 3), molestias: 2 + Math.floor(r() * 2) } };
        if (x.tipo === 'cardio' && x.cardio) {
          const minutos = (x.cardio.minutos || 30) + Math.round(r() * 6) - 3;
          nx.cardio_hecho = { modalidad: x.cardio.modalidad, minutos, km: Math.round((minutos / 6.5) * 10) / 10 };
        }
        db.sesiones.push(nx);
        let minuto = 0;
        for (const p of db.sesion_ejercicios.filter((y) => y.sesion_id === x.id)) {
          const np = { ...p, id: uuid(), sesion_id: nx.id, carga_sugerida_kg: p.carga_sugerida_kg == null ? null : redondear(p.carga_sugerida_kg * factor) };
          db.sesion_ejercicios.push(np);
          if (x.tipo === 'cardio') continue;
          for (let n = 1; n <= (p.series || 0); n++) {
            minuto += Math.round((p.descanso_seg || 90) / 60) + 1;
            const t = new Date(`${fecha}T18:00:00Z`); t.setUTCMinutes(t.getUTCMinutes() + minuto);
            db.series.push({ id: uuid(), sesion_ejercicio_id: np.id, atleta_id: ana.id, numero: n, kg: np.carga_sugerida_kg,
              reps: Math.max(1, (p.reps_max || 8) - (n === p.series && r() < 0.4 ? 1 : 0)),
              rpe: Math.min(10, (p.rpe_objetivo ?? 10 - (p.rir_objetivo ?? 2)) + (n === p.series ? 0.5 : 0)),
              rir: null, nota: null, sustituto_id: null, registrada_en: t.toISOString() });
            nSeries++;
          }
        }
      });
    }
  }
  cuenta.bloques_ana = N + 1;
  cuenta.series_ana = nSeries;

  // Un pesaje y un check-in por semana, dos años hacia atrás desde lo más antiguo que ya tenía
  const pesos = db.pesos.filter((p) => p.atleta_id === ana.id).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const checkins = db.checkins.filter((c) => c.atleta_id === ana.id).sort((a, b) => a.semana_inicio.localeCompare(b.semana_inicio));
  const primero = pesos[0]?.fecha || hoy;
  for (let w = 1; w <= 96; w++) db.pesos.push({ id: uuid(), atleta_id: ana.id, fecha: dia(primero, -7 * w), kg: Math.round((63 + w * 0.07 + (r() - 0.5) * 0.8) * 10) / 10, notas: null });
  const c0 = checkins[0];
  if (c0) for (let w = 1; w <= 96; w++) {
    db.checkins.push({ ...c0, id: uuid(), semana_inicio: dia(c0.semana_inicio, -7 * w), energia: 2 + Math.floor(r() * 4), recuperacion: 2 + Math.floor(r() * 4),
      motivacion: 2 + Math.floor(r() * 4), pasos_media: 5000 + Math.round(r() * 6000), notas: w % 9 === 0 ? TEXTOS_CHAT[9] : null, creado_en: `${dia(c0.semana_inicio, -7 * w + 6)}T20:00:00.000Z` });
  }

  // Un chat de 1.500 mensajes en dos años, que acaba antes de lo que ya trae la demo
  const fin = new Date(`${dia(hoy, -3)}T09:00:00Z`).getTime();
  const paso = (730 * 864e5) / 1500;
  for (let i = 0; i < 1500; i++) {
    const t = new Date(fin - (1500 - i) * paso).toISOString();
    tabla('comentarios').push({ id: uuid(), atleta_id: ana.id, sesion_id: null, checkin_id: null, archivo_id: null,
      autor: i % 3 === 1 ? 'coach' : 'atleta', texto: TEXTOS_CHAT[(i * 7) % TEXTOS_CHAT.length], creado_en: t, leido_en: t });
  }
  cuenta.chat_ana = db.comentarios.filter((c) => c.atleta_id === ana.id).length;

  // Rubén, con un nombre larguísimo
  ruben.nombre = 'Rubén Alejandro Martín-Fernández de la Vega y Sotomayor del Real 🏋️‍♂️💪🔥';
  const pr = db.perfiles.find((p) => p.id === ruben.perfil_id);
  if (pr) pr.nombre = 'Rubén Alejandro 🏋️‍♂️';

  // Iván, sin programa ni nada apuntado
  const bloquesIvan = new Set(db.bloques.filter((b) => b.atleta_id === ivan.id).map((b) => b.id));
  const semanasIvan = new Set(db.semanas.filter((s) => bloquesIvan.has(s.bloque_id)).map((s) => s.id));
  const sesionesIvan = new Set(db.sesiones.filter((s) => semanasIvan.has(s.semana_id)).map((s) => s.id));
  db.sesion_ejercicios = db.sesion_ejercicios.filter((p) => !sesionesIvan.has(p.sesion_id));
  db.sesiones = db.sesiones.filter((s) => !sesionesIvan.has(s.id));
  db.semanas = db.semanas.filter((s) => !semanasIvan.has(s.id));
  for (const [t, filas] of Object.entries(db)) {
    if (!Array.isArray(filas) || t === 'atletas') continue;
    db[t] = filas.filter((f) => !(f && f.atleta_id === ivan.id));
  }

  // Un ejercicio de Ana con un nombre larguísimo y notas largas
  const semanaHoy = semanas.find((s) => s.fecha_inicio <= hoy && dia(s.fecha_inicio, 6) >= hoy) || semanas[0];
  const sesionHoy = db.sesiones.filter((s) => s.semana_id === semanaHoy.id && s.tipo !== 'cardio').sort((a, b) => a.orden - b.orden)[0];
  const pautaHoy = db.sesion_ejercicios.filter((p) => p.sesion_id === sesionHoy?.id).sort((a, b) => a.orden - b.orden)[0];
  if (pautaHoy) {
    const e = db.ejercicios.find((x) => x.id === pautaHoy.ejercicio_id);
    if (e) e.nombre = 'Sentadilla búlgara con mancuernas y pausa isométrica de tres segundos en el punto más bajo (pie trasero en banco alto)';
    pautaHoy.notas_coach = 'Baja en tres segundos, pausa abajo sin rebotar y sube fuerte. Si la rodilla molesta más de un 3 sobre 10, cambia a prensa a una pierna y me lo cuentas en el chat. Larguísimopalabrasinespaciosquenodeberíasalirsedelapantallanuncajamás.';
  }
  semanaHoy.nota_coach = 'Esta semana subimos un poco la carga en los básicos. Si algún día vas muy cansada, quita una serie de cada ejercicio de la segunda mitad de la sesión y apunta en la nota cómo te has encontrado. 💪🏋️‍♀️ Y recuerda: https://fuerzabasadaenevidencia.com/guia-dos-dias/index.html?utm_source=app&utm_medium=nota&utm_campaign=larguisima';

  // El coach con 60 atletas: 53 más, con nombres largos, emojis y estados distintos; diez con su programa de esta semana
  const plantilla = ruben;
  const bloqueR = db.bloques.find((b) => b.atleta_id === ruben.id && b.estado === 'activo');
  const semanasR = bloqueR ? db.semanas.filter((s) => s.bloque_id === bloqueR.id) : [];
  const extra = 60 - db.atletas.length;
  for (let i = 0; i < extra; i++) {
    const nombre = `${NOMBRES[i % NOMBRES.length]} ${APELLIDOS[(i * 3) % APELLIDOS.length]}${i % 11 === 4 ? ' 🏃‍♀️' : ''}${i % 17 === 8 ? ` ${APELLIDOS[(i + 5) % APELLIDOS.length]}` : ''}`;
    const email = `raro${i + 1}@fbe.demo`;
    const perfil = uuid();
    tabla('auth_users').push({ id: perfil, email, password: 'demo' });
    db.perfiles.push({ id: perfil, rol: 'atleta', nombre: nombre.split(' ')[0], creado_en: ahora });
    const estado = i % 13 === 5 ? 'baja' : i % 9 === 7 ? 'invitado' : 'activo';
    const a = { ...plantilla, id: uuid(), perfil_id: perfil, nombre, email, estado, fecha_alta: dia(hoy, -Math.round(r() * 700)), creado_en: ahora,
      objetivo: i % 5 === 2 ? 'Volver a entrenar después de la operación de rodilla, ganar fuerza en la pierna operada y poder jugar al pádel con mis amigos los domingos sin dolor' : 'Ganar fuerza',
      propio: null, volumen_objetivo: null };
    db.atletas.push(a);
    for (const tipo of ['privacidad', 'datos_salud']) tabla('consentimientos').push({ id: uuid(), perfil_id: perfil, tipo, version: '2026-10', aceptado_en: ahora, revocado_en: null });
    if (i < 10 && bloqueR && estado === 'activo') {
      const nb = { ...bloqueR, id: uuid(), atleta_id: a.id, creado_en: ahora };
      db.bloques.push(nb);
      for (const s of semanasR) {
        const ns = { ...s, id: uuid(), bloque_id: nb.id };
        db.semanas.push(ns);
        for (const x of db.sesiones.filter((y) => y.semana_id === s.id)) {
          const nx = { ...x, id: uuid(), semana_id: ns.id, completada: false, fecha_realizada: null, revisada_en: null, rpe_sesion: null, duracion_min: null, nota_atleta: null };
          db.sesiones.push(nx);
          for (const p of db.sesion_ejercicios.filter((y) => y.sesion_id === x.id)) db.sesion_ejercicios.push({ ...p, id: uuid(), sesion_id: nx.id });
        }
      }
      for (let w = 0; w < 6; w++) db.pesos.push({ id: uuid(), atleta_id: a.id, fecha: dia(hoy, -7 * w), kg: 70 + i + Math.round(r() * 10) / 10, notas: null });
    }
  }
  cuenta.atletas = db.atletas.length;
  return cuenta;
}
