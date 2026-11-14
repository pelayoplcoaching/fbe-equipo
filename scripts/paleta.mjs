// Genera web/src/color.css desde web/src/logica/paleta.js (color, mejoras 1–2): las primitivas (las escalas en hex),
// los tokens con significado de cada tema, los degradados de marca, las sombras teñidas, la paleta de las gráficas,
// las celebraciones, la ayuda para daltonismo y el alto contraste.
//   npm run paleta        (las pruebas comprueban que color.css está al día)
import { writeFileSync } from 'node:fs';
import { cssPaleta } from '../web/src/logica/paleta-css.js';

const ruta = new URL('../web/src/color.css', import.meta.url);
writeFileSync(ruta, cssPaleta());
console.log('web/src/color.css generado');
