// ¿Lleva algo visible un texto? Lo mismo que public.texto_visible (migración 009): no valen solo espacios
// (de cualquier tipo), saltos de línea, caracteres de control, de formato o invisibles (de ancho cero, de
// dirección del texto, selectores de variante, etiquetas…).
const INVISIBLES = /[\s\u0001-\u001f\u007f-\u009f\u00a0\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180b-\u180f\u1680\u2000-\u200f\u2028-\u202f\u205f-\u206f\u2800\u3000\u3164\ufe00-\ufe0f\ufeff\uffa0\ufff9-\ufffc\u{1d173}-\u{1d17a}\u{e0000}-\u{e007f}]/gu;
export const textoVisible = (t) => t != null && String(t).replace(INVISIBLES, '') !== '';
