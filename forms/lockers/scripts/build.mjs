// Builds the one self-contained page the website serves at /lockers (a locker reserved from a drawing of the cabinet):
//   design/index.html + styles.css + app.js + i18n.js + the logo, shared/shared.js -> src/page.html
// Usage: npm run build (in forms/lockers). Never edit src/page.html (or the website's copy) by hand.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { ACCOUNT_JS, writeAccountForWeb } from '../../shared/emit.mjs';
import { emitSite } from '../../shared/site-form.mjs';

const root = resolve(import.meta.dirname, '..');
const d = (f) => resolve(root, 'design', f);
let html = readFileSync(d('index.html'), 'utf8');
const css = readFileSync(d('styles.css'), 'utf8');
const js = readFileSync(d('app.js'), 'utf8');
const i18n = readFileSync(d('i18n.js'), 'utf8');
// The booking site's strings and lists (synced, in English and Arabic), in the website's sixteen languages:
// forms/shared/langs16.js lays the other fourteen, and their strings (forms/shared/site-t-extra.js), over them.
const shared = readFileSync(resolve(root, 'shared/shared.js'), 'utf8') + '\n' + readFileSync(resolve(root, '../shared/site-t-extra.js'), 'utf8') +
  '\n' + readFileSync(resolve(root, '../shared/langs16.js'), 'utf8') + '\nmmLangs16(SHARED);\n';
const SHARED = new Function(shared + ';return SHARED;')();
// The account step every account form shares (forms/shared/account.js), inlined before the page's script;
// the website's Learn to ride form gets the same file as apps/web/src/lib/account-shared.ts.
writeAccountForWeb();
// The code the desk scans is drawn with the website's own QR encoder (qrcode-generator, MIT, apps/web's dependency, as
// the tickets on micromobility.sa/account draw theirs), inlined as it ships: it defines the global qrcode.
let QR_JS;
try { QR_JS = readFileSync(createRequire(resolve(root, '../../apps/web/package.json')).resolve('qrcode-generator'), 'utf8'); }
catch { console.error('qrcode-generator not found: run pnpm install at the repository root first (it is the website\'s QR encoder)'); process.exit(1); }
if (!/var qrcode = function/.test(QR_JS)) { console.error('qrcode-generator no longer defines qrcode as the page expects'); process.exit(1); }

// Every language carries every string the page shows, with the same {placeholders}, and nothing it does not.
// The page's strings: data-t in the page, and in the script tr("..."), the messages kept as keys
// (setErr, showBanner, say, the step's problems), the step titles and the doors' names.
const FORM_T = new Function(i18n + ';return FORM_T;')();
const unent = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const NOT_TEXT = new Set(['Bearer ', 'HTTP ']);
const keys = new Set();
for (const m of html.matchAll(/data-t(?:-aria)?="([^"]+)"/g)) keys.add(unent(m[1]));
const PATTERNS = [/\btr\("((?:[^"\\]|\\.)+)"/g, /\bsetErr\([^,]+, "([^"]+)"/g, /\bshowBanner\("([^"]+)"/g, /\bsay\("([^"]+)"/g, /\["([A-Z][^"]*)"/g,
  /\b\d: "([^"]+)"/g, /\b[a-z]+: "([A-Z][^"]* [^"]*)"/g, /\bvar [A-Z_]+ = "([A-Z][^"]* [^"]*)"/g, /", "([A-Z][^"]* [^"]*)"\]/g];
for (const re of PATTERNS) for (const m of js.matchAll(re)) if (!NOT_TEXT.has(m[1]) && !/^(err[A-Z]|f-|privacy|dob)/.test(m[1])) keys.add(m[1]); // the site's own keys come from shared.js
const ph = (s) => (s.match(/\{[a-z0-9]+\}/g) || []).sort().join(',');
const problems = [];
for (const { code } of SHARED.LANGS) {
  if (code === 'en') continue;
  const t = FORM_T[code];
  if (!t) { problems.push(`${code}: no translations`); continue; }
  for (const k of keys) {
    if (!t[k]) problems.push(`${code}: missing "${k}"`);
    else if (ph(t[k]) !== ph(k)) problems.push(`${code}: placeholders differ in "${k}"`);
  }
  for (const k of Object.keys(t)) if (!keys.has(k)) problems.push(`${code}: unused "${k}"`);
}
for (const l of Object.keys(FORM_T)) if (!SHARED.LANGS.some((x) => x.code === l)) problems.push(`${l}: not one of the website's languages`);
// The booking site's strings the page shows (data-site*, site("..."), a field message flagged as the site's), in every language.
const siteKeys = new Set();
for (const m of html.matchAll(/data-site(?:-aria|-placeholder)?="([^"]+)"/g)) siteKeys.add(unent(m[1]));
for (const m of js.matchAll(/\bsite\("([^"]+)"/g)) siteKeys.add(m[1]);
for (const k of [...siteKeys]) if (k.endsWith('_')) { siteKeys.delete(k); for (const e of Object.keys(SHARED.SITE_T.en)) if (e.startsWith(k)) siteKeys.add(e); } // site("emRel_" + r): every one of them
for (const { code } of SHARED.LANGS) for (const k of siteKeys) if (!(SHARED.SITE_T[code] || {})[k]) problems.push(`${code}: the booking site's "${k}" has no text`);
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }

