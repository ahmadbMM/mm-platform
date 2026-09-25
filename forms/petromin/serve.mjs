// Serves the built page for the Playwright specs, at the address the website gives it
// (apps/web/src/app/petromin/route.ts). The specs stub every database call, so nothing here
// reaches Supabase.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

const port = Number(process.argv[2] || 8787);
const page = readFileSync(new URL('./src/page.html', import.meta.url));

createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  if (pathname === '/petromin') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(page);
  }
  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('Not found');
}).listen(port);
