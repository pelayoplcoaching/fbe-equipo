// La foto del plato y comer fuera (v0.174, migración 079).
//  - La foto del plato: el atleta hace una foto de lo que come y esa comida queda hecha. Se guarda reducida (lado largo
//    1024 px) con su miniatura (160 px), 30 días.
//  - Comer fuera: marca la comida como hecha fuera de casa, le sale una pauta corta y cuenta como hecha.
// Aquí, lo que no toca el navegador: los límites, los textos y la pauta.

export const TEXTO_FOTO = 'Foto del plato';
export const TEXTO_FUERA = 'Comida fuera';
export const DIAS_FOTO = 30;
export const LADO_FOTO = 1024;
export const LADO_MINI = 160;
export const MAX_FOTO = 380000;  // caracteres del data URL (la base admite 400 000)
export const MAX_MINI = 22000;   // (la base admite 24 000)
export const FOTOS_POR_DIA = 12;

const DATA_JPEG = /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/;
export const fotoValida = (s, max = MAX_FOTO) => typeof s === 'string' && s.length >= 200 && s.length <= max && DATA_JPEG.test(s);

// Hasta cuándo se ve la foto de una comida: 30 días desde que se subió
export function fotoVigente(creadoEn, ahora = Date.now()) {
  const t = Date.parse(creadoEn);
  return Number.isFinite(t) && ahora - t < DIAS_FOTO * 864e5;
}
// Se puede subir la foto de una comida de los últimos 7 días (y de mañana, por los viajes)
export function fechaAdmiteFoto(fecha, hoy) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fecha)) || !/^\d{4}-\d{2}-\d{2}$/.test(String(hoy))) return false;
  const d = Math.round((Date.parse(fecha) - Date.parse(hoy)) / 864e5);
  return d >= -7 && d <= 1;
}

// La proteína a buscar en una comida fuera: la del día entre sus comidas principales, redondeada a 5 g (de 20 a 60)
const PRINCIPALES = ['desayuno', 'comida', 'cena'];
export function proteinaPorComida(proteinaDia, tomas = []) {
  const p = Number(proteinaDia);
  if (!Number.isFinite(p) || p <= 0) return null;
  const n = Math.max(2, Math.min(5, (tomas || []).filter((t) => PRINCIPALES.includes(t)).length + ((tomas || []).length > 3 ? 1 : 0) || 3));
  return Math.min(60, Math.max(20, Math.round(p / n / 5) * 5));
}

// La pauta corta de comer fuera, según la comida del día. proteina: gramos a buscar (o null, sin plan)
const LIGERAS = ['desayuno', 'media_manana', 'merienda', 'recena'];
export function pautaFuera({ toma = 'comida', proteina = null } = {}) {
  const g = proteina ? ` Busca unos ${proteina} g.` : '';
  if (LIGERAS.includes(toma)) {
    return {
      titulo: 'Fuera de casa, sin complicarte',
      puntos: [
        `Que lleve algo de proteína: huevos, jamón, yogur, queso fresco o un bocadillo de lomo, pavo o tortilla.${g}`,
        'Pan, tostada o fruta antes que bollería.',
        'El café o la infusión, como siempre; el zumo, mejor la fruta entera.',
        'Y ya está: lo apuntas como hecho y sigues con tu plan en la siguiente comida.',
      ],
    };
  }
  return {
    titulo: 'Comer fuera, sin salirte del plan',
    puntos: [
      `Elige primero la proteína: carne, pescado, huevos o legumbre.${g || ' Una ración como la palma de tu mano, o algo más.'}`,
      'Verdura o ensalada de acompañamiento, si la hay.',
      'El hidrato, a ojo: un puño de arroz, pasta, patata o pan. No hace falta pesar nada.',
      'Salsas, fritos y postre: elige uno, no los tres.',
      'Come sin prisa y para cuando estés bien. En la siguiente comida sigues con tu plan tal cual: una comida no cambia la semana.',
    ],
  };
}

// Las fotos de una semana, por día (para la tira de la revisión semanal)
export function fotosPorDia(fotos = []) {
  const out = {};
  for (const f of fotos || []) (out[f.fecha] ||= []).push(f);
  return out;
}
