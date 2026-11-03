// El selector de emojis del chat (v0.55): una selección propia de unos cuatrocientos, por categorías, sin librerías ni
// imágenes (los pinta el sistema). Los recientes se guardan en el propio móvil.
const lista = (s) => s.trim().split(/\s+/);

export const CATEGORIAS_EMOJI = [
  ['caras', 'Caras', '😀', lista(`😀 😃 😄 😁 😆 😅 🤣 😂 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😗 😚 😙 🥲 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🫢 🤫 🤔 🫡
    🤐 🤨 😐 😑 😶 🫥 😏 😒 🙄 😬 😮‍💨 🤥 😌 😔 😪 🤤 😴 😷 🤒 🤕 🤢 🤮 🤧 🥵 🥶 🥴 😵 😵‍💫 🤯 🤠 🥳 🥸 😎 🤓 🧐 😕 🫤 😟 🙁
    😮 😯 😲 😳 🥺 🥹 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 😈 💀 🤡 👻 👽 🤖 💩 😺 😸 😹 😻 😼 😽 🙀 😿 😾`)],
  ['gestos', 'Gestos y personas', '👍', lista(`👍 👎 👊 ✊ 🤛 🤜 👏 🙌 🫶 👐 🤲 🤝 🙏 ✌️ 🤞 🫰 🤟 🤘 👌 🤌 🤏 👈 👉 👆 👇 ☝️ ✋ 🤚 🖐️ 🖖 👋 🤙
    💪 🦾 🦵 🦶 👂 👃 🧠 🫀 🫁 🦷 🦴 👀 👁️ 👅 👄 🫦 🧍 🧎 🏃 🏃‍♀️ 🚶 🚶‍♀️ 💃 🕺 🧘 🧘‍♀️ 🙋 🙋‍♀️ 🤷 🤷‍♀️ 🤦 🤦‍♀️ 🙆 🙆‍♀️ 🙅 🙅‍♀️ 👨‍👩‍👧 👶`)],
  ['deporte', 'Deporte', '🏋️', lista(`🏋️ 🏋️‍♀️ 🤸 🤸‍♀️ 🤼 🤾 🧗 🧗‍♀️ 🚴 🚴‍♀️ 🚵 🏊 🏊‍♀️ 🤽 🚣 🏄 🏄‍♀️ ⛹️ ⛹️‍♀️ 🤺 🏇 🥊 🥋 ⚽ 🏀 🏈 ⚾ 🥎 🎾 🏐 🏉 🥏
    🏓 🏸 🏒 🏑 🥍 🏏 ⛳ 🏹 🎣 🤿 🛹 🛼 ⛸️ 🥌 🎿 ⛷️ 🏂 🪂 🏆 🥇 🥈 🥉 🏅 🎖️ 🎽 👟 🩳 🧢 ⏱️ ⌚ 🔥 💯 🎯`)],
  ['comida', 'Comida', '🥗', lista(`🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍈 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🥑 🍆 🥔 🥕 🌽 🌶️ 🫑 🥒 🥬 🥦 🧄 🧅 🍄 🥜 🫘
    🌰 🍞 🥐 🥖 🫓 🥨 🥯 🥞 🧇 🧀 🍖 🍗 🥩 🥓 🍔 🍟 🍕 🌭 🥪 🌮 🌯 🥙 🧆 🥚 🍳 🥘 🍲 🥣 🥗 🍿 🧈 🧂 🥫 🍱 🍘 🍙 🍚 🍛 🍜 🍝 🍠
    🍣 🍤 🥟 🍦 🍰 🎂 🧁 🍫 🍬 🍯 🥛 🍼 ☕ 🍵 🧃 🥤 🧋 🍺 🍷 🥂 🍹 💧`)],
  ['naturaleza', 'Naturaleza', '🌿', lista(`🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐔 🐧 🐦 🐤 🦅 🦉 🐺 🐗 🐴 🦄 🐝 🦋 🐌 🐞 🐢 🐍 🐙 🐬 🐳
    🦈 🐘 🦒 🦘 🐾 🌵 🌲 🌳 🌴 🌱 🌿 ☘️ 🍀 🍁 🍂 🌷 🌹 🌻 🌼 🌸 💐 🌞 🌝 🌚 🌙 ⭐ 🌟 ✨ ⚡ ☀️ 🌤️ ⛅ 🌧️ ⛈️ ❄️ ☃️ 🌈 🌊`)],
  ['viajes', 'Viajes y sitios', '✈️', lista(`🚗 🚕 🚙 🚌 🚎 🏎️ 🚓 🚑 🚲 🛴 🛵 🏍️ 🚂 🚆 🚇 ✈️ 🛫 🛬 🚀 🛳️ ⛵ 🚢 🗺️ 🧭 🏔️ ⛰️ 🏕️ 🏖️ 🏝️ 🏟️ 🏠 🏡 🏢 🏥 🏨 🏫 🏛️
    ⛪ 🕌 🗼 🗽 🎡 🎢 🌅 🌄 🌇 🌃 🎒 🧳 🛏️ 🛎️`)],
  ['objetos', 'Objetos', '📱', lista(`📱 💻 ⌨️ 🖥️ 🖨️ 📷 📸 🎥 📹 📺 📻 🎧 🎤 🎵 🎶 🎮 🧩 ⏰ ⏳ 📅 📆 🗓️ 📝 ✏️ 📌 📎 📏 📐 📒 📓 📔 📕 📗 📘 📙 📚
    📖 🔖 📄 📃 📊 📈 📉 🗂️ 📁 📦 📬 ✉️ 💌 🔑 🔒 🔓 💡 🔦 🧯 🛒 💊 🩹 🩺 🌡️ 🧴 🧼 🪥 🧻 🛁 🚿 💤 🎁 🎈 🎉 🎊 🪅 💰 💳`)],
  ['simbolos', 'Símbolos', '❤️', lista(`❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❤️‍🔥 ❤️‍🩹 💕 💞 💓 💗 💖 💘 💝 💟 ☮️ ✝️ ☯️ ♻️ ✅ ☑️ ✔️ ❌ ❎ ➕ ➖ ➗ ✖️ 💲
    ‼️ ⁉️ ❓ ❔ ❗ ❕ 〰️ ➰ ⭕ 🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ 🟥 🟧 🟨 🟩 🟦 🟪 ⬛ ⬜ 🔶 🔷 🔺 🔻 💠 🔘 🆗 🆕 🆙 🆒 🆓 🔝 🔜 ⬆️ ⬇️ ⬅️ ➡️
    ↩️ ↪️ 🔁 🔄 ⏩ ⏪ ⏸️ ⏹️ 1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣ 6️⃣ 7️⃣ 8️⃣ 9️⃣ 🔟 #️⃣ 💬 💭 🗯️ 🔇 🔔 🔕 📢 ⚠️ 🚫 ⛔ 📵 🇪🇸 🏳️ 🏴 🏁 🚩`)],
];
export const TODOS_EMOJIS = CATEGORIAS_EMOJI.flatMap(([, , , l]) => l);

