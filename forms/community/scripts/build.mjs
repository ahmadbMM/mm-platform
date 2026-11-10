// Builds the one self-contained page the website serves at /community/registration:
//   design/index.html + styles.css + app.js + i18n.js + images, shared/shared.js -> src/page.html
// Usage: npm run build (in forms/community). Never edit src/page.html (or the website's copy) by hand.
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { ACCOUNT_JS, writeAccountForWeb, sameNoticeAsSite } from '../../shared/emit.mjs';
import { emitSite } from '../../shared/site-form.mjs';

const root = resolve(import.meta.dirname, '..');
const d = (f) => resolve(root, 'design', f);
let html = readFileSync(d('index.html'), 'utf8');
const css = readFileSync(d('styles.css'), 'utf8');
const js = readFileSync(d('app.js'), 'utf8');
const i18n = readFileSync(d('i18n.js'), 'utf8');
// The booking site's strings and lists (synced), in the website's sixteen languages: forms/shared/langs16.js lays the
// six the booking app does not speak, and their strings (forms/shared/site-t-extra.js), over them.
// The sport question (the booking app's of 2026-11-10, asked on the form since 2026-11-11): its groups and federations
// (apps/web/src/lib/sport.ts) and its words in the sixteen languages (apps/web/src/components/account/Sport.words.ts),
// read from the website's own files so the form never keeps a second copy. Plain data, read out of the TypeScript.
const webSrc = resolve(root, '../../apps/web/src');
const literal = (file, name, open, close) => {
  const src = readFileSync(resolve(webSrc, file), 'utf8');
  const at = src.indexOf(`export const ${name}`);
  if (at < 0) throw new Error(`${file}: no ${name}`);
  const from = src.indexOf(open, src.indexOf('=', at));
  const to = src.indexOf(close, from);
  return new Function(`return ${src.slice(from, to + close.length - 1)};`)();
};
const SPORT_DATA = { groups: literal('lib/sport.ts', 'SPORT_GROUPS', '[', '\n];'), words: literal('components/account/Sport.words.ts', 'SPORT_WORDS', '{', '\n};') };
if (SPORT_DATA.groups.length !== 10 || !SPORT_DATA.words.en || !SPORT_DATA.words.ar) throw new Error('the sport question\'s lists did not read');
const shared = readFileSync(resolve(root, 'shared/shared.js'), 'utf8') + '\n' + readFileSync(resolve(root, '../shared/site-t-extra.js'), 'utf8') +
  '\n' + readFileSync(resolve(root, '../shared/langs16.js'), 'utf8') + '\nmmLangs16(SHARED);\nvar SPORT_DATA = ' + JSON.stringify(SPORT_DATA) + ';\n';
// The account step every account form shares (forms/shared/account.js), inlined before the page's script;
// the website's Learn to ride form gets the same file as apps/web/src/lib/account-shared.ts.
writeAccountForWeb();

// Every translation carries every string the page shows, with the same {placeholders}.
const FORM_T = new Function(i18n + ';return FORM_T;')();
const SHARED = new Function(shared + ';return SHARED;')();
sameNoticeAsSite(SHARED, 'community'); // the notice the website shows, never an older copy
const keys = new Set();
for (const m of html.matchAll(/data-t(?:-placeholder|-aria)?="([^"]+)"/g)) keys.add(m[1]);
for (const m of js.matchAll(/tr\("([^"]+)"/g)) keys.add(m[1]);
for (const m of js.matchAll(/\bk\("([^"]+)"\)/g)) keys.add(m[1]); // k("..."): a string of the form's own, used as a key
for (const m of js.matchAll(/(?:hard|soft)(?:\[(?:"f-[a-z]+"|id)\])?\s*[:=]\s*\["([^"]+)"/g)) keys.add(m[1]);
for (const m of js.matchAll(/"f-[a-z]+", \d, "([^"]+)"/g)) keys.add(m[1]);
for (const m of js.matchAll(/showBanner\("([^"]+)"/g)) keys.add(m[1]);
for (const m of js.matchAll(/setErr\("f-[a-z0-9-]+", "([^"]+)"\)/g)) keys.add(m[1]); // a message set straight on a field
['dobErrFuture', 'dobErrYoung', 'privacyAckRequired', 'errPasswordLen', 'errPasswordMatch'].forEach((k) => keys.delete(k)); // the site's own strings (shared.js)
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
if (problems.length) { console.error(problems.slice(0, 40).join('\n')); process.exit(1); }

// A PNG with only the chunks that draw it (IHDR, PLTE, tRNS, IDAT, IEND): a design export's metadata
// (a C2PA block of ~5.7 KB a logo) or any other ancillary chunk never reaches the page.
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
// The website's own page for the form (forms/shared/site-form.mjs): the site draws the header (its language picker
// among it), so the form's header is left out; the rest of the body as designed, its scripts run by the page.
const page = readFileSync(d('index.html'), 'utf8');
const siteBody = page.slice(page.indexOf('<main'), page.indexOf('<script src="shared.js">')).trim();
const siteImages = [...new Set([...siteBody.matchAll(/(?:src|href)="([^":]+\.(?:png|svg|webp))"/g)].map((m) => m[1]))];
// The website's page carries English only; every other language is a file of its own, fetched by the page that needs
// it (the owner's B19, 2026-11-10): the form's words (FORM_T), the booking site's (SITE_T), the Privacy Notice where it
// is written in that language, and the Arabic country names. Named by their content, so a browser never keeps an old one.
const packDir = resolve(root, '../../apps/web/public/forms/community/lang');
rmSync(packDir, { recursive: true, force: true }); mkdirSync(packDir, { recursive: true });
const packFiles = {};
for (const { code } of SHARED.LANGS) {
  if (code === 'en') continue;
  const pack = { lang: code, T: FORM_T[code], S: SHARED.SITE_T[code] || {} };
  if (SHARED.PRIVACY_NOTICE[code]) pack.N = SHARED.PRIVACY_NOTICE[code];
  if (code === 'ar') pack.C = SHARED.COUNTRY_AR;
  const body = JSON.stringify(pack);
  const file = `${code}.${createHash('sha256').update(body).digest('hex').slice(0, 10)}.json`;
  writeFileSync(resolve(packDir, file), body); packFiles[code] = file;
}
const lean = { ...SHARED, SITE_T: { en: SHARED.SITE_T.en }, PRIVACY_NOTICE: { en: SHARED.PRIVACY_NOTICE.en }, COUNTRY_AR: {} };
const siteShared = 'var SHARED = ' + JSON.stringify(lean) + ';\nvar SPORT_DATA = ' + JSON.stringify(SPORT_DATA) + ';\n';
emitSite({ name: 'community', design: resolve(root, 'design'), body: siteBody, css, scripts: [siteShared, 'var FORM_T = {};\n', ACCOUNT_JS, js], images: siteImages,
  packs: { dir: '/forms/community/lang/', files: packFiles } });
// The website serves this page (apps/web/src/app/community/registration/route.ts): it bundles this module.
writeFileSync(resolve(root, '../../apps/web/src/forms/community-page.ts'),
  '// GENERATED by forms/community/scripts/build.mjs from src/page.html. Do not edit here:\n' +
  '// change the form in forms/community and run `npm run build` in forms/community.\n' +
  'const page: string = ' + JSON.stringify(html) + ';\nexport default page;\n');
console.log(`src/page.html and apps/web/src/forms/community-page.ts written (${(html.length / 1024).toFixed(0)} KB, ${keys.size} strings x ${SHARED.LANGS.length} languages). Commit both; the website serves the page from its next deploy.`);
