// (v0.207) Uso largo: la app abierta mucho rato, yendo y viniendo entre pantallas (como en el móvil, que no se cierra en
// días). Ni la memoria ni los temporizadores ni los oyentes de la ventana deben crecer sin parar: si crecen a cada
// vuelta, algo se queda vivo al salir de una pantalla y, con los días, la app se vuelve lenta.
//   Suelta:  npm run build && node test/suelta.mjs e2e-uso-largo
// Se da una vuelta para calentar (la primera vez todo se carga y se guarda) y se compara lo que hay tras la vuelta 2 con
// lo que hay tras la última: con la memoria recogida (el recolector, a mano), lo de cada vuelta debe quedarse igual.
import { irASeccion } from './secciones.mjs';

const VUELTAS = Number(process.env.FBE_VUELTAS) || 6;

export async function probarUsoLargo({ navegador, check, base = 'http://localhost:4174' }) {
  for (const [quien, pantallas, listo] of [
    [/Ana López/, ['Semana', 'Progreso', 'Mensajes', 'Hoy'], '.hero-dia'],
    [/Pelayo/, ['Revisar', 'Mensajes', 'Atletas'], 'button.tarjeta-atleta:visible, tr:visible'],
  ]) {
    const ctx = await navegador.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, locale: 'es-ES' });
    try {
      const p = await ctx.newPage();
      const errores = [];
      p.on('pageerror', (e) => errores.push(e.message));
      // Cuántos temporizadores que se repiten (setInterval) y oyentes de la ventana y del documento quedan vivos
      await p.addInitScript(() => {
        const vivos = new Set();
        const si = window.setInterval, ci = window.clearInterval;
        window.setInterval = function (...a) { const id = si.apply(this, a); vivos.add(id); return id; };
        window.clearInterval = function (id) { vivos.delete(id); return ci.call(this, id); };
        const oyentes = new Map();
        for (const o of [window, document]) {
          const add = o.addEventListener.bind(o), rem = o.removeEventListener.bind(o);
          const clave = (t, f, op) => `${o === window ? 'w' : 'd'}:${t}:${typeof op === 'object' ? !!op?.capture : !!op}`;
          o.addEventListener = (t, f, op) => { if (f) { const k = clave(t, f, op); const s = oyentes.get(k) || new Set(); s.add(f); oyentes.set(k, s); } return add(t, f, op); };
          o.removeEventListener = (t, f, op) => { oyentes.get(clave(t, f, op))?.delete(f); return rem(t, f, op); };
        }
        window.__vivos = () => ({ intervalos: vivos.size, oyentes: [...oyentes.values()].reduce((t, s) => t + s.size, 0) });
      });
      await p.goto(`${base}/?demo`);
      await p.getByRole('button', { name: quien }).first().tap();
      await p.locator(listo).first().waitFor({ timeout: 30000 });
      await p.waitForTimeout(1500);
      for (let i = 0; i < 6; i++) {
        const d = p.locator('[role=dialog]').last();
        if (!(await d.isVisible().catch(() => false))) break;
        await p.keyboard.press('Escape');
        await p.waitForTimeout(300);
      }
      const cdp = await ctx.newCDPSession(p);
      const medir = async () => {
        await p.waitForTimeout(800);
        await cdp.send('HeapProfiler.collectGarbage');
        await cdp.send('HeapProfiler.collectGarbage');
        const { usedSize } = await cdp.send('Runtime.getHeapUsage');
        const v = await p.evaluate(() => window.__vivos());
        const nodos = await p.evaluate(() => document.getElementsByTagName('*').length);
        return { mb: usedSize / 1048576, ...v, nodos };
      };
      const vuelta = async () => { for (const s of pantallas) { await irASeccion(p, s); await p.waitForTimeout(450); } };
      await vuelta(); await vuelta();
      const antes = await medir();
      for (let i = 2; i < VUELTAS; i++) await vuelta();
      const despues = await medir();
      const nombre = quien.source.replace(/\\/g, '');
      const crece = despues.mb - antes.mb;
      check(crece < Math.max(4, antes.mb * 0.15), `${nombre}: tras ${VUELTAS} vueltas por ${pantallas.join(', ')}, la memoria no crece sin parar (${antes.mb.toFixed(1)} → ${despues.mb.toFixed(1)} MB)`);
      check(despues.intervalos <= antes.intervalos, `${nombre}: ni los temporizadores que se repiten (${antes.intervalos} → ${despues.intervalos})`);
      check(despues.oyentes <= antes.oyentes + 2, `${nombre}: ni los oyentes de la ventana (${antes.oyentes} → ${despues.oyentes})`);
      check(despues.nodos <= antes.nodos * 1.2 + 200, `${nombre}: ni lo que hay en la pantalla (${antes.nodos} → ${despues.nodos} elementos)`);
      check(!errores.length, `${nombre}: sin errores${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
    } finally {
      await ctx.close();
    }
  }
}
