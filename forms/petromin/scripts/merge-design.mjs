// Merge the design into one self-contained src/page.html.
//
//   design/index.html, design/styles.css, design/app.js, design/*.png (logos)
//   + src/live-submit.js (the real calls, kept out of the design) + src/guest.js (an invited guest's account and booking)
//   + forms/shared/account.js (the sign-in every account form shares)
//   -> src/page.html
//
// Usage: npm run build (in forms/petromin)
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { emitSite } from '../../shared/site-form.mjs';
import { ACCOUNT_JS } from '../../shared/emit.mjs';

const root = resolve(import.meta.dirname, '..');
const d = (f) => resolve(root, 'design', f);
const need = ['index.html', 'styles.css', 'app.js'];
for (const f of need) if (!existsSync(d(f))) { console.error(`missing design/${f}`); process.exit(1); }

let html = readFileSync(d('index.html'), 'utf8');
const css = readFileSync(d('styles.css'), 'utf8');
let js = readFileSync(d('app.js'), 'utf8');
const liveSrc = readFileSync(resolve(root, 'src/live-submit.js'), 'utf8');
const guestSrc = readFileSync(resolve(root, 'src/guest.js'), 'utf8');

// Partner registrations have no cap: the session capacity limits website bookings only.
// A design export that greys out or labels a session by its spots would put the cap back.
if (/ar-SA/.test(js)) { console.error('design/app.js formats dates with the ar-SA locale, which is the Hijri calendar; use "ar-u-ca-gregory-nu-latn"'); process.exit(1); }
if (/\.spots\b/.test(js)) { console.error('design/app.js reads a session\'s spots: registrations must never be disabled or marked full by capacity (see README)'); process.exit(1); }
// A night's title in the calendar is Petromin's own name for it: only nightTitle() reads it, and only for Petromin's
// and Petrolube's employees. Dukan's employees and the invited guests see a night by its day and time alone.
const titleReads = (js.slice(js.indexOf('\n  var $ = function'), js.indexOf('  /* Submit: demo behaviour.')) + liveSrc + guestSrc).match(/\bs\.title\b/g) || [];
if (titleReads.length !== 2 || !js.includes('function nightTitle(s) { return (!KIND || KIND === "emp") && s && s.title ? s.title : ""; }')) {
  console.error('a session\'s title is read outside nightTitle(): name the night by its day and time for everyone but Petromin\'s and Petrolube\'s employees (see README)'); process.exit(1);
}
// The page loads no script from elsewhere: its calls are plain POSTs (rpcFetch).
if (/window\.supabase|createClient\(/.test(liveSrc + guestSrc)) { console.error('the page talks to the database with rpcFetch, never supabase-js'); process.exit(1); }
// An invited guest's session lives in memory: never in the phone's storage.
if (/Storage\.setItem\([^)]*(token|acct)/.test(guestSrc)) { console.error('src/guest.js keeps the account in the phone\'s storage: the session lives in memory only'); process.exit(1); }

// The lists an invited guest's account step chooses from are the booking site's own, as the Saturday ride's page
// carries them (forms/saturday/shared/shared.js, synced from the booking app): every calling code with its mobile
// rules, the nationalities, the emergency contact's relations. The Privacy Notice a new account confirms is the
// website's (apps/web/src/content/privacy-notice.ts): its version is read at each build, so CI's rebuild refuses a
// page left on an older one.
const SH = new Function(readFileSync(resolve(root, '../saturday/shared/shared.js'), 'utf8') + ';return SHARED;')();
const notice = /export const PRIVACY_VERSION = "(\d{4}-\d{2}-\d{2})"/.exec(readFileSync(resolve(root, '../../apps/web/src/content/privacy-notice.ts'), 'utf8'));
if (!notice) { console.error('apps/web/src/content/privacy-notice.ts names no PRIVACY_VERSION'); process.exit(1); }
for (const k of ['COUNTRY_CODES', 'PHONE_RULES', 'NATIONALITIES', 'COUNTRY_AR', 'EM_RELS']) if (!SH[k]) { console.error(`forms/saturday/shared/shared.js has no ${k}`); process.exit(1); }
if (SH.COUNTRY_CODES.some((x) => x[1] === 'IL') || SH.NATIONALITIES.some((x) => x[0] === 'IL')) { console.error('the country lists must not carry Israel (the owner\'s rule)'); process.exit(1); }
const ACCT = { COUNTRY_CODES: SH.COUNTRY_CODES, PHONE_RULES: SH.PHONE_RULES, NATIONALITIES: SH.NATIONALITIES, COUNTRY_AR: SH.COUNTRY_AR, EM_RELS: SH.EM_RELS, PRIVACY_VERSION: notice[1] };
const live = '  var ACCT = ' + JSON.stringify(ACCT) + ';\n' + liveSrc + guestSrc;

// 1. Replace the demo submit + ?state= previews with the live submit.
const cut = js.indexOf('  /* Submit: demo behaviour.');
const end = js.indexOf('  window.RiderRegistration');
if (cut < 0 || end < 0) { console.error('app.js changed shape: expected "/* Submit: demo behaviour." and "window.RiderRegistration" markers'); process.exit(1); }
js = js.slice(0, cut) + live + js.slice(end);
// Sessions are Jeddah events: format them in Riyadh time whatever the phone's zone is.
js = js.replace(/toLocaleDateString\(loc, \{/g, 'toLocaleDateString(loc, { timeZone: "Asia/Riyadh",')
       .replace(/toLocaleTimeString\(loc, \{/g, 'toLocaleTimeString(loc, { timeZone: "Asia/Riyadh",');

// Every word the page shows is in T (design/app.js), in each of the fifteen languages beside English, with the same
// {placeholders}: the markup's data-t, and in the scripts t("..."), the messages a box, the banner or a note is given,
// the names kept as constants and the two sides of a choice between messages.
const tStart = js.indexOf('  var T = {'), tEnd = js.indexOf('\n  var $ = function');
if (tStart < 0 || tEnd < 0) { console.error('app.js changed shape: expected "  var T = {" before "var $ = function"'); process.exit(1); }
const T = new Function('return ' + js.slice(tStart + '  var T = '.length, tEnd).trim().replace(/;$/, ''))();
const LANGS = new Function('return ' + /var LANGS = (\{[^}]+\});/.exec(js)[1])();
// (the lists the build put in, and the two Privacy Notices, which are written in English and Arabic in full, are not T's)
const code = js.slice(tEnd).replace(/^\s*var ACCT = .*$/m, '').replace(/var PV_EMP = \{[\s\S]*?var pvDialog/, 'var pvDialog');
const unent = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const NOT_TEXT = new Set(['Saudi Arabia', 'Asia/Riyadh', 'Content-Type', 'Bearer ', 'HTTP ', 'TypeError: ', 'Failed to fetch', 'no canvas', 'Petromin', 'Petrolube', 'Dukan', 'Guest',
  'D-001', 'I-001', 'P-001', 'SA+966', 'USA', 'Canada', 'Any', 'MMP-', 'D', 'I', 'P', 'ArrowLeft', 'ArrowRight', 'Md. Rahman']);
const keys = new Set();
for (const m of html.matchAll(/data-t(?:-placeholder|-label)?="([^"]+)"/g)) keys.add(unent(m[1]));
const PATTERNS = [/\bt\("((?:[^"\\]|\\.)+)"/g, /\bsetError\([^;\n]*?, (?:true|!?[a-z][\w.()!&| ]*), "((?:[^"\\]|\\.)+)"/g, /\b(?:showBanner|failBanner|setNote|setNotice|fdMiss)\("((?:[^"\\]|\\.)+)"/g, /\bfail\("[a-z0-9-]+", "((?:[^"\\]|\\.)+)"/g,
  /[?:] "([A-Z][^"]*[a-z][^"]*)"/g, /\bvar [A-Z_]+ = "([A-Z][^"]* [^"]*)"/g, /\breturn "([A-Z][^"]* [^"]*)"/g, /\[\s*"([A-Z][^"]* [^"]*)"/g, /: \["[a-z]+", "([A-Z][^"]* [^"]*)"\]/g, /"data-t", "([^"]+)"/g,
  /\b[a-z_]+: "([A-Z][^"]* [^"]*[a-z.])"/g, /err: \["f-" \+ p \+ "-[a-z]+", "([^"]+)"\]/g, /data-t="([^"]+)"/g];
for (const re of PATTERNS) for (const m of code.matchAll(re)) {
  const k = unent(m[1].replace(/\\"/g, '"').replace(/\\n/g, '\n'));
  if (!NOT_TEXT.has(k) && /[A-Za-z]{2}/.test(k) && !/^(https?:|BEGIN:|END:|VERSION:|PRODID:|CALSCALE:|METHOD:|TRIGGER:|ACTION:|URL:|UID:|DTSTART:|DTEND:|DTSTAMP:|SUMMARY:|LOCATION:|DESCRIPTION:)/.test(k)) keys.add(k);
}
for (const k of ['Company', 'Your account', 'Session', 'Your details', 'Bike', 'Check and agree', 'Petromin bike night', 'Dukan bike night', 'Petromin Ride Night: Invited Guests',
  'Spouse', 'Parent', 'Brother or sister', 'Son or daughter', 'Relative', 'Friend', 'Colleague', 'Other', 'Hybrid', 'Mountain', 'Road']) keys.add(k);
keys.delete('104582'); keys.delete('175'); keys.delete('5X XXX XXXX');
const ph = (s) => (s.match(/\{[a-z0-9]+\}/g) || []).sort().join(',');
const problems = [];
for (const lang of Object.keys(LANGS)) {
  if (lang === 'en') continue;
  const t = T[lang];
  if (!t) { problems.push(`${lang}: no translations`); continue; }
  for (const k of keys) {
    if (!t[k]) problems.push(`${lang}: missing "${k}"`);
    else if (ph(t[k]) !== ph(k)) problems.push(`${lang}: placeholders differ in "${k}"`);
  }
}
for (const l of Object.keys(T)) if (!LANGS[l]) problems.push(`${l}: not one of the page's languages`);
if (problems.length) { console.error(problems.slice(0, 60).join('\n') + (problems.length > 60 ? `\n... and ${problems.length - 60} more` : '')); process.exit(1); }

// 2. Strip demo values from the success markup.
html = html.replace(/ data-args='[^']*'>[^<]*(?=<\/p>)/, '>');
html = html.replace(/(<div class="ticket-(?:num|value)" id="(?:chip-booking-value|chip-session-value|chip-value|chip-company-value|tk-type-value|tk-pickup-value|tk-place-value)"[^>]*>)[^<]*(<\/div>)/g, '$1$2');

// The website's page for the form (apps/web/src/app/[locale]/petromin) draws its own header - logo and language - so it
// takes the body from <main> on, its pictures as files beside the page rather than inlined.
const siteHtml = html.replace(/https:\/\/wa\.me\/\d+/g, 'https://wa.me/966566668818');

// 3. Inline images as data URIs (the page's CSP allows img-src 'self' data: only).
// href too, for the tab icon: the page is one address and nothing else, so a linked file would not be found.
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
const mime = { png: 'image/png', avif: 'image/avif', webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml' };
// A picture the page shows more than once (a company's mark on its tile and over the form) is carried once: the others
// name it (data-img-ref) and a line of script, before the form's own, gives them its bytes.
const inlined = new Set();
html = html.replace(/(src|href)="([^"]+\.(png|avif|webp|jpe?g|svg))"/g, (m, attr, file, ext) => {
  if (/^(https?:)?\/\//.test(file) || file.startsWith('data:')) return m; // somebody else's image
  const p = d(file);
  if (!existsSync(p)) { console.warn(`warning: design/${file} not found, left as is`); return m; }
  if (attr === 'src' && inlined.has(file)) return `data-img-ref="${file}"`;
  const bytes = ext === 'png' ? pngBare(readFileSync(p)) : readFileSync(p);
  if (attr === 'src') inlined.add(file);
  return `${attr}="data:${mime[ext]};base64,${bytes.toString('base64')}"` + (attr === 'src' ? ` data-img="${file}"` : '');
});
const IMG_REFS = 'document.querySelectorAll("img[data-img-ref]").forEach(function (i) { var s = document.querySelector(\'img[data-img="\' + i.getAttribute("data-img-ref") + \'"]\'); if (s) i.src = s.src; });';

// 4. Real WhatsApp number, noindex, inline CSS, inline JS. No script from elsewhere (the calls are plain POSTs).
html = html.replace(/https:\/\/wa\.me\/\d+/g, 'https://wa.me/966566668818');
html = html.replace('<link rel="stylesheet" href="styles.css">',
  () => '<meta name="robots" content="noindex">\n<link rel="preconnect" href="https://qpffkzmsfyilicwcsszz.supabase.co">\n<style>\n' + css + '\n</style>');
// The QR generator is inlined (MIT, vendor/): the desk scans the code to open the booking.
const qrlib = readFileSync(resolve(root, 'vendor/qrcode-generator-1.4.4.js'), 'utf8');
// A function replacer: a plain string would have $& and $' inside the scripts read as patterns.
html = html.replace('<script src="app.js"></script>',
  () => '<script>\n' + qrlib + '\n</script>\n<script>\n' + ACCOUNT_JS + '\n</script>\n<script>\n' + IMG_REFS + '\n' + js + '\n</script>');

// 5. Sanity: the ids the live submit relies on must exist.
for (const id of ['form', 'card', 'banner', 'edit', 'cancel-edit', 'qr', 'riders', 'add-rider', 'chip-riders', 'chip-riders-value', 'riders-note', 'ticket', 'tk-name', 'sessions', 'f-session', 'companies', 'f-company', 'badge', 'name', 'cc', 'phone', 'height', 'types', 'submit', 'next', 'back', 'success', 'result', 'chip-booking-value', 'chip-value', 'chip-company-value', 'chip-session-value', 'f-badge', 'f-name', 'f-phone', 'f-height', 'f-type', 'f-waiver', 'waiver', 'another', 'others', 'others-list',
  'tk-type', 'tk-price', 'tk-status', 'waiver-label', 'bike-title', 'type-label', 'f-riders', 'ac-ask', 'ac-signin', 'ac-create', 'ac-details', 'ac-ident', 'ac-spwd', 'ac-first', 'ac-last', 'ac-genders', 'ac-email', 'ac-cc', 'ac-phone', 'ac-pwd', 'ac-pwd2', 'ac-height', 'em-slot', 'xem-slot', 'ac-ack', 'ac-news', 'ac-company', 'ac-xheight', 'ac-nat', 'ac-birth-d', 'ac-birth-m', 'ac-birth-y', 'ac-who', 'ac-blocked', 'ac-temp', 'ac-email-fix']) {
  if (!html.includes(`id="${id}"`)) { console.error(`design/index.html is missing id="${id}" (the live submit needs it)`); process.exit(1); }
}
for (const p of ['company', 'account', 'session', 'details', 'bike', 'check']) if (!html.includes(`data-pane="${p}"`)) { console.error(`design/index.html is missing the "${p}" step (data-pane)`); process.exit(1); }
if (html.includes('href="styles.css"') || html.includes('src="app.js"')) { console.error('could not replace the styles.css / app.js tags'); process.exit(1); }
if (/<script\b[^>]*\bsrc=/.test(html)) { console.error('the page names a script file: everything it runs is inlined'); process.exit(1); }
if (!/<link rel="icon"[^>]+href="data:image\//.test(html)) { console.error('the tab icon is missing or did not inline (design/favicon.png)'); process.exit(1); }
new Function(js); // syntax check

writeFileSync(resolve(root, 'src/page.html'), html);

// The website's page for the form: its markup, stylesheet and scripts (forms/shared/site-form.mjs). The QR generator
// runs as part of the form's scripts, its module wrapper (which would hand it to a bundler's `module`) left out; the
// shared account step is handed to the page as MMAccount.
const siteBody = siteHtml.slice(siteHtml.indexOf('<main'), siteHtml.indexOf('<script src="app.js">')).trim();
const siteImages = [...new Set([...siteBody.matchAll(/src="([^":]+\.png)"/g)].map((m) => m[1]))];
const qrSite = qrlib.replace(/\n\(function \(factory\) \{[\s\S]*\}\(function \(\) \{\s*return qrcode;\s*\}\)\);\s*$/, '\n');
if (qrSite === qrlib) { console.error('the QR generator changed shape: its module wrapper was not found'); process.exit(1); }
// The website's copy carries one language: the dictionary (T, every language but English) leaves its scripts, and each
// language's words are a file of their own beside the page, named by their content so a browser keeps them for a year
// (apps/web/public/_headers). The page's language is fetched before the form's scripts run; another one picked later
// is fetched then (applyLang). The form's own page keeps every language, as its picker switches without a load.
const tDir = resolve(root, '../../apps/web/public/forms/petromin/t');
rmSync(tDir, { recursive: true, force: true }); mkdirSync(tDir, { recursive: true });
const tFiles = {};
for (const [lang, dict] of Object.entries(T)) {
  const body = JSON.stringify(dict), hash = createHash('sha256').update(body).digest('hex').slice(0, 10);
  writeFileSync(resolve(tDir, `${lang}.${hash}.json`), body);
  tFiles[lang] = `/forms/petromin/t/${lang}.${hash}.json`;
}
const siteJs = '(function () {\n  var site = window.MM_SITE_FORM || {}, files = ' + JSON.stringify(tFiles) + ';\n  site.tBase = files;\n' +
  '  function start(dict) {\n    var T_SITE = {}; if (dict) T_SITE[site.lang] = dict;\n' +
  js.slice(0, tStart) + '  var T = T_SITE;' + js.slice(tEnd) + '\n  }\n' +
  '  if (!files[site.lang] || !window.fetch) start(null);\n' +
  '  else fetch(files[site.lang]).then(function (r) { return r.ok ? r.json() : null; }).then(start, function () { start(null); });\n})();\n';
new Function(siteJs); // syntax check
// The website loads Space Grotesk and IBM Plex Sans Arabic itself (next/font, --cs-font-en / --cs-font-ar): its copy
// of the form uses those rather than fetching the same faces a second time. Rubik (Dukan's look) and the riyal sign
// are the form's own there too.
const siteCss = css.replace(/@font-face \{ font-family: "(Space Grotesk|IBM Plex Sans Arabic)";[^}]*\}\n/g, '')
  .replace(/"Space Grotesk"/g, 'var(--cs-font-en)').replace(/"IBM Plex Sans Arabic"/g, 'var(--cs-font-ar)');
if (/@font-face \{ font-family: "Space Grotesk"/.test(siteCss)) { console.error('the site copy still declares Space Grotesk'); process.exit(1); }
emitSite({ name: 'petromin', design: resolve(root, 'design'), body: siteBody, css: siteCss, scripts: [qrSite, ACCOUNT_JS, siteJs], images: siteImages });
for (const f of siteImages) writeFileSync(resolve(root, '../../apps/web/public/forms/petromin', basename(f)), pngBare(readFileSync(d(f))));
// The website serves this page (apps/web/src/app/petromin/route.ts): it bundles this module.
writeFileSync(resolve(root, '../../apps/web/src/forms/petromin-page.ts'),
  '// GENERATED by forms/petromin/scripts/merge-design.mjs from src/page.html. Do not edit here:\n' +
  '// change the form in forms/petromin and run `npm run build` in forms/petromin.\n' +
  'const page: string = ' + JSON.stringify(html) + ';\nexport default page;\n');
console.log(`src/page.html and apps/web/src/forms/petromin-page.ts written (${(html.length / 1024).toFixed(0)} KB, ${keys.size} strings x ${Object.keys(LANGS).length} languages), and the website's page for the form (apps/web/src/forms/site/petromin.*). Commit them all; the website serves them from its next deploy.`);
