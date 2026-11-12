// FBE Equipo · función «reloj» en un solo archivo (generado; no lo edites a mano).
// Supabase → Edge Functions → Deploy a new function → Via Editor → nombre: reloj → pega TODO este archivo →
// Deploy. Después, en sus ajustes, desactiva «Verify JWT» (la llama el atajo «FBE Reloj» del Apple Watch, con la
// clave de cada atleta). No necesita secretos. El código fuente está en supabase/functions/reloj.
// supabase/functions/enviar-notificaciones/webpush.js
var te = new TextEncoder();
var CERO = new Uint8Array([0]);
var UNO = new Uint8Array([1]);
var MAX_MENSAJE = 4096 - 86 - 16 - 1;

// supabase/functions/enviar-notificaciones/envio.js
var RECORDATORIOS = /* @__PURE__ */ new Set(["sesion_hoy", "checkin", "habitos", "nutricion"]);
var DE_UNA_EN_UNA = /* @__PURE__ */ new Set([...RECORDATORIOS, "descanso"]);
var ESPERA_MS = 1e4;
function claveServicio(env) {
  try {
    const k = JSON.parse(env.SUPABASE_SECRET_KEYS || "null");
    const v = k && (k.default || Object.values(k)[0]);
    if (v) return String(v);
  } catch {
  }
  return env.SUPABASE_SERVICE_ROLE_KEY || "";
}
function clienteBase(env, f = globalThis.fetch) {
  const clave = claveServicio(env);
  const cab = { apikey: clave, "Content-Type": "application/json" };
  if (clave.split(".").length === 3) cab.Authorization = `Bearer ${clave}`;
  const url = String(env.SUPABASE_URL).replace(/\/+$/, "");
  return {
    async rpc(nombre, args = {}) {
      const r = await f(`${url}/rest/v1/rpc/${nombre}`, { method: "POST", headers: cab, body: JSON.stringify(args), signal: AbortSignal.timeout(ESPERA_MS * 2) });
      const texto = await r.text();
      if (!r.ok) throw new Error(`${nombre}: HTTP ${r.status} ${texto.slice(0, 200)}`);
      return texto ? JSON.parse(texto) : null;
    },
    // ¿Es una sesión válida de la app? (la comprueba el servidor de autenticación de Supabase)
    async usuario(token) {
      const r = await f(`${url}/auth/v1/user`, { headers: { apikey: clave, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(ESPERA_MS) });
      return r.ok ? r.json() : null;
    }
  };
}

// web/src/logica/cardio.js
var MODALIDADES = [
  ["carrera", "Carrera", "correr"],
  ["andar", "Andar", "andar"],
  ["bici", "Bici", "bici"],
  ["eliptica", "Elíptica", "elíptica"],
  ["remo", "Remo", "remo"],
  ["nadar", "Natación", "nadar"],
  ["cuerda", "Comba", "comba"],
  ["otro", "Otro", "cardio"]
];
var NOMBRE_MODALIDAD = Object.fromEntries(MODALIDADES.map(([v, t]) => [v, t]));
var VERBO = Object.fromEntries(MODALIDADES.map(([v, , x]) => [v, x]));

// web/src/logica/unidades.js
function num2(v, dec = 1) {
  const n = Number(v);
  const f = n.toFixed(dec);
  const s = Number.isInteger(n) ? String(n) : f.includes(".") ? f.replace(/\.?0+$/, "") : f;
  return s.replace(".", ",");
}
var KG_POR_LB = 0.45359237;
var actual = "kg";
var esNum = (x) => x !== null && x !== void 0 && x !== "" && Number.isFinite(Number(x));
function vista(kg, u = actual) {
  if (!esNum(kg)) return null;
  const n = Number(kg);
  return u === "lb" ? Math.round(n / KG_POR_LB * 10) / 10 : Math.round(n * 100) / 100;
}
function deVista(v, u = actual) {
  if (!esNum(v)) return null;
  const n = Number(v);
  return Math.round((u === "lb" ? n * KG_POR_LB : n) * 100) / 100;
}
function pesoNum(kg, dec = 2, u = actual) {
  if (!esNum(kg)) return "—";
  return u === "lb" ? num2(Number(kg) / KG_POR_LB, Math.min(dec, 1)) : num2(Number(kg), dec);
}
function pesoTxt(kg, dec = 2, u = actual) {
  const n = pesoNum(kg, dec, u);
  return n === "—" ? n : `${n} ${u}`;
}
var pasoLb = (lb) => Number(lb) > 0 && Number(lb) < 20 ? 2.5 : 5;
function redondearCarga(kg, u = actual) {
  if (u !== "lb" || !esNum(kg) || !(Number(kg) > 0)) return kg;
  const lb = Number(kg) / KG_POR_LB;
  const p = pasoLb(lb);
  return deVista(Math.max(p, Math.round(lb / p) * p), "lb");
}

// web/src/logica/enlaces.js
var INVISIBLES_RUTA = new RegExp("[\\u0000-\\u001f\\u007f-\\u009f\\u200b-\\u200f\\u202a-\\u202e\\u2060-\\u2069\\ufeff]", "g");

// web/src/logica/formato.js
var AREA_PRIVADA = new RegExp("[\\uE000-\\uF8FF]");

// web/src/logica/calculos.js
function num(v, dec = 1) {
  if (v === null || v === void 0 || v === "" || Number.isNaN(Number(v))) return "—";
  const n = Number(v);
  const f = n.toFixed(dec);
  const s = Number.isInteger(n) ? String(n) : f.includes(".") ? f.replace(/\.?0+$/, "") : f;
  return s.replace(".", ",");
}
function mmss(seg) {
  const s = Math.max(0, Math.round(seg));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
function enReserva({ rpe, rir }) {
  if (rir !== null && rir !== void 0 && rir !== "") return Math.max(0, Number(rir));
  if (rpe !== null && rpe !== void 0 && rpe !== "") return Math.max(0, 10 - Number(rpe));
  return null;
}
var esTopBackoff = (se) => se?.backoff_pct != null && Number(se.backoff_pct) > 0 && Number(se.series) >= 2;
function cargaBackoff(kgTop, pct, nombre = "") {
  const kg = Number(kgTop);
  if (!(kg > 0) || !(Number(pct) > 0)) return null;
  const paso = incrementoCarga(nombre, kg);
  const bruto = kg * (1 - Number(pct) / 100);
  let redondeado = Math.round(bruto / paso) * paso;
  if (redondeado >= kg) redondeado = kg - paso;
  if (!(redondeado > 0)) redondeado = Math.round(bruto * 2) / 2;
  return redondeado > 0 && redondeado < kg ? Math.round(redondeado * 100) / 100 : null;
}
function propuestaBackoff(se, k, hechas, deLaTop, nombre = "") {
  if (!esTopBackoff(se) || k < 2) return null;
  if (k > 2 && Number(hechas?.[k - 1]?.kg) > 0) return null;
  const hecha = Number(hechas?.[1]?.kg) > 0;
  const kg = cargaBackoff(hecha ? hechas[1].kg : deLaTop?.kg, se.backoff_pct, nombre);
  if (kg == null) return null;
  return { kg, reps: se.reps_max ?? se.reps_min ?? hechas?.[1]?.reps ?? deLaTop?.reps ?? null, backoff: true, desdeTop: hecha };
}
var tieneDetalle = (se) => Array.isArray(se?.series_detalle) && se.series_detalle.length > 0;
var objetivoSerie = (se, k) => tieneDetalle(se) ? se.series_detalle[k - 1] || null : null;
function gruposSuperserie(ejercicios) {
  const grupos = [];
  for (const e of ejercicios) {
    const letra = e.superserie || null;
    const ultimo = grupos[grupos.length - 1];
    if (letra && ultimo?.letra === letra && ultimo.bloque === (e._bloque ?? null)) ultimo.items.push(e);
    else grupos.push({ letra, bloque: e._bloque ?? null, items: [e] });
  }
  return grupos.map((g) => g.letra && g.items.length < 2 ? { letra: null, items: g.items } : { letra: g.letra, items: g.items });
}
function etiquetasSuperserie(ejercicios) {
  const m = {};
  for (const g of gruposSuperserie(ejercicios)) if (g.letra) g.items.forEach((e, i) => {
    m[e.id] = `${g.letra}${i + 1}`;
  });
  return m;
}
var DESCANSOS_ATLETA = [0, 60, 90, 120, 150, 180, 240, 300];
var DESCANSO_DEFECTO = 120;
var descansoValido = (s) => typeof s === "number" && DESCANSOS_ATLETA.includes(s);
function descansoEfectivo(e, { propio = null, defecto = null } = {}) {
  const c = e?.descanso_seg;
  if (c != null && c !== "" && Number.isFinite(Number(c)) && Number(c) >= 0) return { seg: Number(c) > 0 ? Number(c) : null, origen: "coach" };
  if (descansoValido(propio)) return { seg: propio || null, origen: "propio" };
  if (descansoValido(defecto)) return { seg: defecto || null, origen: "defecto" };
  return { seg: null, origen: null };
}
var descansoDelCoach = (x) => Number(x.descanso_seg) || null;
function descansoGrupo(g, descansoDe = descansoDelCoach) {
  return Math.max(0, ...g.items.map((x) => Number(descansoDe(x)) || 0)) || null;
}
function trasSerie(ejercicios, hechas, eid, descansoDe = descansoDelCoach) {
  const h = (x) => hechas[x.id] || 0;
  const pendiente = (x) => h(x) < x.series;
  const grupos = gruposSuperserie(ejercicios);
  const gi = grupos.findIndex((g2) => g2.items.some((x) => x.id === eid));
  if (gi < 0) return { descanso: null, siguiente: null, enRonda: false };
  const g = grupos[gi];
  const e = g.items.find((x) => x.id === eid);
  const sig = (x) => x ? { id: x.id, numero: h(x) + 1 } : null;
  const fuera = () => sig([...grupos.slice(gi + 1), ...grupos.slice(0, gi)].flatMap((x) => x.items).find(pendiente));
  if (g.letra) {
    const n = h(e);
    const i = g.items.indexOf(e);
    const resto = [...g.items.slice(i + 1), ...g.items.slice(0, i)];
    const enRonda = resto.find((x) => h(x) < n && pendiente(x));
    if (enRonda) return { descanso: 0, siguiente: sig(enRonda), enRonda: true };
    const proxima = g.items.find(pendiente);
    return { descanso: descansoGrupo(g, descansoDe), siguiente: proxima ? sig(proxima) : fuera(), enRonda: false };
  }
  return { descanso: Number(descansoDe(e)) || null, siguiente: pendiente(e) ? sig(e) : fuera(), enRonda: false };
}
function propuestaSerie(se, ultimas, numero2, { sugerencia = null, pautaAnterior = null } = {}) {
  const previa = (ultimas || []).find((u) => u.numero === numero2) || (ultimas || [])[0];
  const pautada = se.carga_sugerida_kg != null ? Number(se.carga_sugerida_kg) : null;
  let kg;
  if (bajaDelCoach(se, pautaAnterior)) kg = pautada;
  else {
    const candidatas = [previa?.kg, pautada, sugerencia?.tipo === "subir" ? sugerencia.kg : null].filter((x) => x != null).map(Number);
    kg = candidatas.length ? Math.max(...candidatas) : null;
  }
  const reps = se.reps_max ?? se.reps_min ?? previa?.reps ?? null;
  return { kg: kg === null ? null : Number(kg), reps: reps === null ? null : Number(reps) };
}
var bajaDelCoach = (se, anterior) => se.carga_sugerida_kg != null && anterior?.carga_sugerida_kg != null && Number(se.carga_sugerida_kg) < Number(anterior.carga_sugerida_kg);
function incrementoCarga(nombre = "", kg = 0) {
  if (esBarra(nombre)) return 2.5;
  if (/mancuerna|b\u00falgara|bulgara|kettlebell/i.test(nombre)) return 2;
  return Number(kg) >= 50 ? 5 : 2.5;
}
function sugerenciaProgresion(se, ultimas, { nombre = "", foco = null, pautaAnterior = null } = {}) {
  let hechas = (ultimas || []).filter((s) => Number(s.kg) > 0 && Number(s.reps) > 0);
  const top = esTopBackoff(se);
  if (!top && esTopBackoff(pautaAnterior)) return null;
  if (top) hechas = hechas.filter((s) => Number(s.numero) === 1).slice(0, 1);
  if (!hechas.length || se.reps_max == null || foco === "descarga" || bajaDelCoach(se, pautaAnterior)) return null;
  const kg = Math.max(...hechas.map((s) => Number(s.kg)));
  const trabajo = hechas.filter((s) => Number(s.kg) === kg);
  const objetivo = se.rir_objetivo != null ? Number(se.rir_objetivo) : se.rpe_objetivo != null ? 10 - Number(se.rpe_objetivo) : null;
  const reservas = trabajo.map(enReserva).filter((x) => x != null);
  const sinPasarse = objetivo == null || !reservas.length || reservas.every((r) => r >= objetivo - 0.5);
  const min = se.reps_min ?? se.reps_max;
  if (trabajo.length >= (top ? 1 : se.series || 1) && trabajo.every((s) => Number(s.reps) >= se.reps_max) && sinPasarse) {
    const nuevo = Math.round((kg + incrementoCarga(nombre, kg)) * 100) / 100;
    return { tipo: "subir", kg: nuevo, texto: `La última vez llegaste a ${se.reps_max} en ${top ? "la serie top" : "todas las series"}${reservas.length && objetivo != null ? " sin pasarte de esfuerzo" : ""}: prueba con ${pesoTxt(redondearCarga(nuevo), 2)}${top ? " en la top" : ""}.` };
  }
  if (trabajo.some((s) => Number(s.reps) < min)) {
    return { tipo: "mantener", kg, texto: `La última vez no llegaste a ${min} en alguna serie: repite ${pesoTxt(kg, 2)} hasta completar el rango.` };
  }
  return { tipo: "repetir", kg, texto: `Misma carga (${pesoTxt(kg, 2)}) e intenta sumar una repetición hasta llegar a ${se.reps_max}.` };
}
function esBarra(nombre = "") {
  const n = nombre.toLowerCase();
  if (/mancuerna|m\u00e1quina|maquina|multipower|polea|unilateral|landmine|trap bar|kettlebell/.test(n)) return false;
  return /barra|press banca|peso muerto convencional|remo pendlay|hip thrust$|rack pull|good morning/.test(n);
}
var ZONAS = [
  ["hombros", "Hombros"],
  ["pectoral", "Pectoral"],
  ["triceps", "Tríceps"],
  ["espalda_alta", "Espalda alta"],
  ["zona_lumbar", "Zona lumbar"],
  ["femoral_gluteo", "Femoral y glúteo"],
  ["cuadriceps", "Cuádriceps"],
  ["aductor", "Aductor"],
  ["otra", "Otra zona"]
];
var NOMBRE_ZONA = Object.fromEntries(ZONAS);
var GRUPOS = [
  ["pectoral", "Pectoral"],
  ["espalda", "Espalda"],
  ["deltoides", "Deltoides"],
  ["cuadriceps", "Cuádriceps"],
  ["gluteo", "Glúteo"],
  ["isquiotibiales", "Isquiotibiales"],
  ["biceps", "Bíceps"],
  ["triceps", "Tríceps"],
  ["abdominales", "Abdominales"],
  ["gemelo", "Gemelo"]
];
var NOMBRE_GRUPO = Object.fromEntries(GRUPOS);
var PRIORIDADES = [
  ["alta", "Obligatorio"],
  ["media", "Muy importante"],
  ["baja", "Accesorio"],
  ["muy_baja", "Prescindible"]
];
var NOMBRE_PRIORIDAD = Object.fromEntries(PRIORIDADES);
var FOCOS = [
  ["adaptacion", "Adaptación"],
  ["tecnica", "Técnica"],
  ["volumen", "Volumen"],
  ["intensidad", "Intensidad"],
  ["descarga", "Descarga"],
  ["mixto", "Mixto"],
  ["evaluacion", "Evaluación"],
  ["peaking", "Peaking"]
];
var NOMBRE_FOCO = Object.fromEntries(FOCOS);
var INTENCIONES = [
  ["rendimiento", "Rendimiento"],
  ["volumen", "Volumen"],
  ["tecnica", "Técnica"],
  ["recuperacion_activa", "Recuperación activa"]
];
var NOMBRE_INTENCION = Object.fromEntries(INTENCIONES);
var TIPOS_SESION = [["fuerza", "Fuerza"], ["cardio", "Cardio"], ["movilidad", "Movilidad"]];
var NOMBRE_TIPO_SESION = Object.fromEntries(TIPOS_SESION);
var TIPOS_EJERCICIO = [["basico", "Básico"], ["multiarticular", "Multiarticular"], ["aislamiento", "Aislamiento"]];
var NOMBRE_TIPO_EJERCICIO = Object.fromEntries(TIPOS_EJERCICIO);
var MEDIDAS = [
  ["cintura_cm", "Cintura"],
  ["cadera_cm", "Cadera"],
  ["pecho_cm", "Pecho"],
  ["brazo_cm", "Brazo"],
  ["muslo_cm", "Muslo"],
  ["pantorrilla_cm", "Pantorrilla"]
];
var NOMBRE_MEDIDA = Object.fromEntries(MEDIDAS);
var CATEGORIAS_RECURSO = [
  ["entrenamiento", "Entrenamiento"],
  ["tecnica", "Técnica"],
  ["alimentacion", "Alimentación"],
  ["descanso", "Descanso"],
  ["faq", "Preguntas frecuentes"],
  ["general", "General"]
];
var NOMBRE_CATEGORIA = Object.fromEntries(CATEGORIAS_RECURSO);
var ESTADOS_OBJETIVO = [["no_iniciado", "Sin empezar"], ["en_curso", "En curso"], ["completado", "Conseguido"], ["descartado", "Descartado"]];
var NOMBRE_ESTADO_OBJETIVO = Object.fromEntries(ESTADOS_OBJETIVO);

// web/src/logica/ahora-toca.js
function serieQueToca(ejercicios, hechas, proxima = null, { completada = false } = {}) {
  if (completada) return null;
  const h = hechas || {};
  const pendienteDe = (x2) => Array.from({ length: x2.series }, (_, i) => i + 1).find((k) => !h[x2.id]?.[k]);
  if (proxima && (ejercicios || []).some((x2) => x2.id === proxima.id && proxima.numero <= x2.series) && !h[proxima.id]?.[proxima.numero]) return { id: proxima.id, numero: proxima.numero };
  const x = (ejercicios || []).find((y) => pendienteDe(y));
  return x ? { id: x.id, numero: pendienteDe(x) } : null;
}
function objetivoEsfuerzo(se, propuesta = null) {
  if (propuesta?.rpe != null) return `RPE ${num(propuesta.rpe)}`;
  if (se?.rir_objetivo != null) return `RIR ${num(se.rir_objetivo)}`;
  if (se?.rpe_objetivo != null) return `RPE ${num(se.rpe_objetivo)}`;
  return null;
}
function nombreSerie(se, numero2) {
  const pautadas = se.pautadas ?? se.series;
  if (numero2 > pautadas) return `Serie ${numero2} (de más)`;
  if (esTopBackoff(se)) return numero2 === 1 ? "Serie top" : `Back-off ${numero2 - 1} de ${pautadas - 1}`;
  return `Serie ${numero2} de ${pautadas}`;
}

// web/src/logica/preparacion.js
var PREGUNTAS = [
  { id: "sueno", texto: "¿Cómo has dormido?", opciones: [[1, "Mal"], [2, "Normal"], [3, "Bien"]] },
  { id: "energia", texto: "¿Cómo tienes la energía?", opciones: [[1, "Baja"], [2, "Normal"], [3, "Alta"]] },
  { id: "molestias", texto: "¿Agujetas o molestias?", opciones: [[1, "Bastantes"], [2, "Algunas"], [3, "Ninguna"]] }
];
var NOMBRE = Object.fromEntries(PREGUNTAS.map((p) => [p.id, Object.fromEntries(p.opciones)]));
var completa = (p) => !!p && PREGUNTAS.every((q) => [1, 2, 3].includes(p[q.id]));
function consejoPreparacion(p) {
  if (!completa(p)) return null;
  const total = p.sueno + p.energia + p.molestias;
  if (p.molestias === 1 || total <= 4) {
    return {
      nivel: "malo",
      frenar: true,
      titulo: "Día difícil",
      texto: "Haz la sesión sin pasar del esfuerzo pautado y, si hace falta, quita una serie en los accesorios. Si una molestia cambia cómo te mueves o va a más, para ese ejercicio y cuéntaselo a tu coach."
    };
  }
  if (total <= 6 || Object.values(p).includes(1)) {
    return {
      nivel: "flojo",
      frenar: true,
      titulo: "Día flojo",
      texto: "Que el esfuerzo pautado (RPE) mande: si las series pesan más de lo normal, quédate en la parte baja del rango."
    };
  }
  return { nivel: "bien", frenar: false, titulo: "Buen día", texto: "Sigue la pauta tal cual. Si todo sale fácil, la app te propondrá subir carga donde toque." };
}

// web/src/logica/integraciones.js
var LARGO_VALOR = 32;
function numero(v, { entero = false } = {}) {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string" || v.length > LARGO_VALOR) return null;
  const m = v.trim().replace(/ | /g, " ").match(/^[+-]?\d[\d.,' ]*/);
  if (!m) return null;
  let t = m[0].replace(/[' ]/g, "");
  const punto = t.lastIndexOf("."), coma = t.lastIndexOf(",");
  if (punto >= 0 && coma >= 0) {
    t = punto > coma ? t.replace(/,/g, "") : t.replace(/\./g, "").replace(",", ".");
  } else if (punto >= 0 || coma >= 0) {
    const sep = punto >= 0 ? "." : ",";
    const grupos = new RegExp(`^[+-]?\\d{1,3}(\\${sep}\\d{3})+$`).test(t);
    if (grupos && (entero || t.split(sep).length > 2)) t = t.split(sep).join("");
    else if (sep === ",") t = t.replace(",", ".");
    if (t.split(".").length > 2) return null;
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// web/src/logica/reloj.js
var CLAVE = /^[0-9a-f]{64}$/;
var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
var OPCION = {
  hecha: "✓ Hecha",
  cambiar: "✎ Cambiar kilos o reps",
  saltar: "⏭ Saltar este ejercicio",
  terminar: "■ Terminar la sesión",
  otra: "↺ Otra sesión"
};
var unidadDe = (u) => u === "lb" ? "lb" : "kg";
var cargaTxt = (kg, u) => pesoTxt(kg, 2, unidadDe(u));
function mapasHechas(hechas = []) {
  const porPauta = {}, cuenta = {};
  for (const s of hechas || []) {
    (porPauta[s.sesion_ejercicio_id] ||= {})[s.numero] = s;
  }
  for (const [id, m] of Object.entries(porPauta)) cuenta[id] = Object.keys(m).length;
  return { porPauta, cuenta };
}
function propuestaReloj(se, ultimas, numero2, hechasSe = {}, { foco = null, progresionAuto = true, frenar = false, cambiado = false } = {}) {
  const nombre = se?.ejercicio?.nombre || "";
  const prescripcion = cambiado ? { ...se, carga_sugerida_kg: null, series_detalle: se.series_detalle ? se.series_detalle.map(({ kg, ...resto }) => resto) : se.series_detalle } : se;
  const ult = cambiado ? null : ultimas;
  const detalle = tieneDetalle(prescripcion);
  const sugerencia = progresionAuto && !frenar && !detalle ? sugerenciaProgresion(prescripcion, ult?.series, { nombre, foco, pautaAnterior: ult?.pauta }) : null;
  const deLaTop = propuestaSerie(prescripcion, ult?.series, 1, { sugerencia, pautaAnterior: ult?.pauta });
  const bo = esTopBackoff(prescripcion) ? propuestaBackoff(prescripcion, numero2, hechasSe, deLaTop, nombre) : null;
  if (bo) return bo;
  const previa = hechasSe[numero2 - 1];
  const o = objetivoSerie(prescripcion, numero2);
  if (o) {
    const base = previa ? { kg: previa.kg, reps: previa.reps } : propuestaSerie(prescripcion, ult?.series, numero2, { pautaAnterior: ult?.pauta });
    return { kg: o.kg ?? base.kg, reps: o.reps ?? base.reps, rpe: o.rpe ?? null, objetivo: o };
  }
  return previa ? { kg: previa.kg, reps: previa.reps } : propuestaSerie(prescripcion, ult?.series, numero2, { sugerencia, pautaAnterior: ult?.pauta });
}
var resolverReloj = (x) => descansoEfectivo(x, { defecto: DESCANSO_DEFECTO }).seg;
function serieSiguiente(estado) {
  const saltados = new Set(estado?.saltados || []);
  const lista = (estado?.ejercicios || []).filter((x) => !saltados.has(x.id));
  const { porPauta, cuenta } = mapasHechas(estado?.hechas);
  const ultima = [...estado?.hechas || []].filter((s) => lista.some((x) => x.id === s.sesion_ejercicio_id)).sort((a, b) => String(a.registrada_en).localeCompare(String(b.registrada_en))).pop();
  const proxima = ultima ? trasSerie(lista, cuenta, ultima.sesion_ejercicio_id, resolverReloj).siguiente : null;
  const sig = serieQueToca(lista, porPauta, proxima);
  if (!sig) return null;
  const se = lista.find((x) => x.id === sig.id);
  return se ? { se, numero: sig.numero, hechasSe: porPauta[se.id] || {} } : null;
}
var frenaHoy = (preparacion) => !!consejoPreparacion(preparacion)?.frenar;
function vistaReloj(estado) {
  const u = unidadDe(estado?.unidad);
  const otras = (estado?.otras || []).slice(0, 12);
  const extraOtras = otras.length ? { otras: otras.map((o) => o.nombre), otras_ids: Object.fromEntries(otras.map((o) => [o.nombre, o.id])) } : { otras: [], otras_ids: {} };
  if (!estado?.sesion) {
    return { ok: true, estado: "nada", titulo: "Nada que entrenar", texto: "No tienes ninguna sesión pendiente esta semana. ¡A descansar!", opciones: [], acciones: {}, ...extraOtras };
  }
  const s = estado.sesion;
  const base = { ok: true, sesion_id: s.id, sesion: s.nombre, unidad: u, ...extraOtras };
  if (s.completada) return { ...base, estado: "nada", titulo: s.nombre, texto: `${s.nombre}: ya está hecha.`, opciones: [], acciones: {} };
  if (s.tipo === "cardio" || !(estado.ejercicios || []).length) {
    const opciones2 = [OPCION.terminar, ...otras.length ? [OPCION.otra] : []];
    return {
      ...base,
      estado: "cardio",
      titulo: s.nombre,
      texto: `${s.nombre}
${s.tipo === "cardio" ? "Es de cardio: llévala con el Entreno del reloj y, al acabar, termínala aquí o en la app." : "No tiene ejercicios que apuntar desde el reloj."}`,
      opciones: opciones2,
      acciones: accionesDe(opciones2)
    };
  }
  const sig = serieSiguiente(estado);
  if (!sig) {
    const opciones2 = [OPCION.terminar, ...otras.length ? [OPCION.otra] : []];
    return { ...base, estado: "terminar", titulo: s.nombre, texto: `${s.nombre}
No queda ninguna serie. ¿La terminas?`, opciones: opciones2, acciones: accionesDe(opciones2) };
  }
  const { se, numero: numero2, hechasSe } = sig;
  const sustituto = Object.values(hechasSe).find((x) => x.sustituto_id)?.sustituto_id || null;
  let prop = null;
  try {
    prop = propuestaReloj(
      se,
      estado.ultimas?.[se.ejercicio_id] || null,
      numero2,
      hechasSe,
      { foco: estado.foco, progresionAuto: estado.progresion_auto !== false, frenar: frenaHoy(estado.preparacion), cambiado: !!sustituto }
    );
  } catch {
    prop = null;
  }
  let kg = prop?.kg != null && Number(prop.kg) > 0 ? Number(prop.kg) : null;
  if (kg != null && u === "lb" && !(hechasSe[numero2 - 1] && Number(hechasSe[numero2 - 1].kg) === kg)) kg = redondearCarga(kg, "lb");
  const reps = prop?.reps != null ? Number(prop.reps) : null;
  const etiqueta = etiquetasSuperserie(estado.ejercicios)[se.id];
  const nombre = `${etiqueta ? `${etiqueta} ` : ""}${se.ejercicio?.nombre || "Ejercicio"}${sustituto ? " (cambiado)" : ""}`;
  const serie = nombreSerie(se, numero2);
  const esfuerzo = objetivoEsfuerzo(se, prop);
  const carga = kg != null ? `${cargaTxt(kg, u)}${reps != null ? ` × ${reps}` : ""}` : reps != null ? `${reps} reps` : null;
  const previa = (estado.ultimas?.[se.ejercicio_id]?.series || []).find((x) => Number(x.numero) === numero2);
  const ultimaVez = !sustituto && previa ? `La última vez: ${Number(previa.kg) > 0 ? `${cargaTxt(previa.kg, u)} × ${previa.reps ?? "—"}` : `${previa.reps ?? "—"} reps`}` : null;
  const opciones = [`${OPCION.hecha}${carga ? ` · ${carga}` : ""}`, OPCION.cambiar, OPCION.saltar, OPCION.terminar, ...otras.length ? [OPCION.otra] : []];
  const acciones = accionesDe(opciones);
  return {
    ...base,
    estado: "serie",
    titulo: nombre,
    texto: [nombre, serie, [carga, esfuerzo].filter(Boolean).join(" · "), ultimaVez].filter(Boolean).join("\n"),
    serie,
    carga,
    esfuerzo,
    ref: `${se.id}:${numero2}`,
    // Lo que sale por defecto al cambiar (en la unidad del reloj, sin redondeos raros)
    kg: kg != null ? vista(kg, u) : null,
    reps,
    opciones,
    acciones
  };
}
function accionesDe(opciones) {
  const m = {};
  for (const o of opciones) {
    if (o.startsWith(OPCION.hecha)) m[o] = "hecha";
    else if (o === OPCION.cambiar) m[o] = "cambiar";
    else if (o === OPCION.saltar) m[o] = "saltar";
    else if (o === OPCION.terminar) m[o] = "terminar";
    else if (o === OPCION.otra) m[o] = "otra";
  }
  return m;
}
var ACCIONES = ["ver", "hecha", "cambiar", "saltar", "terminar", "elegir", "otra"];
function limpiarPeticion(cuerpo, unidad = "kg") {
  const c = cuerpo && typeof cuerpo === "object" && !Array.isArray(cuerpo) ? cuerpo : {};
  const corto = (v) => typeof v === "string" || typeof v === "number" ? String(v).slice(0, 40) : null;
  let accion = corto(c.accion);
  accion = accion && ACCIONES.includes(accion.trim().toLowerCase()) ? accion.trim().toLowerCase() : "ver";
  let ref = null;
  const m = corto(c.ref)?.match(/^([0-9a-f-]{36}):(\d{1,2})$/i);
  if (m && UUID.test(m[1])) ref = { pauta: m[1].toLowerCase(), numero: Number(m[2]) };
  const n = (v, { entero = false, min = 0, max = 9999 } = {}) => {
    const x = numero(corto(v) ?? v, { entero });
    if (x == null || x < min || x > max) return null;
    return entero ? Math.round(x) : x;
  };
  const kgVista = n(c.kg, { max: 9999 });
  const sesion = corto(c.sesion)?.trim();
  return {
    accion,
    ref,
    kg: kgVista == null ? null : deVista(kgVista, unidadDe(unidad)),
    reps: n(c.reps, { entero: true, max: 1e3 }),
    rir: n(c.rir, { max: 10 }),
    rpe: n(c.rpe, { min: 1, max: 10 }),
    sesion: sesion && UUID.test(sesion) ? sesion.toLowerCase() : null
  };
}
function trasGuardar(estadoAntes, pauta, kg, reps, unidad) {
  const u = unidadDe(unidad);
  const saltados = new Set(estadoAntes?.saltados || []);
  const lista = (estadoAntes?.ejercicios || []).filter((x) => !saltados.has(x.id));
  const { cuenta } = mapasHechas(estadoAntes?.hechas);
  const yaEstaba = (estadoAntes?.hechas || []).some((s) => s.sesion_ejercicio_id === pauta.pauta && s.numero === pauta.numero);
  const cuentaTras = { ...cuenta, [pauta.pauta]: (cuenta[pauta.pauta] || 0) + (yaEstaba ? 0 : 1) };
  const t = lista.some((x) => x.id === pauta.pauta) ? trasSerie(lista, cuentaTras, pauta.pauta, resolverReloj) : { descanso: null };
  const descanso = Number(t.descanso) || 0;
  const hecho = Number(kg) > 0 ? `${cargaTxt(kg, u)} × ${reps ?? "—"}` : `${reps ?? "—"} reps`;
  return { descanso_seg: descanso, mensaje: `Guardada: ${hecho}.${descanso ? ` Descanso ${mmss(descanso)}.` : t.enRonda ? " Sigue con el siguiente de la superserie." : ""}` };
}
var MENSAJES_RELOJ = {
  clave: "Esta clave ya no vale: crea otra en la app (Perfil → Apple Watch) y pégala en el atajo.",
  baja: "Tu cuenta está de baja: desde el reloj ya no se apunta nada.",
  sesion: "Esa sesión ya no está disponible: vuelve a abrir el atajo.",
  terminada: "Esa sesión ya está terminada.",
  datos: "Faltan los kilos o las repeticiones (o no valen)."
};

// supabase/functions/reloj/reloj.js
var MAX_CUERPO = 8 * 1024;
var json = (d, estado = 200) => new Response(JSON.stringify(d), { status: estado, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
var fallo = (error, estado = 422) => json({ ok: false, error, mensaje: MENSAJES_RELOJ[error] || "No se ha podido hacer" }, estado);
var estadoHttp = (e) => e === "clave" ? 401 : e === "baja" ? 403 : e === "sesion" || e === "terminada" ? 409 : 422;
async function atender(req, { env = {}, f = globalThis.fetch } = {}) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { Allow: "POST, OPTIONS" } });
  if (req.method !== "POST") return json({ ok: false, mensaje: "Usa POST" }, 405);
  if (!env.SUPABASE_URL || !claveServicio(env)) return json({ ok: false, mensaje: "Falta la configuración de Supabase en la función" }, 500);
  const clave = (req.headers.get("x-fbe-clave") || "").trim();
  if (!CLAVE.test(clave)) return fallo("clave", 401);
  if (Number(req.headers.get("content-length") || 0) > MAX_CUERPO) return json({ ok: false, mensaje: "Demasiados datos" }, 413);
  const crudo = await req.text();
  if (crudo.length > MAX_CUERPO) return json({ ok: false, mensaje: "Demasiados datos" }, 413);
  let cuerpo = {};
  if (crudo.trim()) {
    try {
      cuerpo = JSON.parse(crudo);
    } catch {
      return json({ ok: false, mensaje: "El atajo tiene que mandar un JSON" }, 400);
    }
  }
  const base = clienteBase(env, f);
  const rpc = async (nombre, args) => base.rpc(nombre, args);
  try {
    let estado = await rpc("reloj_estado", { p_clave: clave, p_sesion: null });
    if (!estado?.ok) return fallo(estado?.error || "clave", estadoHttp(estado?.error));
    const p = limpiarPeticion(cuerpo, estado.unidad);
    if (p.accion === "otra" && p.sesion) p.accion = "elegir";
    const vista2 = vistaReloj(estado);
    if (p.accion === "ver" || p.accion === "otra") return json({ ...vista2, mensaje: vista2.texto });
    if (p.accion === "hecha" || p.accion === "cambiar") {
      const ref = p.ref || (vista2.ref ? limpiarPeticion({ ref: vista2.ref }).ref : null);
      if (!ref) return json({ ...vista2, ok: false, error: "datos", mensaje: "No hay ninguna serie que apuntar." }, 409);
      let kg = p.kg, reps = p.reps;
      if (kg == null && reps == null && vista2.ref === `${ref.pauta}:${ref.numero}`) {
        kg = vista2.kg != null ? limpiarPeticion({ kg: vista2.kg }, estado.unidad).kg : null;
        reps = vista2.reps;
      }
      const sustituto = (estado.hechas || []).find((s) => s.sesion_ejercicio_id === ref.pauta && s.sustituto_id)?.sustituto_id || null;
      const r = await rpc("reloj_serie", { p_clave: clave, p_pauta: ref.pauta, p_numero: ref.numero, p_kg: kg, p_reps: reps, p_rir: p.rir, p_sustituto: sustituto });
      if (!r?.ok) return fallo(r?.error || "datos", estadoHttp(r?.error));
      const tras = trasGuardar(estado, ref, kg, reps, estado.unidad);
      const despues = vistaReloj(await rpc("reloj_estado", { p_clave: clave, p_sesion: r.sesion_id || null }));
      return json({
        ...despues,
        ok: true,
        descanso_seg: tras.descanso_seg,
        mensaje: tras.mensaje,
        siguiente: despues.estado === "serie" ? `Después: ${despues.titulo} · ${despues.serie}${despues.carga ? ` · ${despues.carga}` : ""}` : despues.estado === "terminar" ? "No queda ninguna serie: termínala." : ""
      });
    }
    if (p.accion === "saltar") {
      const pauta = p.ref?.pauta || (vista2.ref ? vista2.ref.split(":")[0] : null);
      if (!pauta) return json({ ...vista2, ok: false, error: "datos", mensaje: "No hay ningún ejercicio que saltar." }, 409);
      const r = await rpc("reloj_saltar", { p_clave: clave, p_pauta: pauta });
      if (!r?.ok) return fallo(r?.error || "datos", estadoHttp(r?.error));
      const despues = vistaReloj(await rpc("reloj_estado", { p_clave: clave, p_sesion: null }));
      return json({ ...despues, ok: true, descanso_seg: 0, mensaje: `Saltado.${despues.estado === "serie" ? ` Ahora: ${despues.titulo}` : ""}` });
    }
    if (p.accion === "elegir") {
      if (!p.sesion) return json({ ...vista2, ok: false, error: "datos", mensaje: "Elige una sesión." }, 422);
      const r = await rpc("reloj_elegir", { p_clave: clave, p_sesion: p.sesion });
      if (!r?.ok) return fallo(r?.error || "sesion", estadoHttp(r?.error));
      const despues = vistaReloj(await rpc("reloj_estado", { p_clave: clave, p_sesion: p.sesion }));
      return json({ ...despues, ok: true, mensaje: despues.texto });
    }
    if (p.accion === "terminar") {
      const sesion = p.sesion || vista2.sesion_id;
      if (!sesion) return json({ ...vista2, ok: false, error: "datos", mensaje: "No hay ninguna sesión que terminar." }, 409);
      const r = await rpc("reloj_terminar", { p_clave: clave, p_sesion: sesion, p_rpe: p.rpe, p_minutos: null });
      if (!r?.ok) return fallo(r?.error || "datos", estadoHttp(r?.error));
      return json({
        ok: true,
        estado: "hecha",
        descanso_seg: 0,
        opciones: [],
        acciones: {},
        mensaje: `¡Sesión terminada${r.minutos ? ` (${r.minutos} min)` : ""}! Abre la app cuando quieras para ver el resumen.`
      });
    }
    return json({ ...vista2, mensaje: vista2.texto });
  } catch {
    return json({ ok: false, mensaje: "No se ha podido conectar con la app: prueba otra vez en un momento." }, 503);
  }
}

// supabase/functions/reloj/index.ts
Deno.serve((req) => atender(req, { env: Deno.env.toObject() }));
