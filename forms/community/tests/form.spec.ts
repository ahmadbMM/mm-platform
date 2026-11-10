import { test, expect, type Page } from '@playwright/test';

// The community membership application, end to end in a browser with every database call stubbed.
// The first screen asks whether the applicant has an account. Step 1 is the booking site's own sign-up in four screens
// (About you, How we reach you, Emergency contact, Create a password) and makes the account (customer_exists,
// customer_signup, customer_consents, customer_set_emergency); step 2 asks the community questions in short screens
// and a last look at every answer, then sends them from that account (customer_set_sport, customer_community_apply).
// A rider the booking site hands over signed in (?code=) starts on step 2 (customer_handoff_redeem,
// customer_community_me). Every field is checked the way the booking site's staff checks look at accounts.
const json = (b: unknown) => ({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' }, body: JSON.stringify(b) });
const refuse = (b: unknown, status = 400) => ({ ...json(b), status });
type Body = Record<string, unknown>;
type Call = { fn: string; body: Body };
type Answers = Partial<Record<string, (body: Body) => ReturnType<typeof json>>>;
type W = {
  CommunityForm: { setLang(c: string, s: boolean): void; natMatches(q: string): string[]; pwdBad(p: string): string };
  FORM_T: Record<string, Record<string, string>>;
  SPORT_DATA: { words: Record<string, Record<string, string>> };
  SHARED: { COUNTRY_AR: Record<string, string> };
};
const CODE = 'ab'.repeat(24);
const ME = { name: 'Karim Mansour', email: 'karim.mansour@gmail.com', phone: '+966552468013', member: false, pending: false, gender: 'male', height: 178,
  birth_date: null, nationality: null, instagram: null, linkedin: null, profession: null, workplace: null, bike_type: null, heard_from: null };
const HELD = { birth_date: '1994-03-12', nationality: 'Egypt', profession: 'Architect', workplace: 'Saudi Aramco', bike_type: 'Hybrid', own_bike: false, heard_from: 'friend', instagram: 'karim.rides', whatsapp_same: true };

// An account that has its emergency contact (customer_emergency's six columns).
const EM_ROW = { emergency_name: 'Layla Mansour', emergency_phone: '+966551234567', emergency_relation: 'spouse', emergency2_name: null, emergency2_phone: null, emergency2_relation: null };
const EM_NONE = { emergency_name: null, emergency_phone: null, emergency_relation: null, emergency2_name: null, emergency2_phone: null, emergency2_relation: null };
const VERSION = expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/);
const ksaYear = () => new Date(Date.now() + 3 * 3600e3).getUTCFullYear();
// A label's text, with or without the red star of a required question after it.
const lbl = (s: string) => new RegExp('^' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\*?$');

async function open(page: Page, qs = '', answers: Answers = {}, form: unknown = null, stay = false) {
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(e.message));
  // A fetch with keepalive (the anonymous counts sent as the page is left) goes out past page.route when it is sent from
  // a page being closed or reloaded, straight to the real database: here it is an ordinary fetch, which the routes catch.
  await page.addInitScript(() => {
    const f = window.fetch;
    window.fetch = function (u: RequestInfo | URL, o?: RequestInit) { return f.call(this, u, o && o.keepalive ? { ...o, keepalive: false } : o); } as typeof fetch;
  });
  // the questions as the admins set them (site_content 'community.form'); none, the form as it always was
  await page.route('**/rest/v1/site_content*', (r) => r.fulfill(json(form ? [{ value: form }] : [])));
  const calls: Call[] = [];
  const base: Answers = {
    customer_exists: () => json(false),
    customer_signup: (b) => json([{ id: b.p_id, session_token: 'tok-new' }]),
    customer_consents: () => json({ privacy_version: '2026-09-28', ride_news: true }),
    customer_community_apply: () => json({ ok: true, updated: false }),
    customer_handoff_redeem: () => json([{ id: 'c-karim', name: 'Karim Mansour', session_token: 'tok-handed' }]),
    customer_community_me: () => json(ME),
    customer_emergency: () => json([EM_ROW]),
    customer_set_emergency: () => json(true),
    customer_set_emergency2: () => json(true),
    sport_option_list: () => json([]),
    customer_sport: () => json([]),
    customer_set_sport: () => json(true),
    customer_community_guardian: () => json(true),
    community_app_invited: () => json(true),
    community_form_log: () => json(null),
  };
  await page.route('**/rest/v1/rpc/*', async (r) => {
    if (r.request().method() === 'OPTIONS') return r.fulfill(json({}));
    const fn = r.request().url().split('/rpc/')[1];
    const body = JSON.parse(r.request().postData() || '{}');
    calls.push({ fn, body });
    const a = answers[fn] || base[fn];
    return r.fulfill(a ? a(body) : refuse({ code: 'PGRST202', message: 'not found' }, 404));
  });
  await page.goto('/community/registration' + qs);
  await page.waitForFunction(() => !!(window as unknown as W).CommunityForm);
  // the first question (2026-10-25): no account yet goes on to make one, unless the spec stays to answer it
  if (!stay && !/code=|track=/.test(qs)) await page.click('#haves .tile[data-v="no"]');
  const of = (fn: string) => calls.filter((c) => c.fn === fn).map((c) => c.body);
  return { errs, calls, of };
}
// The page's language: the form's own picker on its own page; on the website the site's globe reloads the page in the
// language chosen, so the spec switches it in place, the way the picker does (the website's page fetches the language's
// words first, so the spec waits for the page to be in it).
async function setLang(page: Page, code: string) {
  if (await page.locator('#lang').count()) await page.selectOption('#lang', code);
  else await page.evaluate((c) => (window as unknown as W).CommunityForm.setLang(c, true), code);
  await expect(page.locator('html')).toHaveAttribute('lang', code);
}
// A string of the form's own in Arabic, as the page has it (many new ones are still the English text).
const arT = (page: Page, key: string) => page.evaluate((k) => ((window as unknown as W).FORM_T.ar || {})[k] || k, key);
const sportWords = (page: Page, l = 'en') => page.evaluate((x) => (window as unknown as W).SPORT_DATA.words[x], l);

const step = (page: Page, n: number) => page.locator(`fieldset.step[data-step="${n}"]`);
const scr = (page: Page, s: string) => page.locator(`#form .screen[data-screen="${s}"]`);
// The screen on show ('success' once sent, 'member' for a member already).
const current = (page: Page) => page.evaluate(() => {
  if (!document.getElementById('success')!.hidden) return 'success';
  if (!document.getElementById('member')!.hidden) return 'member';
  const s = document.querySelector('#form .screen:not([hidden])') as HTMLElement | null;
  return s ? s.dataset.screen || '' : '';
});
async function next(page: Page, from: string) {
  await page.click('#next');
  await expect(scr(page, from)).toBeHidden();
}

type Em = { name?: string; phone?: string; rel?: string };
type O = {
  first?: string; last?: string; gender?: string; height?: string; phone?: string; email?: string; wa?: string; waNum?: string;
  em?: Em | false; pwd?: string; ack?: boolean; news?: boolean;
  birth?: [string, string, string] | null; nat?: string | null; type?: string; sport?: string; feds?: string[]; other?: string;
  prof?: string; work?: string; ig?: string; li?: string; heard?: string; xem?: Em;
};
async function emContact(page: Page, pre: string, o: Em = {}) {
  await page.fill(`#${pre}-name`, o.name ?? 'Layla Mansour');
  await page.fill(`#${pre}-phone`, o.phone ?? '0551234567');
  await page.selectOption(`#${pre}-rel`, o.rel ?? 'spouse');
}
async function fillAbout(page: Page, o: O = {}) {
  await page.fill('#first', o.first ?? 'karim');
  await page.fill('#last', o.last ?? 'mansour');
  if (o.gender !== '') await page.click(`#genders .tile[data-v="${o.gender ?? 'male'}"]`);
  await page.fill('#height', o.height ?? '178');
}
async function fillReach(page: Page, o: O = {}) {
  await page.fill('#phone', o.phone ?? '0552468013');
  if (o.wa !== '') await page.click(`#was .tile[data-v="${o.wa ?? 'yes'}"]`); // is it their WhatsApp too (2026-10-07)
  if (o.waNum) await page.fill('#wa', o.waNum);
  await page.fill('#email', o.email ?? 'Karim.Mansour@gmail.com');
}
async function fillPassword(page: Page, o: O = {}) {
  await page.fill('#pwd', o.pwd ?? 'Ride2Work');
  if (o.ack !== false && (await page.locator('#ack').getAttribute('aria-checked')) !== 'true') await page.click('#ack');
  if (o.news && (await page.locator('#news').getAttribute('aria-checked')) !== 'true') await page.click('#news');
}
// The account's first three screens, answered, up to the password.
async function toPassword(page: Page, o: O = {}) {
  await fillAbout(page, o); await next(page, 'about');
  await fillReach(page, o); await next(page, 'reach');
  if (o.em !== false) await emContact(page, 'em', o.em || {});
  await next(page, 'emergency');
}
// The whole account step: the account is made and the first membership screen is on show.
async function accountStep(page: Page, o: O = {}) {
  await toPassword(page, o);
  await fillPassword(page, o); await next(page, 'password');
  await expect(step(page, 2)).toBeVisible();
}
async function typeBirth(page: Page, d: string, m: string, y: string) {
  await page.fill('#birth-d', d); await page.fill('#birth-m', m); await page.fill('#birth-y', y);
}
async function pickNat(page: Page, name: string) {
  await page.fill('#nat-q', name);
  await page.locator(`#nat-list li[data-name="${name}"]`).first().click();
  await expect(page.locator('#nat')).toHaveValue(name);
}
// Each membership screen answered with what it still asks (a question the account holds is not on show).
async function fillScreen(page: Page, s: string, o: O) {
  const on = (sel: string) => page.locator(sel).isVisible();
  if (s === 'birth') {
    if ((await on('#f-wa')) && !(await page.locator('#was .tile[aria-checked="true"]').count())) await page.click('#was .tile[data-v="yes"]');
    if ((await on('#f-birth')) && o.birth !== null) await typeBirth(page, ...(o.birth ?? ['12', '3', '1994'] as [string, string, string]));
    if ((await on('#f-nat')) && o.nat !== null) await pickNat(page, o.nat ?? 'Egypt');
  } else if (s === 'riding') {
    if ((await on('#f-type')) && (o.type || !(await page.locator('#types .tile[aria-checked="true"]').count()))) await page.click(`#types .tile[data-v="${o.type ?? 'Road'}"]`);
    if ((await on('#f-sport')) && (o.sport || !(await page.locator('#sports .tile[aria-checked="true"]').count()))) await page.click(`#sports .tile[data-v="${o.sport ?? 'no'}"]`);
    for (const c of o.feds ?? []) await page.selectOption('#sp-add', c);
    if (o.other !== undefined) await page.fill('#sp-other', o.other);
  } else if (s === 'work') {
    if (await on('#f-prof')) await page.fill('#prof', o.prof ?? 'Architect');
    if (await on('#f-work')) await page.fill('#work', o.work ?? '  Saudi   Aramco ');
    if (await on('#f-ig')) await page.fill('#ig', o.ig ?? 'https://www.instagram.com/karim.rides/?hl=en');
    if (o.li !== undefined) { if (await on('#li-add')) await page.click('#li-add'); await page.fill('#li', o.li); }
    if ((await on('#f-heard')) && o.heard !== '') await page.selectOption('#heard', o.heard ?? 'instagram');
  } else if (s === 'xem') {
    if (!(await page.locator('#xem-name').inputValue())) await emContact(page, 'xem', o.xem || {});
  }
}
// On through the membership screens to `until` ('check', another screen, or 'success': sent).
async function through(page: Page, o: O = {}, until = 'check') {
  for (let i = 0; i < 14; i++) {
    const s = await current(page);
    if (s === until) return;
    await fillScreen(page, s, o);
    await page.click('#next');
    await expect.poll(() => current(page), { message: `Continue on "${s}"` }).not.toBe(s);
  }
  throw new Error(`the form never reached ${until}`);
}
async function apply(page: Page, o: O = {}) {
  await through(page, o, 'check');
  await expect(page.locator('#next-label')).toHaveText('Send application');
  await page.click('#next');
  await expect(page.locator('#success')).toBeVisible();
}

test('the account in four screens, the membership questions, Check your answers and the thank-you card', async ({ page }) => {
  const { errs, of, calls } = await open(page);
  await expect(scr(page, 'about')).toBeVisible();
  await expect(page.locator('#next-label')).toHaveText('Continue');
  await fillAbout(page); await next(page, 'about');
  await fillReach(page);
  await next(page, 'reach');
  // leaving "How we reach you": each id asked on its own (the message says which one is taken)
  expect(of('customer_exists')).toEqual([{ p_email: 'karim.mansour@gmail.com', p_phone: '' }, { p_email: '', p_phone: '+966552468013' }]);
  await emContact(page, 'em'); await next(page, 'emergency');
  await expect(page.locator('#next-label')).toHaveText('Create account');
  expect(of('customer_signup')).toEqual([]);
  await fillPassword(page, { news: true }); await next(page, 'password');
  await expect(scr(page, 'birth')).toBeVisible();
  await expect(page.locator('#acct-made .acct-title')).toHaveText('Your account has been created');
  // Create account asks again, then the sign-up, the consents and the emergency contact.
  expect(of('customer_exists')).toHaveLength(4);
  const su = of('customer_signup');
  expect(su).toEqual([{ p_id: expect.stringMatching(/^[a-z0-9]{8,20}$/), p_name: 'Karim Mansour', p_email: 'karim.mansour@gmail.com', p_phone: '+966552468013',
    p_pwd: 'Ride2Work', p_height: 178, p_type_preference: 'Any', p_gender: 'male' }]);
  expect(of('customer_consents')).toEqual([{ p_id: su[0].p_id, p_token: 'tok-new', p_privacy: VERSION, p_ride_news: true }]);
  expect(of('customer_set_emergency')).toEqual([{ p_id: su[0].p_id, p_token: 'tok-new', p_name: 'Layla Mansour', p_phone: '+966551234567', p_relation: 'spouse' }]);
  // No way back to the account step: it would make a second account.
  await expect(page.locator('#back')).toBeHidden();
  await through(page, { li: 'https://sa.linkedin.com/in/karim-mansour-arch/' });
  await page.click('#next');
  await expect(page.locator('#success')).toBeVisible();
  await expect(page.locator('#success-title')).toHaveText('Application sent');
  await expect(page.locator('#success-title')).toBeFocused();
  await expect(page.locator('#result')).toHaveText('Karim, your application is with our team.');
  await expect(page.locator('#result-signin')).toHaveText('You sign in with ⁦karim.mansour@gmail.com⁩ and your password.');
  await expect(page.locator('#track-link')).toBeHidden(); // no link from this database
  await expect(page.locator('#book-link')).toHaveAttribute('href', 'https://experiences.micromobility.sa/?lang=en');
  await expect(page.locator('#wa-help')).toHaveAttribute('href', 'https://wa.me/966566668818');
  await expect(page.locator('#form')).toBeHidden();
  await expect(page).toHaveTitle(/^Application sent/);
  expect(of('customer_set_sport')).toEqual([{ p_id: su[0].p_id, p_token: 'tok-new', p_competes: false, p_federations: null, p_other: null }]);
  expect(of('customer_community_apply')).toEqual([{ p_id: su[0].p_id, p_token: 'tok-new', p: {
    birth_date: '1994-03-12', nationality: 'Egypt', bike_type: 'Road', own_bike: false, instagram: 'karim.rides', linkedin: 'karim-mansour-arch',
    profession: 'Architect', workplace: 'Saudi Aramco', heard_from: 'instagram', lang: 'en', whatsapp_same: true, privacy_version: VERSION,
    privacy_ack: true, // the account step showed the notice's box, and it was ticked
  } }]);
  const names = calls.map((c) => c.fn);
  expect(names.indexOf('customer_set_sport')).toBeLessThan(names.indexOf('customer_community_apply'));
  expect(of('customer_community_guardian')).toEqual([]); // an adult: no parent or guardian
  expect(await page.evaluate(() => localStorage.getItem('mm-community-draft'))).toBeNull();
  expect(errs).toEqual([]);
});

test('the first question, the screens, the progress and Back', async ({ page }) => {
  const { errs } = await open(page, '', {}, null, true);
  await expect(page.locator('#gate-title')).toHaveText('Join the MicroMobility community');
  await expect(scr(page, 'gate').locator('.gets li')).toHaveCount(4);
  await expect(page.locator('#have-q')).toHaveText('Do you already have a MicroMobility account?');
  await expect(page.locator('#actions')).toBeHidden();
  await expect(page.locator('#progress')).toBeHidden();
  await page.click('#haves .tile[data-v="yes"]');
  await expect(page.locator('#login-box')).toBeVisible();
  await expect(page.locator('#lid')).toBeFocused();
  await page.click('#haves .tile[data-v="no"]');
  await expect(page.locator('#login-box')).toBeHidden();
  await expect(scr(page, 'about')).toBeVisible();
  await expect(page.locator('#first')).toBeFocused();
  await expect(page.locator('#back')).toBeVisible();
  await expect(page.locator('#prog-bar li')).toHaveCount(8); // four account screens, three membership ones and the last look
  await expect(page.locator('#prog-txt')).toHaveText('Step 1 of 8: About you');
  await expect(page).toHaveTitle(/^About you \| Community membership/);
  await fillAbout(page); await next(page, 'about');
  await expect(scr(page, 'reach').locator('.screen-title')).toBeFocused();
  await expect(page.locator('#prog-txt')).toHaveText('Step 2 of 8: How we reach you');
  await expect(page.locator('#prog-bar li.done')).toHaveCount(1);
  await page.click('#back');
  await expect(scr(page, 'about')).toBeVisible();
  await expect(page.locator('#first')).toHaveValue('karim'); // the answers stay
  await page.click('#back');
  await expect(scr(page, 'gate')).toBeVisible();
  await expect(page.locator('#actions')).toBeHidden();
  await page.click('#haves .tile[data-v="no"]');
  await accountStep(page);
  // the first membership screen has no Back (the account exists); the next one goes back to it
  await expect(page.locator('#back')).toBeHidden();
  await through(page, {}, 'riding');
  await expect(page.locator('#back')).toBeVisible();
  await page.click('#back');
  await expect(scr(page, 'birth')).toBeVisible();
  await expect(page.locator('#nat-q')).toHaveValue('Egypt');
  expect(errs).toEqual([]);
});

test('a refused Continue names every problem at once, on the questions and in a summary that links to each', async ({ page }) => {
  await open(page);
  await page.click('#next');
  const sum = page.locator('#errsum');
  await expect(sum).toBeVisible();
  await expect(sum).toBeFocused();
  await expect(sum.locator('.errsum-h')).toHaveText('There is a problem');
  await expect(page.locator('#errsum-list a')).toHaveText(['Enter your first and last name', 'Choose your gender', 'Enter your height in cm (100 to 250)']);
  expect(await page.locator('#errsum-list a').evaluateAll((as) => as.map((a) => a.getAttribute('href')))).toEqual(['#f-name', '#f-gender', '#f-height']);
  await expect(page.locator('#f-name .err')).toHaveText('Enter your first and last name');
  await expect(page.locator('#f-gender .err')).toHaveText('Choose your gender');
  await expect(page.locator('#f-height .err')).toHaveText('Enter your height in cm (100 to 250)');
  await expect(page).toHaveTitle(/^Error: About you/);
  // a screen reader hears that the box is wrong and why
  await expect(page.locator('#first')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#first')).toHaveAttribute('aria-describedby', 'f-name-err');
  await expect(page.locator('#genders')).toHaveAttribute('aria-invalid', 'true');
  // each line takes the applicant to its question
  await page.click('#errsum-list a[data-f="f-height"]');
  await expect(page.locator('#height')).toBeFocused();
  await page.click('#errsum-list a[data-f="f-gender"]');
  await expect(page.locator('#genders .tile').first()).toBeFocused();
  // answered, each line goes, and the summary with the last
  await page.fill('#first', 'karim'); await page.fill('#last', 'mansour');
  await expect(page.locator('#errsum-list a')).toHaveCount(2);
  await expect(page.locator('#first')).not.toHaveAttribute('aria-invalid', 'true');
  await page.click('#genders .tile[data-v="male"]');
  await page.fill('#height', '178');
  await expect(sum).toBeHidden();
  await expect(page).toHaveTitle(/^About you/);
  // in Arabic: the summary's lines in the page language
  await page.fill('#height', '');
  await page.click('#next');
  await setLang(page, 'ar');
  await expect(page.locator('#errsum-list a')).toHaveText([await arT(page, 'Enter your height in cm (100 to 250)')]);
  await expect(sum.locator('.errsum-h')).toHaveText(await arT(page, 'There is a problem'));
  await expect(page).toHaveTitle(new RegExp('^' + (await arT(page, 'Error:'))));
});

test('each box is checked as it is left, once it has an answer; a soft warning there lets the next Continue go on', async ({ page }) => {
  await open(page);
  await page.focus('#last');
  await page.press('#last', 'Tab'); // left empty: nothing said yet
  await expect(page.locator('#f-name .err')).toHaveText('');
  await page.fill('#height', '95');
  await page.press('#height', 'Tab');
  await expect(page.locator('#f-height .err')).toHaveText('Enter your height in cm (100 to 250)');
  await expect(page.locator('#errsum')).toBeHidden(); // a summary is Continue's
  await page.fill('#height', '212');
  await expect(page.locator('#f-height .err')).toHaveText('');
  await page.press('#height', 'Tab');
  await expect(page.locator('#f-height .warn')).toHaveText('Is 212 cm right? If it is right, press Continue.');
  await page.fill('#first', 'karim'); await page.fill('#last', 'mansour');
  await page.click('#genders .tile[data-v="male"]');
  await next(page, 'about'); // said once already: Continue goes on
  await page.fill('#email', 'karim@gmail.con');
  await page.press('#email', 'Tab');
  await expect(page.locator('#f-email .err')).toHaveText('Did you mean karim@gmail.com?');
  await expect(page.locator('#email-fix')).toHaveText('Use karim@gmail.com');
  await page.click('#email-fix');
  await expect(page.locator('#email')).toHaveValue('karim@gmail.com');
  await expect(page.locator('#f-email .err')).toHaveText('');
  await page.fill('#phone', '0112345678');
  await page.press('#phone', 'Tab');
  await expect(page.locator('#f-phone .err')).toHaveText('Enter a valid Saudi mobile number (5XXXXXXXX)');
});

test('a soft warning met on Continue is said once; pressing Continue again goes on', async ({ page }) => {
  const { of } = await open(page);
  await fillAbout(page, { first: 'kaaarim', height: '212' });
  await page.click('#next');
  await expect(page.locator('#f-height .warn')).toHaveText('Is 212 cm right? If it is right, press Continue.');
  await expect(page.locator('#f-name .warn')).toHaveText('Please check the spelling of your name. If it is right, press Continue.');
  await expect(page.locator('#errsum .errsum-h')).toHaveText('Please check');
  await expect(page).not.toHaveTitle(/^Error:/); // a warning is no error
  await expect(scr(page, 'about')).toBeVisible();
  await next(page, 'about');
  await fillReach(page); await next(page, 'reach');
  await emContact(page, 'em'); await next(page, 'emergency');
  await fillPassword(page); await next(page, 'password');
  expect(of('customer_signup')[0]).toMatchObject({ p_height: 212, p_name: 'Kaaarim Mansour' });
});

test('names: first and last, letters and periods only, no initials, one alphabet', async ({ page }) => {
  await open(page);
  const err = page.locator('#f-name .err');
  await page.click('#genders .tile[data-v="male"]');
  await page.fill('#height', '178');
  for (const [first, last, msg] of [
    ['Karim', '', 'Enter your first and last name'],
    ['K', 'Mansour', 'Write your first and last name in full, not initials'],
    ['Karim A', 'Mansour', 'Write your first and last name in full, not initials'],
    ['J.R.', 'Mansour', 'Write your first and last name in full, not initials'],
    ['Karim', 'منصور', 'Write your name in one alphabet'],
    ['Test', 'User', 'Please enter your real name'],
  ]) {
    await page.fill('#first', first); await page.fill('#last', last);
    await page.click('#next');
    await expect(err).toHaveText(msg);
  }
  await expect(scr(page, 'about')).toBeVisible();
  await page.fill('#first', 'Karim2!');
  await expect(page.locator('#first')).toHaveValue('Karim'); // dropped as typed
  await page.fill('#last', 'Al-Mansour'); // a dash is not a name character in the database: it becomes a space
  await expect(page.locator('#last')).toHaveValue('Al Mansour');
  await expect(err).toHaveText('');
  await page.locator('#first').fill('');
  await page.locator('#first').pressSequentially('Md.. .Karim');
  await expect(page.locator('#first')).toHaveValue('Md. Karim');
  await page.locator('#first').pressSequentially('3');
  await expect(err).toHaveText('Names can only contain letters, spaces and periods.');
  // required questions carry a red star and aria-required; nothing anywhere says "optional"
  await expect(page.locator('#f-name .req-mark')).toHaveCount(2);
  await expect(page.locator('#first')).toHaveAttribute('aria-required', 'true');
  await expect(page.locator('#genders')).toHaveAttribute('aria-required', 'true');
  await expect(page.locator('#form')).not.toContainText(/optional/i);
});

test('phones: Saudi mobiles only on +966, the mobile rules elsewhere, a paste with its code, and the code alone on the picker', async ({ page }) => {
  await open(page);
  await fillAbout(page); await next(page, 'about');
  const err = page.locator('#f-phone .err');
  await expect(page.locator('#phone')).toHaveAttribute('placeholder', '5X XXX XXXX');
  await page.fill('#phone', '+966552468013');
  await expect(page.locator('#phone')).toHaveValue('55 246 8013');
  await fillReach(page, { phone: '0112345678' });
  await page.click('#next');
  await expect(err).toHaveText('Enter a valid Saudi mobile number (5XXXXXXXX)');
  expect(await page.locator('#cc option').count()).toBeGreaterThan(200);
  await expect(page.locator('#cc option[value="EG+20"]')).toHaveText('Egypt (+20)');
  await expect(page.locator('#cc option[value="PS+970"]')).toHaveText('Palestine (+970)');
  await expect(page.locator('#cc option[value="PS+972"]')).toHaveText('Palestine (+972)');
  await page.fill('#phone', '+972 59 123 4865');
  await expect(page.locator('#cc')).toHaveValue('PS+972');
  await expect(page.locator('#cc-code')).toHaveText('+972');
  expect(await page.locator('#f-phone').innerHTML()).not.toMatch(/[\u{1F1E6}-\u{1F1FF}]/u); // no flags
  await page.fill('#phone', '+20 22 345 6789'); // a Cairo landline
  await page.click('#next');
  await expect(err).toHaveText('This is not a mobile number for +20. Please check it.');
  await page.fill('#phone', '+20 106 482 9153');
  await next(page, 'reach');
  await expect(scr(page, 'emergency')).toBeVisible();
});

test('Saudi Arabia is first and again in its alphabetical place in the dial codes, one value for both (the owner, 2026-10-05)', async ({ page }) => {
  await open(page);
  const cc = await page.locator('#cc option').evaluateAll((os) => os.map((o) => [(o as HTMLOptionElement).value, (o as HTMLOptionElement).selected] as [string, boolean]));
  const ccSa = cc.flatMap(([v], i) => (v === 'SA+966' ? [i] : []));
  expect(ccSa).toHaveLength(2);
  expect(ccSa[0]).toBe(0);
  expect(cc[ccSa[1] - 1][0]).toBe('ST+239'); // São Tomé, then Saudi Arabia, then Senegal
  expect(cc[ccSa[1] + 1][0]).toBe('SN+221');
  expect(cc.filter(([, on]) => on)).toHaveLength(1);
  expect(cc[0][1]).toBe(true); // the top copy shows the pick
  expect(cc.filter(([v]) => v.startsWith('IL'))).toEqual([]);
});

test('emails: a misspelt provider is refused with a one-tap fix; throwaway and relay addresses are refused', async ({ page }) => {
  await open(page);
  await fillAbout(page); await next(page, 'about');
  await fillReach(page);
  const err = page.locator('#f-email .err');
  for (const [email, msg] of [
    ['karim@gmail.con', 'Did you mean karim@gmail.com?'],
    ['karim@mailinator.com', 'Please use your own, permanent email address'],
    ['abc123@privaterelay.appleid.com', 'Please use your own email address, not an Apple hidden (relay) address'],
    ['karim@gmail', 'Enter a valid email address'],
  ]) {
    await page.fill('#email', email);
    await page.click('#next');
    await expect(err).toHaveText(msg);
  }
  await page.fill('#email', 'karim@gmail.con');
  await page.click('#next');
  await page.click('#email-fix');
  await expect(page.locator('#email')).toHaveValue('karim@gmail.com');
  await next(page, 'reach');
});

test('an email or mobile that already has an account: said as the screen is left, with Sign in instead; Create account asks again', async ({ page }) => {
  let taken = 'email';
  const { of } = await open(page, '', { customer_exists: (b) => json(taken === 'email' ? b.p_email !== '' : taken === 'phone' ? b.p_phone !== '' : false) });
  await fillAbout(page); await next(page, 'about');
  await fillReach(page);
  await page.click('#next');
  await expect(page.locator('#f-email .err')).toHaveText('An account with this email already exists. Sign in to apply with it.');
  await expect(page.locator('#errsum-signin')).toHaveText('Sign in instead');
  await expect(scr(page, 'reach')).toBeVisible();
  taken = 'phone';
  await page.click('#next');
  await expect(page.locator('#f-phone .err')).toHaveText('An account with this mobile number already exists. Sign in to apply with it.');
  await page.click('#errsum-signin');
  await expect(scr(page, 'gate')).toBeVisible();
  await expect(page.locator('#login-box')).toBeVisible();
  await expect(page.locator('#lid')).toHaveValue('0552468013');
  await expect(page.locator('#lpw')).toBeFocused();
  // back to making one: free as the screen is left, taken by the time Create account asks again
  taken = '';
  await page.click('#haves .tile[data-v="no"]');
  await next(page, 'about');
  await next(page, 'reach');
  await emContact(page, 'em'); await next(page, 'emergency');
  await fillPassword(page);
  taken = 'email';
  await page.click('#next');
  await expect(scr(page, 'reach')).toBeVisible();
  await expect(page.locator('#f-email .err')).toHaveText('An account with this email already exists. Sign in to apply with it.');
  expect(of('customer_signup')).toEqual([]);
});

test('signing in from the first question: Forgot password goes to the booking site in the page language', async ({ page }) => {
  await open(page, '?lang=ar', {}, null, true);
  await page.click('#haves .tile[data-v="yes"]');
  await expect(page.locator('#login-box')).toBeVisible();
  await expect(page.locator('#signin-link2')).toHaveAttribute('href', 'https://experiences.micromobility.sa/?handoff=community&lang=ar&auth=forgot');
  await expect(page.locator('#signin-link2')).toHaveText('نسيت كلمة المرور؟'); // no Google or Apple sign-in (2026-11-09)
  await expect(page.locator('#login .submit-label')).toHaveText('تسجيل الدخول');
  await setLang(page, 'fr');
  await expect(page.locator('#signin-link2')).toHaveAttribute('href', 'https://experiences.micromobility.sa/?handoff=community&lang=fr&auth=forgot');
});

// The first question (the owner, 2026-10-25): an account already signs in here and is asked only what the
// account lacks, or what staff flagged on it; no account goes on to make one.
test('first question: Yes signs in and asks only what is missing or flagged, never the same answer again', async ({ page }) => {
  const { errs, of } = await open(page, '?lang=en', {
    customer_login: () => json([{ id: 'c-karim', name: 'Karim Mansour', session_token: 'tok-in' }]),
    customer_community_me: () => json({ ...ME, ...HELD, flags: ['instagram', 'height', 'emergency'] }),
  }, null, true);
  await page.click('#haves .tile[data-v="yes"]');
  await page.click('#login');
  await expect(page.locator('#f-lid .err')).toHaveText('Enter an email or a phone number.'); // the booking site's own words
  await page.fill('#lid', '0552468013');
  await page.fill('#lpw', 'Secret123');
  await page.click('#login');
  await expect(step(page, 2)).toBeVisible();
  expect(of('customer_login')).toEqual([{ p_identifier: '+966552468013', p_pwd: 'Secret123' }]);
  // filled and not flagged: not asked, but still sent and named on the last look
  for (const id of ['#f-birth', '#f-nat', '#f-prof', '#f-work', '#f-type', '#f-heard', '#f-wa']) {
    await expect(page.locator(id)).toHaveAttribute('data-skipped', '');
    await expect(page.locator(id)).toBeHidden();
  }
  await expect(page.locator('#acct-skip')).toBeVisible();
  // flagged: asked again even though filled
  await expect(scr(page, 'birth')).toBeVisible();
  await expect(page.locator('#birth-title')).toHaveText('About you');
  await expect(page.locator('#f-xheight')).toBeVisible();
  await expect(page.locator('#f-ig .flag')).toHaveText('Please check');
  // A flagged question answered as the account holds it is refused (the owner, 2026-11-09: "don't allow a flagged
  // account field to type in the same info in the field again").
  const SAME = 'This is the same as what is on your account. Please correct it.';
  await page.fill('#xheight', '178');
  await page.click('#next');
  await expect(page.locator('#f-xheight .err')).toHaveText(SAME);
  await page.fill('#xheight', '180');
  await through(page, {}, 'work');
  await expect(page.locator('#ig')).toHaveValue('karim.rides');
  await page.click('#next');
  await expect(page.locator('#f-ig .err')).toHaveText(SAME);
  await setLang(page, 'ar');
  await expect(page.locator('#f-ig .err')).toHaveText('هذا مطابق لما هو مسجل في حسابك. يرجى تصحيحه.');
  await setLang(page, 'en');
  await page.fill('#ig', 'karim.rides.jed');
  await next(page, 'work');
  await expect(scr(page, 'xem')).toBeVisible();
  await emContact(page, 'xem');
  await page.click('#next');
  await expect(page.locator('#f-xem-name .err')).toHaveText(SAME);
  expect(of('customer_set_emergency')).toEqual([]);
  expect(of('customer_community_apply')).toEqual([]);
  await page.fill('#xem-phone', '0551234568');
  await next(page, 'xem');
  await expect(page.locator('#check-list dt')).toContainText(['Date of birth', 'Nationality', 'Profession']);
  await page.click('#next');
  await expect(page.locator('#success')).toBeVisible();
  const sent = of('customer_community_apply')[0].p as Body;
  expect(sent).toMatchObject({ birth_date: '1994-03-12', nationality: 'Egypt', profession: 'Architect', workplace: 'Saudi Aramco', bike_type: 'Hybrid', own_bike: false, heard_from: 'friend', instagram: 'karim.rides.jed', height: 180, emergency_saved: true, whatsapp_same: true });
  expect(of('customer_signup')).toEqual([]);
  expect(errs).toEqual([]);
});

test('first question: a wrong password is said on the box; Show all answers brings the skipped questions back', async ({ page }) => {
  let ok = false;
  await open(page, '?lang=en', {
    customer_login: () => json(ok ? [{ id: 'c-karim', name: 'Karim Mansour', session_token: 'tok-in' }] : []),
    customer_community_me: () => json({ ...ME, birth_date: '1994-03-12', nationality: 'Egypt' }),
  }, null, true);
  await page.click('#haves .tile[data-v="yes"]');
  await page.fill('#lid', 'karim.mansour@gmail.com');
  await page.fill('#lpw', 'wrong');
  await page.click('#login');
  await expect(page.locator('#f-lpw .err')).toHaveText('Those sign-in details aren’t right. Try again.');
  ok = true;
  await page.fill('#lpw', 'Secret123');
  await page.press('#lpw', 'Enter');
  await expect(step(page, 2)).toBeVisible();
  await expect(page.locator('#f-nat')).toBeHidden();
  await page.click('#acct-skip-show');
  await expect(page.locator('#f-nat')).toBeVisible();
  await expect(page.locator('#nat-q')).toHaveValue('Egypt');
  await expect(page.locator('#acct-skip')).toBeHidden();
});

test('a sign-up the database refuses says why, on the question or in the banner', async ({ page }) => {
  let answer = refuse({ code: 'P0001', message: 'RATE_LIMITED' });
  const { of } = await open(page, '', { customer_signup: () => answer });
  await toPassword(page); await fillPassword(page);
  await page.click('#next');
  await expect(page.locator('#banner .banner-text')).toHaveText('Too many tries from this network. Wait a few minutes and try again.');
  await expect(scr(page, 'password')).toBeVisible();
  // taken, with the checks before it out of lookups (customer_exists answers false): the email or the mobile, either
  answer = refuse({ code: '23505', message: 'DUPLICATE' }, 409);
  await page.click('#next');
  await expect(scr(page, 'reach')).toBeVisible();
  await expect(page.locator('#f-email .err')).toHaveText('An account with this email or mobile number already exists. Sign in to apply with it.');
  await expect(page.locator('#f-phone .err')).toHaveText('An account with this email or mobile number already exists. Sign in to apply with it.');
  answer = refuse({ code: 'P0001', message: 'name_short' });
  await next(page, 'reach'); await next(page, 'emergency');
  await page.click('#next');
  await expect(scr(page, 'about')).toBeVisible();
  await expect(page.locator('#f-name .err')).toHaveText('Write your first and last name in full, not initials');
  expect(of('customer_signup')).toHaveLength(3);
  await expect(step(page, 2)).toBeHidden();
});

test('the password: one box with show and hide, 8 characters or more and not a common one', async ({ page }) => {
  const { of } = await open(page);
  await toPassword(page);
  await expect(page.locator('#f-pwd input')).toHaveCount(1); // typed once
  await expect(page.locator('#pwd')).toHaveAttribute('placeholder', 'At least 8 characters');
  const eye = page.locator('#f-pwd .pw-eye');
  await expect(eye).toHaveAttribute('aria-label', 'Show password');
  await page.fill('#pwd', 'corniche');
  await eye.click();
  await expect(page.locator('#pwd')).toHaveAttribute('type', 'text');
  await expect(eye).toHaveAttribute('aria-pressed', 'true');
  await expect(eye).toHaveAttribute('aria-label', 'Hide password');
  await eye.click();
  await expect(page.locator('#pwd')).toHaveAttribute('type', 'password');
  await page.click('#ack');
  for (const [pwd, msg] of [
    ['short1', 'Use at least 8 characters.'],
    ['password1', 'This password is too easy to guess. Choose another.'],
    ['Qwerty123', 'This password is too easy to guess. Choose another.'],
    ['zzzzzzzzzz', 'This password is too easy to guess. Choose another.'],
  ]) {
    await page.fill('#pwd', pwd);
    await page.click('#next');
    await expect(page.locator('#f-pwd .err')).toHaveText(msg);
  }
  expect(of('customer_signup')).toEqual([]);
  // no upper-case letter or digit asked any more (the owner's B10)
  await page.fill('#pwd', 'corniche rides');
  await next(page, 'password');
  expect(of('customer_signup')[0].p_pwd).toBe('corniche rides');
});

test('a password the database calls weak is said on the password box, not as a lost connection', async ({ page }) => {
  await open(page, '', { customer_signup: () => refuse({ code: '22023', message: 'WEAK_PASSWORD' }) });
  await toPassword(page);
  await fillPassword(page, { pwd: 'corniche rides' });
  await page.click('#next');
  // a database from before 2026-11-11 still asks for an upper-case letter and a digit
  await expect(page.locator('#f-pwd .err')).toHaveText('Use at least 8 characters, with an upper-case letter and a number.');
  await expect(page.locator('#banner')).toBeHidden();
  await page.fill('#pwd', 'Corniche Rides 9');
  await page.click('#next');
  await expect(page.locator('#f-pwd .err')).toHaveText('This password is too easy to guess. Choose another.');
});

test('the Privacy Notice opens from the confirmation box without ticking it, and Tab stays inside it', async ({ page }) => {
  await open(page);
  await toPassword(page);
  await expect(page.locator('#ack-lbl')).toContainText('I have read the Privacy Notice');
  await page.click('#pv-open'); // the box's link: the website's page has no footer of the form's (the site's is there)
  await expect(page.locator('#pv .pv-box')).toBeVisible();
  await expect(page.locator('#pv-body')).toContainText('community membership application');
  await expect(page.locator('#pv-x')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => !!document.activeElement && !!document.activeElement.closest('#pv .pv-box'))).toBe(true);
  for (let i = 0; i < 6; i++) await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement && !!document.activeElement.closest('#pv .pv-box'))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('#pv')).toBeHidden();
  await expect(page.locator('#ack')).toHaveAttribute('aria-checked', 'false');
});

