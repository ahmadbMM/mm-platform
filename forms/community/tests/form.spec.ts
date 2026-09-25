import { test, expect, type Page } from '@playwright/test';

// The community membership application, end to end in a browser with community_apply stubbed:
// every field checked the way the booking site's staff checks look at accounts, the consent
// boxes, the payload the server gets, the thank-you screen, and every language.
const json = (b: unknown) => ({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' }, body: JSON.stringify(b) });

async function open(page: Page, qs = '') {
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(e.message));
  const sent: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/rpc/community_apply', async (r) => {
    if (r.request().method() === 'OPTIONS') return r.fulfill(json({}));
    sent.push(JSON.parse(r.request().postData() || '{}'));
    return r.fulfill(json({ ok: true }));
  });
  await page.goto('/community/registration' + qs);
  return { errs, sent };
}
async function stepOne(page: Page, o: { name?: string; height?: string; year?: string } = {}) {
  await page.fill('#name', o.name ?? 'karim mansour');
  await page.selectOption('#birth-y', o.year ?? '1994');
  await page.selectOption('#birth-m', '3');
  await page.selectOption('#birth-d', '12');
  await page.click('#genders .tile[data-v="male"]');
  await page.selectOption('#nat', 'Egypt');
  await page.fill('#height', o.height ?? '178');
  await page.click('#next');
}
async function stepTwo(page: Page, o: { phone?: string; email?: string } = {}) {
  await page.fill('#phone', o.phone ?? '0552468013');
  await page.fill('#email', o.email ?? 'Karim.Mansour@gmail.com');
  await page.fill('#ig', 'https://www.instagram.com/karim.rides/?hl=en');
  await page.fill('#li', 'https://sa.linkedin.com/in/karim-mansour-arch/');
  await page.click('#next');
}

test('a complete application: the payload is clean and the rider is told we will reply', async ({ page }) => {
  const { errs, sent } = await open(page);
  await expect(page.locator('.title').first()).toHaveText('Community Membership Application');
  await stepOne(page);
  await stepTwo(page);
  await page.fill('#prof', 'Architect');
  await page.click('#types .tile[data-v="Road"]');
  await page.click('#submit');
  await expect(page.locator('#f-ack .err')).toHaveText('Please confirm you’ve read the Privacy Notice.');
  expect(sent.length).toBe(0);
  await page.click('#ack .tick-box');
  await page.click('#news .tick-box');
  await page.click('#submit');
  await expect(page.locator('#success')).toBeVisible();
  await expect(page.locator('#result')).toHaveText('Thank you, Karim. Our team will review your application and reply to you shortly.');
  expect(sent).toEqual([{ p: {
    name: 'Karim Mansour', email: 'karim.mansour@gmail.com', phone: '+966552468013', height: 178, birth_date: '1994-03-12',
    gender: 'male', nationality: 'Egypt', bike_type: 'Road', instagram: 'karim.rides', linkedin: 'karim-mansour-arch',
    profession: 'Architect', lang: 'en', privacy_version: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), ride_news: true,
  } }]);
  expect(errs).toEqual([]);
});