// Los recientes (los últimos 24 usados, el último primero), en el móvil. almacen: localStorage (o algo como él); si
// falla, no pasa nada.
export const CLAVE_RECIENTES = 'fbe-emojis-recientes';
const MAX_RECIENTES = 24;
export function leerRecientes(almacen) {
  try {
    const x = JSON.parse(almacen?.getItem(CLAVE_RECIENTES) || '[]');
    return Array.isArray(x) ? x.filter((e) => typeof e === 'string' && TODOS_EMOJIS.includes(e)).slice(0, MAX_RECIENTES) : [];
  } catch { return []; }
}
export function apuntarReciente(almacen, emoji) {
  const lista = [emoji, ...leerRecientes(almacen).filter((e) => e !== emoji)].filter((e) => TODOS_EMOJIS.includes(e)).slice(0, MAX_RECIENTES);
  try { almacen?.setItem(CLAVE_RECIENTES, JSON.stringify(lista)); } catch { /* sin almacenamiento */ }
  return lista;
}
// Meter un emoji donde está el cursor (o en lugar de lo seleccionado): { texto, cursor }
export function insertarEnTexto(texto, emoji, inicio = null, fin = null) {
  const t = String(texto ?? '');
  const a = inicio == null ? t.length : Math.max(0, Math.min(t.length, inicio));
  const b = fin == null ? a : Math.max(a, Math.min(t.length, fin));
  return { texto: t.slice(0, a) + emoji + t.slice(b), cursor: a + emoji.length };
}

// ---------------------------------------------------------------------------------------------------------- v0.56
// Tonos de piel (como WhatsApp: se elige uno y lo llevan los emojis de manos y personas que lo admiten) y las seis
// reacciones rápidas, a elegir. Las dos cosas se guardan en el propio móvil, por cuenta.
export const TONOS_PIEL = [['', 'Amarillo (sin tono)', '✋'], ['\u{1F3FB}', 'Tono claro', '✋\u{1F3FB}'], ['\u{1F3FC}', 'Tono claro medio', '✋\u{1F3FC}'],
  ['\u{1F3FD}', 'Tono medio', '✋\u{1F3FD}'], ['\u{1F3FE}', 'Tono oscuro medio', '✋\u{1F3FE}'], ['\u{1F3FF}', 'Tono oscuro', '✋\u{1F3FF}']];