test('the Privacy Notice is confirmed on the password screen, and ride news is optional', async ({ page }) => {
  const { of } = await open(page);
  await toPassword(page);
  await fillPassword(page, { ack: false });
  await page.click('#next');
  await expect(page.locator('#f-ack .err')).toHaveText('Tick to confirm you’ve read the Privacy Notice.');
  await expect(page.locator('#ack')).toHaveAttribute('aria-required', 'true');
  expect(of('customer_signup')).toEqual([]);
  await page.click('#ack');
  await next(page, 'password');
  expect(of('customer_consents')[0].p_ride_news).toBe(false);
});

test('the date of birth is typed: a date that is not one, under 5, the future, very old, and Arabic digits', async ({ page }) => {
  const { of } = await open(page);
  await accountStep(page);
  const err = page.locator('#f-birth .err');
  const y = ksaYear();
  await expect(page.locator('#birth-d')).toHaveAttribute('inputmode', 'numeric');
  await expect(page.locator('#f-birth select')).toHaveCount(0);
  await pickNat(page, 'Egypt');
  await typeBirth(page, '31', '2', '1994');
  await page.press('#birth-y', 'Tab'); // said as the date is left
  await expect(err).toHaveText('Enter a real date of birth');
  await typeBirth(page, '1', '1', String(y - 3));
  await page.click('#next');
  await expect(err).toHaveText('Riders must be at least 5 years old. Check the birth date.');
  await typeBirth(page, '1', '1', String(y + 1));
  await page.click('#next');
  await expect(err).toHaveText("A birth date can't be in the future.");
  await typeBirth(page, '', '', '');
  await page.click('#next');
  await expect(err).toHaveText('Enter your date of birth');
  await typeBirth(page, '1', '1', String(y - 90));
  await page.click('#next');
  await expect(page.locator('#f-birth .warn')).toHaveText('Please check your date of birth. If it is right, press Continue.');
  await expect(scr(page, 'birth')).toBeVisible();
  await page.fill('#birth-d', '١٢');
  await expect(page.locator('#birth-d')).toHaveValue('12');
  await page.fill('#birth-m', '٣');
  await page.fill('#birth-y', '١٩٩٤x');
  await expect(page.locator('#birth-y')).toHaveValue('1994');
  await expect(page.locator('#g-block')).toBeHidden();
  await next(page, 'birth');
  await apply(page);
  expect((of('customer_community_apply')[0].p as Body).birth_date).toBe('1994-03-12');
});

