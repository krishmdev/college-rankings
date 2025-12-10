// Serves dist/ the way GitHub Pages will: under BASE (default /college-rankings), with 404.html
// as the SPA fallback. Only binds to localhost.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'dist');
const base = (process.env.WEB_BASE_URL ?? '/college-rankings').replace(/\/$/, '');
const port = Number(process.env.PORT ?? 4173);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.svg': 'image/svg+xml',
};

function send(res, file, status = 200) {
  res.writeHead(status, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (base && !url.pathname.startsWith(base)) {
    res.writeHead(302, { location: `${base}/` });
    return res.end();
  }
  const rel = normalize(decodeURIComponent(url.pathname.slice(base.length) || '/')).replace(/^(\.\.[/\\])+/, '');
  let file = join(root, rel);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (existsSync(file)) return send(res, file);
  const fallback = join(root, '404.html');
  return send(res, existsSync(fallback) ? fallback : join(root, 'index.html'), 404);
}).listen(port, '127.0.0.1', () => console.log(`serving ${root} at http://127.0.0.1:${port}${base}/`));
