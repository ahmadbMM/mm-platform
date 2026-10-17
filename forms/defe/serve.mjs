// Serves the built page for the Playwright specs, at the address the website gives it
// (apps/web/src/app/defe/route.ts), with the fonts it names. The specs stub every database call
// (and the booking app it hands riders on to), so nothing here reaches Supabase.
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';

const port = Number(process.argv[2] || 8789);
const page = readFileSync(new URL('./src/page.html', import.meta.url));
const fonts = new URL('../../apps/web/public/fonts/forms/', import.meta.url);

createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  const font = /^\/fonts\/forms\/([a-z0-9-]+\.woff2)$/.exec(pathname);
  if (font && existsSync(new URL(font[1], fonts))) {
    res.writeHead(200, { 'content-type': 'font/woff2' });
    return res.end(readFileSync(new URL(font[1], fonts)));
  }
  if (pathname === '/defe') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(page);
  }
  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('Not found');
}).listen(port);