test('nationality: type to search, Saudi Arabia first and again in its place, no Israel, and names in Arabic', async ({ page }) => {
  const { of } = await open(page);
  await accountStep(page);
  const matches = (q: string) => page.evaluate((x) => (window as unknown as W).CommunityForm.natMatches(x), q);
  expect((await matches('ksa'))[0]).toBe('Saudi Arabia');
  expect((await matches('KSA'))[0]).toBe('Saudi Arabia');
  expect((await matches('Saudi'))[0]).toBe('Saudi Arabia');
  expect((await matches('egy'))[0]).toBe('Egypt');
  expect(await matches('israel')).toEqual([]);
  // the empty box lists every country: Saudi Arabia first, a line, then all of them alphabetically
  await page.click('#nat-q');
  await expect(page.locator('#nat-list')).toBeVisible();
  await expect(page.locator('#nat-q')).toHaveAttribute('aria-expanded', 'true');
  const names = await page.locator('#nat-list li[role=option]').evaluateAll((os) => os.map((o) => o.getAttribute('data-name')));
  const sa = names.flatMap((v, i) => (v === 'Saudi Arabia' ? [i] : []));
  expect(sa).toHaveLength(2);
  expect(sa[0]).toBe(0);
  expect(names.slice(sa[1] - 1, sa[1] + 2)).toEqual(['Sao Tome and Principe', 'Saudi Arabia', 'Senegal']);
  expect(names.length).toBeGreaterThan(190);
  expect(names).not.toContain('Israel');
  await expect(page.locator('#nat-list .combo-sep')).toHaveCount(1);
  await page.locator('#nat-list li[data-name="Saudi Arabia"]').nth(1).click(); // the lower copy: the same country
  await expect(page.locator('#nat')).toHaveValue('Saudi Arabia');
  await expect(page.locator('#nat-q')).toHaveValue('Saudi Arabia');
  await expect(page.locator('#nat-list')).toBeHidden();
  // the keyboard: typed, then Enter takes the first match
  await page.fill('#nat-q', 'egy');
  await expect(page.locator('#nat')).toHaveValue('');
  await page.press('#nat-q', 'Enter');
  await expect(page.locator('#nat')).toHaveValue('Egypt');
  await expect(scr(page, 'birth')).toBeVisible(); // Enter in the list never sends the screen
  // nothing that matches: said as the box is left
  await page.fill('#nat-q', 'Atlantis');
  await expect(page.locator('#nat-list .combo-none')).toHaveText('No country matches');
  await page.press('#nat-q', 'Tab');
  await expect(page.locator('#f-nat .err')).toHaveText('Choose your nationality from the list');
  // a name typed in full is taken as the box is left
  await page.fill('#nat-q', 'saudi');
  await page.press('#nat-q', 'Tab');
  await expect(page.locator('#nat')).toHaveValue('Saudi Arabia');
  await expect(page.locator('#f-nat .err')).toHaveText('');
  // in Arabic: the country's Arabic name, found by its Arabic words
  await setLang(page, 'ar');
  const ar = await page.evaluate(() => (window as unknown as W).SHARED.COUNTRY_AR['Saudi Arabia']);
  expect(ar).toMatch(/السعودية/);
  await expect(page.locator('#nat-q')).toHaveValue(ar);
  expect((await matches('سعودي'))[0]).toBe('Saudi Arabia');
  expect((await matches('مصر'))[0]).toBe('Egypt');
  await page.fill('#nat-q', '');
  await page.click('#birth-d');
  await page.click('#nat-q');
  const arNames = await page.locator('#nat-list li[role=option]').evaluateAll((os) => os.map((o) => o.getAttribute('data-name')));
  expect(arNames[0]).toBe('Saudi Arabia');
  expect(arNames.filter((n) => n === 'Saudi Arabia')).toHaveLength(2);
  expect(arNames).not.toContain('Israel');
  await expect(page.locator('#nat-list')).not.toContainText('إسرائيل');
  await page.locator('#nat-list li[data-name="Saudi Arabia"]').first().click();
  await setLang(page, 'en');
  await typeBirth(page, '12', '3', '1994');
  await next(page, 'birth');
  await apply(page);
  expect((of('customer_community_apply')[0].p as Body).nationality).toBe('Saudi Arabia'); // the English name, as before
});

