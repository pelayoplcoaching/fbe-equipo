// Demo v0.26: el recetario de Pelayo, Lucía (solo nutrición) y el menú de la semana de Lucía y de Ana.
// Recetas y cifras ficticias pero realistas (kcal = 4·P + 4·H + 9·G, redondeadas). Las fotos son ilustraciones
// hechas para la demo (fotos-recetas-demo.js).
import { sumarDias, lunesDe } from '../logica/fechas.js';
import { macrosDe } from '../logica/comidas.js';
import { FOTOS_RECETAS } from './fotos-recetas-demo.js';

const ing = (s) => s.split('\n').map((l) => {
  const [c, u, ...n] = l.split('|');
  return { nombre: n.join('|'), ...(c ? { cantidad: Number(c) } : {}), ...(u ? { unidad: u } : {}) };
});

export const RECETAS_DEMO = [
  { clave: 'tostadas', nombre: 'Tostadas con huevo y aguacate', tomas: ['desayuno'], raciones: 1, kcal: 465, proteina_g: 22, carbos_g: 38, grasa_g: 25, minutos: 10, etiquetas: ['Rápida', 'Vegetariana'],
    ingredientes: ing('60|g|Pan integral\n2|ud|Huevos\n70|g|Aguacate\n6|ud|Tomates cherry\n||Sal y pimienta'),
    preparacion: 'Tuesta el pan.\nHaz los huevos a la plancha o revueltos con unas gotas de aceite.\nAplasta el aguacate con un tenedor y úntalo en las tostadas.\nPon encima los huevos y los tomates en mitades; sal y pimienta al gusto.' },
  { clave: 'porridge', nombre: 'Porridge de avena con plátano', tomas: ['desayuno'], raciones: 1, kcal: 505, proteina_g: 38, carbos_g: 72, grasa_g: 7, minutos: 8, etiquetas: ['Alta en proteína', 'Dulce'],
    ingredientes: ing('50|g|Copos de avena\n200|ml|Leche desnatada\n1|ud|Plátano\n30|g|Proteína en polvo\n||Canela al gusto'),
    preparacion: 'Calienta la leche con la avena a fuego medio 4-5 minutos, removiendo, hasta que espese.\nApaga el fuego y mezcla la proteína (si la echas hirviendo se apelmaza).\nSirve con el plátano en rodajas y canela.' },
  { clave: 'yogur', nombre: 'Yogur griego con frutos rojos y nueces', tomas: ['desayuno', 'merienda'], raciones: 1, kcal: 265, proteina_g: 22, carbos_g: 22, grasa_g: 10, minutos: 3, etiquetas: ['Rápida', 'Para llevar'],
    ingredientes: ing('200|g|Yogur griego 0 %\n100|g|Frutos rojos\n15|g|Nueces\n1|cdta|Miel'),
    preparacion: 'Pon el yogur en un bol, los frutos rojos encima y las nueces troceadas.\nUn hilo de miel, si te apetece.' },
  { clave: 'curry', nombre: 'Pollo al curry con arroz basmati', tomas: ['comida', 'cena'], raciones: 2, kcal: 525, proteina_g: 42, carbos_g: 62, grasa_g: 12, minutos: 25, etiquetas: ['Batch cooking'],
    ingredientes: ing('300|g|Pechuga de pollo\n140|g|Arroz basmati\n1|ud|Cebolla\n200|ml|Leche de coco light\n1|cda|Curry en polvo\n100|g|Espinacas frescas'),
    preparacion: 'Cuece el arroz (unos 12 minutos) y escúrrelo.\nDora la cebolla picada con una cucharadita de aceite y añade el pollo en dados.\nCuando el pollo esté hecho por fuera, echa el curry, remueve y añade la leche de coco.\nCocina 8 minutos a fuego suave y añade las espinacas al final, hasta que se ablanden.\nSirve con el arroz. Aguanta 3 días en la nevera.' },
  { clave: 'lentejas', nombre: 'Lentejas estofadas con verduras', tomas: ['comida'], raciones: 4, kcal: 380, proteina_g: 22, carbos_g: 55, grasa_g: 8, minutos: 40, etiquetas: ['Batch cooking', 'Vegana'],
    ingredientes: ing('320|g|Lentejas pardinas\n2|ud|Zanahorias\n1|ud|Pimiento verde\n1|ud|Cebolla\n2|diente|Ajo\n1|cda|Pimentón dulce\n2|cda|Aceite de oliva\n1|ud|Hoja de laurel'),
    preparacion: 'Pica la cebolla, el pimiento, los ajos y la zanahoria y sofríelos con el aceite 8 minutos.\nAñade el pimentón, remueve y echa enseguida las lentejas lavadas y el laurel.\nCubre con agua (unos tres dedos por encima) y cuece a fuego suave 30-35 minutos.\nSala al final. Congelan muy bien en raciones.' },
  { clave: 'salmon', nombre: 'Salmón al horno con patata y brócoli', tomas: ['cena', 'comida'], raciones: 1, kcal: 485, proteina_g: 34, carbos_g: 38, grasa_g: 22, minutos: 30, etiquetas: ['Sin gluten'],
    ingredientes: ing('150|g|Lomo de salmón\n200|g|Patata\n150|g|Brócoli\n1|cdta|Aceite de oliva\n||Limón, sal y eneldo'),
    preparacion: 'Corta la patata en rodajas finas y hornéala a 200 °C 15 minutos con el aceite.\nAñade el salmón y el brócoli en ramilletes y hornea 12 minutos más.\nTermina con limón, sal y eneldo.' },
  { clave: 'tortilla', nombre: 'Tortilla de claras con pavo y ensalada', tomas: ['cena'], raciones: 1, kcal: 255, proteina_g: 32, carbos_g: 12, grasa_g: 9, minutos: 10, etiquetas: ['Rápida', 'Alta en proteína'],
    ingredientes: ing('200|ml|Claras de huevo\n50|g|Pechuga de pavo\n1|ud|Huevo\n||Ensalada variada\n1|cdta|Aceite de oliva'),
    preparacion: 'Bate las claras con el huevo y cuaja la tortilla en una sartén antiadherente.\nRellénala con el pavo en tiras antes de doblarla.\nAcompaña con la ensalada aliñada con el aceite.' },
  { clave: 'bocadillo', nombre: 'Bocadillo de atún con tomate', tomas: ['media_manana', 'merienda'], raciones: 1, kcal: 330, proteina_g: 24, carbos_g: 40, grasa_g: 8, minutos: 5, etiquetas: ['Para llevar', 'Rápida'],
    ingredientes: ing('80|g|Pan integral\n1|lata|Atún al natural\n1|ud|Tomate'),
    preparacion: 'Abre el pan, ralla o corta el tomate en rodajas y añade el atún escurrido.' },
  { clave: 'garbanzos', nombre: 'Ensalada de garbanzos, atún y huevo', tomas: ['comida'], raciones: 1, kcal: 460, proteina_g: 35, carbos_g: 40, grasa_g: 18, minutos: 10, etiquetas: ['Para llevar'],
    ingredientes: ing('150|g|Garbanzos cocidos\n1|lata|Atún al natural\n1|ud|Huevo cocido\n1|ud|Tomate\n||Cebolleta y pimiento al gusto\n1|cda|Aceite de oliva'),
    preparacion: 'Lava y escurre los garbanzos.\nTrocea el tomate, la cebolleta y el pimiento, y mézclalo todo con el atún y el huevo en cuartos.\nAliña con el aceite, vinagre y sal.' },
  { clave: 'batido', nombre: 'Batido de proteína con plátano', tomas: ['merienda', 'recena'], raciones: 1, kcal: 260, proteina_g: 28, carbos_g: 30, grasa_g: 3, minutos: 2, etiquetas: ['Rápida', 'Alta en proteína'],
    ingredientes: ing('30|g|Proteína en polvo\n1|ud|Plátano\n250|ml|Leche desnatada'),
    preparacion: 'Bátelo todo 30 segundos. Con hielo, más fresco.' },
];

