// (v0.209 y v0.210) Los estilos repartidos al construir (scripts/css-coach.mjs): los del coach aparte y los de cada pantalla
// con su trozo. Una regla solo se va si no puede afectar a nada de fuera; y como el archivo al que va se carga después, las
// reglas de después con las que podría empatar van copiadas detrás de ella, limitadas a sus elementos (:where()), para que
// gane y pierda como en el original. Lo demás se queda en app.css, en su orden.
//   node test/css-trozos.test.mjs
import { separarCssCoach, separarCssPorTrozos, clasesNecesarias, palabrasDe, prefijosDe, especificidad, pseudoElemento, familias, respetarCascada, leer, planas, sujetoDe } from '../scripts/css-coach.mjs';

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
{
  const f = [...familias('margin-top:0;color:red!important;--x:1;background:url("a;b");inline-size:2px;line-height:1;margin-inline:0;border-inline-start:1px solid')];
  check(f.includes('margin-top') && f.includes('color!') && !f.includes('color') && f.includes('--x') && f.includes('background-image') && f.includes('width') && f.includes('line-height')
    && f.includes('margin-left') && f.includes('margin-right') && f.includes('border-left-color') && !f.includes('font-size') && !f.includes('border-radius'), `lo que fija cada declaración, de verdad (${f.length} propiedades; las !important aparte)`);
  check(!familias('font-size:1px').has('font-weight') && familias('font:12px a').has('font-size') && familias('border:0').has('border-top-width') && !familias('border:0').has('border-top-left-radius'),
    'font-size no empata con font-weight; font y border fijan sus partes (border no toca el radio)');
}
check(sujetoDe('.a .b::before').base === '.a .b' && sujetoDe('.a .b::before').sufijo === '::before' && sujetoDe('button.x:hover').etiqueta === 'button' && sujetoDe('.a > .b.c').clases.join() === 'b,c',
  'el sujeto: su etiqueta, sus clases y el selector sin su pseudo-elemento');
{
  // .tv-lobo y .chip: misma especificidad y misma propiedad; en el original ganaba .chip (va después) en un elemento con las dos
  const textos = new Map([['app.js', 'chip hoy'], ['chunks/Travesia-1.js', 'tv-lobo tv-ojo tv-cola']]);
  const css = '.tv-lobo{color:red}.tv-ojo{margin:0}.tv-cola::before{color:red}.tv-lobo .x{color:red}.chip{color:blue;padding:0}.hoy::after{color:blue}';
  const r = separarCssPorTrozos(css, { textos, candidatos: new Set(['chunks/Travesia-1.js']) });
  const t = r.porTrozo.get('chunks/Travesia-1.js') || '';
  check(t === '.tv-lobo{color:red}.tv-ojo{margin:0}.tv-cola::before{color:red}.tv-lobo .x{color:red}.chip:where(.tv-lobo){color:blue}',
    `la que empata con una de después se va, y detrás de ella la de después, solo en sus elementos y solo con esa propiedad (${t})`);
  check(r.comun === '.chip{color:blue;padding:0}.hoy::after{color:blue}' && r.copias === 1 && r.quedan === 0, 'el común sigue con lo suyo; una copia y ninguna se queda');
  // en el modo de antes (sin copiar), la que empata se queda en su sitio
  const reglas = planas(leer(css));
  for (const x of reglas) x.dest = /tv-/.test(x.sel) ? 'chunks/Travesia-1.js' : null;
  check(respetarCascada(reglas) === 1 && reglas[0].dest === null && reglas[1].dest !== null, 'sin copiar, la que empata se queda en el común (y las otras se van)');
  // con más empates de la cuenta, se queda en el común
  const muchas = `.tv-lobo{color:red}${Array.from({ length: 14 }, (_, k) => `.c${k}{color:blue}`).join('')}`;
  const rm = separarCssPorTrozos(muchas, { textos: new Map([...textos, ['app.js', `chip hoy ${Array.from({ length: 14 }, (_, k) => `c${k}`).join(' ')}`]]), candidatos: new Set(['chunks/Travesia-1.js']) });
  check(rm.quedan === 1 && rm.comun.startsWith('.tv-lobo{color:red}') && !rm.porTrozo.size, 'con más de 12 empates posibles, se queda en el común (no compensa copiar tanto)');
  // y en cadena: las copias de varias, cada una en su sitio
  const r2 = separarCssPorTrozos('.tv-ojo{color:red}.tv-lobo{color:red;margin:0}.chip{margin:1px}.tv-cola{margin:2px}', { textos, candidatos: new Set(['chunks/Travesia-1.js']) });
  check(r2.porTrozo.get('chunks/Travesia-1.js') === '.tv-ojo{color:red}.tv-lobo{color:red;margin:0}.chip:where(.tv-lobo){margin:1px}.tv-cola{margin:2px}' && r2.comun === '.chip{margin:1px}',
    `las copias, en el sitio de la regla copiada y entre las movidas (${r2.porTrozo.get('chunks/Travesia-1.js')})`);
  // un pseudo-elemento va detrás del :where(); y lo que está en un @media, con su @media
  const r3 = separarCssPorTrozos('.tv-cola::before{color:red}@media (min-width:700px){.hoy::before{color:blue}}', { textos, candidatos: new Set(['chunks/Travesia-1.js']) });
  check(r3.porTrozo.get('chunks/Travesia-1.js') === '.tv-cola::before{color:red}@media (min-width:700px){.hoy:where(.tv-cola)::before{color:blue}}', `con pseudo-elemento y @media (${r3.porTrozo.get('chunks/Travesia-1.js')})`);
}

