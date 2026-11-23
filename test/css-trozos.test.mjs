// (v0.209 y v0.210) Los estilos repartidos al construir (scripts/css-coach.mjs): los del coach aparte y los de cada pantalla
// con su trozo. Una regla solo se va si no puede afectar a nada de fuera ni ganar un empate que antes perdía (el archivo
// al que va se carga después); lo demás se queda en app.css, en su orden.
//   node test/css-trozos.test.mjs
import { separarCssCoach, separarCssPorTrozos, clasesNecesarias, palabrasDe, prefijosDe, especificidad, pseudoElemento, familias } from '../scripts/css-coach.mjs';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };

console.log('Las clases que hacen falta');
check(JSON.stringify(clasesNecesarias('.a:not(.b) .c[x=".d"]:is(.e) > .f')) === '["a","c","f"]', 'sin las de :not(), :is(), los atributos ni lo de dentro de las comillas');
check(JSON.stringify(clasesNecesarias('.chat:has(.burbuja) .x')) === '["chat","x"]', 'ni las de :has()');
check(palabrasDe('class="tarjeta-hoy chip"').has('tarjeta-hoy') && prefijosDe('`tono-${t}`').has('tono-') && prefijosDe('"zona-"+z').has('zona-'), 'las palabras del código y los principios de las clases armadas a trozos');

console.log('\nLos del coach');
{
  const css = ':root{--a: 1}.btn{color:red}.radar-x .btn,.revisar-y{color:blue}.radar-x,.btn{margin:0}@media (min-width:700px){.radar-x{padding:1px}.btn{border:0}}.app.coach .tabs{display:flex}.chip:not(.radar-x){outline:0}.a:has(.radar-x){background:red}.q[data-x="{"]{content:"}"}@keyframes k{0%{opacity:0}to{opacity:1}}';
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

console.log('\nSin cambiar quién gana un empate (v0.210)');
check(especificidad('#a .b c') === 1001001 && especificidad(':where(.a .b) .c') === 1000 && especificidad('.a:not(.b, #c)') === 1001000 && especificidad('a::before') === 2
  && especificidad('[data-x="a b"].y:hover') === 3000 && especificidad('.a:nth-child(2n+1 of .b)') === 3000 && especificidad(':is(h1, .t) span') === 1001, 'la especificidad (ids, clases, elementos; :where cuenta cero, :is/:not/:has su argumento mayor)');
check(pseudoElemento('.a .b::before') === 'before' && pseudoElemento('.x:hover') === '' && pseudoElemento('.a:not(.b) .c::after') === 'after' && pseudoElemento('.c:before') === 'before'
  && pseudoElemento('input:-webkit-autofill') === '' && pseudoElemento('.l::-webkit-scrollbar-thumb') === '-webkit-scrollbar-thumb', 'el pseudo-elemento del sujeto (:-webkit-autofill es del propio elemento)');
check([...familias('margin-top:0;color:red!important;--x:1;background:url("a;b");inline-size:2px;line-height:1')].join() === 'margin,color!,--x,background,width,font', 'las propiedades por familia (y las !important aparte)');
{
  // .tv-lobo y .chip: misma especificidad y misma propiedad; en el original ganaba .chip (va después) en un elemento con las dos
  const textos = new Map([['app.js', 'chip hoy'], ['chunks/Travesia-1.js', 'tv-lobo tv-ojo tv-cola']]);
  const r = separarCssPorTrozos('.tv-lobo{color:red}.tv-ojo{margin:0}.tv-cola::before{color:red}.tv-lobo .x{color:red}.chip{color:blue}.hoy::after{color:blue}', { textos, candidatos: new Set(['chunks/Travesia-1.js']) });
  const t = r.porTrozo.get('chunks/Travesia-1.js') || '';
  check(r.comun.startsWith('.tv-lobo{color:red}') && !t.includes('.tv-lobo{'), 'una regla que empata con otra de después (misma especificidad y propiedad) se queda en su sitio');
  check(t === '.tv-ojo{margin:0}.tv-cola::before{color:red}.tv-lobo .x{color:red}', `se van las que no pueden empatar: otra propiedad, otro pseudo-elemento u otra especificidad (${t})`);
  check(r.quedan === 1, `una se queda por el orden (${r.quedan})`);
  // y en cadena: si una se queda, las de antes que empataban con ella también
  const r2 = separarCssPorTrozos('.tv-ojo{color:red}.tv-lobo{color:red;margin:0}.chip{margin:1px}', { textos, candidatos: new Set(['chunks/Travesia-1.js']) });
  check(r2.comun === '.tv-ojo{color:red}.tv-lobo{color:red;margin:0}.chip{margin:1px}' && r2.quedan === 2, `en cadena (${r2.comun})`);
}

console.log(`\n${ok} correctas, ${fallos} fallidas`);
process.exit(fallos ? 1 : 0);
