// FBE Esencial, altas en grupo (coach): leer la lista que pega Pelayo (una persona por línea: nombre y correo, y
// «nutrición» si es el nivel con nutrición; vale también lo copiado de una exportación de Stripe) y el mensaje de la
// invitación, para copiarlo o mandarlo por correo. Lógica pura; solo la usan la app del coach y las pruebas.
import { fechaLarga } from './esencial-alta.js';

export const MAX_ALTAS = 60;
export const ASUNTO_ESENCIAL = 'Tu plaza en FBE Esencial: tu código para entrar';

const CORREO = /[^\s,;<>"'()[\]]+@[^\s,;<>"'()[\]]+\.[a-z]{2,}/i;
const ID_STRIPE = /^(cus|sub|price|prod|pi|in|ch|cs|si|pm|acct)_[A-Za-z0-9]+$/;
const FECHA = /^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}/;
const PRECIO = /^[\d\s.,]+(\s*(\u20ac|eur))?$/i;
// (palabras de una exportación que no son un nombre: el producto, el estado, la moneda, el periodo…)
const NO_NOMBRE = /^(entrenamiento( y nutrici[o\u00f3]n)?|nutrici[o\u00f3]n|con nutrici[o\u00f3]n|ent|nut|activ[ao]s?|active|trialing|past_due|canceled|incomplete|mensual|anual|month|year|monthly|yearly|eur|true|false|s[i\u00ed]|no|fbe esencial.*)$/i;
const NIVEL_EN_NOMBRE = /\b(entrenamiento y nutrici[o\u00f3]n|con nutrici[o\u00f3]n|nutrici[o\u00f3]n|entrenamiento|nut|ent)\b/gi;
const CABECERA = /^(email|e-mail|correo|name|nombre|customer|cliente|id|description)\b/i;

// Una línea partida por su separador (tabulador, punto y coma o coma), respetando lo que va entre comillas
function partir(linea) {
  const sep = linea.includes('\t') ? '\t' : linea.includes(';') ? ';' : ',';
  const campos = [];
  let actual = '', comillas = false;
  for (const c of linea) {
    if (c === '"') comillas = !comillas;
    else if (c === sep && !comillas) { campos.push(actual); actual = ''; } else actual += c;
  }
  campos.push(actual);
  return campos.map((x) => x.trim().replace(/^['"]+|['"]+$/g, '').trim());
}

const limpiarNombre = (t) => t.replace(NIVEL_EN_NOMBRE, ' ').replace(/[\u00b7|]+/g, ' ').replace(/\s+/g, ' ').replace(/^[\s.,;:-]+|[\s.,;:-]+$/g, '');
const esNombre = (t) => /\p{L}/u.test(t) && !t.includes('@') && !ID_STRIPE.test(t) && !FECHA.test(t) && !PRECIO.test(t) && !NO_NOMBRE.test(t);

// texto: lo pegado; existentes: las fichas que ya hay ({ nombre, email }), para no dar de alta dos veces al mismo.
// Devuelve { filas: [{ linea, nombre, email, nutricion, error }], validas, ignoradas } (ignoradas: la cabecera).
export function leerAltas(texto = '', existentes = []) {
  const ya = new Map(existentes.filter((a) => a?.email).map((a) => [String(a.email).trim().toLowerCase(), a.nombre]));
  const vistos = new Set();
  const filas = [];
  let ignoradas = 0;
  const lineas = String(texto).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const [i, linea] of lineas.entries()) {
    const m = linea.match(CORREO);
    if (!m) {
      if (i === 0 && CABECERA.test(linea.replace(/^['"]+/, ''))) { ignoradas++; continue; }
      filas.push({ linea, nombre: '', email: '', nutricion: false, error: 'Falta el correo' });
      continue;
    }
    const email = m[0].replace(/\.+$/, '').toLowerCase();
    // (se parte la línea tal cual, con su separador, y se quita el correo de su campo)
    const campos = partir(linea).map((x) => x.replace(m[0], ' ').trim());
    const resto = campos.join(' ');
    const nutricion = /nutri/i.test(resto) || /(^|\s)nut(\s|$)/i.test(resto);
    const nombre = campos.map(limpiarNombre).find((x) => x && esNombre(x)) || '';
    let error = null;
    if (filas.length >= MAX_ALTAS) error = `Como mucho ${MAX_ALTAS} de una vez`;
    else if (!nombre) error = 'Falta el nombre';
    else if (vistos.has(email)) error = 'Repetido en la lista';
    else if (ya.has(email)) error = `Ya tiene ficha${ya.get(email) ? ` (${ya.get(email)})` : ''}`;
    vistos.add(email);
    filas.push({ linea, nombre, email, nutricion, error });
  }
  return { filas, validas: filas.filter((f) => !f.error), ignoradas };
}

// (alta, 1) El enlace de la invitación lleva el código: al abrirlo, la app enseña «Activa tu cuenta» con el código ya
// escrito (y, si es de FBE Esencial, lo que hace falta para su plan). url: la dirección de la app.
export function enlaceInvitacion(url, codigo, esencial = false) {
  if (!codigo) return '';
  return `${String(url || '').replace(/[?#].*$/, '')}?codigo=${encodeURIComponent(codigo)}${esencial ? '&plan=esencial' : ''}`;
}

// El mensaje de la invitación (el mismo del alta de uno en uno). inicio: 'AAAA-MM-DD' o null; caduca: hasta qué día vale
// el código ('AAAA-MM-DD'; sin él, los 14 días de siempre).
export function mensajeInvitacion({ nombre = '', codigo, url, esencial = false, inicio = null, caduca = null }) {
  const n = String(nombre).trim().split(/\s+/)[0] || '';
  if (!codigo) return '';
  const enlace = enlaceInvitacion(url, codigo, esencial);
  const vale = caduca ? `Sirve una sola vez, hasta el ${fechaLarga(caduca)}.` : 'Caduca en 14 días y solo sirve una vez.';
  if (!esencial) return `Hola, ${n}. Ya tienes tu acceso a la app de FBE Coaching. Para activar tu cuenta, abre este enlace, que ya lleva tu código: ${enlace} (o entra en ${url}, toca «Activa tu cuenta» y escribe ${codigo}). ${vale}`;
  const dia = inicio ? fechaLarga(inicio) : '';
  return `Hola, ${n}. Ya tienes tu plaza en FBE Esencial. Para activar tu cuenta, abre este enlace, que ya lleva tu código: ${enlace} (o entra en ${url}, toca «Activa tu cuenta» y escribe ${codigo}). ${vale} Lo primero, tu cuestionario: con él, la app te prepara tu plan${dia ? `, que empieza el ${dia}` : ''}.`;
}

// El enlace para abrir el correo ya escrito (el programa de correo del coach)
export function enlaceCorreo(email, asunto, cuerpo) {
  if (!CORREO.test(String(email || ''))) return null;
  return `mailto:${String(email).trim()}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
}

// La lista para guardar (nombre, correo y código, separados por tabuladores: se pega tal cual en una hoja de cálculo)
export const listaCodigos = (hechos = []) => hechos.filter((h) => h.codigo).map((h) => [h.nombre, h.email, h.nutricion ? 'Con nutrición' : 'Entrenamiento', h.codigo].join('\t')).join('\n');