// (v0.211) El dueño de una clase tiene que pintarla: la demo traía «m3» en sus datos y la regla de .musculo.m3 se iba a su
// trozo (en la app de verdad, sin demo, el brillo de los músculos de nivel 3 no salía). Y los principios sin guion (`m${n}`)
{
  const { duenosDeCodigo, prefijosDe: pref } = await import('../scripts/css-coach.mjs');
  check(pref('`musculo m${n}`').has('m#') && pref('`cr-celda n${d.nivel}`').has('n#') && !pref('`hola ${x}`').has('hola#'), 'principios sin guion: m${n} y n${d.nivel} (y no «hola ${x}»)');
  const a = 'x("div",{class:"tarjeta"}),x("span",{class:`musculo m${n}`})', b = 'const DATOS={nivel:"m3",chip:"chip"};x("p",{class:"otra"})';
  const solo = (txt) => duenosDeCodigo({ textos: new Map([['chunks/B.js', txt], ['chunks/C.js', 'x("i",{class:"nada"})']]), candidatos: new Set(['chunks/B.js', 'chunks/C.js']) });
  const d = duenosDeCodigo({ textos: new Map([['chunks/A.js', a], ['chunks/B.js', b]]), candidatos: new Set(['chunks/A.js', 'chunks/B.js']) });
  const d2 = duenosDeCodigo({ textos: new Map([['chunks/A.js', a], ['chunks/C.js', 'x("i",{class:"nada"})']]), candidatos: new Set(['chunks/A.js', 'chunks/C.js']) });
  check(solo(b)('m3') === null && solo(b)('chip') === null && solo(b)('otra') === 'chunks/B.js' && d('m3') === null && d2('m3') === 'chunks/A.js' && d2('tarjeta') === 'chunks/A.js',
    `una clase que un trozo solo nombra en sus datos no es suya (solo en datos: ${solo(b)('m3')}; pintada en A y nombrada en B: ${d('m3')}; solo pintada en A: ${d2('m3')})`);
}