test('one bike question: My own bike sends own_bike and the type Own; unanswered, Continue waits', async ({ page }) => {
  const { of } = await open(page);
  await accountStep(page);
  await through(page, {}, 'riding');
  await expect(page.locator('#type-label')).toHaveText(lbl('Which bike will you ride?'));
  await expect(page.locator('#types .tile')).toHaveText(['Road', 'Hybrid', 'Mountain', 'My own bike']);
  await expect(page.locator('#f-own')).toHaveCount(0);
  await page.click('#sports .tile[data-v="no"]');
  await page.click('#next');
  await expect(page.locator('#f-type .err')).toHaveText('Choose the bike you will ride');
  await page.click('#types .tile[data-v="Hybrid"]');
  await expect(page.locator('#f-type .err')).toHaveText('');
  // one tile at a time, the arrow keys move along them
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#types .tile[data-v="Mountain"]')).toHaveAttribute('aria-checked', 'true');
  await page.click('#types .tile[data-v="Own"]');
  await expect(page.locator('#types .tile[aria-checked="true"]')).toHaveCount(1);
  await through(page);
  await expect(page.locator('#check-list .ck-row').filter({ hasText: 'Which bike will you ride?' }).locator('dd')).toHaveText('My own bike');
  await page.click('#next');
  await expect(page.locator('#success')).toBeVisible();
  expect(of('customer_community_apply')[0].p).toMatchObject({ own_bike: true, bike_type: 'Own' });
});

test('the sport question: Yes with federations and Other, saved on the account before the application', async ({ page }) => {
  const { of, calls } = await open(page);
  await accountStep(page);
  await through(page, {}, 'riding');
  const w = await sportWords(page);
  await expect(page.locator('#sport-label')).toHaveText(lbl(w.ask));
  await expect(page.locator('#sports .tile')).toHaveText([w.yes, w.no]);
  await page.click('#types .tile[data-v="Road"]');
  await page.click('#next');
  await expect(page.locator('#f-sport .err')).toHaveText(w.errPick);
  await page.click('#sports .tile[data-v="yes"]');
  await expect(page.locator('#f-spfeds')).toBeVisible();
  await expect(page.locator('#sp-feds-lbl')).toHaveText(lbl(w.fedsLabel));
  await page.click('#next');
  await expect(page.locator('#f-spfeds .err')).toHaveText(w.errFeds);
  await page.selectOption('#sp-add', 'cycling');
  await expect(page.locator('#sp-chips .chip')).toHaveText(['Saudi Cycling Federation']);
  await expect(page.locator('#sp-add option[value="cycling"]')).toHaveCount(0); // a chip leaves the list
  await page.selectOption('#sp-add', 'football');
  await page.click('#sp-chips .chip-x[data-code="football"]');
  await expect(page.locator('#sp-chips .chip')).toHaveCount(1);
  await page.selectOption('#sp-add', 'other');
  await expect(page.locator('#f-spother')).toBeVisible();
  await expect(page.locator('#sp-other')).toBeFocused();
  await page.click('#next');
  await expect(page.locator('#f-spother .err')).toHaveText(w.errOther);
  await page.fill('#sp-other', 'Padel league');
  await next(page, 'riding');
  await through(page);
  await expect(page.locator('#check-list .ck-row').filter({ hasText: w.title }).locator('dd')).toHaveText('Saudi Cycling Federation, Padel league');
  await page.click('#next');
  await expect(page.locator('#success')).toBeVisible();
  expect(of('customer_set_sport')).toEqual([{ p_id: expect.any(String), p_token: 'tok-new', p_competes: true, p_federations: ['cycling', 'other'], p_other: 'Padel league' }]);
  const names = calls.map((c) => c.fn);
  expect(names.indexOf('customer_set_sport')).toBeLessThan(names.indexOf('customer_community_apply'));
});

test('the sport question: a refusal is said on its question and nothing is sent; a Yes taken back sends No', async ({ page }) => {
  let n = 0;
  const { of } = await open(page, '', { customer_set_sport: () => (++n === 1 ? refuse({ code: '22023', message: 'BAD_INPUT', details: 'sport_feds' }) : json(true)) });
  await accountStep(page);
  await through(page, { sport: 'yes', feds: ['cycling'] });
  await page.click('#next');
  const w = await sportWords(page);
  await expect(scr(page, 'riding')).toBeVisible();
  await expect(page.locator('#f-spfeds .err')).toHaveText(w.errFeds);
  await expect(page.locator('#errsum-list a')).toHaveText([w.errFeds]);
  expect(of('customer_community_apply')).toEqual([]);
  await page.click('#sports .tile[data-v="no"]'); // a Yes taken back: its federations go with it
  await expect(page.locator('#f-spfeds')).toBeHidden();
  await through(page, {}, 'success');
  expect(of('customer_set_sport')[1]).toMatchObject({ p_competes: false, p_federations: null, p_other: null });
  expect(of('customer_community_apply')).toHaveLength(1);
});

test('the sport question: an account that answered it is not asked again, and a database without it asks nobody', async ({ page }) => {
  const { of } = await open(page, `?code=${CODE}&lang=en`, { customer_sport: () => json([{ competes: true, federations: ['cycling'], other: null }]) });
  await expect(step(page, 2)).toBeVisible();
  await through(page, {}, 'riding');
  await expect(page.locator('#f-sport')).toBeHidden();
  await expect(page.locator('#f-type')).toBeVisible();
  await through(page);
  const w = await sportWords(page);
  await expect(page.locator('#check-list .ck-row').filter({ hasText: w.title }).locator('dd')).toHaveText('Saudi Cycling Federation');
  await page.click('#next');
  await expect(page.locator('#success')).toBeVisible();
  expect(of('customer_sport')).toEqual([{ p_id: 'c-karim', p_token: 'tok-handed' }]);
  expect(of('customer_set_sport')).toEqual([]);

  const p2 = await page.context().newPage();
  const b = await open(p2, '', { sport_option_list: () => refuse({ code: 'PGRST202', message: 'Could not find the function' }, 404) });
  await accountStep(p2);
  await through(p2, {}, 'riding');
  await expect(p2.locator('#f-sport')).toBeHidden();
  await apply(p2);
  expect(b.of('customer_set_sport')).toEqual([]);
});

