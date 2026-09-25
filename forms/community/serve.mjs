// Serves the built page for the Playwright specs, at the address the website gives it
// (apps/web/src/app/community/registration/route.ts). The specs stub every database call, so nothing here
// reaches Supabase.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

const port = Number(process.argv[2] || 8788);
const page = readFileSync(new URL('./src/page.html', import.meta.url));
const og = readFileSync(new URL('./design/og-image.png', import.meta.url)); // the website has it in apps/web/public

createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  if (pathname === '/community/registration/og-image.png') {
    res.writeHead(200, { 'content-type': 'image/png' });
    return res.end(og);
  }
  if (pathname === '/community/registration') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(page);
  }
  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('Not found');
}).listen(port);
