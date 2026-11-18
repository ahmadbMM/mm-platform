// Copies what the Farmhouse page shares with the booking site out of the site's own source, so the two
// never drift: the Privacy Notice (English + Arabic) and its version, the language list (English and
// Arabic; forms/shared/langs16.js lays the other fourteen over it), the nationality and calling-code lists, the Arabic
// country names, the phone-number rules the staff "Looks off" check uses, the Farm House Night's own waiver (its words
// and the version a booking is stamped with) in all sixteen languages, and the site's own strings for the sign-up, the
// sign-in, the consent boxes, the date-of-birth picker, gender and the emergency contact.
//
//   node scripts/sync-shared.mjs [path to the micromobilityrentals checkout]
//   default: $RENTALS_DIR or ~/micromobilityrentals
//
// Writes shared/shared.js (committed, so a build never needs the other repo). Run it after the
// site changes the notice or the farm waiver, then `npm run build`.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';

const rentals = resolve(process.argv[2] || process.env.RENTALS_DIR || join(homedir(), 'micromobilityrentals'));
const src = readFileSync(join(rentals, 'app.src.html'), 'utf8');

// The value that starts at `marker` (an object or array literal), evaluated. Brackets inside
// string literals are skipped, the same scan the site's build and check-i18n use.
function valueAt(marker, scope = '') {
  const at = src.indexOf(marker);
  if (at < 0) throw new Error(`sync-shared: \`${marker}\` not found in app.src.html`);
  let i = at + marker.length - 1;
  const open = src[i], close = open === '[' ? ']' : '}';
  const start = i;
  let depth = 0, quote = null;
  for (; i < src.length; i++) {
    const c = src[i];
    if (quote) { if (c === '\\') { i++; continue; } if (c === quote) quote = null; continue; }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if (c === open) depth++;
    else if (c === close && --depth === 0) break;
  }
  return new Function(`${scope}return (${src.slice(start, i + 1)});`)();
}
function stringAt(marker) {
  const m = new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "'([^']*)'").exec(src);
  if (!m) throw new Error(`sync-shared: \`${marker}\` not found`);
  return m[1];
}

// The booking app's ten languages: their words for the site's strings below (as forms/community syncs them), so a
// language the booking app speaks never falls back to English; the page's own list is English and Arabic here.
const APP_LANGS = valueAt('const LANGS=[');
const LANGS = APP_LANGS.filter((l) => l.code === 'en' || l.code === 'ar');
if (LANGS.length !== 2) throw new Error('sync-shared: the site no longer lists English and Arabic');
const COUNTRY_CODES = valueAt('const COUNTRY_CODES=[');
const NATIONALITIES = valueAt('const NATIONALITIES=[');
const COUNTRY_AR = valueAt('const COUNTRY_AR={');
const PV_MAIL = stringAt('const _PV_MAIL=');
const PRIVACY_NOTICE = valueAt('const PRIVACY_NOTICE={', `const _PV_MAIL='${PV_MAIL}';`);
const PRIVACY_VERSION = stringAt('const PRIVACY_VERSION=');
const LANG = valueAt('const LANG={');
// The emergency contact's relations: customers.emergency_relation's codes (the database checks the same list).
const EM_RELS = valueAt('const EM_RELS=[');

// The site's rule (see no-Israel rule in its notes): no list offers Israel.
const bad = [...COUNTRY_CODES.map((x) => x[1] + ' ' + x[2]), ...NATIONALITIES.map((x) => x[0] + ' ' + x[1])].filter((s) => /^IL\b|Israel/i.test(s));
if (bad.length) throw new Error('sync-shared: a list offers Israel: ' + bad.join(', '));