test('under 18: a parent or guardian names themselves and confirms, filled from a parent who is the emergency contact', async ({ page }) => {
  const { of, calls } = await open(page);
  await toPassword(page, { em: { rel: 'parent' } });
  await fillPassword(page); await next(page, 'password');
  const y = ksaYear();
  await typeBirth(page, '12', '3', '1994');
  await expect(page.locator('#g-block')).toBeHidden(); // an adult is never asked
  await typeBirth(page, '1', '1', String(y - 15));
  await expect(page.locator('#g-block')).toBeVisible();
  await expect(page.locator('#gname')).toHaveValue('Layla Mansour');
  await expect(page.locator('#grels .tile[data-v="parent"]')).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('#gphone')).toHaveValue('055 123 4567');
  await expect(page.locator('#gcc-code')).toHaveText('+966');
  await expect(page.locator('#gack-lbl')).toContainText('Privacy Notice');
  await pickNat(page, 'Egypt');
  await page.fill('#gname', '');
  await page.click('#next');
  await expect(page.locator('#errsum-list a')).toHaveText(['Enter their full name', 'Their confirmation is needed. Ask them to tick this box.']);
  await page.fill('#gname', 'Layla Mansour');
  await page.click('#gack');
  await expect(page.locator('#f-gack .err')).toHaveText('');
  await next(page, 'birth');
  await through(page);
  await expect(page.locator('#check-list .ck-row').filter({ hasText: 'A parent or guardian' }).locator('dd')).toHaveText('Layla Mansour · Parent · ⁦+966 55 123 4567⁩');
  await page.click('#next');
  await expect(page.locator('#success')).toBeVisible();
  expect((of('customer_community_apply')[0].p as Body).birth_date).toBe(`${y - 15}-01-01`);
  expect(of('customer_community_guardian')).toEqual([{ p_id: expect.any(String), p_token: 'tok-new', p_name: 'Layla Mansour', p_relation: 'parent', p_phone: '+966551234567', p_privacy: VERSION }]);
  const names = calls.map((c) => c.fn);
  expect(names.indexOf('customer_community_apply')).toBeLessThan(names.indexOf('customer_community_guardian'));
});

test('Instagram is asked of everyone after a fixed @; LinkedIn waits behind Add LinkedIn and may stay empty', async ({ page }) => {
  const { of } = await open(page);
  await accountStep(page);
  await through(page, {}, 'work');
  await expect(page.locator('#f-ig .affix-at')).toHaveText('@');
  await expect(page.locator('#f-ig .req-mark')).toHaveCount(1);
  await expect(page.locator('#ig')).toHaveAttribute('aria-required', 'true');
  await expect(page.locator('#f-li')).toBeHidden();
  await expect(page.locator('#li-add')).toHaveText('Add LinkedIn');
  await page.fill('#prof', 'Architect'); await page.fill('#work', 'Saudi Aramco'); await page.selectOption('#heard', 'instagram');
  await page.click('#next');
  await expect(page.locator('#f-ig .err')).toHaveText('Enter your Instagram username');
  await page.fill('#ig', 'karim rides!');
  await page.click('#next');
  await expect(page.locator('#f-ig .err')).toHaveText('An Instagram username has only letters, numbers, dots and underscores');
  await page.fill('#ig', '@karim.rides');
  await page.press('#ig', 'Tab');
  await expect(page.locator('#ig')).toHaveValue('karim.rides'); // the @ is the box's own
  await page.click('#li-add');
  await expect(page.locator('#f-li')).toBeVisible();
  await expect(page.locator('#li')).toBeFocused();
  await expect(page.locator('#li-add')).toBeHidden();
  await expect(page.locator('#f-li .req-mark')).toHaveCount(0);
  await page.fill('#li', 'https://www.linkedin.com/company/micromobility');
  await page.click('#next');
  await expect(page.locator('#f-li .err')).toHaveText('Paste the link to your own profile (linkedin.com/in/…)');
  await page.fill('#li', '');
  await next(page, 'work');
  await expect(page.locator('#check-list dt')).not.toContainText(['LinkedIn']);
  await page.click('#next');
  await expect(page.locator('#success')).toBeVisible();
  const p = of('customer_community_apply')[0].p as Body;
  expect([p.instagram, p.linkedin]).toEqual(['karim.rides', '']);
});

test('Check your answers lists every answer, and Change goes to the question and comes back', async ({ page }) => {
  const { of } = await open(page);
  await accountStep(page);
  await through(page);
  await expect(scr(page, 'check').locator('.screen-title')).toHaveText('Check your answers');
  await expect(page.locator('#prog-txt')).toHaveText('Step 8 of 8: Check your answers');
  const rows = page.locator('#check-list .ck-row');
  await expect(rows.locator('dt')).toHaveText(['Date of birth', 'Nationality', 'Which bike will you ride?', 'Sport', 'Profession', 'Company', 'Instagram', 'How did you hear about us?']);
  await expect(rows.locator('dd').nth(0)).toHaveText('12 March 1994');
  await expect(rows.locator('dd').nth(1)).toHaveText('Egypt');
  await expect(rows.locator('dd').nth(2)).toHaveText('Road');
  await expect(rows.locator('dd').nth(3)).toHaveText('No');
  await expect(rows.locator('dd').nth(5)).toHaveText('Saudi Aramco');
  await expect(rows.locator('dd').nth(6)).toHaveText('@karim.rides');
  await expect(rows.locator('.ck-change').nth(1)).toHaveText('Change Nationality'); // the question named for a screen reader
  // Change: to the question, and Continue comes back here
  await rows.filter({ hasText: 'Nationality' }).locator('.ck-change').click();
  await expect(scr(page, 'birth')).toBeVisible();
  await expect(page.locator('#nat-q')).toBeFocused();
  await pickNat(page, 'Morocco');
  await next(page, 'birth');
  await expect(scr(page, 'check')).toBeVisible();
  await expect(rows.locator('dd').nth(1)).toHaveText('Morocco');
  await rows.filter({ hasText: 'Company' }).locator('.ck-change').click();
  await expect(scr(page, 'work')).toBeVisible();
  await expect(page.locator('#work')).toBeFocused();
  await page.fill('#work', 'Red Sea Global');
  await next(page, 'work');
  await expect(scr(page, 'check')).toBeVisible();
  await page.click('#next');
  await expect(page.locator('#success')).toBeVisible();
  expect(of('customer_community_apply')[0].p).toMatchObject({ nationality: 'Morocco', workplace: 'Red Sea Global' });
});

test('company: required, beside the profession, and in the page language', async ({ page }) => {
  const { errs, of } = await open(page);
  await accountStep(page);
  await through(page, {}, 'work');
  await expect(page.locator('#f-work label')).toHaveText(lbl('Company'));
  await page.fill('#prof', 'Architect'); await page.fill('#ig', 'karim.rides'); await page.selectOption('#heard', 'instagram');
  await page.click('#next');
  await expect(page.locator('#f-work .err')).toHaveText('Enter your company');
  for (const bad of ['x', '12345', '<b>Aramco</b>', '--- ...']) {
    await page.fill('#work', bad);
    await expect(page.locator('#f-work .err')).toHaveText('');
    await page.click('#next');
    await expect(page.locator('#f-work .err')).toHaveText('Enter your company');
  }
  expect(of('customer_community_apply')).toEqual([]);
  await setLang(page, 'ar');
  await expect(page.locator('#f-work label')).toHaveText(lbl('الشركة'));
  await expect(page.locator('#f-work .err')).toHaveText('أدخل اسم شركتك');
  await page.fill('#work', 'جامعة الملك عبدالعزيز');
  await next(page, 'work');
  await page.click('#next');
  await expect(page.locator('#success')).toBeVisible();
  expect((of('customer_community_apply')[0].p as Body).workplace).toBe('جامعة الملك عبدالعزيز');
  expect(errs).toEqual([]);
});

test('how they heard of us: every answer the booking site knows, required, in the page language', async ({ page }) => {
  const { errs } = await open(page);
  await accountStep(page);
  await through(page, {}, 'work');
  const opts = page.locator('#heard option');
  expect(await opts.evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value))).toEqual(['', 'instagram', 'tiktok', 'snapchat', 'x', 'facebook', 'youtube', 'whatsapp', 'google', 'friend', 'invited', 'passed_by', 'event', 'hotel', 'school', 'work', 'community', 'other']);
  await fillScreen(page, 'work', { heard: '' });
  await page.click('#next');
  await expect(page.locator('#f-heard .err')).toHaveText('Please tell us how you heard about us.');
  await expect(page.locator('#heard option[value="invited"]')).toHaveText('Invited by MicroMobility');
  await page.selectOption('#heard', 'passed_by');
  await setLang(page, 'ar');
  await expect(page.locator('#f-heard label')).toHaveText(lbl('كيف عرفت عنا؟'));
  await expect(page.locator('#heard')).toHaveValue('passed_by');
  expect(errs).toEqual([]);
});

test('a server answer about a community question goes back to that question', async ({ page }) => {
  let error = 'workplace';
  await open(page, '', { customer_community_apply: () => json({ ok: false, error }) });
  await accountStep(page);
  for (const [e, field, msg, s] of [['workplace', 'f-work', 'Enter your company', 'work'], ['heard_from', 'f-heard', 'Please tell us how you heard about us.', 'work'], ['birth_date', 'f-birth', 'Enter your date of birth', 'birth']]) {
    error = e;
    await through(page);
    await page.click('#next');
    await expect(scr(page, s)).toBeVisible();
    await expect(page.locator(`#${field} .err`)).toHaveText(msg);
  }
  error = 'signed_out';
  await through(page);
  await page.click('#next');
  await expect(page.locator('#banner .banner-text')).toHaveText('You were signed out. Sign in again to send your application.');
  await expect(page.locator('#banner-signin')).toBeVisible();
  await expect(page.locator('#banner-signin')).toHaveAttribute('href', 'https://experiences.micromobility.sa/?handoff=community&lang=en');
});

// Arriving signed in: the booking site's "Sign in" from here, or the Apply button of its
// members-only popup, sends the rider back with a one-time code.
test('arriving signed in starts on step 2 with the answers so far, and asks only what is left', async ({ page }) => {
  const { errs, of } = await open(page, `?code=${CODE}&lang=en`, { customer_community_me: () => json({ ...ME, ...HELD, pending: true }) });
  await expect(step(page, 2)).toBeVisible();
  await expect(step(page, 1)).toBeHidden();
  expect(new URL(page.url()).search).toBe('?lang=en'); // the code leaves the address at once
  expect(of('customer_handoff_redeem')).toEqual([{ p_code: CODE }]);
  expect(of('customer_community_me')).toEqual([{ p_id: 'c-karim', p_token: 'tok-handed' }]);
  await expect(page.locator('#acct-made')).toBeHidden();
  await expect(page.locator('#acct-pending')).toBeVisible();
  await expect(page.locator('#birth-y')).toHaveValue('1994');
  await expect(page.locator('#birth-d')).toHaveValue('12');
  await expect(page.locator('#nat')).toHaveValue('Egypt');
  await expect(page.locator('#types .tile[data-v="Hybrid"]')).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('#heard')).toHaveValue('friend');
  await expect(page.locator('#was .tile[data-v="yes"]')).toHaveAttribute('aria-checked', 'true'); // WhatsApp, from the account
  await expect(page.locator('#f-xgender')).toBeHidden();
  await expect(page.locator('#f-xheight')).toBeHidden();
  // everything held: only the sport is left, then the last look
  expect(await current(page)).toBe('riding');
  await expect(page.locator('#back')).toBeHidden();
  await through(page, { sport: 'no' });
  await expect(page.locator('#prog-bar li')).toHaveCount(2);
  await page.click('#next');
  await expect(page.locator('#success')).toBeVisible();
  await expect(page.locator('#result')).toHaveText('Karim, your application is with our team.');
  expect(of('customer_community_apply')).toEqual([{ p_id: 'c-karim', p_token: 'tok-handed', p: expect.objectContaining({ birth_date: '1994-03-12', bike_type: 'Hybrid', own_bike: false, profession: 'Architect', instagram: 'karim.rides' }) }]);
  // This form never showed them the notice's box: nothing says they confirmed it here.
  const sent = of('customer_community_apply')[0].p as Body;
  expect(sent).not.toHaveProperty('privacy_version');
  expect(sent).not.toHaveProperty('privacy_ack');
  expect(of('customer_signup')).toEqual([]);
  expect(errs).toEqual([]);
});

test('an account without a gender or height is asked for them on step 2', async ({ page }) => {
  const { of } = await open(page, `?code=${CODE}`, { customer_community_me: () => json({ ...ME, gender: null, height: null }) });
  await expect(page.locator('#f-xgender')).toBeVisible();
  await expect(page.locator('#f-xheight')).toBeVisible();
  await expect(page.locator('#birth-title')).toHaveText('About you');
  await fillScreen(page, 'birth', {});
  await page.click('#next');
  await expect(page.locator('#f-xgender .err')).toHaveText('Choose your gender');
  await expect(page.locator('#f-xheight .err')).toHaveText('Enter your height in cm (100 to 250)');
  await expect(page.locator('#errsum-list a')).toHaveCount(2);
  await page.click('#xgenders .tile[data-v="female"]');
  await page.fill('#xheight', '165');
  await apply(page);
  expect(of('customer_community_apply')[0].p).toEqual(expect.objectContaining({ gender: 'female', height: 165 }));
});

// A height outside 100 to 250 cm on the account (0, a typo) is no height: asked here, as the database asks for it.
test('an account whose height is 0 or out of range is asked for it on step 2', async ({ page }) => {
  for (const height of [0, 95, 260]) {
    const p = await page.context().newPage();
    await open(p, `?code=${CODE}`, { customer_community_me: () => json({ ...ME, height }) });
    await expect(step(p, 2)).toBeVisible();
    await expect(p.locator('#f-xheight')).toBeVisible();
    await expect(p.locator('#f-xgender')).toBeHidden();
    await p.close();
  }
});

test('a member already is told so, and a used or late code asks to sign in again', async ({ page }) => {
  await open(page, `?code=${CODE}`, { customer_community_me: () => json({ ...ME, member: true }) });
  await expect(page.locator('#member')).toBeVisible();
  await expect(page.locator('#member-title')).toHaveText('You are already a community member');
  await expect(page.locator('#member-go')).toHaveAttribute('href', 'https://experiences.micromobility.sa/?lang=en');
  await expect(page.locator('#form')).toBeHidden();

  const late = await page.context().newPage();
  const { of } = await open(late, `?code=${CODE}`, { customer_handoff_redeem: () => json([]) });
  await expect(late.locator('#banner .banner-text')).toHaveText('This sign-in link has expired. Sign in again to continue.');
  await expect(late.locator('#banner-signin')).toBeVisible();
  await expect(scr(late, 'gate')).toBeVisible();
  expect(of('customer_community_me')).toEqual([]);
});

