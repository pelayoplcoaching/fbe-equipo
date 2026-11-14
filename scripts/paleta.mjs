// Genera web/src/color.css desde web/src/logica/paleta.js (color, mejoras 1–2): las primitivas (las escalas en hex),
// los tokens con significado de cada tema, los degradados de marca, las sombras teñidas, la paleta de las gráficas,
// las celebraciones, la ayuda para daltonismo y el alto contraste.
// Y web/src/sistema.css desde web/src/logica/sistema.js (color y diseño, tanda 3): las escalas de lo que no es color.
//   npm run paleta        (las pruebas comprueban que color.css y sistema.css están al día)
import { writeFileSync } from 'node:fs';
import { cssPaleta, cssSistema } from '../web/src/logica/paleta-css.js';

const ruta = new URL('../web/src/color.css', import.meta.url);
writeFileSync(ruta, cssPaleta());
writeFileSync(new URL('../web/src/sistema.css', import.meta.url), cssSistema());
console.log('web/src/color.css y web/src/sistema.css generados');
