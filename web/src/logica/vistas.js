// v0.52: transiciones con elemento compartido (como Fotos de Apple o Airbnb). Un nombre de View Transitions solo puede
// estar en un elemento a la vez (si dos lo llevan, el navegador cancela la transición entera). Por eso los nombres se
// ponen solo a la pareja que se transforma, en el momento de la transición, y se quitan después. Aquí, la regla pura.

export const NOMBRES_COMPARTIDOS = ['vt-ej-nombre', 'vt-ej-picto', 'vt-avatar', 'vt-titulo-sesion'];
const VALIDO = /^vt-[a-z0-9-]{1,40}$/;

// Las parejas que se pueden usar: nombre válido, de la lista, con origen y destino, y sin repetir nombre (la primera vale)
export function paresValidos(pares = []) {
  const vistos = new Set();
  return (pares || []).filter((p) => {
    if (!p || !VALIDO.test(p.nombre || '') || !NOMBRES_COMPARTIDOS.includes(p.nombre) || !p.desde || !p.hasta || vistos.has(p.nombre)) return false;
    vistos.add(p.nombre);
    return true;
  });
}

// Si el elemento de origen se ve (un poco, al menos) en la pantalla: si no, transformarlo desde fuera queda raro
export function seVe(r, ancho, alto) {
  return !!r && r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < alto && r.left < ancho;
}