// A code that fails leaves the applicant here to sign in: what they type for it is saved on top of the membership
// answers kept on this device, never instead of them (2026-11-10 bug hunt).
test('a code that fails keeps the saved membership answers through a sign-in typed here', async ({ page }) => {
  let redeem = () => json([{ id: 'c-karim', name: 'Karim Mansour', session_token: 'tok-handed' }]);
  await open(page, `?code=${CODE}&lang=en`, {
    customer_handoff_redeem: () => redeem(),
    customer_login: () => json([{ id: 'c-karim', name: 'Karim Mansour', session_token: 'tok-again' }]),
    customer_pwd_state: () => json(false),
  });
  await expect(scr(page, 'birth')).toBeVisible();
  await pickNat(page, 'Egypt');
  await typeBirth(page, '12', '3', '1994');
  await page.waitForTimeout(500);
  // back by the booking site's link, the code already used
  redeem = () => json([]);
  await page.goto(`/community/registration?code=${CODE}&lang=en`);
  await expect(page.locator('#banner .banner-text')).toHaveText('This sign-in link has expired. Sign in again to continue.');
  await page.click('#haves .tile[data-v="yes"]');
  await page.fill('#lid', 'karim.mansour@gmail.com');
  await page.waitForTimeout(500);
  const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('mm-community-draft') || 'null'));
  expect(kept.data.v).toEqual(expect.objectContaining({ nat: 'Egypt', 'birth-y': '1994' }));
  await page.fill('#lpw', 'Secret123');
  await page.click('#login');
  await expect(step(page, 2)).toBeVisible();
  await expect(page.locator('#nat')).toHaveValue('Egypt');
  await expect(page.locator('#nat-q')).toHaveValue('Egypt');
  await expect(page.locator('#birth-y')).toHaveValue('1994');
});

test('Arabic: right to left, the account screens and the account-made note in the page language', async ({ page }) => {
  const { errs } = await open(page, '?lang=ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('#f-name label')).toHaveText([lbl(await arT(page, 'First name')), lbl(await arT(page, 'Last name'))]);
  await expect(page.locator('#first')).toHaveAttribute('placeholder', 'اسمك الأول');
  await expect(page.locator('#genders .tile')).toHaveText(['ذكر', 'أنثى']);
  await toPassword(page);
  await expect(page.locator('#next-label')).toHaveText('إنشاء حساب');
  await expect(page.locator('#f-pwd label')).toHaveText(lbl('كلمة المرور'));
  await fillPassword(page, { pwd: 'short' });
  await page.click('#next');
  await expect(page.locator('#f-pwd .err')).toHaveText(await arT(page, 'Use at least 8 characters.'));
  await page.fill('#pwd', 'Ride2Work');
  await next(page, 'password');
  await expect(page.locator('#acct-made .acct-title')).toHaveText('تم إنشاء حسابك');
  await expect(page.locator('#next-label')).toHaveText(await arT(page, 'Continue'));
  expect(errs).toEqual([]);
});

test('a consent save that fails keeps step 2 shut, says so, and Continue saves it without a second account', async ({ page }) => {
  let n = 0; // the first two tries fail (the save is tried twice at once), the third lands
  const { of, errs } = await open(page, '', { customer_consents: () => (++n <= 2 ? refuse({ message: 'upstream' }, 503) : json({ privacy_version: '2026-09-28', ride_news: false })) });
  await toPassword(page); await fillPassword(page);
  await page.click('#next');
  await expect(page.locator('#banner')).toContainText('Could not reach the server');
  await expect(step(page, 2)).toBeHidden();
  expect(of('customer_signup')).toHaveLength(1);
  expect(of('customer_consents')).toHaveLength(2);
  await page.click('#next');
  await expect(step(page, 2)).toBeVisible();
  expect(of('customer_signup')).toHaveLength(1); // the account was made once
  expect(of('customer_consents')).toHaveLength(3);
  expect(errs).toEqual([]);
});

// A signed-in account the database holds no confirmed notice for: the application is answered
// 'privacy', and the last screen shows the notice's box; ticked, the application carries the notice's version
// and privacy_ack. Nothing of the kind is sent for a box the form never showed.
test('a signed-in account without a confirmed notice is asked for it on the last screen, and only then sends it', async ({ page }) => {
  const { errs, of } = await open(page, `?code=${CODE}&lang=en`, {
    customer_community_apply: (b) => json((b.p as Body).privacy_ack === true ? { ok: true, updated: false } : { ok: false, error: 'privacy' }),
  });
  await expect(step(page, 2)).toBeVisible();
  await through(page);
  await expect(page.locator('#f-xack')).toBeHidden();
  await page.click('#next');
  await expect(page.locator('#f-xack')).toBeVisible();
  await expect(page.locator('#f-xack .err')).toHaveText('Tick to confirm you’ve read the Privacy Notice.');
  await expect(page.locator('#errsum')).toBeFocused();
  await page.click('#errsum-list a[data-f="f-xack"]');
  await expect(page.locator('#xack')).toBeFocused();
  await expect(page.locator('#success')).toBeHidden();
  expect(of('customer_community_apply')).toHaveLength(1);
  expect(of('customer_community_apply')[0].p).not.toHaveProperty('privacy_ack');
  // Not ticked: not sent again.
  await page.click('#next');
  await expect(page.locator('#f-xack .err')).toHaveText('Tick to confirm you’ve read the Privacy Notice.');
  expect(of('customer_community_apply')).toHaveLength(1);
  // The notice opens from the box's link without ticking it.
  await page.click('#pv-open-x');
  await expect(page.locator('#pv .pv-box')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#xack')).toHaveAttribute('aria-checked', 'false');
  await page.click('#xack');
  await expect(page.locator('#f-xack .err')).toHaveText('');
  await page.click('#next');
  await expect(page.locator('#success')).toBeVisible();
  expect(of('customer_community_apply')).toHaveLength(2);
  expect(of('customer_community_apply')[1].p).toMatchObject({ privacy_version: VERSION, privacy_ack: true });
  expect(errs).toEqual([]);
});

test('the last screen\'s notice box reads in Arabic', async ({ page }) => {
  await open(page, `?code=${CODE}&lang=ar`, { customer_community_apply: () => json({ ok: false, error: 'privacy' }) });
  await expect(step(page, 2)).toBeVisible();
  await through(page);
  await page.click('#next');
  await expect(page.locator('#xack-lbl')).toContainText('إشعار الخصوصية');
  await expect(page.locator('#f-xack .err')).toHaveText('يرجى تأكيد قراءتك لإشعار الخصوصية.');
});

// WhatsApp (the owner, 2026-10-07): "ask the users if the phone number typed in is their whatsapp phone number too that
// contains yes and no buttons, if the answer is no open a new field called whatsapp number and let it contain the same
// country codes and behavior as the phone number field".
test('under the mobile: Yes / No, and No opens a WhatsApp number with the mobile\'s codes and rules', async ({ page }) => {
  const { errs, of } = await open(page);
  await fillAbout(page); await next(page, 'about');
  await expect(page.locator('#wa-label')).toHaveText(lbl('Is this mobile number your WhatsApp number too?'));
  await page.fill('#phone', '0552468013');
  await expect(page.locator('#wa-label')).toHaveText(lbl('Is ⁦+966 55 246 8013⁩ your WhatsApp number too?'));
  await expect(page.locator('#f-wanum')).toBeHidden();
  await page.fill('#email', 'Karim.Mansour@gmail.com');
  // not answered: Continue waits
  await page.click('#next');
  await expect(page.locator('#f-wa .err')).toHaveText('Tell us whether this is your WhatsApp number');
  await page.click('#was .tile[data-v="no"]');
  await expect(page.locator('#f-wanum')).toBeVisible();
  await expect(page.locator('#wa')).toBeFocused();
  expect(await page.locator('#wacc option').count()).toBe(await page.locator('#cc option').count());
  await expect(page.locator('#wacc')).toHaveValue('SA+966');
  await page.click('#next');
  await expect(page.locator('#f-wanum .err')).toHaveText('Enter your WhatsApp number');
  await page.fill('#wa', '0512');
  await page.click('#next');
  await expect(page.locator('#f-wanum .err')).toHaveText('Enter a valid Saudi mobile number (5XXXXXXXX)');
  // typed with its country code, the picker follows, as the mobile's does
  await page.fill('#wa', '+971 50 482 9153');
  await expect(page.locator('#wacc')).toHaveValue('AE+971');
  await expect(page.locator('#wacc-code')).toHaveText('+971');
  await expect(page.locator('#wa')).toHaveValue('504 829 153');
  await next(page, 'reach');
  await emContact(page, 'em'); await next(page, 'emergency');
  await fillPassword(page); await next(page, 'password');
  await expect(page.locator('#f-wa')).toBeHidden(); // asked on step 1, not again
  await apply(page);
  expect(of('customer_community_apply')[0].p).toMatchObject({ whatsapp_same: false, whatsapp: '+971504829153' });
  expect(errs).toEqual([]);
});

test('handed over signed in: the question names the account\'s mobile on step 2, filled from the account', async ({ page }) => {
  const { errs, of } = await open(page, `?code=${CODE}&lang=en`, {
    customer_community_me: () => json({ ...ME, whatsapp_same: false, whatsapp: '+201001234567' }),
  });
  await expect(step(page, 2)).toBeVisible();
  const wa = step(page, 2).locator('#f-wa');
  await expect(wa).toBeHidden(); // already on the account: not asked (2026-10-25) until Show all answers
  await page.click('#acct-skip-show');
  await expect(wa).toBeVisible();
  await expect(page.locator('#wa-label')).toHaveText(lbl('Is ⁦+966 55 246 8013⁩ your WhatsApp number too?'));
  await expect(page.locator('#was .tile[data-v="no"]')).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('#wacc')).toHaveValue('EG+20');
  await page.click('#was .tile[data-v="yes"]');
  await expect(page.locator('#f-wanum')).toBeHidden();
  await apply(page);
  const p = of('customer_community_apply')[0].p as Body;
  expect(p.whatsapp_same).toBe(true);
  expect(p).not.toHaveProperty('whatsapp');
  expect(errs).toEqual([]);
});

test('the WhatsApp question in Arabic', async ({ page }) => {
  await open(page, '?lang=ar');
  await fillAbout(page); await next(page, 'about');
  await expect(page.locator('#wa-label')).toHaveText(lbl('هل رقم الجوال هذا هو رقمك على WhatsApp أيضًا؟'));
  await expect(page.locator('#was .tile')).toHaveText(['نعم', 'لا']);
  await page.click('#was .tile[data-v="no"]');
  await expect(page.locator('#f-wanum label[for="wa"]')).toHaveText(lbl('رقم WhatsApp'));
});

// Bug hunt 2026-10-14.
test('a WhatsApp No put back on arrival does not jump the focus (and the keyboard) to its box', async ({ page }) => {
  const { errs } = await open(page, `?code=${CODE}`, {
    customer_community_me: () => json({ ...ME, whatsapp_same: false, whatsapp: '+971501234567' }),
  });
  await expect(step(page, 2)).toBeVisible();
  await expect(page.locator('#was .tile[data-v="no"]')).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('#wacc-code')).toHaveText('+971');
  expect(await page.evaluate(() => document.activeElement && document.activeElement.id)).not.toBe('wa');
  // the rider's own No still opens the box for typing
  await page.click('#acct-skip-show');
  await page.click('#was .tile[data-v="yes"]');
  await page.click('#was .tile[data-v="no"]');
  await expect(page.locator('#wa')).toBeFocused();
  expect(errs).toEqual([]);
});

// The emergency contact (the owner, 2026-10-07): the first required on the account step and, for an
// account handed over without one, on step 2; a second optional, behind its button.
test('the account step will not make the account without an emergency contact, and names every missing box at once', async ({ page }) => {
  const { errs, of } = await open(page);
  await fillAbout(page); await next(page, 'about');
  await fillReach(page); await next(page, 'reach');
  await expect(scr(page, 'emergency').locator('.screen-title')).toHaveText('Emergency contact');
  await page.click('#next');
  await expect(page.locator('#f-em-name .err')).toHaveText('Enter your contact’s name.');
  await expect(page.locator('#f-em-phone .err')).toHaveText('Enter your contact’s mobile number.');
  await expect(page.locator('#f-em-rel .err')).toHaveText('Choose how they are related to you.');
  await expect(page.locator('#errsum-list a')).toHaveCount(3);
  await page.fill('#em-name', 'Layla Mansour');
  await page.fill('#em-phone', '0551234567');
  await page.click('#next');
  await expect(page.locator('#errsum-list a')).toHaveText(['Choose how they are related to you.']);
  await page.selectOption('#em-rel', 'parent');
  await next(page, 'emergency');
  expect(of('customer_signup')).toHaveLength(0);
  await fillPassword(page); await next(page, 'password');
  expect(of('customer_set_emergency')).toEqual([{ p_id: of('customer_signup')[0].p_id, p_token: 'tok-new', p_name: 'Layla Mansour', p_phone: '+966551234567', p_relation: 'parent' }]);
  expect(of('customer_set_emergency2')).toHaveLength(0);
  expect(errs).toEqual([]);
});

test('the emergency contact cannot be the rider’s own number, and a dash in its name becomes a space', async ({ page }) => {
  await open(page);
  await fillAbout(page); await next(page, 'about');
  await fillReach(page); await next(page, 'reach');
  await emContact(page, 'em', { name: 'Layla-Mansour', phone: '+966 55 246 8013' });
  await expect(page.locator('#em-name')).toHaveValue('Layla Mansour');
  await page.click('#next');
  await expect(page.locator('#f-em-phone .err')).toHaveText('Your contact’s number can’t be your own.');
  await page.fill('#em-name', 'L Mansour');
  await page.fill('#em-phone', '0551234567');
  await page.click('#next');
  await expect(page.locator('#f-em-name .err')).toHaveText('Write each name in full: every name needs at least two letters.');
  await expect(scr(page, 'emergency')).toBeVisible();
});

