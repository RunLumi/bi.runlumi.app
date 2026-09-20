// Loopback-only acceptance server for the *built* site. Applies the common Pages
// security headers; host-pattern rules and edge behavior still need staging checks.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../dist/', import.meta.url));
const headersText = await readFile(resolve(root, '_headers'), 'utf8');
const common = {};
let active = false;
for (const line of headersText.split('\n')) {
  if (!line.trim() || line.startsWith('#')) continue;
  if (!/^\s/.test(line)) { active = line.trim() === '/*'; continue; }
  if (active) { const colon = line.indexOf(':'); common[line.slice(0, colon).trim()] = line.slice(colon + 1).trim(); }
}
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const server = createServer(async (req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    let file = resolve(root, `.${pathname}`);
    if (file !== root && !file.startsWith(root + sep) || pathname.includes('\0') || pathname.includes('\\')) { res.writeHead(400); res.end(); return; }
    let code = 200;
    try { if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html'); await stat(file); }
    catch { code = 404; file = resolve(root, '404.html'); }
    const content = await readFile(file);
    res.writeHead(code, { ...common, 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Content-Length': content.length });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch { res.writeHead(400); res.end('Bad request'); }
});
server.listen(4321, '127.0.0.1', () => console.log('Static acceptance server: http://127.0.0.1:4321'));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
