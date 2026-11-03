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
