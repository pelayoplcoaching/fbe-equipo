// (tacto 242, v0.273) El índice lateral de las listas largas: una tira en el borde derecho con un trozo por capítulo;
// arrastrar el pulgar por ella salta de uno a otro. Aquí, las cuentas (probadas en test/tacto.test.mjs).

// Sale si hay al menos tres capítulos y la lista pasa de dos pantallas
export const conIndice = (n, altoLista, altoPantalla) => n >= 3 && altoPantalla > 0 && altoLista > altoPantalla * 2.2;

// El capítulo bajo el dedo: y (desde el borde de arriba de la tira), su alto y cuántos hay
export function indiceEn(y, alto, n) {
  if (!(n > 0) || !(alto > 0)) return 0;
  return Math.max(0, Math.min(n - 1, Math.floor((y / alto) * n)));
}

// Lo que se lee en la tira: las tres primeras letras («Desayunos» → «Des», «noviembre de 2026» → «Nov»)
export const cortoDe = (texto) => { const t = String(texto || '').trim().slice(0, 3); return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase(); };
