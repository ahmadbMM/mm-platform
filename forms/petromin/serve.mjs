// Serves the built page for the Playwright specs, at the address the website gives it
// (apps/web/src/app/petromin/route.ts). The specs stub every database call, so nothing here
// reaches Supabase.
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';

const port = Number(process.argv[2] || 8787);
const page = readFileSync(new URL('./src/page.html', import.meta.url));

// The fonts the page names, from where the website serves them (apps/web/public/fonts/forms).
const fonts = new URL('../../apps/web/public/fonts/forms/', import.meta.url);

createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  const font = /^\/fonts\/forms\/([a-z0-9-]+\.woff2)$/.exec(pathname);
  if (font && existsSync(new URL(font[1], fonts))) {
    res.writeHead(200, { 'content-type': 'font/woff2' });
    return res.end(readFileSync(new URL(font[1], fonts)));
  }
  if (pathname === '/petromin') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(page);
  }
  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('Not found');
}).listen(port);