// The logo is drawn inline, so its words follow the page's colour (currentColor) in light and dark.
html = html.replace(/<!-- svg:([a-z0-9-]+\.svg) -->/g, (m, file) => {
  const p = d(file);
  if (!existsSync(p)) { console.error(`design/${file} not found`); process.exit(1); }
  return readFileSync(p, 'utf8').replace(/<\?xml[^>]*>\s*/, '').replace(/<!--[\s\S]*?-->/g, '').replace(/\s+role="img"/, ' role="img" focusable="false"').trim();
});
if (/<!-- svg:/.test(html)) { console.error('an inline logo was left out'); process.exit(1); }
const sitePage = html;

// A PNG with only the chunks that draw it (IHDR, PLTE, tRNS, IDAT, IEND).
const PNG_KEEP = new Set(['IHDR', 'PLTE', 'tRNS', 'IDAT', 'IEND']);
function pngBare(buf) {
  if (buf.toString('latin1', 1, 4) !== 'PNG') return buf;
  const parts = [buf.subarray(0, 8)];
  for (let i = 8; i + 12 <= buf.length; ) {
    const end = i + 12 + buf.readUInt32BE(i);
    if (PNG_KEEP.has(buf.toString('latin1', i + 4, i + 8))) parts.push(buf.subarray(i, end));
    i = end;
  }
  return Buffer.concat(parts);
}
const mime = { png: 'image/png', svg: 'image/svg+xml', webp: 'image/webp' };
html = html.replace(/(src|href)="([^"]+\.(png|svg|webp))"/g, (m, attr, file, ext) => {
  if (/^(https?:)?\/\//.test(file)) return m;
  const p = d(file);
  if (!existsSync(p)) { console.error(`design/${file} not found`); process.exit(1); }
  const bytes = ext === 'png' ? pngBare(readFileSync(p)) : readFileSync(p);
  return `${attr}="data:${mime[ext]};base64,${bytes.toString('base64')}"`;
});
html = html.replace('<link rel="stylesheet" href="styles.css">',
  () => '<meta name="robots" content="noindex">\n<link rel="preconnect" href="https://qpffkzmsfyilicwcsszz.supabase.co">\n<style>\n' + css + '\n</style>');
html = html.replace('<script src="shared.js"></script>\n<script src="i18n.js"></script>\n<script src="app.js"></script>',
  () => '<script>\n' + shared + '\n' + i18n + '\n' + ACCOUNT_JS + '\n' + QR_JS + '\n</script>\n<script>\n' + js + '\n</script>');
if (/href="styles\.css"|src="(app|i18n|shared)\.js"/.test(html)) { console.error('could not inline the styles or scripts'); process.exit(1); }
new Function(js); new Function(i18n); // syntax
writeFileSync(resolve(root, 'src/page.html'), html);
// The website's own page for it (forms/shared/site-form.mjs): the site draws the header (its logo and language picker
// among it), so the page's header is left out; the rest of the body as designed, its scripts run by the page.
const siteBody = sitePage.slice(sitePage.indexOf('<main'), sitePage.indexOf('<script src="shared.js">')).trim();
const siteImages = [...new Set([...siteBody.matchAll(/(?:src|href)="([^":#]+\.(?:png|svg|webp))"/g)].map((m) => m[1]))];
emitSite({ name: 'lockers', design: resolve(root, 'design'), body: siteBody, css, scripts: [shared, i18n, ACCOUNT_JS, QR_JS, js], images: siteImages }); // the QR encoder too: the desk card draws its code on the website's page as on its own
// The website serves this page (apps/web/src/app/lockers/route.ts): it bundles this module.
writeFileSync(resolve(root, '../../apps/web/src/forms/lockers-page.ts'),
  '// GENERATED by forms/lockers/scripts/build.mjs from src/page.html. Do not edit here:\n' +
  '// change the page in forms/lockers and run `npm run build` in forms/lockers.\n' +
  'const page: string = ' + JSON.stringify(html) + ';\nexport default page;\n');
console.log(`src/page.html and apps/web/src/forms/lockers-page.ts written (${(html.length / 1024).toFixed(0)} KB, ${keys.size} strings x ${SHARED.LANGS.length} languages), and the website's page for it (apps/web/src/forms/site/lockers.*). Commit them all; the website serves them from its next deploy.`);