// Los que admiten tono (la base, sin el selector de variante U+FE0F): manos, gestos y personas
const CON_TONO = new Set(lista(`👍 👎 👊 ✊ 🤛 🤜 👏 🙌 🫶 👐 🤲 🙏 ✌ 🤞 🫰 🤟 🤘 👌 🤌 🤏 👈 👉 👆 👇 ☝ ✋ 🤚 🖐 🖖 👋 🤙 🫱 🫲 🫳 🫴 ✍ 💅 🤳
  💪 🦵 🦶 👂 🦻 👃 👶 🧒 👦 👧 🧑 👱 👨 🧔 👩 🧓 👴 👵 🙍 🙎 🙅 🙆 💁 🙋 🧏 🙇 🤦 🤷 👮 🕵 💂 🥷 👷 🤴 👸 👳 👲 🧕 🤵 👰 🤰 🤱 👼
  🎅 🤶 🦸 🦹 🧙 🧚 🧛 🧜 🧝 💆 💇 🚶 🧍 🧎 🏃 💃 🕺 🧖 🧗 🏇 🏂 🏌 🏄 🚣 🏊 ⛹ 🏋 🚴 🚵 🤸 🤽 🤾 🤹 🧘 🛀 🛌`));
const VS16 = '️';
const ZWJ = '‍';
const TONO = new RegExp('[\\u{1F3FB}-\\u{1F3FF}]', 'gu');
// ¿Admite tono? (el primer emoji de la secuencia: «🏋️‍♀️» lo lleva en la persona)
export function admiteTono(emoji) {
  const primero = [...String(emoji || '').replace(TONO, '')][0] || '';
  return CON_TONO.has(primero.replace(VS16, ''));
}
// El emoji con ese tono (o sin ninguno, con ''): el tono va justo detrás de la persona o la mano (y quita su U+FE0F)
export function conTono(emoji, tono = '') {
  const e = String(emoji || '').replace(TONO, '');
  if (!admiteTono(e)) return e;
  const partes = e.split(ZWJ);
  const cps = [...partes[0]];
  const base = cps[0];
  const resto = cps.slice(1).join('').replace(VS16, '');
  partes[0] = tono ? `${base}${tono}${resto}` : `${base}${cps.slice(1).join('')}`;
  return partes.join(ZWJ);
}
export const CLAVE_TONO = 'fbe-emoji-tono';
export function leerTono(almacen) {
  try { const t = almacen?.getItem(CLAVE_TONO) || ''; return TONOS_PIEL.some(([k]) => k === t) ? t : ''; } catch { return ''; }
}
export function guardarTono(almacen, tono) { try { almacen?.setItem(CLAVE_TONO, TONOS_PIEL.some(([k]) => k === tono) ? tono : ''); } catch { /* */ } }

// ¿Es un emoji (o una secuencia de emojis: tono, bandera, ZWJ) que vale como reacción? Lo mismo que pide la base (034):
// de 1 a 16 caracteres, solo de los bloques de emojis (ni letras, ni espacios, ni invisibles que no unan un emoji).
const BLOQUES_EMOJI = '\\u00a9\\u00ae\\u203c\\u2049\\u2122\\u2139\\u2194-\\u2199\\u21a9\\u21aa\\u231a\\u231b\\u2328\\u23cf\\u23e9-\\u23f3\\u23f8-\\u23fa\\u24c2\\u25aa\\u25ab\\u25b6\\u25c0\\u25fb-\\u25fe\\u2600-\\u27bf\\u2934\\u2935\\u2b05-\\u2b07\\u2b1b\\u2b1c\\u2b50\\u2b55\\u3030\\u303d\\u3297\\u3299\\u{1F000}-\\u{1FAFF}';
const UNE = '\\u200d\\ufe0f\\u20e3\\u{E0020}-\\u{E007F}';
const SOLO_EMOJI = new RegExp(`^[${BLOQUES_EMOJI}${UNE}]+$`, 'u');
const ALGO_VISIBLE = new RegExp(`[^${UNE}]`, 'u');
export function emojiValido(e) {
  const t = String(e ?? '');
  const n = t.length; // en la base, char_length cuenta puntos de código: aquí, los de JavaScript (UTF-16) son como mucho el doble
  return n >= 1 && [...t].length <= 16 && n <= 32 && SOLO_EMOJI.test(t) && ALGO_VISIBLE.test(t);
}

// Las seis reacciones rápidas (las de siempre si no se eligen otras): seis distintas y válidas
export const REACCIONES_DEFECTO = ['❤️', '👍', '💪', '😂', '😮', '🙏'];
const claveReacciones = (uid) => `fbe-reacciones-${uid || 'yo'}`;
export function normalReacciones(xs) {
  const out = [];
  for (const e of Array.isArray(xs) ? xs : []) if (emojiValido(e) && !out.includes(e) && out.length < 6) out.push(e);
  for (const e of REACCIONES_DEFECTO) if (out.length < 6 && !out.includes(e)) out.push(e);
  return out;
}
export function leerReacciones(almacen, uid) {
  try { return normalReacciones(JSON.parse(almacen?.getItem(claveReacciones(uid)) || 'null')); } catch { return [...REACCIONES_DEFECTO]; }
}
export function guardarReacciones(almacen, uid, xs) {
  const r = normalReacciones(xs);
  try { almacen?.setItem(claveReacciones(uid), JSON.stringify(r)); } catch { /* */ }
  return r;
}