// db: la base de la demo; ctx: { hoy, uuid, usuario, ahoraISO, ana }
export function sembrarComidas(db, { hoy, uuid, usuario, ahoraISO, ana }) {
  const lunesHoy = lunesDe(hoy);
  Object.assign(db, { recetas: [], recetas_atleta: [], comidas_atleta: [], menu_comidas: [] });
  const R = {};
  for (const { clave, ...r } of RECETAS_DEMO) {
    const f = FOTOS_RECETAS[clave] || {};
    const fila = { id: uuid(), ...r, foto: f.foto || null, foto_mini: f.mini || null, creada_en: ahoraISO, actualizada_en: ahoraISO };
    db.recetas.push(fila);
    R[clave] = fila;
  }

  // Lucía: solo nutrición. Cuatro comidas al día, plan de kcal y macros, su recetario y su menú de esta semana
  const perfil = usuario('lucia@fbe.demo', 'Lucía', 'atleta');
  const lucia = { id: uuid(), perfil_id: perfil, nombre: 'Lucía Ferrer', email: 'lucia@fbe.demo', estado: 'activo', fecha_alta: sumarDias(lunesHoy, -35), objetivo: 'Comer mejor y bajar 4 kg sin pasar hambre',
    notion_url: null, progresion_auto: true, volumen_objetivo: null, nutricion: true, entrenamiento: false, nivel: null, creado_en: ahoraISO };
  db.atletas.push(lucia);
  for (const tipo of ['privacidad', 'datos_salud']) db.consentimientos.push({ id: uuid(), perfil_id: perfil, tipo, version: '2026-10', aceptado_en: ahoraISO, revocado_en: null });
  db.comidas_atleta.push({ atleta_id: lucia.id, tomas: ['desayuno', 'comida', 'merienda', 'cena'], actualizado_en: ahoraISO });
  db.planes_nutricion.push({ id: uuid(), atleta_id: lucia.id, desde: sumarDias(lunesHoy, -28), modo: 'macros', fase: 'perder', ritmo_pct: -0.5, kcal: 1750, proteina_g: 115, carbos_g: 200, grasa_g: 55, fibra_g: 25,
    kcal_descanso: null, carbos_descanso_g: null, grasa_descanso_g: null, motivo: null, creado_en: ahoraISO,
    pautas: 'Elige cada día una opción de tu recetario para cada comida: todas cuadran con tu plan.\nSi un día comes fuera, apúntalo en el menú como texto y sigue con normalidad.\nAgua como bebida habitual.' });
  // Pesos de las últimas semanas (bajando despacio)
  for (let d = 34; d >= 0; d -= 2) db.pesos.push({ id: uuid(), atleta_id: lucia.id, fecha: sumarDias(hoy, -d), kg: Math.round((71.4 - 0.06 * (34 - d) + ((d * 7) % 5 - 2) * 0.12) * 10) / 10, notas: null });
  const asignar = (atleta, clave, toma, extra = {}) => {
    const a = { id: uuid(), atleta_id: atleta.id, receta_id: R[clave].id, toma, factor: 1, orden: 0, nota: null, favorita: false, cambio_pedido_en: null, cambio_nota: null, creada_en: ahoraISO, ...extra };
    db.recetas_atleta.push(a);
    return a;
  };
  const recLucia = [
    asignar(lucia, 'tostadas', 'desayuno', { favorita: true }), asignar(lucia, 'porridge', 'desayuno'), asignar(lucia, 'yogur', 'desayuno'),
    asignar(lucia, 'curry', 'comida', { nota: 'Haz las dos raciones el domingo: una para el lunes y otra para el miércoles.' }), asignar(lucia, 'lentejas', 'comida'), asignar(lucia, 'garbanzos', 'comida'),
    asignar(lucia, 'yogur', 'merienda'), asignar(lucia, 'bocadillo', 'merienda', { factor: 0.75, cambio_pedido_en: new Date(Date.now() - 5 * 3600e3).toISOString(), cambio_nota: 'El atún entre semana me cansa: ¿algo con pavo o queso fresco?' }),
    asignar(lucia, 'salmon', 'cena'), asignar(lucia, 'tortilla', 'cena', { favorita: true }), asignar(lucia, 'curry', 'cena'),
  ];
  const deLucia = (clave, toma) => recLucia.find((a) => a.receta_id === R[clave].id && a.toma === toma);
  // Su menú: lo de esta semana hasta mañana (lo de antes de hoy, comido), y la semana pasada entera
  const plan = [['tostadas', 'curry', 'yogur', 'tortilla'], ['porridge', 'lentejas', 'bocadillo', 'salmon'], ['yogur', 'curry', 'yogur', 'tortilla'], ['tostadas', 'garbanzos', 'bocadillo', 'salmon'],
    ['porridge', 'lentejas', 'yogur', 'tortilla'], ['tostadas', null, 'yogur', 'curry'], ['porridge', 'garbanzos', null, 'salmon']];
  const tomas = ['desayuno', 'comida', 'merienda', 'cena'];
  for (const semana of [-7, 0]) {
    for (let i = 0; i < 7; i++) {
      const fecha = sumarDias(lunesHoy, semana + i);
      if (fecha > sumarDias(hoy, 1)) continue;
      plan[i].forEach((clave, k) => {
        const toma = tomas[k];
        const a = clave ? deLucia(clave, toma) : null;
        const hecho = fecha < hoy || (fecha === hoy && k === 0);
        if (!a) {
          if (i === 5 && k === 1) db.menu_comidas.push({ id: uuid(), atleta_id: lucia.id, fecha, toma, receta_id: null, texto: 'Comida familiar (paella)', raciones: 1, kcal: 650, proteina_g: 30, carbos_g: null, grasa_g: null, hecho, orden: 0, creado_en: ahoraISO });
          return;
        }
        db.menu_comidas.push({ id: uuid(), atleta_id: lucia.id, fecha, toma, receta_id: a.receta_id, texto: R[clave].nombre, raciones: 1, ...macrosDe(R[clave], a.factor, 1), hecho, orden: 0, creado_en: ahoraISO });
      });
    }
  }
  // Lo que ha apuntado de nutrición (los totales de su menú), los días que ya pasaron
  const porDia = {};
  for (const e of db.menu_comidas.filter((x) => x.atleta_id === lucia.id && x.fecha < hoy)) (porDia[e.fecha] ||= []).push(e);
  for (const [fecha, xs] of Object.entries(porDia)) {
    const s = (k) => Math.round(xs.reduce((t, e) => t + (Number(e[k]) || 0), 0));
    db.registros_nutricion.push({ id: uuid(), atleta_id: lucia.id, fecha, kcal: s('kcal'), proteina_g: s('proteina_g'), carbos_g: s('carbos_g'), grasa_g: s('grasa_g'), fibra_g: null, completo: xs.every((e) => e.receta_id), cumplido: null, nota: null, actualizado_en: ahoraISO });
  }
  db.habitos.push({ id: uuid(), atleta_id: lucia.id, nombre: 'Pasos', tipo: 'numero', objetivo: 8000, unidad: 'pasos', sentido: 'al_menos', dias_semana: 7, icono: 'pasos', orden: 0, activo: true, creado_en: ahoraISO });
  db.checkins.push({ id: uuid(), atleta_id: lucia.id, semana_inicio: sumarDias(lunesHoy, -7), horas_sueno: '7-8', energia: 4, recuperacion: 4, motivacion: 5, fc_reposo: null, hrv: null,
    adherencia_desayuno: 5, adherencia_comida: 4, adherencia_merienda: 4, adherencia_cena: 5, calorias_media: null, pasos_media: 8400, saciedad: 3, satisfaccion_dieta: 5,
    notas: 'Muy contenta con las recetas: el curry del domingo me salva la semana.', creado_en: ahoraISO, revisado_en: ahoraISO, respuestas: null });

  // Ana (entrenamiento y nutrición): unas pocas recetas y su menú de hoy
  if (ana) {
    const recAna = [asignar(ana, 'porridge', 'desayuno', { factor: 1.25, favorita: true }), asignar(ana, 'curry', 'comida', { factor: 1.25 }), asignar(ana, 'salmon', 'cena'), asignar(ana, 'batido', 'merienda')];
    for (const a of recAna) {
      const r = db.recetas.find((x) => x.id === a.receta_id);
      db.menu_comidas.push({ id: uuid(), atleta_id: ana.id, fecha: hoy, toma: a.toma, receta_id: r.id, texto: r.nombre, raciones: 1, ...macrosDe(r, a.factor, 1), hecho: a.toma === 'desayuno', orden: 0, creado_en: ahoraISO });
    }
  }
  return lucia;
}
