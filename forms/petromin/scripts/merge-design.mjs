// Merge a Claude Design export into one self-contained src/page.html.
//
//   design/index.html, design/styles.css, design/app.js, design/*.png (logos)
//   + src/live-submit.js (the real rider_register call, kept out of the design)
//   -> src/page.html
//
// Usage: npm run build (in forms/petromin)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const d = (f) => resolve(root, 'design', f);
const need = ['index.html', 'styles.css', 'app.js'];
for (const f of need) if (!existsSync(d(f))) { console.error(`missing design/${f}`); process.exit(1); }

let html = readFileSync(d('index.html'), 'utf8');
const css = readFileSync(d('styles.css'), 'utf8');
let js = readFileSync(d('app.js'), 'utf8');
const live = readFileSync(resolve(root, 'src/live-submit.js'), 'utf8');

// Partner registrations have no cap: the session capacity limits website bookings only.
// A design export that greys out or labels a session by its spots would put the cap back.
if (/ar-SA/.test(js)) { console.error('design/app.js formats dates with the ar-SA locale, which is the Hijri calendar; use "ar-u-ca-gregory-nu-latn"'); process.exit(1); }
if (/\.spots\b/.test(js)) { console.error('design/app.js reads a session\'s spots: registrations must never be disabled or marked full by capacity (see README)'); process.exit(1); }

// 1. Replace the demo submit + ?state= previews with the live submit.
const cut = js.indexOf('  /* Submit: demo behaviour.');
const end = js.indexOf('  window.RiderRegistration');
if (cut < 0 || end < 0) { console.error('app.js changed shape: expected "/* Submit: demo behaviour." and "window.RiderRegistration" markers'); process.exit(1); }
js = js.slice(0, cut) + live + js.slice(end);
// Sessions are Jeddah events: format them in Riyadh time whatever the phone's zone is.
js = js.replace(/toLocaleDateString\(loc, \{/g, 'toLocaleDateString(loc, { timeZone: "Asia/Riyadh",')
       .replace(/toLocaleTimeString\(loc, \{/g, 'toLocaleTimeString(loc, { timeZone: "Asia/Riyadh",');

// 2. Strip demo values from the success markup.
html = html.replace(/ data-args='[^']*'>[^<]*(?=<\/p>)/, '>');
html = html.replace(/<b id="(chip-value|chip-booking-value|chip-company-value|chip-session-value)">[^<]*<\/b>/g, '<b id="$1"></b>');

// 3. Inline images as data URIs (the Worker CSP allows img-src 'self' data: only).
// href too, for the tab icon: the Worker serves one path and nothing else, so a linked
// file would be fetched from the origin, which forwards everywhere but here.
const mime = { png: 'image/png', avif: 'image/avif', webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml' };
html = html.replace(/(src|href)="([^"]+\.(png|avif|webp|jpe?g|svg))"/g, (m, attr, file, ext) => {
  if (/^(https?:)?\/\//.test(file) || file.startsWith('data:')) return m; // somebody else's image
  const p = d(file);
  if (!existsSync(p)) { console.warn(`warning: design/${file} not found, left as is`); return m; }
  return `${attr}="data:${mime[ext]};base64,${readFileSync(p).toString('base64')}"`;
});

// 4. Real WhatsApp number, noindex, inline CSS, supabase-js + inline JS.
html = html.replace(/https:\/\/wa\.me\/\d+/g, 'https://wa.me/966566668818');
html = html.replace('<link rel="stylesheet" href="styles.css">',
  () => '<meta name="robots" content="noindex">\n<link rel="preconnect" href="https://qpffkzmsfyilicwcsszz.supabase.co">\n<style>\n' + css + '\n</style>');
// The QR generator is inlined (MIT, vendor/): the desk scans the code to open the booking.
const qrlib = readFileSync(resolve(root, 'vendor/qrcode-generator-1.4.4.js'), 'utf8');
// A function replacer: a plain string would have $& and $' inside the scripts read as patterns.
html = html.replace('<script src="app.js"></script>',
  () => '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.0/dist/umd/supabase.min.js" integrity="sha384-DjOvX/sJLsmbMrw4wTvf6l3kiGBjdxyOO6X2MTFwOOXGkjN/mE08BoDzrpaaIjil" crossorigin="anonymous"></script>\n<script>\n' + qrlib + '\n</script>\n<script>\n' + js + '\n</script>');

// 5. Sanity: the ids the live submit relies on must exist.
for (const id of ['form', 'card', 'banner', 'edit', 'cancel-edit', 'qr', 'riders', 'add-rider', 'chip-riders', 'chip-riders-value', 'riders-note', 'ticket', 'tk-name', 'sessions', 'f-session', 'companies', 'f-company', 'badge', 'name', 'cc', 'phone', 'height', 'types', 'submit', 'next', 'back', 'success', 'result', 'chip-booking-value', 'chip-value', 'chip-company-value', 'chip-session-value', 'f-badge', 'f-name', 'f-phone', 'f-height', 'f-type']) {
  if (!html.includes(`id="${id}"`)) { console.error(`design/index.html is missing id="${id}" (the live submit needs it)`); process.exit(1); }
}
if (html.includes('href="styles.css"') || html.includes('src="app.js"')) { console.error('could not replace the styles.css / app.js tags'); process.exit(1); }
if (!/<link rel="icon"[^>]+href="data:image\//.test(html)) { console.error('the tab icon is missing or did not inline (design/favicon.png)'); process.exit(1); }
new Function(js); // syntax check

writeFileSync(resolve(root, 'src/page.html'), html);
// The website serves this page (apps/web/src/app/petromin/route.ts): it bundles this module.
writeFileSync(resolve(root, '../../apps/web/src/forms/petromin-page.ts'),
  '// GENERATED by forms/petromin/scripts/merge-design.mjs from src/page.html. Do not edit here:\n' +
  '// change the form in forms/petromin and run `npm run build` in forms/petromin.\n' +
  'const page: string = ' + JSON.stringify(html) + ';\nexport default page;\n');
console.log(`src/page.html and apps/web/src/forms/petromin-page.ts written (${(html.length / 1024).toFixed(0)} KB). Commit both; the website serves the page from its next deploy.`);
