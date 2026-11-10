// Builds the one self-contained page the website serves at /saturday (the Saturday Social Ride, booked with a ride code):
//   design/index.html + styles.css + app.js + i18n.js + the logo, shared/shared.js -> src/page.html
// Usage: npm run build (in forms/saturday). Never edit src/page.html (or the website's copy) by hand.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ACCOUNT_JS, writeAccountForWeb, sameNoticeAsSite } from '../../shared/emit.mjs';
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
sameNoticeAsSite(SHARED, 'saturday'); // the notice the website shows, never an older copy
// The account step every account form shares (forms/shared/account.js), inlined before the page's script;
// the website's Learn to ride form gets the same file as apps/web/src/lib/account-shared.ts.
writeAccountForWeb();

// Every language carries every string the page shows, with the same {placeholders}, and nothing it does not.
// The page's strings: data-t in the page, and in the script tr("..."), the messages kept as keys
// (setErr, showBanner, the step's problems and the notices' arrays), the step titles and the state names.
const FORM_T = new Function(i18n + ';return FORM_T;')();
const unent = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const NOT_TEXT = new Set(['Saudi Arabia', 'January', 'Road', 'Bearer ', 'HTTP ']);
const keys = new Set();
for (const m of html.matchAll(/data-t(?:-aria)?="([^"]+)"/g)) keys.add(unent(m[1]));
const PATTERNS = [/\btr\("((?:[^"\\]|\\.)+)"/g, /\bsetErr\([^,]+, "([^"]+)"/g, /\bshowBanner\("([^"]+)"/g, /\["([A-Z][^"]*)"/g,
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
  () => '<script>\n' + shared + '\n' + i18n + '\n' + ACCOUNT_JS + '\n</script>\n<script>\n' + js + '\n</script>');
if (/href="styles\.css"|src="(app|i18n|shared)\.js"/.test(html)) { console.error('could not inline the styles or scripts'); process.exit(1); }
new Function(js); new Function(i18n); // syntax
writeFileSync(resolve(root, 'src/page.html'), html);
// The website's own page for it (forms/shared/site-form.mjs): the site draws the header (its logo and language picker
// among it), so the page's header is left out; the rest of the body as designed, its scripts run by the page.
const siteBody = sitePage.slice(sitePage.indexOf('<main'), sitePage.indexOf('<script src="shared.js">')).trim();
const siteImages = [...new Set([...siteBody.matchAll(/(?:src|href)="([^":#]+\.(?:png|svg|webp))"/g)].map((m) => m[1]))];
emitSite({ name: 'saturday', design: resolve(root, 'design'), body: siteBody, css, scripts: [shared, i18n, ACCOUNT_JS, js], images: siteImages });
// The website serves this page (apps/web/src/app/saturday/route.ts): it bundles this module.
writeFileSync(resolve(root, '../../apps/web/src/forms/saturday-page.ts'),
  '// GENERATED by forms/saturday/scripts/build.mjs from src/page.html. Do not edit here:\n' +
  '// change the page in forms/saturday and run `npm run build` in forms/saturday.\n' +
  'const page: string = ' + JSON.stringify(html) + ';\nexport default page;\n');
console.log(`src/page.html and apps/web/src/forms/saturday-page.ts written (${(html.length / 1024).toFixed(0)} KB, ${keys.size} strings x ${SHARED.LANGS.length} languages), and the website's page for it (apps/web/src/forms/site/saturday.*). Commit them all; the website serves them from its next deploy.`);
