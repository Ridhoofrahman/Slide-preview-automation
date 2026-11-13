// Tiny static server with no dependencies.  node dev/serve.mjs   (default port 5173)
//   /panel   the designer add-in with fake PowerPoint + fake Supabase data
//   /review  the DM dashboard with fake Supabase data
//   anything else is served from the repository root
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, panelPage, reviewPage } from './transform.mjs';

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.xml': 'application/xml', '.sql': 'text/plain; charset=utf-8' };

export function startServer(port = 5173) {
  const server = http.createServer((req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const send = (code, type, body) => { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(body); };
      if (url.pathname === '/panel') return send(200, TYPES['.html'], panelPage());
      if (url.pathname === '/review') return send(200, TYPES['.html'], reviewPage());
      const file = path.normalize(path.join(ROOT, decodeURIComponent(url.pathname)));
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(404, 'text/plain', 'Not found');
      send(200, TYPES[path.extname(file)] || 'application/octet-stream', fs.readFileSync(file));
    } catch (e) { res.writeHead(500, { 'Content-Type': 'text/plain' }); res.end(String(e.stack || e)); }
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT) || 5173;
  await startServer(port);
  console.log(`Slideshot test server on http://localhost:${port}`);
  console.log(`  Add-in panel (designer):  http://localhost:${port}/panel?n=1&st=notsent`);
  console.log(`  Add-in panel (DM footer): http://localhost:${port}/panel?n=1&st=notsent&dm=1`);
  console.log(`  Dashboard (DM):           http://localhost:${port}/review`);
}
