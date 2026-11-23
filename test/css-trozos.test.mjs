// (v0.209 y v0.211) Los estilos repartidos al construir (scripts/css-coach.mjs): los del coach aparte y los de cada pantalla
// con su trozo. Una regla solo se va si no puede afectar a nada de fuera; lo demás se queda en app.css, en su orden.
//   node test/css-trozos.test.mjs
import { separarCssCoach, separarCssPorTrozos, clasesNecesarias, palabrasDe, prefijosDe } from '../scripts/css-coach.mjs';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };

console.log('Las clases que hacen falta');
check(JSON.stringify(clasesNecesarias('.a:not(.b) .c[x=".d"]:is(.e) > .f')) === '["a","c","f"]', 'sin las de :not(), :is(), los atributos ni lo de dentro de las comillas');
check(JSON.stringify(clasesNecesarias('.chat:has(.burbuja) .x')) === '["chat","x"]', 'ni las de :has()');
check(palabrasDe('class="tarjeta-hoy chip"').has('tarjeta-hoy') && prefijosDe('`tono-${t}`').has('tono-') && prefijosDe('"zona-"+z').has('zona-'), 'las palabras del código y los principios de las clases armadas a trozos');

console.log('\nLos del coach');
{
  const css = ':root{--a: 1}.btn{color:red}.radar-x .btn,.revisar-y{color:blue}.radar-x,.btn{margin:0}@media (min-width:700px){.radar-x{padding:1px}.btn{padding:2px}}.app.coach .tabs{display:flex}.chip:not(.radar-x){color:green}.a:has(.radar-x){color:red}.q[data-x="{"]{content:"}"}@keyframes k{0%{opacity:0}to{opacity:1}}';
  const r = separarCssCoach(css, { palabrasCoach: palabrasDe('radar-x revisar-y btn chip'), palabrasOtros: palabrasDe('btn chip a q app coach tabs'), prefijosOtros: new Set() });
  check(r.coach === '.radar-x .btn,.revisar-y{color:blue}@media (min-width:700px){.radar-x{padding:1px}}.app.coach .tabs{display:flex}', `se van las reglas solo del coach, con su @media (${r.coach})`);
  check(r.comun.includes('.radar-x,.btn{margin:0}') && r.comun.includes('.chip:not(.radar-x)') && r.comun.includes('.a:has(.radar-x)') && r.comun.includes('@keyframes k') && r.comun.includes('.q[data-x="{"]{content:"}"}'),
    'se quedan las mixtas, las de :not() y :has(), los @keyframes y las llaves dentro de comillas');
}

console.log('\nLos de cada pantalla');
{
  const textos = new Map([
    ['app.js', 'class="hoy tarjeta" chip'],
    ['chunks/Travesia-1.js', 'tv-lobo tv-cielo chip `tv-fase-${f}`'],
    ['chunks/Apuntes-2.js', 'ap-tarjeta ap-lapiz'],
    ['chunks/chunk-3.js', 'tv-cielo compartida'],
    ['chunks/CoachApp-4.js', 'rv-fila'],
  ]);
  const candidatos = new Set(['chunks/Travesia-1.js', 'chunks/Apuntes-2.js', 'chunks/chunk-3.js']);
  const css = '.hoy{a:1}.tv-lobo{b:1}.tv-cielo{c:1}.ap-tarjeta .tv-lobo{d:1}.ap-tarjeta,.ap-lapiz{e:1}@media (hover:hover){.ap-lapiz:hover{f:1}.hoy:hover{g:1}}.tv-fase-noche{h:1}.rv-fila{i:1}.chip.tv-lobo{j:1}.portada-x{k:1}.compartida{l:1}';
  const r = separarCssPorTrozos(css, { textos, candidatos, extra: 'portada-x' });
  const t = (f) => r.porTrozo.get(f) || '';
  check(t('chunks/Travesia-1.js') === '.tv-lobo{b:1}.tv-fase-noche{h:1}.chip.tv-lobo{j:1}', `La travesía se lleva lo suyo, también lo armado a trozos y lo que mezcla con una clase común (${t('chunks/Travesia-1.js')})`);
  check(t('chunks/Apuntes-2.js') === '.ap-tarjeta,.ap-lapiz{e:1}@media (hover:hover){.ap-lapiz:hover{f:1}}', `Apuntes, lo suyo con su @media (${t('chunks/Apuntes-2.js')})`);
  check(t('chunks/chunk-3.js') === '.compartida{l:1}', 'el trozo compartido, lo que solo sale en él');
  check(r.comun === '.hoy{a:1}.tv-cielo{c:1}.ap-tarjeta .tv-lobo{d:1}@media (hover:hover){.hoy:hover{g:1}}.rv-fila{i:1}.portada-x{k:1}', `se quedan: lo de arranque, lo que sale en dos trozos, lo que necesita dos trozos a la vez, lo del coach y lo de index.html (${r.comun})`);
}

console.log(`\n${ok} correctas, ${fallos} fallidas`);
process.exit(fallos ? 1 : 0);