const KEYS = ['privacyNotice', 'privacyUpdated', 'privacyAckOpt', 'privacyAckRequired', 'rideNewsOpt',
  'closeBtn', 'dobDay', 'dobMonth', 'dobYear', 'dobErrFuture', 'dobErrYoung', 'genderMale', 'genderFemale',
  // The account step is the booking site's sign-up and sign-in: its labels, password rule and messages, word for word.
  'firstName', 'lastName', 'phFirstName', 'phLastName', 'authPassword', 'authConfirmPassword', 'fixPwHint',
  'errPasswordLen', 'errPasswordCommon', 'errPasswordOld', 'errPasswordMatch', 'errTooManyTries', 'authLogin', 'authSignupBtn',
  'authIdentifier', 'errEmailOrPhone', 'errPasswordRequired', 'errInvalidCredentials', 'errLoginLocked', 'errLoginPhoneCc',
  // The emergency contact (the owner, 2026-10-07: the first one required, a second one optional).
  'emTitle', 'emSubAcc', 'emName', 'emPhone', 'emRelation', 'emPick', ...EM_RELS.map((c) => 'emRel_' + c),
  'em2Title', 'em2Sub', 'em2Add', 'optionalLabel', 'errEmName', 'errEmPhone', 'errEmRelation', 'errEmSelf', 'errEmSame',
  'errNameChars', 'errNameShort',
  // "I don't have one": an optional question staff flagged (the second contact, a non-member's Instagram) answered by clearing it.
  'fixNone',
  'tabMyRides'];
const SITE_T = {};
for (const { code } of APP_LANGS) {
  const pack = code === 'en' || code === 'ar' ? LANG[code] : JSON.parse(readFileSync(join(rentals, 'i18n', code + '.json'), 'utf8'));
  SITE_T[code] = {};
  for (const k of KEYS) {
    const v = pack[k] ?? LANG.en[k];
    if (v == null) throw new Error(`sync-shared: the site has no string ${k} (${code})`);
    SITE_T[code][k] = v;
  }
}

// The Farm House Night's own waiver (fhWaiverTitle, fhWaiverBody, fhWaiverAgree; a booking carries FARM_WAIVER_VERSION):
// in the booking app's ten languages as it writes them (LANG en/ar, i18n/<code>.json), and in the website's six more as
// the website translates the same English (apps/web/src/i18n/tx/<code>.json; content/farm-words.ts farmWaiverCopy).
const FARM_WAIVER = { version: stringAt('const FARM_WAIVER_VERSION=') };
const fw = (o, code) => {
  const x = { title: o.fhWaiverTitle, body: o.fhWaiverBody, agree: o.fhWaiverAgree };
  for (const k of Object.keys(x)) if (!x[k]) throw new Error(`sync-shared: no farm waiver ${k} in ${code}`);
  return x;
};
FARM_WAIVER.en = fw(LANG.en, 'en'); FARM_WAIVER.ar = fw(LANG.ar, 'ar');
const WEB_TX = resolve(import.meta.dirname, '../../../apps/web/src/i18n/tx');
for (const code of ['id', 'ms', 'de', 'es', 'fr', 'pt', 'tl', 'ru', 'ur', 'hi', 'ne', 'bn', 'zh', 'ja']) {
  const own = join(rentals, 'i18n', code + '.json');
  if (existsSync(own)) { FARM_WAIVER[code] = fw(JSON.parse(readFileSync(own, 'utf8')), code); continue; }
  const tx = JSON.parse(readFileSync(join(WEB_TX, code + '.json'), 'utf8'));
  FARM_WAIVER[code] = fw({ fhWaiverTitle: tx[FARM_WAIVER.en.title], fhWaiverBody: tx[FARM_WAIVER.en.body], fhWaiverAgree: tx[FARM_WAIVER.en.agree] }, code);
}

const rules = JSON.parse(readFileSync(join(rentals, 'assets', 'phone-rules.json'), 'utf8'));
if (!rules.codes) throw new Error('sync-shared: assets/phone-rules.json has no codes');

const out = `/* Generated by scripts/sync-shared.mjs from the booking site's app.src.html and
   assets/phone-rules.json. Do not edit by hand: change the site, then sync. */
var SHARED = ${JSON.stringify({ PRIVACY_VERSION, PRIVACY_NOTICE: { en: PRIVACY_NOTICE.en, ar: PRIVACY_NOTICE.ar }, FARM_WAIVER, LANGS, COUNTRY_CODES, NATIONALITIES, COUNTRY_AR, EM_RELS, SITE_T, PHONE_RULES: rules.codes })};
`;
writeFileSync(resolve(import.meta.dirname, '..', 'shared', 'shared.js'), out);
console.log(`shared/shared.js written from ${rentals} (notice ${PRIVACY_VERSION}, farm waiver ${FARM_WAIVER.version} in ${Object.keys(FARM_WAIVER).length - 1} languages, ${NATIONALITIES.length} nationalities, ${COUNTRY_CODES.length} calling codes, ${Object.keys(rules.codes).length} phone rules, ${(out.length / 1024).toFixed(0)} KB)`);