test('a second emergency contact is optional, needs all three boxes, and not the first one’s number', async ({ page }) => {
  const { errs, of } = await open(page);
  await fillAbout(page); await next(page, 'about');
  await fillReach(page); await next(page, 'reach');
  await expect(page.locator('#em2-box')).toBeHidden();
  await page.click('#em2-add');
  await expect(page.locator('#em2-box')).toBeVisible();
  await expect(page.locator('#em2-box .em-h')).toHaveText('Second emergency contact');
  await expect(page.locator('#em2-add')).toBeHidden();
  await expect(page.locator('#em2-name')).toBeFocused();
  await emContact(page, 'em'); // the second left empty: none, and the account is made
  await next(page, 'emergency');
  await fillPassword(page); await next(page, 'password');
  expect(of('customer_set_emergency2')).toHaveLength(0);
  expect(errs).toEqual([]);

  // a second visitor on a device of their own: the first one's answers kept on this one (mm-community-draft) are not theirs.
  // The first page is closed first: it writes its draft as it is hidden or closed, which on the website's page (whose
  // scripts run once the page is drawn) could land after the second page has cleared it and before its form reads it.
  await page.close();
  const p2 = await page.context().newPage();
  await p2.addInitScript(() => { try { localStorage.removeItem('mm-community-draft'); } catch (e) { /* none */ } });
  const b = await open(p2);
  await fillAbout(p2); await next(p2, 'about');
  await fillReach(p2); await next(p2, 'reach');
  await emContact(p2, 'em');
  await p2.click('#em2-add');
  await emContact(p2, 'em2', { name: 'Omar Mansour', phone: '055 123 4567', rel: 'sibling' });
  await p2.click('#next');
  await expect(p2.locator('#f-em2-phone .err')).toHaveText('The two emergency contacts can’t have the same number.');
  await p2.fill('#em2-phone', '0559876541');
  await p2.selectOption('#em2-rel', '');
  await p2.click('#next');
  await expect(p2.locator('#f-em2-rel .err')).toHaveText('Choose how they are related to you.');
  await p2.selectOption('#em2-rel', 'sibling');
  await next(p2, 'emergency');
  await fillPassword(p2); await next(p2, 'password');
  expect(b.of('customer_set_emergency2')).toEqual([{ p_id: b.of('customer_signup')[0].p_id, p_token: 'tok-new', p_name: 'Omar Mansour', p_phone: '+966559876541', p_relation: 'sibling' }]);
});

test('a contact the database refuses after the account is made is asked again on step 2, then saved before the application', async ({ page }) => {
  let n = 0;
  const { errs, of } = await open(page, '', {
    customer_set_emergency: () => (++n === 1 ? refuse({ code: '22023', message: 'BAD_INPUT', details: 'em_self' }) : json(true)),
  });
  await toPassword(page); await fillPassword(page);
  await page.click('#next');
  await expect(step(page, 2)).toBeVisible();
  // the membership screens in their order first; the contact's own screen comes after them, its refusal said there
  await expect(scr(page, 'birth')).toBeVisible();
  await through(page, {}, 'xem');
  await expect(page.locator('#xem-name')).toHaveValue('Layla Mansour');
  await expect(page.locator('#f-xem-phone .err')).toHaveText('Your contact’s number can’t be your own.');
  expect(of('customer_signup')).toHaveLength(1);
  await page.fill('#xem-phone', '0559876541');
  await page.click('#next');
  await expect(scr(page, 'check')).toBeVisible();
  await through(page, {}, 'success');
  expect(of('customer_set_emergency').at(-1)).toMatchObject({ p_phone: '+966559876541', p_relation: 'spouse' });
  expect(of('customer_community_apply')[0].p).toMatchObject({ emergency_saved: true });
  expect(of('customer_signup')).toHaveLength(1);
  expect(errs).toEqual([]);
});

test('a database without the emergency functions lets the account through', async ({ page }) => {
  const missing = () => refuse({ code: 'PGRST202', message: 'Could not find the function' }, 404);
  const { of } = await open(page, '', { customer_set_emergency: missing, customer_set_emergency2: missing });
  await accountStep(page);
  await expect(scr(page, 'birth')).toBeVisible();
  await expect(page.locator('#prog-bar li')).toHaveCount(8); // no second emergency screen
  expect(of('customer_set_emergency')).toHaveLength(1);
});

test('an account handed over without an emergency contact gives it on step 2 before the application goes', async ({ page }) => {
  const { errs, of } = await open(page, '?code=' + CODE, { customer_emergency: () => json([EM_NONE]) });
  await expect(step(page, 2)).toBeVisible();
  await through(page, {}, 'xem');
  await expect(scr(page, 'xem').locator('.screen-title')).toHaveText('Emergency contact');
  await page.click('#next');
  await expect(page.locator('#f-xem-name .err')).toHaveText('Enter your contact’s name.');
  expect(of('customer_community_apply')).toHaveLength(0);
  await emContact(page, 'xem', { phone: '0552468013' }); // the account's own number (ME.phone)
  await page.click('#next');
  await expect(page.locator('#f-xem-phone .err')).toHaveText('Your contact’s number can’t be your own.');
  await page.fill('#xem-phone', '0551234567');
  await page.click('#xem2-add');
  await emContact(page, 'xem2', { name: 'Omar Mansour', phone: '0559876541', rel: 'friend' });
  await next(page, 'xem');
  await expect(page.locator('#check-list .ck-row').filter({ hasText: 'Emergency contact' }).locator('dd')).toHaveText('Layla Mansour · ⁦+966 55 123 4567⁩');
  await page.click('#next');
  await expect(page.locator('#success')).toBeVisible();
  expect(of('customer_set_emergency')).toEqual([{ p_id: 'c-karim', p_token: 'tok-handed', p_name: 'Layla Mansour', p_phone: '+966551234567', p_relation: 'spouse' }]);
  expect(of('customer_set_emergency2')).toEqual([{ p_id: 'c-karim', p_token: 'tok-handed', p_name: 'Omar Mansour', p_phone: '+966559876541', p_relation: 'friend' }]);
  expect(errs).toEqual([]);
});

test('an account handed over with its contact is not asked; an older database offers no second contact', async ({ page }) => {
  const { of } = await open(page, '?code=' + CODE);
  await expect(step(page, 2)).toBeVisible();
  await apply(page);
  expect(of('customer_set_emergency')).toHaveLength(0);
  expect(of('customer_community_apply')[0].p).not.toHaveProperty('emergency_saved');

  const p2 = await page.context().newPage();
  await open(p2, '?code=' + CODE, { customer_emergency: () => json([{ emergency_name: null, emergency_phone: null, emergency_relation: null }]) });
  await expect(step(p2, 2)).toBeVisible();
  await through(p2, {}, 'xem');
  await expect(p2.locator('#xem-block')).toBeVisible();
  await expect(p2.locator('#xem2-add')).toBeHidden();
});

test('the emergency contact speaks the page’s language, Saudi Arabia first in its dial codes and no Israel', async ({ page }) => {
  await open(page, '?lang=ar');
  await expect(scr(page, 'emergency').locator('.screen-title')).toHaveText('جهة اتصال للطوارئ');
  await expect(page.locator('#em-rel option').nth(1)).toHaveText('الزوج أو الزوجة');
  await expect(page.locator('#f-em-name label')).toHaveText(lbl('اسم جهة الاتصال'));
  const codes = await page.locator('#em-cc option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
  expect(codes[0]).toBe('SA+966');
  expect(codes.filter((c) => c.startsWith('IL'))).toEqual([]);
  expect(await page.locator('#em-block').innerHTML()).not.toMatch(/[\u{1F1E6}-\u{1F1FF}]/u);
});

test('the admins\' settings: a question turned off is not asked or sent, one made optional may be left empty, LinkedIn made required shows at once, and their wording shows', async ({ page }) => {
  const form = { q: { profession: { on: false }, workplace: { req: false }, linkedin: { req: true }, nationality: { label: { en: 'Which passport do you hold?', ar: 'ما جواز سفرك؟' } } } };
  const { errs, of } = await open(page, '', {}, form);
  await accountStep(page);
  await expect(page.locator('#f-nat label')).toHaveText(lbl('Which passport do you hold?'));
  await through(page, {}, 'work');
  await expect(page.locator('#f-prof')).toBeHidden();
  await expect(page.locator('#f-work .req-mark')).toHaveCount(0); // optional: no star, and nothing says so
  await expect(page.locator('#work')).not.toHaveAttribute('aria-required', 'true');
  await expect(page.locator('#f-li')).toBeVisible();
  await expect(page.locator('#li-add')).toBeHidden();
  await expect(page.locator('#f-li .req-mark')).toHaveCount(1);
  await page.fill('#ig', 'karim.rides'); await page.selectOption('#heard', 'instagram');
  await page.click('#next');
  await expect(page.locator('#errsum-list a')).toHaveText(['Paste the link to your own profile (linkedin.com/in/…)']);
  await page.fill('#li', 'https://sa.linkedin.com/in/karim-mansour-arch/');
  await next(page, 'work');
  await page.click('#next');
  await expect(page.locator('#success')).toBeVisible();
  const p = of('customer_community_apply')[0].p as Body;
  expect(p).toMatchObject({ profession: '', workplace: '', nationality: 'Egypt', linkedin: 'karim-mansour-arch' });
  expect(errs).toEqual([]);
});

test('the admins\' wording shows in Arabic', async ({ page }) => {
  await open(page, '?lang=ar', {}, { q: { nationality: { label: { en: 'Which passport do you hold?', ar: 'ما جواز سفرك؟' } } } });
  await accountStep(page);
  await expect(page.locator('#f-nat label')).toHaveText(lbl('ما جواز سفرك؟'));
});

test('a refused box tells a screen reader it is wrong and why; a second contact typed in Arabic digits is not dropped', async ({ page }) => {
  const { of } = await open(page);
  await fillAbout(page); await next(page, 'about');
  await page.click('#next');
  await expect(page.locator('#email')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#email')).toHaveAttribute('aria-describedby', 'f-email-err');
  await expect(page.locator('#f-email-err')).toHaveText('Enter your email address');
  await expect(page.locator('#was')).toHaveAttribute('aria-invalid', 'true');
  await page.fill('#email', 'karim.mansour@gmail.com');
  await expect(page.locator('#email')).not.toHaveAttribute('aria-invalid', 'true');
  await fillReach(page); await next(page, 'reach');
  // the second contact: only a number, in Arabic-Indic digits - asked for the rest, never silently dropped
  await emContact(page, 'em');
  await page.click('#em2-add');
  await page.fill('#em2-phone', '٠٥٥٩٨٧٦٥٤١');
  await page.click('#next');
  await expect(page.locator('#f-em2-name .err')).not.toHaveText('');
  await expect(scr(page, 'emergency')).toBeVisible();
  expect(of('customer_signup')).toHaveLength(0);
});

// One sign-in for every account form (forms/shared/account.js, the owner, 2026-10-25): a temporary password is
// changed on the booking site first, and a number typed without its code that is not a Saudi mobile says so.
test('the shared sign-in: a temporary password goes to the booking site first; a foreign number without its code is said', async ({ page }) => {
  let temp = true;
  const { of } = await open(page, '?lang=en', {
    customer_login: (b) => json(String(b.p_identifier).startsWith('+966') && String(b.p_identifier).length > 13 ? [] : [{ id: 'c-karim', name: 'Karim Mansour', session_token: 'tok-in' }]),
    customer_pwd_state: () => json(temp),
  }, null, true);
  await page.click('#haves .tile[data-v="yes"]');
  await expect(page.locator('#f-lid label')).toHaveText('Email or phone');
  await page.fill('#lid', 'Karim.Mansour@Gmail.com');
  await page.click('#login');
  await expect(page.locator('#f-lpw .err')).toHaveText('Enter your password.');
  await page.fill('#lpw', 'Temp12345');
  await page.click('#login');
  await expect(page.locator('#si-temp')).toBeVisible();
  await expect(page.locator('#si-temp-a')).toHaveAttribute('href', 'https://experiences.micromobility.sa/?handoff=community&lang=en');
  await expect(step(page, 2)).toBeHidden();
  expect(of('customer_login')[0]).toEqual({ p_identifier: 'karim.mansour@gmail.com', p_pwd: 'Temp12345' });
  expect(of('customer_pwd_state')).toEqual([{ p_id: 'c-karim', p_token: 'tok-in' }]);
  // a number from abroad typed without its code: not found as a Saudi number, and the message says so
  await page.fill('#lid', '1001234567');
  await page.fill('#lpw', 'Secret123');
  await page.click('#login');
  await expect(page.locator('#f-lpw .err')).toContainText('No account has that number as a Saudi number');
  // a password of their own: in
  temp = false;
  await page.fill('#lid', '0552468013');
  await page.click('#login');
  await expect(step(page, 2)).toBeVisible();
  await expect(page.locator('#si-temp')).toBeHidden();
});

// What was typed stays on this device for three days (the owner, 2026-10-25): a reload puts it back, an account made
// here signs in again and finds its membership answers, Start over and sending take it away.
test('answers kept on this device: a reload puts them back on their screen, never a password; Start over clears them', async ({ page }) => {
  await open(page, '?lang=en');
  await toPassword(page);
  await page.fill('#pwd', 'corniche rides');
  await page.waitForTimeout(500);
  const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('mm-community-draft') || 'null'));
  expect(kept.data.v.first).toBe('karim');
  expect(kept.data.v['em-name']).toBe('Layla Mansour');
  expect(kept.data.v).not.toHaveProperty('pwd'); // never a password
  expect(JSON.stringify(kept)).not.toContain('corniche rides');
  await page.reload();
  await expect(scr(page, 'password')).toBeVisible();
  await expect(page.locator('#draft-note')).toBeVisible();
  await expect(page.locator('#pwd')).toHaveValue('');
  await expect(page.locator('#ack')).toHaveAttribute('aria-checked', 'false'); // never a tick of the notice
  await page.click('#back'); await page.click('#back'); await page.click('#back');
  await expect(scr(page, 'about')).toBeVisible();
  await expect(page.locator('#first')).toHaveValue('karim');
  await expect(page.locator('#genders .tile[data-v="male"]')).toHaveAttribute('aria-checked', 'true');
  await page.click('#draft-clear');
  await expect(scr(page, 'gate')).toBeVisible();
  await expect(page.locator('#first')).toHaveValue('');
  expect(await page.evaluate(() => localStorage.getItem('mm-community-draft'))).toBeNull();
});

