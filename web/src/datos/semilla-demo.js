// Datos de la demo, relativos a la fecha de hoy para que siempre parezcan actuales.
// Atletas y cifras ficticios. Contraseña de todas las cuentas demo: "demo".
import { hoyISO, lunesDe, sumarDias, diasEntre, instanteMadrid, partesMadrid } from '../logica/fechas.js';
import { BIBLIOTECA_BASE } from './biblioteca-base.js';
import { FAQ } from './faq.js';
import { RESPUESTAS_EJEMPLO } from './respuestas.js';
import { sembrarComidas } from './semilla-comidas.js';
import { VERSION_NORMAS } from './normas-comunidad.js';
import { VERSION_LEGAL } from '../legal.js';

const uuid = () => crypto.randomUUID();

// PRNG con semilla para que la demo salga igual cada vez
function prng(semilla) {
  let s = semilla >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const redondear = (kg, paso = 2.5) => Math.round(kg / paso) * paso;

// Tempo de algunos ejercicios (el atleta lo tiene con metrónomo en la sesión)
const TEMPOS = { 'Peso muerto rumano con barra RDL': '3-1-1', 'Press inclinado con mancuernas': '3-0-1' };

// Programa de referencia (cargas para el atleta "1,0"; null = peso corporal)
const DIAS_TORSO_PIERNA = [
  {
    nombre: 'Torso A', intencion: 'rendimiento',
    dinamica: 'Movilidad general 5 min antes de empezar. Las dos primeras son las importantes: si vas justo de tiempo, recorta por abajo.',
    ej: [
      ['Press banca', 'alta', 3, 5, 6, 2, null, 80, 180, 'Pausa de 1 s en el pecho'],
      ['Remo con barra', 'alta', 3, 6, 8, 2, null, 70, 150],
      ['Press militar con barra', 'media', 3, 6, 8, 2, null, 50, 150],
      ['Jalón al pecho prono', 'media', 3, 8, 10, 2, null, 65, 120],
      ['Elevaciones laterales con mancuernas de pie', 'baja', 3, 12, 15, 1, null, 10, 60],
      ['Curl martillo con mancuernas', 'muy_baja', 2, 10, 12, 1, null, 16, 60],
    ],
  },
  {
    nombre: 'Pierna A', intencion: 'rendimiento',
    dinamica: 'Sentadilla con 3 series de aproximación (50 %, 70 %, 85 %). RPE 8: dejas unas 2 repeticiones en recámara.',
    ej: [
      ['Sentadilla barra alta', 'alta', 4, 5, 5, null, 8, 110, 180],
      ['Peso muerto rumano con barra RDL', 'alta', 3, 6, 8, 2, null, 100, 150, 'Barra pegada a las piernas'],
      ['Búlgara con mancuernas+apoyo', 'media', 3, 8, 10, 2, null, 24, 90],
      ['Leg curl tumbado', 'baja', 3, 10, 12, 1, null, 40, 90, null, 'A'],
      ['Gemelo en máquina de pie', 'baja', 3, 10, 15, 1, null, 60, 90, null, 'A'],
      ['Ab wheel', 'muy_baja', 3, 8, 12, 2, null, null, 60],
    ],
  },
  {
    nombre: 'Torso B', intencion: 'volumen',
    dinamica: 'Día de volumen: controla la bajada (2–3 s) y no persigas cargas. Descansos estrictos.',
    ej: [
      ['Press inclinado con mancuernas', 'alta', 3, 8, 10, 2, null, 30, 120],
      ['Dominadas pronas', 'alta', 3, 6, 8, 2, null, null, 150],
      ['Fondos en paralelas agarre ancho', 'media', 3, 8, 10, 2, null, null, 120],
      ['Remo gironda', 'media', 3, 10, 12, 2, null, 60, 90],
      ['Face pull', 'baja', 3, 12, 15, 1, null, 20, 75, null, 'A'],
      ['Extensiones desde polea alta con cuerda', 'muy_baja', 2, 12, 15, 1, null, 25, 75, null, 'A'],
    ],
  },
];

const DIAS_FULL_BODY = [
  {
    nombre: 'Full body A', intencion: 'rendimiento', dinamica: 'Calentamiento general de 5 min y series de aproximación en el primer ejercicio.',
    ej: [
      ['Sentadilla barra alta', 'alta', 3, 6, 8, 2, null, 100, 180],
      ['Press banca', 'alta', 3, 6, 8, 2, null, 75, 150],
      ['Remo con barra', 'media', 3, 8, 10, 2, null, 65, 120],
      ['Hip thrust', 'baja', 3, 10, 12, 2, null, 100, 90],
    ],
  },
  {
    nombre: 'Full body B', intencion: 'volumen', dinamica: 'Peso muerto con técnica limpia: si se redondea la espalda, baja la carga.',
    ej: [
      ['Peso muerto convencional', 'alta', 3, 5, 6, 2, null, 130, 180],
      ['Press militar con barra', 'alta', 3, 6, 8, 2, null, 50, 150],
      ['Jalón al pecho prono', 'media', 3, 8, 10, 2, null, 65, 120],
      ['Prensa (miscelánea)', 'baja', 3, 10, 12, 2, null, 160, 90],
    ],
  },
];

export function semillaDemo(hoy = hoyISO()) {
  const r = prng(20261024);
  const db = { auth_users: [], perfiles: [], atletas: [], invitaciones: [], consentimientos: [], ejercicios: [], bloques: [], semanas: [], sesiones: [], sesion_ejercicios: [], series: [], pesos: [], checkins: [], molestias: [], notas_coach: [], medidas: [], marcas: [], objetivos: [], archivos: [], comentarios: [], recursos: [], notas_ejercicio: [], respuestas_guardadas: [], avisos: [], habitos: [], registros_habito: [], planes_nutricion: [], registros_nutricion: [], preferencias_notificaciones: [], suscripciones_push: [], notificaciones: [], cuestionarios: [], preguntas_checkin: [], cobros_atletas: [], pagos: [] };
  const ahoraISO = new Date().toISOString();
  const lunesHoy = lunesDe(hoy);

  for (const e of BIBLIOTECA_BASE) {
    db.ejercicios.push({ id: uuid(), variante: null, video_url: null, instrucciones: null, errores: null, tipo: [], rango_reps: null, activo: true, creado_en: ahoraISO, ...e, alternativas: e.alternativas || [] });
  }
  const ej = Object.fromEntries(db.ejercicios.map((e) => [e.nombre, e]));
  // Las alternativas vienen por nombre: se pasan a ids, como en Supabase
  for (const e of db.ejercicios) e.alternativas = e.alternativas.map((n) => ej[n]?.id).filter(Boolean);

  const usuario = (email, nombre, rol) => {
    const id = uuid();
    db.auth_users.push({ id, email, password: 'demo' });
    db.perfiles.push({ id, rol, nombre, creado_en: ahoraISO });
    return id;
  };
  usuario('pelayo@fbe.demo', 'Pelayo', 'coach');

  // Crea sesiones + prescripción de una semana a partir de un programa de referencia
  function crearSemana(bloqueId, numero, fecha, dias, factor, programacion, progresionKg) {
    const semana = { id: uuid(), bloque_id: bloqueId, numero, foco: null, fecha_inicio: fecha, nota_coach: null, programacion };
    db.semanas.push(semana);
    dias.forEach((d, i) => {
      const sesion = { id: uuid(), semana_id: semana.id, orden: i + 1, nombre: d.nombre, tipo: 'fuerza', intencion: d.intencion, dinamica: d.dinamica, fecha_realizada: null, completada: false, nota_atleta: null, duracion_min: null, rpe_sesion: null, revisada_en: null };
      db.sesiones.push(sesion);
      d.ej.forEach(([nombre, prioridad, series, rmin, rmax, rir, rpe, carga, descanso, variante = null, superserie = null], k) => {
        const mancuerna = /mancuerna|b\u00falgara|martillo|laterales/i.test(nombre);
        const base = carga == null ? null : redondear(carga * factor, mancuerna ? 2 : 2.5);
        const prog = carga != null && prioridad === 'alta' && !mancuerna ? progresionKg * (numero - 1) : 0;
        db.sesion_ejercicios.push({
          id: uuid(), sesion_id: sesion.id, ejercicio_id: ej[nombre].id, orden: k + 1, superserie, prioridad, series,
          reps_min: rmin, reps_max: rmax, rir_objetivo: rir, rpe_objetivo: rpe,
          carga_sugerida_kg: base == null ? null : base + prog, descanso_seg: descanso, tempo: TEMPOS[nombre] || null, notas_coach: null, variante,
        });
      });
    });
    return semana;
  }

  // Registra una sesión como hecha, con series realistas cerca de lo pautado
  // revisada: de serie, lo de semanas anteriores ya está revisado (lo de esta semana, aunque se hiciera el domingo, no)
  function hacerSesion(sesion, atletaId, fecha, { cumplimiento = 1, revisada = fecha < lunesHoy } = {}) {
    const pautas = db.sesion_ejercicios.filter((p) => p.sesion_id === sesion.id).sort((a, b) => a.orden - b.orden);
    // Cómo llegó (sin tocar la secuencia aleatoria, para que el resto de la demo no cambie)
    const dia = Number(fecha.slice(8, 10));
    sesion.preparacion = { sueno: dia % 5 === 0 ? 1 : dia % 3 === 0 ? 2 : 3, energia: dia % 4 === 0 ? 2 : 3, molestias: dia % 7 === 0 ? 2 : 3 };
    let minuto = 0;
    pautas.forEach((p, idx) => {
      if (idx >= Math.ceil(pautas.length * cumplimiento)) return;
      for (let n = 1; n <= p.series; n++) {
        const reps = Math.max(1, p.reps_max - (r() < 0.45 ? 1 : 0) - (n === p.series && r() < 0.35 ? 1 : 0));
        const rpeBase = p.rpe_objetivo ?? 10 - (p.rir_objetivo ?? 2);
        const rpe = Math.min(10, Math.max(6, Math.round((rpeBase + (n - 1) * 0.4 + (r() - 0.5)) * 2) / 2));
        minuto += Math.round((p.descanso_seg || 90) / 60) + 1;
        const t = new Date(`${fecha}T18:00:00`);
        t.setMinutes(t.getMinutes() + minuto);
        db.series.push({
          id: uuid(), sesion_ejercicio_id: p.id, atleta_id: atletaId, numero: n,
          kg: p.carga_sugerida_kg, reps, rpe, rir: null, nota: null, sustituto_id: null, registrada_en: t.toISOString(),
        });
      }
    });
    Object.assign(sesion, {
      completada: true, fecha_realizada: fecha, rpe_sesion: Math.round(7 + r() * 2), duracion_min: Math.round(minuto + 10),
      revisada_en: revisada ? ahoraISO : null,
    });
  }

  // Un atleta con su bloque: semanas pasadas hechas, la actual a medias y el resto en programación
  function atletaConBloque({ nombre, email, objetivo, factor, peso0, tendencia, semanaActual, semanasBloque, programadasHasta,
    dias, hechasEstaSemana, diasSinEntrenar = 0, molestias = [], sinCheckinUltima = false, numeroBloque = 1, nombreBloque, foco, cardio = null }) {
    const perfil = usuario(email, nombre.split(' ')[0], 'atleta');
    const atleta = { id: uuid(), perfil_id: perfil, nombre, email, estado: 'activo', fecha_alta: sumarDias(lunesHoy, -7 * (semanaActual + 6)), objetivo, notion_url: null, progresion_auto: true, volumen_objetivo: null, creado_en: ahoraISO };
    db.atletas.push(atleta);
    for (const tipo of ['privacidad', 'datos_salud']) db.consentimientos.push({ id: uuid(), perfil_id: perfil, tipo, version: '2026-10', aceptado_en: ahoraISO, revocado_en: null });

    const inicio = sumarDias(lunesHoy, -7 * (semanaActual - 1));
    const bloque = { id: uuid(), atleta_id: atleta.id, es_plantilla: false, numero: numeroBloque, nombre: nombreBloque, foco, objetivo, descripcion: null, fecha_inicio: inicio, fecha_fin: sumarDias(inicio, 7 * semanasBloque - 1), estado: 'activo', creado_en: ahoraISO };
    db.bloques.push(bloque);

    const offsets = dias.length === 2 ? [0, 3] : [0, 2, 4];
    for (let w = 1; w <= semanasBloque; w++) {
      const fecha = sumarDias(inicio, 7 * (w - 1));
      const semana = crearSemana(bloque.id, w, fecha, dias, factor, w <= programadasHasta ? 'programada' : 'en_programacion', 2.5);
      semana.foco = w === semanasBloque ? 'descarga' : foco;
      // Una sesión de cardio por semana (v0.17): pautada por el coach; las de semanas pasadas, hechas con sus minutos y km
      if (cardio) {
        const minutosPauta = cardio.pauta.minutos + (w >= 5 ? 5 : 0);
        const sc = { id: uuid(), semana_id: semana.id, orden: dias.length + 1, nombre: cardio.nombre, tipo: 'cardio', intencion: null, dinamica: cardio.dinamica || null,
          cardio: { ...cardio.pauta, minutos: minutosPauta }, cardio_hecho: null, fecha_realizada: null, completada: false, nota_atleta: null, duracion_min: null, rpe_sesion: null, revisada_en: null };
        db.sesiones.push(sc);
        const f = sumarDias(fecha, 5);
        if (w < semanaActual && !(diasSinEntrenar && f > sumarDias(hoy, -diasSinEntrenar))) {
          const minutos = minutosPauta + [0, 2, -3, 4][w % 4];
          const km = Math.round((minutos / (6.4 - w * 0.08)) * 10) / 10;  // va mejorando el ritmo poco a poco
          Object.assign(sc, { completada: true, fecha_realizada: f, duracion_min: minutos, rpe_sesion: [5, 6, 5.5, 6][w % 4], cardio_hecho: { modalidad: cardio.pauta.modalidad, minutos, km }, revisada_en: ahoraISO });
        }
      }
      if (w === 1) semana.nota_coach = 'Primera semana: aprende los ejercicios y quédate siempre con 2 repeticiones en recámara.';
      if (w === semanaActual) semana.nota_coach = 'Si notas el hombro, cambia el press militar por press con mancuernas sentado.';
      const sesiones = db.sesiones.filter((s) => s.semana_id === semana.id && s.tipo !== 'cardio').sort((a, b) => a.orden - b.orden);
      if (w < semanaActual) {
        sesiones.forEach((s, i) => {
          const f = sumarDias(fecha, offsets[i]);
          if (diasSinEntrenar && f > sumarDias(hoy, -diasSinEntrenar)) return;
          hacerSesion(s, atleta.id, f, { cumplimiento: r() < 0.15 ? 0.7 : 1 });
        });
      } else if (w === semanaActual) {
        // Lo de esta semana ya hecho: en su día; si ese día aún no ha llegado (a principio de semana), en el más
        // reciente que quede, sin pasar de hoy, cada una en un día distinto y en su orden (de la última hacia atrás:
        // la última hecha sigue siendo la última). Antes se llevaba todo a hoy y, un lunes, el atleta tenía dos
        // sesiones hoy: la tercera ya no contaba en los retos (como mucho dos por día, como en la base) y lo que
        // pasaba en la demo dependía del día de la semana. Un día que ya ha llegado no cambia.
        const hechasW = sesiones.slice(0, hechasEstaSemana);
        const fechasW = [];
        let siguienteF = sumarDias(hoy, 1);
        for (let i = hechasW.length - 1; i >= 0; i--) {
          const prevista = sumarDias(fecha, offsets[i]), tope = sumarDias(siguienteF, -1);
          fechasW[i] = prevista < tope ? prevista : tope;
          siguienteF = fechasW[i];
        }
        hechasW.forEach((s, i) => hacerSesion(s, atleta.id, fechasW[i], { revisada: false }));
      }
    }

    // Peso semanal y check-ins de las semanas anteriores
    for (let k = 8; k >= 0; k--) {
      const lunes = sumarDias(lunesHoy, -7 * k);
      const kg = Math.round((peso0 + tendencia * (8 - k) + (r() - 0.5) * 0.6) * 10) / 10;
      db.pesos.push({ id: uuid(), atleta_id: atleta.id, fecha: k === 0 ? hoy : lunes, kg, notas: null });
      if (k >= 1 && !(sinCheckinUltima && k <= 2)) {
        db.checkins.push({
          id: uuid(), atleta_id: atleta.id, semana_inicio: lunes,
          horas_sueno: ['6-7', '7-8', '7-8', '6-7', '7-8'][Math.floor(r() * 5)],
          energia: 3 + Math.round(r() * 2), recuperacion: 3 + Math.round(r() * 2), motivacion: 3 + Math.round(r() * 2),
          fc_reposo: Math.round(54 + r() * 8), hrv: null,
          adherencia_desayuno: 4 + Math.round(r()), adherencia_comida: 3 + Math.round(r() * 2), adherencia_merienda: 3 + Math.round(r() * 2), adherencia_cena: 3 + Math.round(r() * 2),
          calorias_media: null, pasos_media: Math.round(7000 + r() * 4000), saciedad: 3, satisfaccion_dieta: 4, notas: null, creado_en: ahoraISO,
          revisado_en: k >= 2 ? ahoraISO : null,  // el de la semana pasada, pendiente de revisar
        });
      }
    }
    const ultimoCheckin = sumarDias(lunesHoy, -7);
    for (const [zona, intensidad] of molestias) db.molestias.push({ id: uuid(), atleta_id: atleta.id, semana_inicio: ultimoCheckin, zona, intensidad, notas: null });
    return atleta;
  }

  const ana = atletaConBloque({
    nombre: 'Ana López', email: 'ana@fbe.demo', objetivo: 'Ganar fuerza y bajar 3 kg sin perder músculo',
    factor: 0.5, peso0: 63.2, tendencia: -0.22, semanaActual: 4, semanasBloque: 6, programadasHasta: 4,
    dias: DIAS_TORSO_PIERNA, hechasEstaSemana: 2, molestias: [['hombros', 1]], numeroBloque: 2, nombreBloque: 'Fuerza base', foco: 'intensidad',
  });
  ana.volumen_objetivo = { espalda: [12, 22], gluteo: [6, 14] };
  // Ana se pesa casi a diario las últimas semanas (para la tendencia)
  {
    const inicio = sumarDias(lunesHoy, -56);
    const ya = new Set(db.pesos.filter((p) => p.atleta_id === ana.id).map((p) => p.fecha));
    for (let d = 27; d >= 1; d--) {
      const fecha = sumarDias(hoy, -d);
      if (ya.has(fecha) || r() < 0.2) continue;
      const semanas = (Date.parse(fecha) - Date.parse(inicio)) / (7 * 864e5);
      db.pesos.push({ id: uuid(), atleta_id: ana.id, fecha, kg: Math.round((63.2 - 0.22 * semanas + (r() - 0.5) * 0.9) * 10) / 10, notas: null });
    }
  }
  const ruben = atletaConBloque({
    nombre: 'Rubén Martín', email: 'ruben@fbe.demo', objetivo: 'Primer año de fuerza: técnica y constancia',
    factor: 0.95, peso0: 84.1, tendencia: -0.05, semanaActual: 3, semanasBloque: 4, programadasHasta: 3,
    dias: DIAS_TORSO_PIERNA, hechasEstaSemana: 2, molestias: [['zona_lumbar', 2]], nombreBloque: 'Adaptación', foco: 'adaptacion',
  });
  // Una variante con otro material, como las que venían de Notion (v0.30): la detectan Revisar y el editor
  {
    const pim = ej['Press inclinado con mancuernas']?.id;
    const bloquesR = new Set(db.bloques.filter((x) => x.atleta_id === ruben.id).map((x) => x.id));
    const semanasR = new Set(db.semanas.filter((w) => bloquesR.has(w.bloque_id)).map((w) => w.id));
    const sesionesR = new Set(db.sesiones.filter((x) => semanasR.has(x.semana_id)).map((x) => x.id));
    for (const p of db.sesion_ejercicios) if (p.ejercicio_id === pim && sesionesR.has(p.sesion_id)) p.variante = 'En máquina';
  }
  const carlos = atletaConBloque({
    nombre: 'Carlos Vera', email: 'carlos@fbe.demo', objetivo: 'Recomposición con 2 días por semana',
    factor: 0.85, peso0: 78.0, tendencia: 0.08, semanaActual: 5, semanasBloque: 8, programadasHasta: 6,
    dias: DIAS_FULL_BODY, hechasEstaSemana: 0, diasSinEntrenar: 13, sinCheckinUltima: true, nombreBloque: 'Recomposición', foco: 'volumen',
    cardio: { nombre: 'Rodaje suave', pauta: { modalidad: 'carrera', minutos: 30, esfuerzo: 5, nota: 'Llano y a ritmo de poder hablar. Si no te apetece correr, andar rápido vale.' } },
  });

  // v0.22: nivel y servicio. Rubén es novato (todo con kg) y Ana intermedia: desde esta semana, kg en los de
  // prioridad alta y RPE objetivo en el resto (sin carga: ve su peso anterior en cada serie). Carlos es avanzado
  // (todo a RPE) y solo le llevas el entrenamiento.
  ruben.nivel = 'novato';
  ana.nivel = 'intermedio';
  Object.assign(carlos, { nivel: 'avanzado', nutricion: false });
  const aRpe = (atleta, desdeLunes, soloNoPrincipales) => {
    const bloques = new Set(db.bloques.filter((x) => x.atleta_id === atleta.id).map((x) => x.id));
    const semanas = new Set(db.semanas.filter((w) => bloques.has(w.bloque_id) && w.fecha_inicio >= desdeLunes).map((w) => w.id));
    const sesiones = new Set(db.sesiones.filter((x) => semanas.has(x.semana_id)).map((x) => x.id));
    for (const p of db.sesion_ejercicios) {
      if (!sesiones.has(p.sesion_id) || (soloNoPrincipales && p.prioridad === 'alta')) continue;
      p.carga_sugerida_kg = null;
      if (p.rir_objetivo == null && p.rpe_objetivo == null) p.rpe_objetivo = p.prioridad === 'alta' ? 8 : 8.5;
    }
  };
  aRpe(ana, lunesHoy, true);
  aRpe(carlos, lunesHoy, false);

  // v0.24: cobros (solo los ve el coach). Ana paga por trimestres y está al día; Rubén, al mes, con este mes
  // pendiente; Carlos, al mes, con el anterior retrasado.
  const mesDe = (iso, n) => { const [a, m, d] = iso.split('-').map(Number); const t = a * 12 + m - 1 + n; const ult = new Date(Date.UTC(Math.floor(t / 12), (t % 12) + 1, 0)).getUTCDate(); return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}-${String(Math.min(d, ult)).padStart(2, '0')}`; };
  const cobro = (atleta, acuerdo, periodos) => {
    db.cobros_atletas.push({ atleta_id: atleta.id, nota: null, actualizado_en: ahoraISO, ...acuerdo });
    for (const [desde, estado, pagadoDias = 2, metodo = 'transferencia'] of periodos) {
      const meses = { mensual: 1, trimestral: 3 }[acuerdo.ciclo];
      db.pagos.push({ id: uuid(), atleta_id: atleta.id, periodo_desde: desde, periodo_hasta: sumarDias(mesDe(desde, meses), -1), importe: acuerdo.precio_mes * meses,
        estado, fecha_pago: estado === 'pagado' ? sumarDias(desde, pagadoDias) : null, metodo: estado === 'pagado' ? metodo : null, nota: null, creado_en: ahoraISO });
    }
  };
  const inicioMes = `${hoy.slice(0, 8)}01`;
  const altaAna = mesDe(sumarDias(hoy, -20), -6);
  cobro(ana, { servicio: 'Performance', precio_mes: 75, ciclo: 'trimestral', desde: altaAna }, [[altaAna, 'pagado'], [mesDe(altaAna, 3), 'pagado', 1], [mesDe(altaAna, 6), 'pagado', 0]]);
  cobro(ruben, { servicio: 'Essential', precio_mes: 49, ciclo: 'mensual', desde: mesDe(inicioMes, -3) }, [[mesDe(inicioMes, -3), 'pagado', 3, 'efectivo'], [mesDe(inicioMes, -2), 'pagado', 1, 'efectivo'], [mesDe(inicioMes, -1), 'pagado', 4, 'efectivo'], [inicioMes, 'pendiente']]);
  cobro(carlos, { servicio: 'Complete', precio_mes: 95, ciclo: 'mensual', desde: mesDe(inicioMes, -4), nota: 'Precio de antes de la subida' }, [[mesDe(inicioMes, -4), 'pagado'], [mesDe(inicioMes, -3), 'pagado'], [mesDe(inicioMes, -2), 'pagado'], [mesDe(inicioMes, -1), 'retrasado'], [inicioMes, 'pendiente']]);

  // Atleta invitada que aún no ha activado su cuenta (código para probar la activación)
  const marta = { id: uuid(), perfil_id: null, nombre: 'Marta Gil', email: 'marta@fbe.demo', estado: 'invitado', fecha_alta: hoy, objetivo: 'Volver a entrenar tras el embarazo', notion_url: null, creado_en: ahoraISO };
  db.atletas.push(marta);
  db.invitaciones.push({ id: uuid(), atleta_id: marta.id, codigo: 'FBE-MARTA-7K3PQ', caduca_en: new Date(Date.now() + 14 * 864e5).toISOString(), usada_en: null, creada_en: ahoraISO });

  // Plantillas
  for (const [nombre, dias, foco] of [['Torso-pierna 3 días', DIAS_TORSO_PIERNA, 'adaptacion'], ['Full body 2 días', DIAS_FULL_BODY, 'volumen']]) {
    const pl = { id: uuid(), atleta_id: null, es_plantilla: true, numero: null, nombre, foco, objetivo: null, descripcion: null, fecha_inicio: null, fecha_fin: null, estado: 'planificado', creado_en: ahoraISO };
    db.bloques.push(pl);
    for (let w = 1; w <= 4; w++) crearSemana(pl.id, w, null, dias, 1, 'no_iniciada', 2.5).foco = w === 4 ? 'descarga' : foco;
  }

  db.notas_coach.push({ id: uuid(), atleta_id: ana.id, texto: 'Molestia leve en hombro derecho con el press militar. Probar agarre neutro si sigue.', creado_en: ahoraISO });

  // Conversaciones en las últimas sesiones
  const ultimaSesion = (atletaId) => {
    const bloques = new Set(db.bloques.filter((b) => b.atleta_id === atletaId).map((b) => b.id));
    const semanas = new Set(db.semanas.filter((w) => bloques.has(w.bloque_id)).map((w) => w.id));
    return db.sesiones.filter((x) => semanas.has(x.semana_id) && x.completada).sort((x, y) => (x.fecha_realizada < y.fecha_realizada ? 1 : -1))[0];
  };
  const hace = (min) => new Date(Date.now() - min * 60000).toISOString();
  // Mensajes de Ana con su coach fuera de las sesiones (v0.17): la respuesta del coach sigue sin leer
  db.comentarios.push(
    { id: uuid(), atleta_id: ana.id, sesion_id: null, checkin_id: null, archivo_id: null, autor: 'atleta', texto: 'La semana que viene estoy de viaje de trabajo de martes a jueves, con un gimnasio de hotel pequeño (mancuernas hasta 20 kg y poleas). ¿Hago las dos sesiones que pueda y la tercera la cambio por algo con mancuernas?', creado_en: hace(1500), leido_en: hace(1400) },
    { id: uuid(), atleta_id: ana.id, sesion_id: null, checkin_id: null, archivo_id: null, autor: 'coach', texto: 'Perfecto. Haz Torso A y Pierna A como están, y para la tercera te dejo una versión con mancuernas en la semana. Si solo hay 20 kg, sube repeticiones hasta 15 y acércate más al fallo (RIR 1).', creado_en: hace(1380), leido_en: null },
  );
  // Una foto enviada en el chat (v0.18): el gimnasio del hotel
  const adjAna = uuid();
  db.archivos.push({ id: adjAna, atleta_id: ana.id, tipo: 'adjunto', ruta: `${ana.id}/ejemplo-foto-2.jpg`, fecha: hoy, sesion_ejercicio_id: null, ejercicio_id: null, nota_atleta: null,
    comentario_coach: null, mime: 'image/jpeg', bytes: 16500, revisado_en: hace(1370), creado_en: hace(1375), pose: null });
  db.comentarios.push({ id: uuid(), atleta_id: ana.id, sesion_id: null, checkin_id: null, archivo_id: adjAna, autor: 'atleta', texto: 'Este es el gimnasio del hotel, por si te sirve para la tercera.', creado_en: hace(1375), leido_en: hace(1370), adjunto: true });
  const sAna = ultimaSesion(ana.id);
  if (sAna) {
    sAna.nota_atleta = 'Buena sesión. La última serie de press me ha costado bastante.';
    db.comentarios.push(
      { id: uuid(), atleta_id: ana.id, sesion_id: sAna.id, checkin_id: null, archivo_id: null, autor: 'atleta', texto: '¿Bajo un poco el press la semana que viene o lo mantengo?', creado_en: hace(600), leido_en: hace(300) },
      { id: uuid(), atleta_id: ana.id, sesion_id: sAna.id, checkin_id: null, archivo_id: null, autor: 'coach', texto: 'Mantenlo. Si la última serie vuelve a salir a RPE 9,5 o más, quita 2,5 kg solo en esa.', creado_en: hace(290), leido_en: null },
    );
    sAna.revisada_en = hace(290);
    sAna.preparacion = { sueno: 1, energia: 2, molestias: 3 };
  }
  const sRuben = ultimaSesion(ruben.id);
  if (sRuben) {
    sRuben.preparacion = { sueno: 2, energia: 2, molestias: 1 };
    db.comentarios.push({ id: uuid(), atleta_id: ruben.id, sesion_id: sRuben.id, checkin_id: null, archivo_id: null, autor: 'atleta', texto: 'En el peso muerto rumano he notado la lumbar en la última serie. He bajado a 85 kg.', creado_en: hace(120), leido_en: null });
  }

  // Vídeos de técnica (la demo trae un clip esquemático): uno de Ana por revisar y uno de Rubén ya corregido
  const pautaReciente = (atletaId, nombre) => {
    const bloques = new Set(db.bloques.filter((b) => b.atleta_id === atletaId).map((b) => b.id));
    const semanas = new Set(db.semanas.filter((w) => bloques.has(w.bloque_id)).map((w) => w.id));
    const sesiones = db.sesiones.filter((x) => semanas.has(x.semana_id) && x.completada).sort((x, y) => (x.fecha_realizada < y.fecha_realizada ? 1 : -1));
    for (const x of sesiones) {
      const p = db.sesion_ejercicios.find((q) => q.sesion_id === x.id && q.ejercicio_id === ej[nombre]?.id);
      if (p) return { pauta: p, fecha: x.fecha_realizada };
    }
    return null;
  };
  const vidAna = pautaReciente(ana.id, 'Sentadilla barra alta');
  if (vidAna) {
    // v0.57: con su serie (la 2 de esa sentadilla: «kg × reps @RPE» encima del vídeo)
    const serieAna = db.series.some((x) => x.sesion_ejercicio_id === vidAna.pauta.id && x.numero === 2) ? 2 : null;
    const idAnaPend = uuid();
    db.archivos.push({ atleta_id: ana.id, tipo: 'video_tecnica', ruta: `${ana.id}/ejemplo-sentadilla.mp4`, fecha: vidAna.fecha,
      sesion_ejercicio_id: vidAna.pauta.id, ejercicio_id: ej['Sentadilla barra alta'].id, nota_atleta: '¿Llego a la profundidad buena? La última repetición me ha costado.',
      comentario_coach: null, mime: 'video/mp4', bytes: 21660, revisado_en: null, creado_en: hace(200), duracion_seg: 8,
      // v0.50: con su miniatura, como los que suben los atletas (la bandeja del coach la enseña)
      poster_ruta: `${ana.id}/ejemplo-sentadilla.mp4.jpg`, serie_numero: serieAna, repite_de: null, id: idAnaPend });
    // Y otros dos antiguos en su diario (v0.18): uno destacado
    const idAna28 = uuid(), idAna49 = uuid();
    db.archivos.push({ id: idAna28, atleta_id: ana.id, tipo: 'video_tecnica', ruta: `${ana.id}/ejemplo-sentadilla.mp4`, fecha: sumarDias(vidAna.fecha, -28),
      sesion_ejercicio_id: null, ejercicio_id: ej['Sentadilla barra alta'].id, nota_atleta: 'Mi mejor serie hasta ahora: 70 kg limpios.',
      comentario_coach: null, mime: 'video/mp4', bytes: 21660, revisado_en: hace(60 * 24 * 27), creado_en: hace(60 * 24 * 28), duracion_seg: 8, destacado: true });
    db.archivos.push({ id: idAna49, atleta_id: ana.id, tipo: 'video_tecnica', ruta: `${ana.id}/ejemplo-sentadilla.mp4`, fecha: sumarDias(vidAna.fecha, -49),
      sesion_ejercicio_id: null, ejercicio_id: ej['Press banca'].id, nota_atleta: null,
      comentario_coach: null, mime: 'video/mp4', bytes: 21660, revisado_en: hace(60 * 24 * 48), creado_en: hace(60 * 24 * 49), duracion_seg: 8 });
    // v0.57 (035): sus notas de técnica (para «Mi técnica»)
    (db.video_revisiones ||= []).push(
      { archivo_id: idAna28, atleta_id: ana.id, puntuacion: 4, checklist: { puntos: [{ t: 'Rodillas en la dirección de los pies (sin irse hacia dentro)', e: 'bien' }, { t: 'Profundidad que se mantiene con la espalda neutra', e: 'bien', s: 2 }] }, tempo: null,
        voz_archivo_id: null, voz_inicio: null, visto_el: sumarDias(vidAna.fecha, -27), corregido_en: hace(60 * 24 * 27), actualizado_en: hace(60 * 24 * 27) },
      { archivo_id: idAna49, atleta_id: ana.id, puntuacion: 3, checklist: null, tempo: null, voz_archivo_id: null, voz_inicio: null, visto_el: sumarDias(vidAna.fecha, -48), corregido_en: hace(60 * 24 * 48), actualizado_en: hace(60 * 24 * 48) });
    // v0.59 (037): lo que nota Ana del vídeo que espera revisión (su valoración al enviarlo)
    (db.video_autoevaluacion ||= []).push({ archivo_id: idAnaPend, atleta_id: ana.id, rpe: 8.5, nota: 'En la última repetición me cuesta mantener el pecho arriba.', molestia: false, zona: null,
      creado_en: hace(200), actualizado_en: hace(200) });
  }
  // v0.59 (037): el vídeo modelo del coach de la sentadilla (el clip de ejemplo, de lado)
  if (ej['Sentadilla barra alta']) {
    const sId = ej['Sentadilla barra alta'].id;
    (db.videos_modelo ||= []).push({ id: uuid(), ejercicio_id: sId, ruta: `modelos/${sId}/modelo-ejemplo-sentadilla.mp4`, poster_ruta: `modelos/${sId}/modelo-ejemplo-sentadilla.mp4.jpg`,
      duracion_seg: 3, mime: 'video/mp4', bytes: 21660, angulo: 'De lado', orden: 0, creado_en: hace(60 * 24 * 60) });
  }
  const vidRuben = pautaReciente(ruben.id, 'Sentadilla barra alta');
  if (vidRuben) {
    const id = uuid();
    db.archivos.push({ id, atleta_id: ruben.id, tipo: 'video_tecnica', ruta: `${ruben.id}/ejemplo-sentadilla.mp4`, fecha: vidRuben.fecha,
      sesion_ejercicio_id: vidRuben.pauta.id, ejercicio_id: ej['Sentadilla barra alta'].id, nota_atleta: 'Primera vez que me grabo.',
      comentario_coach: null, mime: 'video/mp4', bytes: 21660, revisado_en: hace(2000), creado_en: hace(2900), duracion_seg: 8 });
    db.comentarios.push({ id: uuid(), atleta_id: ruben.id, sesion_id: null, checkin_id: null, archivo_id: id, autor: 'coach',
      texto: 'Buena bajada, controlada. En 0:01,5 la cadera empieza a ir hacia atrás antes que las rodillas: piensa en «sentarte entre los talones». En 0:02 la profundidad es buena. Mira el vídeo a 0,25× y lo verás.',
      creado_en: hace(2000), leido_en: hace(1500),
      // v0.14: el ángulo de la cadera y la línea de la espalda, dibujados sobre el fotograma del 0:02
      dibujo: { t: 2, formas: [{ tipo: 'angulo', p: [[0.47, 0.66], [0.58, 0.49], [0.3, 0.73]] }, { tipo: 'linea', p: [[0.3, 0.73], [0.56, 0.9]] }] } });
    // Y uno de hace cinco semanas, para «Comparar dos»
    const idRuben35 = uuid();
    db.archivos.push({ id: idRuben35, atleta_id: ruben.id, tipo: 'video_tecnica', ruta: `${ruben.id}/ejemplo-sentadilla.mp4`, fecha: sumarDias(vidRuben.fecha, -35),
      sesion_ejercicio_id: null, ejercicio_id: ej['Sentadilla barra alta'].id, nota_atleta: 'Mi primera semana.',
      comentario_coach: null, mime: 'video/mp4', bytes: 21660, revisado_en: hace(60 * 24 * 34), creado_en: hace(60 * 24 * 35), duracion_seg: 8 });
    // v0.57 (035): la corrección del último (nota, puntos clave y tempo) y la nota del de hace cinco semanas
    (db.video_revisiones ||= []).push(
      { archivo_id: id, atleta_id: ruben.id, puntuacion: 3, tempo: { reps: [[0.4, 2.1, 3.0], [3.4, 5.0, 6.1]] }, voz_archivo_id: null, voz_inicio: null,
        checklist: { puntos: [{ t: 'Pie entero apoyado: talón, base del dedo gordo y del meñique', e: 'bien' }, { t: 'Cadera y pecho suben a la vez', e: 'mal', s: 1.5 }, { t: 'Profundidad que se mantiene con la espalda neutra', e: 'bien', s: 2 }] },
        visto_el: vidRuben.fecha, corregido_en: hace(2000), actualizado_en: hace(2000) },
      { archivo_id: idRuben35, atleta_id: ruben.id, puntuacion: 2, checklist: null, tempo: null, voz_archivo_id: null, voz_inicio: null, visto_el: sumarDias(vidRuben.fecha, -34), corregido_en: hace(60 * 24 * 34), actualizado_en: hace(60 * 24 * 34) });
    // La lista de puntos clave del coach para la sentadilla
    (db.tecnica_plantillas ||= []).push({ ejercicio_id: ej['Sentadilla barra alta'].id, actualizado_en: hace(60 * 24 * 40),
      puntos: ['Pie entero apoyado: talón, base del dedo gordo y del meñique', 'Rodillas en la dirección de los pies (sin irse hacia dentro)', 'Profundidad que se mantiene con la espalda neutra', 'Cadera y pecho suben a la vez', 'Aire y tronco firme antes de cada repetición'] });
  }
  // v0.58: un vídeo de Carlos para el análisis automático (experimental): un disco de 45 cm que hace 3 sentadillas a
  // velocidad conocida (lo genera scripts/video-barra-demo.mjs). Ya revisado: no espera en la bandeja del coach.
  if (ej['Sentadilla barra alta']) {
    db.archivos.push({ id: uuid(), atleta_id: carlos.id, tipo: 'video_tecnica', ruta: `${carlos.id}/ejemplo-barra.webm`, fecha: sumarDias(hoy, -14),
      sesion_ejercicio_id: null, ejercicio_id: ej['Sentadilla barra alta'].id, nota_atleta: 'Tres repeticiones con 80 kg: ¿cómo va la velocidad?',
      comentario_coach: null, mime: 'video/webm', bytes: 154584, revisado_en: hace(60 * 24 * 13), creado_en: hace(60 * 24 * 14), duracion_seg: 6, serie_numero: null, repite_de: null });
  }

  // Fotos de progreso de Ana (siluetas de ejemplo), el mismo día que sus medidas
  [[56, 1], [28, 2], [0, 3]].forEach(([dias, n]) => db.archivos.push({
    id: uuid(), atleta_id: ana.id, tipo: 'foto_progreso', ruta: `${ana.id}/ejemplo-foto-${n}.jpg`, fecha: sumarDias(hoy, -dias),
    sesion_ejercicio_id: null, ejercicio_id: null, nota_atleta: null, comentario_coach: null, mime: 'image/jpeg', bytes: 16500, revisado_en: hace(60 * 24 * dias + 30), creado_en: hace(60 * 24 * dias + 60),
    pose: 'frente',
  }));

  // v0.10 (con su propia secuencia aleatoria, para no cambiar el resto de la demo)
  const r2 = prng(7);
  const sesionesDe = (atletaId) => {
    const bloques = new Set(db.bloques.filter((b) => b.atleta_id === atletaId).map((b) => b.id));
    const semanas = db.semanas.filter((w) => bloques.has(w.bloque_id));
    return { semanas, sesiones: db.sesiones.filter((x) => semanas.some((w) => w.id === x.semana_id)) };
  };
  // Plan de la semana: lo hecho, el día que se hizo; Ana tiene lo que le queda para hoy y Rubén, para mañana
  // (si mañana aún es esta semana): así la demo enseña «Hoy toca» y «Hoy descansas»
  for (const [atleta, desde] of [[ana, 0], [ruben, 1]]) {
    const { semanas, sesiones } = sesionesDe(atleta.id);
    const w = semanas.find((x) => x.fecha_inicio === lunesHoy);
    if (!w) continue;
    let k = desde;
    sesiones.filter((x) => x.semana_id === w.id).sort((a, b) => a.orden - b.orden).forEach((x) => {
      x.dia_previsto = x.completada ? x.fecha_realizada : sumarDias(hoy, k++);
      if (x.dia_previsto < lunesHoy || x.dia_previsto > sumarDias(lunesHoy, 6)) x.dia_previsto = null;
    });
    // Serie top + back-off en el primer ejercicio de la sesión que le queda a Ana
    if (atleta === ana) {
      const pendiente = sesiones.filter((x) => x.semana_id === w.id && !x.completada).sort((a, b) => a.orden - b.orden)[0];
      const pauta = pendiente && db.sesion_ejercicios.filter((q) => q.sesion_id === pendiente.id).sort((a, b) => a.orden - b.orden)[0];
      if (pauta) pauta.backoff_pct = 10;
      // Y un final de intervalos (la app los lee y abre el temporizador ya configurado)
      if (pendiente) pendiente.dinamica = `${pendiente.dinamica || ''}\nPara acabar: EMOM 6 (8 flexiones y 10 swings con kettlebell).`.trim();
    }
  }
  // En las plantillas, la sentadilla de Pierna A va con serie top y back-off
  for (const pl of db.bloques.filter((b) => b.es_plantilla)) {
    const semanas = new Set(db.semanas.filter((w) => w.bloque_id === pl.id).map((w) => w.id));
    for (const x of db.sesiones.filter((y) => semanas.has(y.semana_id) && y.nombre === 'Pierna A')) {
      const q = db.sesion_ejercicios.find((z) => z.sesion_id === x.id && z.ejercicio_id === ej['Sentadilla barra alta']?.id);
      if (q) { q.backoff_pct = 10; q.reps_min = 4; q.reps_max = 6; }
    }
  }

  // Hábitos: Ana los lleva bien; Rubén se olvida de apuntar los pasos (el panel lo avisa)
  const habito = (atleta, h, semanas) => {
    const fila = { id: uuid(), atleta_id: atleta.id, objetivo: null, unidad: null, sentido: 'al_menos', dias_semana: 7, orden: db.habitos.filter((x) => x.atleta_id === atleta.id).length, activo: true,
      creado_en: `${sumarDias(lunesHoy, -7 * semanas)}T09:00:00.000Z`, ...h };
    db.habitos.push(fila);
    return fila;
  };
  const apuntar = (h, fecha, valor) => db.registros_habito.push({ id: uuid(), habito_id: h.id, atleta_id: h.atleta_id, fecha, valor, actualizado_en: ahoraISO });
  const pasosAna = habito(ana, { nombre: 'Pasos', tipo: 'numero', objetivo: 8000, unidad: 'pasos', icono: 'pasos', dias_semana: 6 }, 6);
  const protAna = habito(ana, { nombre: 'Proteína', tipo: 'numero', objetivo: 110, unidad: 'g', icono: 'proteina' }, 6);
  const suenoAna = habito(ana, { nombre: 'Horas de sueño', tipo: 'numero', objetivo: 7, unidad: 'h', icono: 'sueno' }, 4);
  const movAna = habito(ana, { nombre: '10 min de movilidad', tipo: 'si_no', icono: 'movilidad', dias_semana: 3 }, 4);
  for (let d = 42; d >= 0; d--) {
    const fecha = sumarDias(hoy, -d);
    if (d === 0) { apuntar(pasosAna, fecha, 5400); apuntar(suenoAna, fecha, 7.5); continue; }  // hoy, a medio día
    if (r2() < 0.9) apuntar(pasosAna, fecha, Math.round((7200 + r2() * 4800) / 100) * 100);
    if (r2() < 0.85) apuntar(protAna, fecha, Math.round((95 + r2() * 35) / 5) * 5);
    if (d <= 28 && r2() < 0.9) apuntar(suenoAna, fecha, Math.round((6 + r2() * 2.5) * 2) / 2);
    if (d <= 28 && [1, 3, 5].includes(new Date(`${fecha}T12:00:00`).getDay()) && r2() < 0.85) apuntar(movAna, fecha, 1);
  }
  const pasosRuben = habito(ruben, { nombre: 'Pasos', tipo: 'numero', objetivo: 10000, unidad: 'pasos', icono: 'pasos' }, 3);
  habito(ruben, { nombre: 'Agua', tipo: 'numero', objetivo: 2.5, unidad: 'l', icono: 'agua' }, 3);
  for (let d = 20; d >= 1; d--) if (r2() < 0.3) apuntar(pasosRuben, sumarDias(hoy, -d), Math.round((6000 + r2() * 5000) / 100) * 100);

  // Nutrición: Ana cuenta kcal y macros (con días de descanso más bajos) y lleva un ajuste hace dos semanas;
  // Rubén va «sin contar», con pautas, y apenas apunta (el panel lo avisa)
  const plan = (atleta, f) => { const x = { id: uuid(), atleta_id: atleta.id, ritmo_pct: null, kcal: null, proteina_g: null, carbos_g: null, grasa_g: null, fibra_g: null, kcal_descanso: null, carbos_descanso_g: null, grasa_descanso_g: null, pautas: null, motivo: null, creado_en: ahoraISO, ...f }; db.planes_nutricion.push(x); return x; };
  const pautasAna = 'Reparte la proteína en 3 o 4 tomas (unos 30–40 g cada una).\nVerdura en la comida y en la cena.\nLos días de entreno, la mayor parte de los hidratos antes y después de entrenar.\nApunta los totales de tu app al final del día; si se te olvida algo, márcalo como incompleto.';
  plan(ana, { desde: sumarDias(lunesHoy, -42), modo: 'macros', fase: 'perder', ritmo_pct: -0.5, kcal: 1995, proteina_g: 125, carbos_g: 250, grasa_g: 55, fibra_g: 25, kcal_descanso: 1795, carbos_descanso_g: 200, grasa_descanso_g: 55, pautas: pautasAna });
  const planAna = plan(ana, { desde: sumarDias(lunesHoy, -14), modo: 'macros', fase: 'perder', ritmo_pct: -0.5, kcal: 1895, proteina_g: 125, carbos_g: 225, grasa_g: 55, fibra_g: 25, kcal_descanso: 1695, carbos_descanso_g: 175, grasa_descanso_g: 55, pautas: pautasAna,
    motivo: 'Ajuste: dos semanas bajando más despacio de lo previsto. Quito 100 kcal, todas de hidratos.' });
  const bloquesAna = new Set(db.bloques.filter((x) => x.atleta_id === ana.id).map((x) => x.id));
  const semanasAna = new Set(db.semanas.filter((w) => bloquesAna.has(w.bloque_id)).map((w) => w.id));
  const entrenaAna = new Set(db.sesiones.filter((x) => semanasAna.has(x.semana_id) && x.completada && x.fecha_realizada).map((x) => x.fecha_realizada));
  for (let d = 42; d >= 1; d--) {
    const fecha = sumarDias(hoy, -d);
    if (r2() < 0.15) continue;  // algún día sin apuntar
    const pl = fecha >= planAna.desde ? planAna : db.planes_nutricion.find((x) => x.atleta_id === ana.id && x.desde < planAna.desde);
    const entreno = entrenaAna.has(fecha);
    const objetivo = entreno ? pl.kcal : pl.kcal_descanso;
    const kcal = Math.round((objetivo - 110 + (r2() - 0.5) * 300) / 5) * 5;  // come algo menos de lo previsto: la app propone ajustar cualquier día
    const prot = Math.round(pl.proteina_g * (0.88 + r2() * 0.24));
    const grasa = Math.round(pl.grasa_g * (0.85 + r2() * 0.35));
    db.registros_nutricion.push({ id: uuid(), atleta_id: ana.id, fecha, kcal, proteina_g: prot, grasa_g: grasa, carbos_g: Math.max(0, Math.round((kcal - 4 * prot - 9 * grasa) / 4)), fibra_g: Math.round(18 + r2() * 12),
      completo: r2() > 0.06, cumplido: null, nota: null, actualizado_en: ahoraISO });
  }
  // Hoy, a medio día (desayuno y comida)
  db.registros_nutricion.push({ id: uuid(), atleta_id: ana.id, fecha: hoy, kcal: 1120, proteina_g: 78, carbos_g: 128, grasa_g: 31, fibra_g: 14, completo: false, cumplido: null, nota: null, actualizado_en: ahoraISO });
  plan(ruben, { desde: sumarDias(lunesHoy, -21), modo: 'sin_contar', fase: 'perder', ritmo_pct: -0.5,
    pautas: 'Plato de comida y cena: la mitad verdura, un cuarto proteína (carne, pescado, huevos o legumbre) y un cuarto hidratos.\nDos o tres piezas de fruta al día.\nAgua como bebida habitual; el alcohol, solo el fin de semana y poco.\nSi un día comes fuera, elige un plato de proteína con verdura y sigue con normalidad.' });
  for (let d = 20; d >= 1; d--) if (r2() < 0.25) db.registros_nutricion.push({ id: uuid(), atleta_id: ruben.id, fecha: sumarDias(hoy, -d), kcal: null, proteina_g: null, carbos_g: null, grasa_g: null, fibra_g: null, completo: true, cumplido: r2() < 0.6 ? 2 : 1, nota: null, actualizado_en: ahoraISO });

  // v0.13: cuestionario inicial. Ana lo rellenó al empezar (revisado); Rubén lo ha actualizado hace dos días con
  // una medicación nueva (el panel avisa de que hay algo de salud por revisar); Carlos aún no lo tiene.
  const cuestionario = (atleta, f) => db.cuestionarios.push({ id: uuid(), atleta_id: atleta.id, objetivo_detalle: null, otros_deportes: null, enfermedad_detalle: null,
    medicacion_detalle: null, alergias: null, pedido_en: null, revisado_en: null, creado_en: f.completado_en, actualizado_en: f.completado_en, ...f, objetivos: f.objetivos || (f.objetivo ? [f.objetivo] : null) });
  const alta = (a) => `${a.fecha_alta}T19:30:00.000Z`;
  cuestionario(ana, { objetivo: 'fuerza', objetivos: ['fuerza', 'perder_grasa'], objetivo_detalle: 'Ganar fuerza y bajar unos 3 kg sin perder músculo. Me gustaría llegar a hacer una dominada.', experiencia: '1_3',
    dias_semana: 3, minutos_sesion: 75, lugar: 'gimnasio', material: ['barra', 'rack', 'banco', 'mancuernas', 'poleas', 'maquinas', 'dominadas', 'cardio'], otros_deportes: 'Pádel los domingos',
    activo: true, enfermedad: false, sintomas: [], otras: [], lesiones: [{ zona: 'hombro', limita: 1, nota: 'El derecho, con el press por encima de la cabeza' }],
    resultado: 'sin_valoracion', completado_en: alta(ana), revisado_en: `${sumarDias(ana.fecha_alta, 1)}T10:00:00.000Z` });
  cuestionario(ruben, { objetivo: 'salud', objetivo_detalle: 'Empezar a entrenar fuerza con buena técnica y bajar algo de peso.', experiencia: 'menos_1',
    dias_semana: 3, minutos_sesion: 60, lugar: 'gimnasio_basico', material: ['barra', 'banco', 'mancuernas', 'maquinas', 'poleas'],
    activo: true, enfermedad: false, sintomas: [], otras: ['medicacion'], medicacion_detalle: 'Enalapril 10 mg al día, para la tensión (desde hace un mes)',
    lesiones: [{ zona: 'zona_lumbar', limita: 1, nota: 'Lumbalgia hace dos años; a veces la noto al final del día' }],
    resultado: 'sin_valoracion', completado_en: hace(60 * 50), pedido_en: hace(60 * 70), creado_en: alta(ruben) });

  // Check-in a medida: una pregunta para todos desde hace 5 semanas; Rubén tiene dos suyas y no le pregunta ni
  // medidas ni datos de reloj
  const preguntaCk = (f, semanas) => { const x = { id: uuid(), atleta_id: null, unidad: null, ayuda: null, etiqueta_min: null, etiqueta_max: null, orden: 0, activa: true, creado_en: `${sumarDias(lunesHoy, -7 * semanas)}T09:00:00.000Z`, ...f }; db.preguntas_checkin.push(x); return x; };
  const estres = preguntaCk({ texto: 'Estrés en el trabajo o los estudios', tipo: 'escala', etiqueta_min: 'Nada', etiqueta_max: 'Muchísimo' }, 6);
  const dePie = preguntaCk({ atleta_id: ruben.id, texto: 'Horas de pie en el trabajo (media al día)', tipo: 'numero', unidad: 'h', orden: 1 }, 4);
  const lumbar = preguntaCk({ atleta_id: ruben.id, texto: '¿Qué tal la zona lumbar al entrenar?', tipo: 'texto', ayuda: 'En qué ejercicios la notas y cuánto', orden: 2 }, 4);
  ruben.checkin_apartados = ['peso', 'descanso', 'molestias', 'alimentacion'];
  const ESTRES_ANA = [3, 4, 4, 2, 3];
  const ESTRES_RUBEN = [2, 3, 2];
  for (const ck of db.checkins) {
    const k = Math.round((Date.parse(lunesHoy) - Date.parse(ck.semana_inicio)) / (7 * 864e5));
    if (ck.atleta_id === ana.id && k >= 1 && k <= 5) ck.respuestas = { [estres.id]: ESTRES_ANA[k - 1] };
    if (ck.atleta_id === ruben.id && k >= 1 && k <= 3) {
      ck.respuestas = { [estres.id]: ESTRES_RUBEN[k - 1], [dePie.id]: [7.5, 8, 6.5][k - 1] };
      if (k === 1) ck.respuestas[lumbar.id] = 'Mejor que la semana pasada. Solo la noto en el peso muerto rumano, en la última serie.';
    }
  }

  // Un aviso para todos (fijado en Hoy hasta su fecha)
  db.avisos.push({ id: uuid(), texto: 'Del 3 al 9 de noviembre estoy en un congreso: esos días os respondo por la tarde. Las sesiones, como siempre.', atleta_id: null, desde: hoy, hasta: sumarDias(hoy, 16), creado_en: ahoraISO });

  // Medidas mensuales, marcas y objetivos de Ana
  [[56, 74.5, 97], [28, 73.4, 96.2], [0, 72.6, 95.6]].forEach(([dias, cintura, cadera]) => db.medidas.push({
    id: uuid(), atleta_id: ana.id, fecha: sumarDias(hoy, -dias), cintura_cm: cintura, cadera_cm: cadera, pecho_cm: null, brazo_cm: 28.5, muslo_cm: 54, pantorrilla_cm: null, notas: null,
  }));
  db.marcas.push(
    { id: uuid(), atleta_id: ana.id, ejercicio_id: ej['Press banca'].id, fecha: sumarDias(lunesHoy, -45), kg: 45, reps: 1, tipo: 'test', notas: 'Test de inicio del bloque' },
    { id: uuid(), atleta_id: ana.id, ejercicio_id: ej['Sentadilla barra alta'].id, fecha: sumarDias(lunesHoy, -45), kg: 60, reps: 3, tipo: 'test', notas: null },
  );
  db.objetivos.push(
    { id: uuid(), atleta_id: ana.id, titulo: 'Press banca 62,5 kg a una repetición', descripcion: 'Al final del bloque, con test el último día.', fecha_limite: sumarDias(lunesHoy, 20), progreso_pct: 0, estado: 'en_curso',
      ejercicio_id: ej['Press banca'].id, kg_objetivo: 62.5, reps_objetivo: 1, e1rm_inicio: 49.3, creado_en: `${sumarDias(lunesHoy, -21)}T10:00:00.000Z` },
    { id: uuid(), atleta_id: ana.id, titulo: 'Sentadilla 80 kg × 3', descripcion: null, fecha_limite: sumarDias(lunesHoy, 55), progreso_pct: 0, estado: 'en_curso',
      ejercicio_id: ej['Sentadilla barra alta'].id, kg_objetivo: 80, reps_objetivo: 3, e1rm_inicio: 66.9, creado_en: `${sumarDias(lunesHoy, -21)}T10:00:00.000Z` },
    { id: uuid(), atleta_id: ana.id, titulo: 'Bajar a 61 kg sin perder fuerza', descripcion: null, fecha_limite: sumarDias(lunesHoy, 41), progreso_pct: 45, estado: 'en_curso', ejercicio_id: null, kg_objetivo: null, reps_objetivo: null, e1rm_inicio: null, creado_en: ahoraISO },
  );

  // Recursos: las preguntas frecuentes de la app y una guía general
  // Notas fijadas de Ana y respuestas guardadas del coach
  for (const [nombre, texto] of [['Press banca', 'Banco en el 3; índices en la marca de la barra'], ['Sentadilla barra alta', 'Pies a la anchura de hombros; la barra sobre el trapecio, no en el cuello'], ['Leg curl tumbado', 'Rodillo justo encima del talón; respaldo en el 2']]) {
    if (ej[nombre]) db.notas_ejercicio.push({ id: uuid(), atleta_id: ana.id, ejercicio_id: ej[nombre].id, texto, actualizado_en: ahoraISO });
  }
  RESPUESTAS_EJEMPLO.forEach(([titulo, texto], i) => db.respuestas_guardadas.push({ id: uuid(), titulo, texto, orden: i + 1, creado_en: ahoraISO }));
  // Notificaciones de ejemplo (en la demo no se envían a ningún móvil: se ven en Perfil → Notificaciones)
  const coachId = db.perfiles.find((p) => p.rol === 'coach').id;
  const notificacion = (usuario_id, tipo, titulo, cuerpo, url, min) => db.notificaciones.push({
    id: uuid(), usuario_id, tipo, titulo, cuerpo, url, clave: `demo:${uuid()}`, creado_en: hace(min), enviar_desde: hace(min),
    caduca_en: hace(min - 1440), estado: 'enviada', canal: 'push', intentos: 1, tomada_en: hace(min), enviada_en: hace(min), error: null,
  });
  notificacion(ana.perfil_id, 'semana', 'Tu semana ya está lista', `Semana 4 de ${db.bloques.find((x) => x.atleta_id === ana.id)?.nombre || 'tu bloque'}`, '#semana', 60 * 30);
  notificacion(ana.perfil_id, 'habitos', 'Te quedan 2 hábitos de hoy', 'Apúntalo en Hoy antes de que acabe el día.', '#hoy', 60 * 24 - 15);
  notificacion(ana.perfil_id, 'respuesta', 'Pelayo te ha respondido', 'En Pierna A', '#hoy', 95);
  notificacion(coachId, 'checkin_recibido', 'Ana ha enviado su check-in', `Semana del ${Number(sumarDias(lunesHoy, -7).slice(8))} de ${['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][Number(sumarDias(lunesHoy, -7).slice(5, 7)) - 1]}`, '#revisar', 60 * 6);
  notificacion(coachId, 'mensaje', 'Ana te ha escrito', 'En Pierna A', '#revisar', 40);
  notificacion(coachId, 'cuestionario_recibido', 'Rubén ha completado su cuestionario', 'Lo tienes en su ficha, en Datos.', '#atletas', 60 * 50);
  db.preferencias_notificaciones.push({ usuario_id: ana.perfil_id, desactivados: [], hora_manana: '08:30:00', hora_tarde: '21:00:00', dia_checkin: 7, silencio_desde: '22:30:00', silencio_hasta: '08:00:00', email: false, actualizado_en: ahoraISO });
  FAQ.forEach(([titulo, descripcion], i) => db.recursos.push({ id: uuid(), atleta_id: null, categoria: 'faq', titulo, descripcion, url: null, orden: i + 1, creado_en: ahoraISO }));
  db.recursos.push({ id: uuid(), atleta_id: null, categoria: 'entrenamiento', titulo: 'Calentamiento general (5 minutos)', descripcion: '2 min de bici o remo suave, 10 sentadillas sin peso, 10 puentes de glúteo, 10 rotaciones de hombro con banda y 5 zancadas por pierna.', url: null, orden: 1, creado_en: ahoraISO });
  // v0.26: recetas, Lucía (solo nutrición) y el menú de la semana (al final: no cambia lo aleatorio de lo anterior)
  sembrarComidas(db, { hoy, uuid, usuario, ahoraISO, ana });
  sembrarComunidad(db, { lunesHoy, hace, coachId, ruben, carlos });
  sembrarV048(db, { hoy, hace, ana, ruben, carlos, ej, ahoraISO, mesDe, inicioMes });
  sembrarMicrociclos();
  // v0.56: todos han visto ya el aviso de la política actual (en la demo no sale al entrar; las pruebas lo quitan)
  db.privacidad_vista = db.perfiles.map((x) => ({ usuario_id: x.id, version: VERSION_LEGAL, vista_en: ahoraISO }));
  return db;

  // v0.53 (al final: no cambia lo aleatorio de lo anterior): Iván va por microciclos de 4 sesiones (torso-pierna A y B)
  // que no caben en una semana natural: entrena 3 días por semana (lunes, miércoles y viernes) y su coach le ha puesto
  // dias_semana = 3. Su bloque empezó hace 5 semanas, con las fechas de sus semanas de 7 en 7 (como las pone la app),
  // así que va por detrás de ellas: 14 sesiones hechas (la semana de hace 3, solo 2) y las de esta semana hechas hasta
  // ayer (el lunes, ninguna; el sábado y el domingo, las 3). Así se ven «x/3», la racha por semanas naturales y cuál sigue.
  function sembrarMicrociclos() {
    const MICRO = [...DIAS_TORSO_PIERNA, {
      nombre: 'Pierna B', intencion: 'volumen', dinamica: 'Bisagra primero y con técnica limpia; en la prensa, recorrido completo sin despegar la zona lumbar.',
      ej: [
        ['Peso muerto convencional', 'alta', 3, 5, 6, 2, null, 130, 180],
        ['Prensa (miscelánea)', 'media', 3, 10, 12, 2, null, 160, 120],
        ['Hip thrust', 'media', 3, 8, 10, 2, null, 100, 90],
        ['Leg curl tumbado', 'baja', 3, 10, 12, 1, null, 40, 75, null, 'A'],
        ['Gemelo en máquina de pie', 'baja', 3, 12, 15, 1, null, 60, 75, null, 'A'],
      ],
    }];
    const perfil = usuario('ivan@fbe.demo', 'Iván', 'atleta');
    const ivan = { id: uuid(), perfil_id: perfil, nombre: 'Iván Prieto', email: 'ivan@fbe.demo', estado: 'activo', fecha_alta: sumarDias(lunesHoy, -7 * 9),
      objetivo: 'Fuerza en torso-pierna, a su ritmo: 4 sesiones por microciclo, 3 días por semana', notion_url: null, progresion_auto: true, volumen_objetivo: null,
      creado_en: ahoraISO, nivel: 'intermedio', nutricion: false, entrenamiento: true, dias_semana: 3 };
    db.atletas.push(ivan);
    for (const tipo of ['privacidad', 'datos_salud']) db.consentimientos.push({ id: uuid(), perfil_id: perfil, tipo, version: '2026-10', aceptado_en: ahoraISO, revocado_en: null });
    const inicio = sumarDias(lunesHoy, -35);
    const bloque = { id: uuid(), atleta_id: ivan.id, es_plantilla: false, numero: 1, nombre: 'Torso-pierna por microciclos', foco: 'volumen', objetivo: ivan.objetivo, descripcion: null,
      fecha_inicio: inicio, fecha_fin: sumarDias(inicio, 7 * 8 - 1), estado: 'activo', creado_en: ahoraISO };
    db.bloques.push(bloque);
    const sesiones = [];
    for (let w = 1; w <= 8; w++) {
      const semana = crearSemana(bloque.id, w, sumarDias(inicio, 7 * (w - 1)), MICRO, 0.9, w <= 6 ? 'programada' : 'en_programacion', 2.5);
      semana.foco = w === 8 ? 'descarga' : 'volumen';
      if (w === 1) semana.nota_coach = 'Vas por microciclos: haz las 4 sesiones en orden, 3 días por semana. Si una semana solo te salen 2, sigue donde lo dejaste.';
      sesiones.push(...db.sesiones.filter((x) => x.semana_id === semana.id).sort((a, b) => a.orden - b.orden));
    }
    // Lunes, miércoles y viernes de cada semana natural, en el orden del programa; la de hace 3 semanas, solo 2
    const dia = diasEntre(lunesHoy, hoy);
    let k = 0;
    for (let atras = 5; atras >= 0; atras--) {
      const lunes = sumarDias(lunesHoy, -7 * atras);
      const dias = (atras === 3 ? [0, 2] : [0, 2, 4]).filter((o) => atras > 0 || o < dia);
      for (const o of dias) hacerSesion(sesiones[k++], ivan.id, sumarDias(lunes, o), { revisada: true });
    }
    for (let atras = 5; atras >= 0; atras--) db.pesos.push({ id: uuid(), atleta_id: ivan.id, fecha: atras ? sumarDias(lunesHoy, -7 * atras) : hoy, kg: Math.round((81.4 + 0.1 * (5 - atras)) * 10) / 10, notas: null });
  }
}

// v0.48 (al final: no cambia lo aleatorio de lo anterior): alternativas marcadas por el coach en la biblioteca de la
// demo (para «¿Dónde entrenas hoy?»; la biblioteca real ya trae las suyas), tareas, plantillas, un mensaje y un aviso
// programados y un atleta que se dio de baja hace dos meses (para el panel de negocio).
function sembrarV048(db, { hoy, hace, ana, ruben, carlos, ej, ahoraISO, mesDe, inicioMes }) {
  const ALTERNATIVAS = {
    'Press banca': ['Press plano con mancuernas', 'Press plano en máquina'],
    'Remo con barra': ['Remo con mancuerna a una mano', 'Remo en polea unilateral'],
    'Press militar con barra': ['Press militar sentado con mancuernas', 'Press militar en máquina/inverso'],
    'Jalón al pecho prono': ['Dominadas pronas', 'Remo con mancuerna a una mano'],
    'Sentadilla barra alta': ['Sentadilla en multipower', 'Búlgara con mancuernas+apoyo'],
    'Peso muerto rumano con barra RDL': ['Peso muerto rumano con mancuernas'],
    'Peso muerto convencional': ['Peso muerto rumano con mancuernas'],
    'Leg curl tumbado': ['Leg curl sentado'],
    'Gemelo en máquina de pie': ['Sóleo sentado con mancuernas/en multipower'],
    'Face pull': ['Pájaros con mancuernas de pie apoyado en banco'],
    'Extensiones desde polea alta con cuerda': ['Press francés con mancuernas tumbado'],
    'Remo gironda': ['Remo con mancuerna a una mano'],
    'Hip thrust': ['Puente de glúteo'],
    'Prensa (miscelánea)': ['Búlgara con mancuernas+apoyo'],
  };
  for (const [nombre, alts] of Object.entries(ALTERNATIVAS)) {
    const e = ej[nombre];
    if (e && !(e.alternativas || []).length) e.alternativas = alts.map((n) => ej[n]?.id).filter(Boolean);
  }
  const lucia = db.atletas.find((a) => a.nombre === 'Lucía Ferrer');
  Object.assign(db, { tareas: [], tareas_plantillas: [] });
  const tarea = (a, f, creada) => db.tareas.push({ id: crypto.randomUUID(), atleta_id: a.id, detalle: null, ejercicio_id: null, hecha_en: null, respuesta: null, archivo_id: null, revisada_en: null, creada_en: hace(creada), ...f });
  tarea(ana, { tipo: 'foto', titulo: 'Fotos de progreso de este mes', detalle: 'Frente, perfil y espalda, con la misma luz que la última vez.', fecha: hoy }, 180);
  tarea(ana, { tipo: 'texto', titulo: '¿Qué tal el viaje de trabajo?', detalle: 'Cuéntame en dos líneas cómo fueron las sesiones en el hotel.', fecha: sumarDias(hoy, -3),
    hecha_en: hace(60 * 20), respuesta: 'Bien: hice Torso A y Pierna A en el hotel y la tercera con mancuernas, a 15 repeticiones.' }, 60 * 24 * 3);
  if (ej['Sentadilla barra alta']) tarea(ruben, { tipo: 'video', titulo: 'Vídeo de tu sentadilla', detalle: 'La última serie, de lado y que se vea todo el cuerpo.', ejercicio_id: ej['Sentadilla barra alta'].id, fecha: sumarDias(hoy, -2) }, 60 * 24 * 2);
  tarea(ruben, { tipo: 'medida', titulo: 'Peso y cintura', detalle: 'Por la mañana, en ayunas.', fecha: sumarDias(hoy, 3) }, 60 * 5);
  if (lucia) tarea(lucia, { tipo: 'medida', titulo: 'Peso y cintura', detalle: 'Por la mañana, en ayunas. La cintura, a la altura del ombligo.', fecha: hoy }, 60 * 2);
  [['foto', 'Fotos de progreso de este mes', 'Frente, perfil y espalda, con la misma luz que la última vez.'], ['medida', 'Peso y cintura', 'Por la mañana, en ayunas.'],
    ['texto', '¿Qué tal la semana?', 'Cuéntame en dos líneas cómo vas: sueño, estrés y ganas.']]
    .forEach(([tipo, titulo, detalle], i) => db.tareas_plantillas.push({ id: crypto.randomUUID(), tipo, titulo, detalle, ejercicio_id: null, orden: i, creada_en: ahoraISO }));
  // Un mensaje a Ana para mañana a las 8:00 (hora de Madrid) y un aviso para todos el lunes a las 8:00: el coach los
  // ve como programados; los atletas, todavía no
  const manana = instanteMadrid(sumarDias(hoy, 1), '08:00');
  const idProg = crypto.randomUUID();
  db.comentarios.push({ id: idProg, atleta_id: ana.id, sesion_id: null, checkin_id: null, archivo_id: null, autor: 'coach', adjunto: false, dibujo: null,
    texto: 'Buenos días, Ana. Esta semana es la de descarga: los mismos ejercicios con algo menos de peso. Disfrútala.', creado_en: manana, enviar_en: manana, leido_en: null });
  // Su notificación, en la cola para esa hora (como la base: Ana no la ve hasta que toca)
  db.notificaciones.push({ id: crypto.randomUUID(), usuario_id: ana.perfil_id, tipo: 'respuesta', titulo: 'Pelayo te ha escrito', cuerpo: 'Mensaje nuevo', url: '#mensajes', clave: `comentario:${idProg}`,
    creado_en: ahoraISO, enviar_desde: manana, caduca_en: new Date(Date.parse(manana) + 864e5).toISOString(), estado: 'pendiente', canal: null, intentos: 0, tomada_en: null, enviada_en: null, error: null });
  const lunesSig = sumarDias(lunesDe(hoy), 7);
  const avisoLunes = instanteMadrid(lunesSig, '08:00');
  db.avisos.push({ id: crypto.randomUUID(), texto: 'Esta semana estreno las tareas en la app: si te pongo una, te saldrá en «Tu día». Un toque y listo.', atleta_id: null,
    desde: lunesSig, hasta: sumarDias(lunesSig, 6), creado_en: ahoraISO, enviar_en: avisoLunes });
  // «Lo que te dijo tu coach»: en una sesión ya hecha de Ana, una corrección que nombra las dominadas (le sale en la
  // siguiente que las lleve), ya leída
  if (ej['Dominadas pronas']) {
    const bloquesA = new Set(db.bloques.filter((x) => x.atleta_id === ana.id).map((x) => x.id));
    const semanasA = new Set(db.semanas.filter((w) => bloquesA.has(w.bloque_id)).map((w) => w.id));
    const conDominadas = new Set(db.sesion_ejercicios.filter((p) => p.ejercicio_id === ej['Dominadas pronas'].id).map((p) => p.sesion_id));
    const hecha = db.sesiones.filter((x) => semanasA.has(x.semana_id) && x.completada && conDominadas.has(x.id)).sort((x, y) => (x.fecha_realizada < y.fecha_realizada ? 1 : -1))[0];
    if (hecha) {
      const cuando = `${hecha.fecha_realizada}T19:30:00.000Z`;
      db.comentarios.push({ id: crypto.randomUUID(), atleta_id: ana.id, sesion_id: hecha.id, checkin_id: null, archivo_id: null, autor: 'coach', adjunto: false, dibujo: null,
        texto: 'Muy bien la sesión. En las dominadas, baja del todo antes de la siguiente repetición aunque salga una menos.', creado_en: cuando, enviar_en: null, leido_en: cuando });
    }
  }
  // Las notas de sus dos últimos check-ins (para «Comparar dos»: respuestas largas que no parten palabras)
  const cksAna = db.checkins.filter((c) => c.atleta_id === ana.id).sort((x, y) => (x.semana_inicio < y.semana_inicio ? 1 : -1));
  if (cksAna[0]) cksAna[0].notas = cksAna[0].notas || 'Semana muy buena: he dormido mejor, me he sentido motivada y con energía casi todos los días, y el hombro, sin molestias.';
  if (cksAna[1]) cksAna[1].notas = cksAna[1].notas || 'Cansada por el trabajo; me ha costado recuperar entre sesiones.';
  // Sergio se dio de baja hace dos meses (pagaba Essential al mes)
  const sergio = { id: crypto.randomUUID(), perfil_id: null, nombre: 'Sergio Ruiz', email: 'sergio@fbe.demo', estado: 'baja', fecha_alta: mesDe(inicioMes, -7), baja_en: sumarDias(mesDe(inicioMes, -2), 9),
    objetivo: 'Volver a entrenar después de una lesión de rodilla', notion_url: null, progresion_auto: true, volumen_objetivo: null, creado_en: ahoraISO, nutricion: false, entrenamiento: true };
  db.atletas.push(sergio);
  db.cobros_atletas.push({ atleta_id: sergio.id, servicio: 'Essential', precio_mes: 49, ciclo: 'mensual', desde: sergio.fecha_alta, nota: null, actualizado_en: ahoraISO });
  for (let k = -7; k <= -3; k++) {
    const desde = mesDe(inicioMes, k);
    db.pagos.push({ id: crypto.randomUUID(), atleta_id: sergio.id, periodo_desde: desde, periodo_hasta: sumarDias(mesDe(desde, 1), -1), importe: 49, estado: 'pagado', fecha_pago: sumarDias(desde, 2), metodo: 'bizum', nota: null, creado_en: ahoraISO });
  }
}

// v0.43: la comunidad del equipo, abierta, con Rubén, Carlos y Lucía dentro (Ana aún no: así se ve la entrada).
// Un aviso del coach fijado, un entreno compartido por Rubén, un par de publicaciones, un reto y el ranking.
// v0.47: un reto de equipo, uno ya acabado que Rubén consiguió (al entrar en Equipo lo celebra) y otro que Carlos
// compartió como logro, una encuesta del coach con sus votos, una mención y los ánimos de esta semana.
function sembrarComunidad(db, { lunesHoy, hace, coachId, ruben, carlos }) {
  const lucia = db.atletas.find((a) => a.nombre === 'Lucía Ferrer');
  Object.assign(db, { comunidad_ajustes: [{ id: true, activa: true, actualizado_en: hace(60 * 24 * 6) }], comunidad_miembros: [], comunidad_posts: [], comunidad_comentarios: [], comunidad_reacciones: [], comunidad_reportes: [], comunidad_retos: [], comunidad_cupos: [], comunidad_votos: [], comunidad_animos: [] });
  // (entraron por primera vez hace semanas; aceptaron lo que se comparte ahora hace unos días)
  // v0.69: Lucía entró hace tres días (en el muro sale «Lucía F. se ha unido al equipo» con «Dar la bienvenida 👋») y Carlos
  // deja que el equipo vea cuándo está entrenando
  const miembro = (a, nombre, dias, desde, extra = {}) => db.comunidad_miembros.push({ atleta_id: a.id, perfil_id: a.perfil_id, nombre, version: 'comunidad-2026-11-b', aceptado_en: hace(60 * 24 * dias), salido_en: null, sin_ranking: false, bloqueado: false, nombre_cambiado_en: null, normas_version: VERSION_NORMAS, normas_leidas_en: hace(60 * 24 * dias), creado_en: hace(60 * 24 * desde), entrado_en: hace(60 * 24 * desde), ver_entrenando: false, ...extra });
  miembro(ruben, 'Rubén M.', 6, 24);
  miembro(carlos, 'Carlos V.', 5, 40, { ver_entrenando: true });
  if (lucia) miembro(lucia, 'Lucía F.', 3, 3);
  Object.assign(db, { comunidad_comentario_reacciones: [], comunidad_bienvenidas: [] });
  const post = (autor, atleta, tipo, texto, min, extra = {}) => {
    const p = { id: crypto.randomUUID(), autor_id: autor, atleta_id: atleta?.id || null, tipo, texto, foto_ruta: null, sesion_id: null, resumen: null, fijada: false, oculta: false, creado_en: hace(min), menciones: [], encuesta: null, reto_id: null, ...extra };
    db.comunidad_posts.push(p);
    return p;
  };
  const aviso = post(coachId, null, 'aviso', '¡Bienvenidos al muro del equipo! Aquí podéis contar qué tal vuestra semana, compartir un entreno al terminarlo y animaros entre vosotros. Esta semana arranca el reto de constancia: a por él.', 60 * 24 * 6, { fijada: true });
  // El último entreno de Rubén, como lo deja la base al compartirlo (sin los kilos)
  const bloquesR = new Set(db.bloques.filter((x) => x.atleta_id === ruben.id).map((x) => x.id));
  const semanasR = new Set(db.semanas.filter((w) => bloquesR.has(w.bloque_id)).map((w) => w.id));
  const ultima = db.sesiones.filter((x) => semanasR.has(x.semana_id) && x.completada).sort((x, y) => (x.fecha_realizada < y.fecha_realizada ? 1 : -1))[0];
  let entreno = null;
  if (ultima) {
    const pautas = db.sesion_ejercicios.filter((p) => p.sesion_id === ultima.id).sort((a, b) => a.orden - b.orden);
    const series = db.series.filter((x) => pautas.some((p) => p.id === x.sesion_ejercicio_id) && Number(x.reps) > 0);
    const nombreEj = (id) => db.ejercicios.find((e) => e.id === id)?.nombre || 'Ejercicio';
    const ejercicios = pautas.filter((p) => series.some((x) => x.sesion_ejercicio_id === p.id)).map((p, i) => ({ nombre: nombreEj(p.ejercicio_id), record: i === 0 }));
    entreno = post(ruben.perfil_id, ruben, 'entreno', 'Primera vez que la sentadilla me sale sin molestias en la lumbar. Poco a poco 💪', 60 * 26, {
      sesion_id: ultima.id,
      resumen: { nombre: ultima.nombre, tipo: ultima.tipo, fecha: ultima.fecha_realizada, minutos: ultima.duracion_min, series: series.length, con_kilos: false, ejercicios },
    });
  }
  // v0.51: Carlos comparte hoy (hora de Madrid) su último entreno: en el muro y en las listas, su foto lleva el aro de
  // «ha compartido un entreno hoy». Siempre dentro de hoy, sea la hora que sea (como mucho, hace 40 minutos).
  const bloquesC = new Set(db.bloques.filter((x) => x.atleta_id === carlos.id).map((x) => x.id));
  const semanasC = new Set(db.semanas.filter((w) => bloquesC.has(w.bloque_id)).map((w) => w.id));
  // (la última con ejercicios: de viernes a domingo la última hecha es el rodaje, que no lleva ninguno, y el entreno
  // compartido salía sin pictogramas: la prueba de navegador de la comunidad fallaba esos días)
  const ultimaC = db.sesiones.filter((x) => semanasC.has(x.semana_id) && x.completada && db.sesion_ejercicios.some((q) => q.sesion_id === x.id))
    .sort((x, y) => (x.fecha_realizada < y.fecha_realizada ? 1 : -1))[0];
  if (ultimaC) {
    const [hh, mm] = partesMadrid().hora.split(':').map(Number);
    const minutosHoy = Math.max(0.2, Math.min(40, (hh * 60 + mm) / 2));
    const pautasC = db.sesion_ejercicios.filter((p) => p.sesion_id === ultimaC.id).sort((a, b) => a.orden - b.orden);
    const seriesC = db.series.filter((x) => pautasC.some((p) => p.id === x.sesion_ejercicio_id) && Number(x.reps) > 0);
    const nombreEjC = (id) => db.ejercicios.find((e) => e.id === id)?.nombre || 'Ejercicio';
    post(carlos.perfil_id, carlos, 'entreno', 'Corta pero intensa, antes del trabajo.', minutosHoy, {
      sesion_id: ultimaC.id,
      resumen: { nombre: ultimaC.nombre, tipo: ultimaC.tipo, fecha: ultimaC.fecha_realizada, minutos: ultimaC.duracion_min, series: seriesC.length, con_kilos: false,
        ejercicios: pautasC.filter((p) => seriesC.some((x) => x.sesion_ejercicio_id === p.id)).map((p) => ({ nombre: nombreEjC(p.ejercicio_id), record: false })) },
    });
  }
  const pCarlos = post(carlos.perfil_id, carlos, 'post', 'Vuelvo después de dos semanas parado por trabajo. Esta semana, aunque sean dos sesiones cortas, no fallo.', 60 * 5);
  const pLucia = lucia ? post(lucia.perfil_id, lucia, 'post', '¿Alguien más entrena a primera hora? A las 7 el gimnasio está vacío y se agradece.', 60 * 30) : null;
  const reaccion = (p, a, tipo, min) => p && db.comunidad_reacciones.push({ post_id: p.id, autor_id: a.perfil_id || a, atleta_id: a.id && a.perfil_id ? a.id : null, tipo, creado_en: hace(min) });
  reaccion(aviso, ruben, 'aplauso', 60 * 24 * 5);
  reaccion(aviso, carlos, 'fuego', 60 * 24 * 4);
  reaccion(entreno, carlos, 'fuerza', 60 * 20);
  if (lucia) reaccion(entreno, lucia, 'fuego', 60 * 18);
  reaccion(entreno, coachId, 'aplauso', 60 * 12);
  reaccion(pCarlos, ruben, 'fuerza', 60 * 3);
  if (lucia) reaccion(pCarlos, lucia, 'aplauso', 60 * 2);
  const comentario = (p, a, texto, min, menciones = []) => p && db.comunidad_comentarios.push({ id: crypto.randomUUID(), post_id: p.id, autor_id: a.perfil_id || a, atleta_id: a.id && a.perfil_id ? a.id : null, texto, oculto: false, creado_en: hace(min), menciones });
  comentario(entreno, coachId, 'Eso es lo que buscábamos: técnica limpia antes que kilos. Muy bien, Rubén.', 60 * 12);
  comentario(entreno, carlos, '¡Grande! Yo también la notaba al principio.', 60 * 10);
  comentario(pCarlos, ruben, '¡Vamos, Carlos! Dos sesiones valen más que ninguna.', 60 * 3);
  if (pLucia) comentario(pLucia, ruben, 'Yo a las 7:30. ¡Somos pocos pero buenos!', 60 * 28);
  const reto = (titulo, descripcion, desde, hasta, objetivo, modo, dias) => {
    const r = { id: crypto.randomUUID(), titulo, descripcion, desde, hasta, objetivo, modo, creado_en: hace(60 * 24 * dias) };
    db.comunidad_retos.push(r);
    return r;
  };
  reto('Reto de constancia: 8 sesiones', 'Del lunes pasado a dentro de tres semanas: 8 sesiones terminadas. Lo puede conseguir todo el equipo.', sumarDias(lunesHoy, -7), sumarDias(lunesHoy, 20), 8, 'individual', 6);
  // v0.47
  reto('Entre todos: 40 sesiones', 'Sumamos las sesiones de todo el equipo hasta dentro de tres semanas. Cada una cuenta.', sumarDias(lunesHoy, -7), sumarDias(lunesHoy, 20), 40, 'equipo', 6);
  reto('Semana de arranque: 3 sesiones', 'Tres sesiones en la semana pasada.', sumarDias(lunesHoy, -7), sumarDias(lunesHoy, -1), 3, 'individual', 9);
  const rCarlos = reto('Tres semanas en marcha: 4 sesiones', null, sumarDias(lunesHoy, -35), sumarDias(lunesHoy, -15), 4, 'individual', 36);
  const hechasCarlos = (() => {
    const bl = new Set(db.bloques.filter((x) => x.atleta_id === carlos.id && !x.es_plantilla).map((x) => x.id));
    const ws = new Set(db.semanas.filter((w) => bl.has(w.bloque_id)).map((w) => w.id));
    return db.sesiones.filter((x) => ws.has(x.semana_id) && x.completada && x.fecha_realizada >= rCarlos.desde && x.fecha_realizada <= rCarlos.hasta).length;
  })();
  const logro = post(carlos.perfil_id, carlos, 'logro', 'Con viajes de por medio, pero conseguido. ¡A por el siguiente!', 60 * 24 * 3, {
    reto_id: rCarlos.id, resumen: { titulo: rCarlos.titulo, modo: 'individual', objetivo: 4, hechas: hechasCarlos, desde: rCarlos.desde, hasta: rCarlos.hasta },
  });
  reaccion(logro, ruben, 'aplauso', 60 * 24 * 2);
  reaccion(logro, coachId, 'fuego', 60 * 24 * 2 + 30);
  // La encuesta del coach (cierra dentro de cinco días) y sus votos
  const cierre = new Date(Date.now() + 5 * 864e5); cierre.setMinutes(0, 0, 0);
  const encuesta = post(coachId, null, 'encuesta', '¿Qué día os viene mejor para la quedada en el gimnasio?', 60 * 9, {
    encuesta: { opciones: ['Sábado por la mañana', 'Domingo por la mañana', 'Entre semana, por la tarde'], cierre: cierre.toISOString() },
  });
  const voto = (a, opcion, min) => db.comunidad_votos.push({ post_id: encuesta.id, autor_id: a.perfil_id, atleta_id: a.id, opcion, creado_en: hace(min) });
  voto(ruben, 0, 60 * 8);
  voto(carlos, 1, 60 * 4);
  if (lucia) voto(lucia, 0, 60 * 6);
  // Una mención: Carlos a Lucía
  if (pLucia && lucia) comentario(pLucia, carlos, '@Lucía F. yo a las 7:15, ¡nos vemos por allí!', 60 * 27, [lucia.perfil_id]);
  // Los ánimos de esta semana: a Rubén le han animado Carlos y el coach; a Carlos, Lucía
  const animo = (de, para, min) => db.comunidad_animos.push({ de: de.perfil_id || de, para: para.perfil_id, atleta_id: de.perfil_id ? de.id : null, para_atleta_id: para.id, semana: lunesHoy, creado_en: hace(min) });
  animo(carlos, ruben, 30);
  animo(coachId, ruben, 50);
  if (lucia) animo(lucia, carlos, 70);
  // v0.69: Rubén ya le dio la bienvenida a Lucía y el coach da 💪 al comentario de Rubén en la publicación de Lucía. (Nadie
  // está «entrenando ahora» de entrada: Carlos lo tiene encendido, pero en la demo no entrena: sale «sin entrenar»)
  if (lucia) db.comunidad_bienvenidas.push({ de: ruben.perfil_id, para: lucia.perfil_id, atleta_id: ruben.id, para_atleta_id: lucia.id, creado_en: hace(60 * 24 * 2) });
  const deRubenALucia = pLucia && db.comunidad_comentarios.find((c) => c.post_id === pLucia.id && c.autor_id === ruben.perfil_id);
  if (deRubenALucia) db.comunidad_comentario_reacciones.push({ comentario_id: deRubenALucia.id, autor_id: coachId, atleta_id: null, creado_en: hace(60 * 20) });
  // v0.70 (042): Rubén y Carlos son compañeros de racha desde hace cuatro semanas; Carlos cuenta sus minutos de cardio en los
  // retos; un reto de cardio entre todos y uno por equipos (Rojos: Rubén; Azules: Carlos y Lucía)
  Object.assign(db, { comunidad_companeros: [], comunidad_reto_equipos: [] });
  for (const r of db.comunidad_retos) Object.assign(r, { medida: 'sesiones', equipos: null });
  db.comunidad_companeros.push({ id: crypto.randomUUID(), de: ruben.perfil_id, para: carlos.perfil_id, de_atleta_id: ruben.id, para_atleta_id: carlos.id, estado: 'aceptada', creado_en: hace(60 * 24 * 29), aceptado_en: hace(60 * 24 * 28) });
  const mCarlos = db.comunidad_miembros.find((m) => m.atleta_id === carlos.id);
  if (mCarlos) mCarlos.cardio_en_retos = true;
  for (const m of db.comunidad_miembros) m.cardio_en_retos ??= false;
  const rCardio = reto('Mes de cardio: 400 minutos entre todos', 'Suman los minutos de cardio de quien los cuenta en los retos (se enciende en el propio reto o en los ajustes del equipo).', sumarDias(lunesHoy, -28), sumarDias(lunesHoy, 13), 400, 'equipo', 28);
  rCardio.medida = 'cardio';
  const rEquipos = reto('Rojos contra azules: 15 sesiones', 'Dos equipos: el primero en llegar a 15 sesiones gana.', sumarDias(lunesHoy, -7), sumarDias(lunesHoy, 13), 15, 'equipos', 7);
  rEquipos.equipos = ['Rojos', 'Azules'];
  const enEquipo = (a, equipo) => a && db.comunidad_reto_equipos.push({ reto_id: rEquipos.id, atleta_id: a.id, perfil_id: a.perfil_id, equipo });
  enEquipo(ruben, 0);
  enEquipo(carlos, 1);
  enEquipo(lucia, 1);
  // v0.71 (043): cada publicación con su tema; un truco de técnica de Rubén; Carlos pregunta al coach, que le responde y la
  // guarda como pregunta frecuente; y en la publicación de Lucía, ella elige la respuesta de Rubén como la mejor
  Object.assign(db, { comunidad_guardados: [], comunidad_preguntas: [] });
  for (const p of db.comunidad_posts) {
    Object.assign(p, { tema: p.tipo === 'entreno' ? null : p.tipo === 'logro' ? 'logros' : ['aviso', 'encuesta'].includes(p.tipo) ? 'avisos' : 'charla', fotos: null, mejor_comentario: null });
  }
  post(ruben.perfil_id, ruben, 'post', 'Lo que más me ha ayudado en el press banca: apretar la barra y juntar las escápulas antes de sacarla. Se nota estable desde la primera repetición.', 60 * 7, { tema: 'tecnica', fotos: null, mejor_comentario: null });
  const pregunta = post(carlos.perfil_id, carlos, 'post', '¿El cardio mejor antes o después de las pesas, si lo hago el mismo día?', 60 * 24 * 2, { tema: 'pregunta', fotos: null, mejor_comentario: null });
  comentario(pregunta, coachId, 'Después, salvo que ese día el objetivo sea el cardio. Así llegas fresco a las series pesadas, que son las que más cuentan.', 60 * 24 * 2 - 90);
  const respuesta = db.comunidad_comentarios.find((c) => c.post_id === pregunta.id && c.autor_id === coachId);
  if (respuesta) {
    pregunta.mejor_comentario = respuesta.id;
    db.comunidad_preguntas.push({ id: crypto.randomUUID(), post_id: pregunta.id, comentario_id: respuesta.id, pregunta: pregunta.texto, respuesta: respuesta.texto, creado_en: hace(60 * 24 * 2 - 100), actualizado_en: hace(60 * 24 * 2 - 100) });
  }
  if (pLucia && deRubenALucia) pLucia.mejor_comentario = deRubenALucia.id;
  // v0.72 (044): una quedada del coach dentro de cuatro días (con 12 plazas; Rubén va y Carlos no puede); sin plantillas, sin
  // atleta de la semana y la moderación apagada (para probarlo)
  Object.assign(db, { comunidad_eventos: [], comunidad_evento_asistentes: [], comunidad_plantillas: [], comunidad_destacados: [],
    comunidad_moderacion: [{ id: true, palabras: [], lento_min: 0, actualizado_en: hace(60 * 24 * 6) }] });
  for (const p of db.comunidad_posts) Object.assign(p, { publicar_en: null, retenida: false });
  for (const c of db.comunidad_comentarios) c.retenido = false;
  for (const m of db.comunidad_miembros) m.silenciado_hasta = null;
  const quedada = { id: crypto.randomUUID(), titulo: 'Quedada en el parque: circuito y café', empieza_en: instanteMadrid(sumarDias(hoyISO(), 4), '10:00'),
    lugar: 'Parque del Retiro, puerta de Alcalá', descripcion: 'Un circuito suave de 45 minutos para todos los niveles y, después, café. Trae agua.',
    plazas: 12, cancelado_en: null, creado_en: hace(60 * 20), actualizado_en: hace(60 * 20) };
  db.comunidad_eventos.push(quedada);
  db.comunidad_evento_asistentes.push({ evento_id: quedada.id, perfil_id: ruben.perfil_id, atleta_id: ruben.id, va: true, creado_en: hace(60 * 18) },
    { evento_id: quedada.id, perfil_id: carlos.perfil_id, atleta_id: carlos.id, va: false, creado_en: hace(60 * 15) });
}
