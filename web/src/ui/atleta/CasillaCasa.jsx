// (vista 280, v0.277) La casilla de la casa: una casilla redonda en los bordes, morada al marcarla y con la marca que
// entra de un golpe (en lugar de la cuadrada del navegador). Va en su propio módulo para que la usen Rutinas, Pruebas y
// Dolor sin que su estilo se cargue al abrir la app (el reparto del CSS, en scripts/css-coach.mjs).
export function CasillaCasa({ class: clase = '', ...resto }) {
  return <input type="checkbox" class={clase ? `chk-casa ${clase}` : 'chk-casa'} {...resto} />;
}