test('an account made here, the tab closed on the membership step: signing in again brings the answers back', async ({ page }) => {
  const { of } = await open(page, '?lang=en', {
    customer_login: () => json([{ id: 'c-new', name: 'Karim Mansour', session_token: 'tok-again' }]),
    customer_pwd_state: () => json(false),
    customer_community_me: () => json({ ...ME, flags: [] }),
  });
  await accountStep(page);
  await pickNat(page, 'Egypt');
  await typeBirth(page, '12', '3', '1994');
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await page.reload();
  await expect(scr(page, 'gate')).toBeVisible();
  await expect(page.locator('#login-box')).toBeVisible();
  await expect(page.locator('#draft-made')).toBeVisible();
  await expect(page.locator('#lid')).toHaveValue('karim.mansour@gmail.com');
  await page.fill('#lpw', 'Secret123');
  await page.click('#login');
  await expect(step(page, 2)).toBeVisible();
  await expect(page.locator('#nat')).toHaveValue('Egypt');
  await expect(page.locator('#birth-d')).toHaveValue('12');
  await apply(page);
  expect(await page.evaluate(() => localStorage.getItem('mm-community-draft'))).toBeNull(); // sent: gone
  expect(of('customer_signup')).toHaveLength(1); // the account made once, never twice
});

test('a friend who came by a member\'s link: the application is sent, then says who invited them, and the code is used once', async ({ page }) => {
  const { errs, of, calls } = await open(page, '?inv=abcdef0123456789');
  await accountStep(page);
  await apply(page);
  expect(of('community_app_invited')).toEqual([{ p_id: expect.any(String), p_token: 'tok-new', p_code: 'abcdef0123456789' }]);
  const names = calls.map((c) => c.fn);
  expect(names.indexOf('customer_community_apply')).toBeLessThan(names.indexOf('community_app_invited'));
  expect(await page.evaluate(() => localStorage.getItem('mm-community-inv'))).toBeNull();
  expect(errs).toEqual([]);
});

test('no link, or a code that is not one: nothing is said about an invitation', async ({ page }) => {
  const { of } = await open(page, '?inv=<script>');
  await accountStep(page);
  await apply(page);
  expect(of('community_app_invited')).toEqual([]);
});

// Where applicants leave the form (the owner's B1): anonymous counts only.
test('the anonymous counts carry screens, questions and reasons, never an answer', async ({ page }) => {
  const { of } = await open(page, '?lang=en');
  await page.click('#next'); // a refused Continue
  await accountStep(page);
  await through(page);
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide'))); // where they would have left
  await page.click('#next');
  await expect(page.locator('#success')).toBeVisible();
  type Ev = Record<string, string>;
  const events = () => of('community_form_log').flatMap((b) => b.p_events as Ev[]);
  await expect.poll(() => events().some((e) => e.kind === 'sent')).toBe(true);
  const bodies = of('community_form_log');
  for (const b of bodies) {
    expect(Object.keys(b).sort()).toEqual(['p_events', 'p_session']);
    expect(b.p_session).toMatch(/^[a-z0-9]{8,24}$/);
  }
  expect(new Set(bodies.map((b) => b.p_session)).size).toBe(1);
  const all = events();
  expect([...new Set(all.map((e) => e.kind))].sort()).toEqual(['done', 'error', 'leave', 'made', 'open', 'screen', 'sent']);
  const KEYS = ['kind', 'lang', 'device', 'screen', 'field', 'code'];
  for (const e of all) {
    expect(Object.keys(e).filter((x) => !KEYS.includes(x)), JSON.stringify(e)).toEqual([]);
    const text = Object.values(e).join(' ').toLowerCase();
    for (const pii of ['karim', 'mansour', 'gmail', '552468013', '0552', '551234567', 'layla', 'egypt', 'architect', 'aramco', 'ride2work']) expect(text, JSON.stringify(e)).not.toContain(pii);
  }
  expect(all.filter((e) => e.kind === 'error').map((e) => e.field)).toEqual(['name', 'gender', 'height']);
  expect(all.find((e) => e.kind === 'error')).toMatchObject({ screen: 'about', lang: 'en', device: 'phone' });
  expect(all.find((e) => e.kind === 'leave')).toMatchObject({ screen: 'check' });
});

// Where an application is (the owner, 2026-10-25): the thank-you card's link, community_track, the steps.
const TRACK = 'cd'.repeat(24);
test('the thank-you card links to the status page, which says where the application is and what was asked', async ({ page }) => {
  const { of } = await open(page, '?lang=en', {
    customer_community_apply: () => json({ ok: true, updated: false, track: TRACK }),
  });
  await accountStep(page);
  await apply(page);
  await expect(page.locator('#track-link')).toBeVisible();
  await expect(page.locator('#track-link')).toHaveAttribute('href', new RegExp(`/community/registration\\?track=${TRACK}&lang=en$`));
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('mm-community-track') || '{}').t)).toBe(TRACK);
  expect(of('customer_community_apply')).toHaveLength(1);

  // the status page: changes asked, with the link to make them
  const t2 = await page.context().newPage();
  const tr = await open(t2, `?track=${TRACK}&lang=en`, {
    community_track: () => json({ ok: true, first: 'Karim', lang: 'en', status: 'pending', sent_at: '2026-10-20T08:00:00Z', updated_at: null, decided_at: null,
      fix: { asked_at: '2026-10-21T08:00:00Z', fields: ['instagram', 'workplace'], note: 'Your handle has a typo', token: 'ef'.repeat(18) }, fix_done_at: null, ride: null }),
  }, null, true);
  await expect(t2.locator('#track')).toBeVisible();
  await expect(t2.locator('#form')).toBeHidden();
  await expect(t2.locator('#track-title')).toHaveText('Karim, your application');
  await expect(t2.locator('#track-sent')).toContainText('Sent on');
  await expect(t2.locator('#track-steps .tk-step b')).toHaveText(['Received', 'Changes asked', 'With our team']);
  await expect(t2.locator('#track-steps .tk-now')).toContainText('Instagram, Company');
  await expect(t2.locator('#track-steps .tk-note')).toHaveText('Your handle has a typo');
  await expect(t2.locator('#track-acts a').first()).toHaveAttribute('href', `https://experiences.micromobility.sa/?appfix=${'ef'.repeat(18)}&lang=en`);
  expect(tr.of('community_track')).toEqual([{ p_token: TRACK }]);
  expect(tr.of('community_form_log')).toEqual([]); // the status page counts nothing
  expect(tr.errs).toEqual([]);
});

test('the status page: invited to a ride, not approved, a link that leads nowhere, and Arabic', async ({ page }) => {
  let answer: unknown = { ok: true, first: 'Karim', lang: 'en', status: 'invited', sent_at: '2026-10-20T08:00:00Z', updated_at: '2026-10-22T08:00:00Z', decided_at: '2026-10-23T08:00:00Z',
    fix: null, fix_done_at: '2026-10-22T08:00:00Z', ride: { date: '2026-10-31', day: 'Saturday', title: null, time: '05:45 - 06:15', cancelled: false } };
  await open(page, `?track=${TRACK}&lang=en`, { community_track: () => json(answer) }, null, true);
  await expect(page.locator('#track-steps .tk-step b')).toHaveText(['Received', 'Changes sent', 'Invited to a ride']);
  await expect(page.locator('#track-steps .tk-step').last()).toContainText('Saturday, 31 October 2026');
  await expect(page.locator('#track-steps .tk-step').last()).toContainText('05:45 - 06:15');
  await expect(page.locator('#track-steps .tk-step').last()).toContainText('Your place is in Bookings on the booking site.'); // the booking app's tab, "Bookings" since its rider round two
  await expect(page.locator('#track-acts a').first()).toHaveText('Open the booking site');
  answer = { ok: true, first: 'Karim', lang: 'en', status: 'rejected', sent_at: '2026-10-20T08:00:00Z', updated_at: null, decided_at: '2026-10-23T08:00:00Z', fix: null, fix_done_at: null, ride: null };
  await page.reload();
  await expect(page.locator('#track-steps .tk-end b')).toHaveText('Not approved this time');
  await expect(page.locator('#track-acts a')).toHaveText(['WhatsApp us']);
  // changes asked and never made, then decided: the request is no step any more, and no link leads to a page that
  // can only say the application is gone (2026-11-10 bug hunt)
  answer = { ok: true, first: 'Karim', lang: 'en', status: 'rejected', sent_at: '2026-10-20T08:00:00Z', updated_at: null, decided_at: '2026-10-23T08:00:00Z',
    fix: { asked_at: '2026-10-21T08:00:00Z', fields: ['instagram'], note: null, token: 'ef'.repeat(18) }, fix_done_at: null, ride: null };
  await page.reload();
  await expect(page.locator('#track-steps .tk-step b')).toHaveText(['Received', 'Not approved this time']);
  await expect(page.locator('#track-acts a')).toHaveText(['WhatsApp us']);
  answer = { ...(answer as Record<string, unknown>), status: 'approved' };
  await page.reload();
  await expect(page.locator('#track-steps .tk-step b')).toHaveText(['Received', 'Approved']);
  await expect(page.locator('#track-acts a').first()).toHaveText('Open the booking site');
  answer = { ok: false, error: 'gone' };
  await page.reload();
  await expect(page.locator('#track-err')).toHaveText('We could not find this application. The link may be incomplete.');
  answer = { ok: true, first: 'كريم', lang: 'ar', status: 'approved', sent_at: '2026-10-20T08:00:00Z', updated_at: null, decided_at: '2026-10-23T08:00:00Z', fix: null, fix_done_at: null, ride: null };
  await page.goto(`/community/registration?track=${TRACK}&lang=ar`);
  await expect(page.locator('#track-title')).toHaveText('كريم، هذا طلبك');
  await expect(page.locator('#track-steps .tk-done b').last()).toHaveText('تمت الموافقة');
});

test('a signed-in account with a waiting application is given its status page; this device names one sent before', async ({ page }) => {
  await open(page, `?code=${CODE}&lang=en`, { customer_community_me: () => json({ ...ME, pending: true, track: TRACK }) });
  await expect(step(page, 2)).toBeVisible();
  await expect(page.locator('#acct-pending')).toContainText('You sent an application before. Sending again updates it.');
  await expect(page.locator('#acct-pending-a')).toBeVisible();
  await expect(page.locator('#acct-pending-a')).toHaveAttribute('href', new RegExp(`\\?track=${TRACK}&lang=en$`));
  const p2 = await page.context().newPage();
  await p2.addInitScript((tok) => { try { localStorage.setItem('mm-community-track', JSON.stringify({ t: tok, at: Date.parse('2026-10-20T08:00:00Z') })); } catch (e) { /* none */ } }, TRACK);
  await open(p2, '?lang=en', {}, null, true);
  await expect(p2.locator('#track-seen')).toBeVisible();
  await expect(p2.locator('#track-seen-txt')).toHaveText('You sent an application on 20 October 2026.');
  await p2.click('#haves .tile[data-v="no"]');
  await expect(p2.locator('#track-seen')).toBeHidden();
});

test('a phone that lays out en-CA dates as 10/27/2026 still takes a typed birth date and sends (an iOS 17.2 iPhone, 2026-10-27)', async ({ page }) => {
  // That iPhone's Intl ignored en-CA's year-first layout: the birth date's limits came out wrong and every
  // Send application was refused.
  await page.addInitScript(() => {
    const Real = Intl.DateTimeFormat, us = (l: unknown) => (l === 'en-CA' ? 'en-US' : l) as string;
    const Fake = function (l?: string, o?: Intl.DateTimeFormatOptions) { return new Real(us(l), o); } as unknown as typeof Intl.DateTimeFormat;
    Object.assign(Fake, { supportedLocalesOf: Real.supportedLocalesOf, prototype: Real.prototype });
    Intl.DateTimeFormat = Fake;
    const tl = Date.prototype.toLocaleDateString;
    Date.prototype.toLocaleDateString = function (l?: string | string[], o?: Intl.DateTimeFormatOptions) { return tl.call(this, us(l), o); };
  });
  const { errs, of } = await open(page, `?code=${CODE}&lang=en`);
  expect(await page.evaluate(() => new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(2026, 9, 27)))).toBe('10/27/2026');
  await expect(step(page, 2)).toBeVisible();
  await typeBirth(page, '1', '1', String(ksaYear() - 4));
  await page.click('#next');
  await expect(page.locator('#f-birth .err')).toHaveText('Riders must be at least 5 years old. Check the birth date.');
  await apply(page);
  expect(of('customer_community_apply')).toEqual([{ p_id: 'c-karim', p_token: 'tok-handed', p: expect.objectContaining({ birth_date: '1994-03-12' }) }]);
  expect(errs).toEqual([]);
});
