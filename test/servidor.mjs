// Servidor estático mínimo para probar dist/ en el navegador.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };

export function servir(dir, puerto = 4173) {
  const srv = createServer((req, res) => {
    let ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let f = join(dir, ruta);
    if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
    if (!existsSync(f)) { res.writeHead(404); res.end('no'); return; }
    res.writeHead(200, { 'content-type': TIPOS[extname(f)] || 'application/octet-stream' });
    res.end(readFileSync(f));
  });
  return new Promise((ok) => srv.listen(puerto, () => ok(srv)));
}