// (v0.214) Las reglas «universales» (se prueban en todos los elementos) partidas para que cada una vaya a su cubo, sin
// cambiar a qué se aplican ni con qué fuerza (scripts/css-cubos.mjs)
console.log('\nCada regla, a su cubo (v0.214)');
{
  const { trozos, partirSelector, cubos } = await import('../scripts/css-cubos.mjs');
  check(JSON.stringify(trozos('.a>.b .c+d~e:is(.f .g, .h)')) === JSON.stringify([{ comb: '', comp: '.a' }, { comb: '>', comp: '.b' }, { comb: ' ', comp: '.c' }, { comb: '+', comp: 'd' }, { comb: '~', comp: 'e:is(.f .g, .h)' }]),
    'los trozos de un selector, con sus combinadores (y sin mirar dentro de los paréntesis)');
  const casos = [
    [':where(.a, .b)', [':where(.a)', ':where(.b)']],
    [':where(.a,.b)::after', [':where(.a)::after', ':where(.b)::after']],
    [':is(.hero-dia, .carnet) ::selection', [':is(.hero-dia) ::selection', ':is(.carnet) ::selection']],
    ['.app :is(.a, .b) > *', ['.app :is(.a)>*', '.app :is(.b)>*']],
    [':where(button, [role="button"]):where(:not(:disabled)):active', [':where(button):where(:not(:disabled)):active', ':where([role="button"]):where(:not(:disabled)):active']],
    [':where([data-a="1,2"], .b:not(.c, .d))', [':where([data-a="1,2"])', ':where(.b:not(.c, .d))']],
    ['::view-transition-old(barra)', [':where(html)::view-transition-old(barra)']],
    [':where(.a b, .c>d, .e)', [':where(b):where(.a *)', ':where(d):where(.c>*)', ':where(.e)']],
    [':is(.num, .marcador, [class*=cifra] .v)', [':is(.num.num)', ':is(.marcador.marcador)', ':is(.v):is([class*=cifra] *)']],
    [':is(.padrinos .pd-t, .lo-mejor .lm-t)>span:first-child', [':is(.pd-t):is(.padrinos *)>span:first-child', ':is(.lm-t):is(.lo-mejor *)>span:first-child']],
  ];
  for (const [sel, esperado] of casos) {
    const r = partirSelector(sel);
    check(JSON.stringify(r) === JSON.stringify(esperado) && r.every((x) => especificidad(x) === especificidad(sel)) && r.every((x) => pseudoElemento(x) === pseudoElemento(sel)),
      `«${sel}» → ${r.join(' , ')} (con la misma especificidad y el mismo pseudo-elemento)`);
  }
  const iguales = [
    [':is(.a, b)', 'un :is() con opciones de distinto peso (partido, la más ligera perdería fuerza)'],
    ['.x:is(.a, .b)', 'una parte que ya tiene su clase (ya va a su cubo)'],
    [':is(p, li, .peq)', 'un :is() con una opción que pesa menos en clases y más en etiquetas (no se puede rellenar)'],
    [':where(:hover, :focus)', 'opciones sin clase, id, etiqueta ni atributo'],
    [':root::view-transition-old(x)', 'una transición de vista que ya dice que es de la raíz'],
    [':not(.a, .b)', 'un :not() (no es una unión)'],
    ['.a:has(:is(.b, .c))', 'lo de dentro de un :has()'],
  ];
  for (const [sel, por] of iguales) check(JSON.stringify(partirSelector(sel)) === JSON.stringify([sel]), `se queda igual: ${por}`);
  const tope = partirSelector(':where(.a,.b,.c,.d,.e) :where(.f,.g,.h,.i)');
  check(JSON.stringify(tope) === JSON.stringify([':where(.a,.b,.c,.d,.e) :where(.f)', ':where(.a,.b,.c,.d,.e) :where(.g)', ':where(.a,.b,.c,.d,.e) :where(.h)', ':where(.a,.b,.c,.d,.e) :where(.i)']),
    `con más de 16 selectores (5 × 4), solo la última parte, la que decide el cubo (${tope.length})`);
  const css = '@media (min-width:1px){:where(.a,.b){color:red}}.c,::view-transition-new(x){x:y}@keyframes k{0%{opacity:0}}:is(.d, .e) span{content:"a,b"}';
  const r = cubos(css);
  check(r.css === '@media (min-width:1px){:where(.a),:where(.b){color:red}}.c,:where(html)::view-transition-new(x){x:y}@keyframes k{0%{opacity:0}}:is(.d) span,:is(.e) span{content:"a,b"}' && r.tocados === 3 && r.nuevos === 5,
    `todo un CSS, con sus @media, @keyframes y comillas (${r.css}; ${r.tocados} tocados, ${r.nuevos} nuevos)`);
  check(cubos(r.css).css === r.css && cubos(r.css).tocados === 0, 'y pasarlo dos veces da lo mismo');
}

console.log(`\n${ok} correctas, ${fallos} fallidas`);
process.exit(fallos ? 1 : 0);