test('Mountain is a bike type; the name and phone fields carry no hints', async ({ page }) => {
  const { errs, sent } = await open(page);
  await expect(page.locator('#f-name .hint')).toHaveCount(0);
  await expect(page.locator('#f-phone .hint')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('as on your ID');
  await expect(page.locator('body')).not.toContainText('Not a Saudi number');
  await stepOne(page); await stepTwo(page);
  await expect(page.locator('#types .tile')).toHaveText(['Road', 'Hybrid', 'Mountain']);
  await page.fill('#prof', 'Architect');
  await page.click('#types .tile[data-v="Mountain"]');
  await page.click('#ack .tick-box');
  await page.click('#submit');
  await expect(page.locator('#success')).toBeVisible();
  expect((sent[0].p as Record<string, unknown>).bike_type).toBe('Mountain');
  expect(errs).toEqual([]);
});

test('names: letters only, first and last, no initials, one alphabet', async ({ page }) => {
  await open(page);
  const err = page.locator('#f-name .err');
  for (const [name, msg] of [
    ['Karim', 'Enter your first and last name'],
    ['K Mansour', 'Write your first and last name in full, not initials'],
    ['Karim A Mansour', 'Write your first and last name in full, not initials'], // a middle initial too, since 2026-09-25
    ['Karim منصور', 'Write your name in one alphabet'],
    ['Test User', 'Please enter your real name'],
  ]) {
    await stepOne(page, { name });
    await expect(err).toHaveText(msg);
  }
  await page.fill('#name', 'Karim2 Mansour!');
  await expect(page.locator('#name')).toHaveValue('Karim Mansour'); // dropped as typed
  // A dash is not a name character in the database: one typed becomes a space, as on the site
  await page.fill('#name', 'Karim Al-Mansour');
  await expect(page.locator('#name')).toHaveValue('Karim Al Mansour');
  await expect(err).toHaveText('');
});

test('phones: Saudi mobiles only on +966, the mobile rules elsewhere, and a paste with its code', async ({ page }) => {
  await open(page);
  await stepOne(page);
  const err = page.locator('#f-phone .err');
  await expect(page.locator('#phone')).toHaveAttribute('placeholder', '5X XXX XXXX'); // the example starts with 5, beside +966
  await page.fill('#phone', '+966552468013'); // pasted with its code: the box reads like the example
  await expect(page.locator('#phone')).toHaveValue('55 246 8013');
  await stepTwo(page, { phone: '0112345678' });
  await expect(err).toHaveText('Enter a valid Saudi mobile number (5XXXXXXXX)');
  await stepTwo(page, { phone: '05524680' });
  await expect(err).toHaveText('Enter a valid Saudi mobile number (5XXXXXXXX)');
  // every country is on offer, named in the rider's language; the box shows the flag and code
  expect(await page.locator('#cc option').count()).toBeGreaterThan(200);
  await expect(page.locator('#cc option[value="EG+20"]')).toHaveText('🇪🇬 Egypt (+20)');
  // Palestine answers on +970 and +972: each keeps its own place, with the Palestinian flag
  await expect(page.locator('#cc option[value="PS+970"]')).toHaveText('🇵🇸 Palestine (+970)');
  await expect(page.locator('#cc option[value="PS+972"]')).toHaveText('🇵🇸 Palestine (+972)');
  await expect(page.locator('#cc-code')).toHaveText('+966');
  await page.fill('#phone', '+20 106 482 9153'); // pasted with its code: the picker follows
  await expect(page.locator('#cc')).toHaveValue('EG+20');
  await expect(page.locator('#cc-code')).toHaveText('+20');
  await expect(page.locator('#cc-flag')).toHaveText('🇪🇬');
  await page.fill('#phone', '+972 59 123 4865');
  await expect(page.locator('#cc')).toHaveValue('PS+972');
  await expect(page.locator('#cc-code')).toHaveText('+972');
  await expect(page.locator('#cc-flag')).toHaveText('🇵🇸');
  await page.fill('#phone', '+20 22 345 6789'); // a Cairo landline
  await page.click('#next');
  await expect(err).toHaveText('This is not a mobile number for +20. Please check it.');
  await page.fill('#phone', '+20 106 482 9153');
  await page.click('#next');
  await expect(page.locator('fieldset.step[data-step="3"]')).toBeVisible();
});

test('emails: a misspelt provider is refused with a one-tap fix; throwaway and relay addresses are refused', async ({ page }) => {
  await open(page);
  await stepOne(page);
  const err = page.locator('#f-email .err');
  await stepTwo(page, { email: 'karim@gmail.con' });
  await expect(err).toHaveText('Did you mean karim@gmail.com?');
  await page.click('#email-fix');
  await expect(page.locator('#email')).toHaveValue('karim@gmail.com');
  await stepTwo(page, { email: 'karim@hotmial.com' });
  await expect(err).toHaveText('Did you mean karim@hotmail.com?');
  await stepTwo(page, { email: 'karim@mailinator.com' });
  await expect(err).toHaveText('Please use your own, permanent email address');
  await stepTwo(page, { email: 'abc123@privaterelay.appleid.com' });
  await expect(err).toHaveText('Please use your own email address, not an Apple hidden (relay) address');
  await stepTwo(page, { email: 'karim@gmail' });
  await expect(err).toHaveText('Enter a valid email address');
});

test('a soft warning is said once; Continue again goes on', async ({ page }) => {
  await open(page);
  await stepOne(page, { height: '212' });
  await expect(page.locator('#f-height .warn')).toContainText('Is 212 cm right?');
  await expect(page.locator('fieldset.step[data-step="1"]')).toBeVisible();
  await page.click('#next');
  await expect(page.locator('fieldset.step[data-step="2"]')).toBeVisible();
});

test('LinkedIn must be a personal profile; Instagram a real username', async ({ page }) => {
  await open(page);
  await stepOne(page);
  await page.fill('#phone', '0552468013');
  await page.fill('#email', 'karim.mansour@gmail.com');
  await page.fill('#ig', 'karim rides!');
  await page.fill('#li', 'https://www.linkedin.com/company/micromobility');
  await page.click('#next');
  await expect(page.locator('#f-ig .err')).toHaveText('An Instagram username has only letters, numbers, dots and underscores');
  await expect(page.locator('#f-li .err')).toHaveText('Paste the link to your own profile (linkedin.com/in/…)');
});

test('Instagram and LinkedIn may be left empty, and nothing on the page says so', async ({ page }) => {
  const { errs, sent } = await open(page);
  await expect(page.locator('#f-ig label')).toHaveText('Instagram');
  await expect(page.locator('#f-li label')).toHaveText('LinkedIn');
  await expect(page.locator('body')).not.toContainText(/optional/i);
  await stepOne(page);
  await page.fill('#phone', '0552468013');
  await page.fill('#email', 'karim.mansour@gmail.com');
  await page.click('#next');
  await expect(page.locator('#f-ig .err')).toHaveText('');
  await expect(page.locator('#f-li .err')).toHaveText('');
  await page.fill('#prof', 'Architect');
  await page.click('#types .tile[data-v="Road"]');
  await page.click('#ack .tick-box');
  await page.click('#submit');
  await expect(page.locator('#success')).toBeVisible();
  const p = sent[0].p as Record<string, unknown>;
  expect([p.instagram, p.linkedin]).toEqual(['', '']);
  expect(errs).toEqual([]);
});

test('the Privacy Notice opens from the confirmation box without ticking it', async ({ page }) => {
  await open(page);
  await stepOne(page); await stepTwo(page);
  await page.click('#pv-open');
  await expect(page.locator('#pv .pv-box')).toBeVisible();
  await expect(page.locator('#pv-body')).toContainText('Profession');
  await expect(page.locator('#pv-body')).toContainText('community membership application');
  await page.keyboard.press('Escape');
  await expect(page.locator('#pv')).toBeHidden();
  await expect(page.locator('#ack')).toHaveAttribute('aria-checked', 'false');
});

test('a server answer about a field goes back to that field', async ({ page }) => {
  const { sent } = await open(page);
  await page.unroute('**/rest/v1/rpc/community_apply');
  await page.route('**/rest/v1/rpc/community_apply', (r) => r.fulfill(json({ ok: false, error: 'email' })));
  await stepOne(page); await stepTwo(page);
  await page.fill('#prof', 'Architect'); await page.click('#types .tile[data-v="Hybrid"]'); await page.click('#ack .tick-box');
  await page.click('#submit');
  await expect(page.locator('fieldset.step[data-step="2"]')).toBeVisible();
  await expect(page.locator('#f-email .err')).toHaveText('Enter a valid email address');
  expect(sent.length).toBe(0);
});

for (const lang of ['ar', 'ur', 'fr', 'es', 'pt', 'hi', 'ne', 'bn', 'tl']) {
  test(`the form speaks ${lang}`, async ({ page }) => {
    const { errs } = await open(page, '?lang=' + lang);
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    await expect(page.locator('html')).toHaveAttribute('dir', lang === 'ar' || lang === 'ur' ? 'rtl' : 'ltr');
    const title = await page.locator('#form .title').textContent();
    expect(title).not.toBe('Community Membership Application');
    await page.click('#next'); // empty: every message in this language
    const msg = await page.locator('#f-name .err').textContent();
    expect(msg && msg !== 'Enter your first and last name').toBeTruthy();
    expect(await page.locator('#ack-lbl .pv-link').count()).toBe(1);
    expect(errs).toEqual([]);
  });
}

test('a shared link previews with the Micromobility mark, served from the page path', async ({ page, request }) => {
  await open(page);
  const img = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(img).toBe('https://micromobility.sa/community/registration/og-image.png?v=1');
  const r = await request.get('/community/registration/og-image.png');
  expect(r.status()).toBe(200);
  expect(r.headers()['content-type']).toBe('image/png');
  expect((await r.body()).subarray(1, 4).toString()).toBe('PNG');
});

test('riders from five: the years stop five years back', async ({ page }) => {
  await open(page);
  const Y = Number(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' }).slice(0, 4));
  const years = await page.evaluate(`[...document.querySelectorAll('#birth-y option')].map(o=>o.value).filter(Boolean).map(Number)`) as number[];
  expect(Math.max(...years)).toBe(Y - 5);
});
