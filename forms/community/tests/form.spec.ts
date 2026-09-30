import { test, expect, type Page } from '@playwright/test';

// The community membership application, end to end in a browser with every database call stubbed.
// Step 1 is the booking site's own sign-up and makes the account (customer_exists, customer_signup,
// customer_consents); step 2 sends the community questions from that account
// (customer_community_apply). A rider the booking site hands over signed in (?code=) starts on
// step 2 (customer_handoff_redeem, customer_community_me). Every field is checked the way the booking
// site's staff checks look at accounts.
const json = (b: unknown) => ({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' }, body: JSON.stringify(b) });
const refuse = (b: unknown, status = 400) => ({ ...json(b), status });
type Call = { fn: string; body: Record<string, unknown> };
type Answers = Partial<Record<string, (body: Record<string, unknown>) => ReturnType<typeof json>>>;
const CODE = 'ab'.repeat(24);
const ME = { name: 'Karim Mansour', email: 'karim.mansour@gmail.com', phone: '+966552468013', member: false, pending: false, gender: 'male', height: 178,
  birth_date: null, nationality: null, instagram: null, linkedin: null, profession: null, workplace: null, bike_type: null, heard_from: null };

async function open(page: Page, qs = '', answers: Answers = {}) {
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(e.message));
  const calls: Call[] = [];
  const base: Answers = {
    customer_exists: () => json(false),
    customer_signup: (b) => json([{ id: b.p_id, session_token: 'tok-new' }]),
    customer_consents: () => json({ privacy_version: '2026-09-28', ride_news: true }),
    customer_community_apply: () => json({ ok: true, updated: false }),
    customer_handoff_redeem: () => json([{ id: 'c-karim', name: 'Karim Mansour', session_token: 'tok-handed' }]),
    customer_community_me: () => json(ME),
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
  const of = (fn: string) => calls.filter((c) => c.fn === fn).map((c) => c.body);
  return { errs, calls, of };
}
async function accountStep(page: Page, o: { first?: string; last?: string; phone?: string; email?: string; pwd?: string; pwd2?: string; height?: string; ack?: boolean; news?: boolean } = {}) {
  await page.fill('#first', o.first ?? 'karim');
  await page.fill('#last', o.last ?? 'mansour');
  await page.click('#genders .tile[data-v="male"]');
  await page.fill('#email', o.email ?? 'Karim.Mansour@gmail.com');
  await page.fill('#phone', o.phone ?? '0552468013');
  await page.fill('#pwd', o.pwd ?? 'Ride2Work');
  await page.fill('#pwd2', o.pwd2 ?? o.pwd ?? 'Ride2Work');
  await page.fill('#height', o.height ?? '178');
  if (o.ack !== false && (await page.locator('#ack').getAttribute('aria-checked')) !== 'true') await page.click('#ack .tick-box');
  if (o.news && (await page.locator('#news').getAttribute('aria-checked')) !== 'true') await page.click('#news .tick-box');
  await page.click('#next');
}
async function communityStep(page: Page, o: { heard?: string; type?: string; work?: string; own?: string } = {}) {
  await page.selectOption('#birth-y', '1994');
  await page.selectOption('#birth-m', '3');
  await page.selectOption('#birth-d', '12');
  await page.selectOption('#nat', 'Egypt');
  await page.fill('#ig', 'https://www.instagram.com/karim.rides/?hl=en');
  await page.fill('#li', 'https://sa.linkedin.com/in/karim-mansour-arch/');
  await page.fill('#prof', 'Architect');
  await page.fill('#work', o.work ?? '  Saudi   Aramco ');
  if (o.own !== '') await page.click(`#owns .tile[data-v="${o.own ?? 'yes'}"]`);
  await page.click(`#types .tile[data-v="${o.type ?? 'Road'}"]`);
  if (o.heard !== '') await page.selectOption('#heard', o.heard ?? 'instagram');
}
const step = (page: Page, n: number) => page.locator(`fieldset.step[data-step="${n}"]`);

test('step 1 makes the account, says so, and step 2 sends the community answers from it', async ({ page }) => {
  const { errs, of } = await open(page);
  await expect(page.locator('.title').first()).toHaveText('Community Membership Application');
  await expect(page.locator('.stepper-label')).toHaveText(['Your account', 'Membership']);
  await expect(page.locator('#next .submit-label')).toHaveText('Create account');
  await accountStep(page, { news: true });
  await expect(step(page, 2)).toBeVisible();
  await expect(step(page, 1)).toBeHidden();
  await expect(page.locator('#acct-made')).toBeVisible();
  await expect(page.locator('#acct-made .acct-title')).toHaveText('Your account has been created');
  await expect(page.locator('#acct-made .acct-sub')).toContainText('sign in and book rides with your email or mobile number and your password');
  await expect(page.locator('#acct-who')).toBeHidden();
  // Each id asked on its own (the message says which one is taken), then the sign-up and the consents.
  expect(of('customer_exists')).toEqual([{ p_email: 'karim.mansour@gmail.com', p_phone: '' }, { p_email: '', p_phone: '+966552468013' }]);
  const su = of('customer_signup');
  expect(su).toEqual([{ p_id: expect.stringMatching(/^[a-z0-9]{8,20}$/), p_name: 'Karim Mansour', p_email: 'karim.mansour@gmail.com', p_phone: '+966552468013',
    p_pwd: 'Ride2Work', p_height: 178, p_type_preference: 'Any', p_gender: 'male' }]);
  expect(of('customer_consents')).toEqual([{ p_id: su[0].p_id, p_token: 'tok-new', p_privacy: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), p_ride_news: true }]);
  // No way back to the account step: it would make a second account.
  await expect(page.locator('#back')).toHaveCount(0);
  await expect(page.locator('#next')).toBeHidden();
  await communityStep(page);
  await page.click('#submit');
  await expect(page.locator('#success')).toBeVisible();
  await expect(page.locator('#result')).toHaveText('Thank you, Karim. Our team will review your application and reply to you shortly.');
  await expect(page.locator('#result-contact')).toContainText('+966552468013');
  expect(of('customer_community_apply')).toEqual([{ p_id: su[0].p_id, p_token: 'tok-new', p: {
    birth_date: '1994-03-12', nationality: 'Egypt', bike_type: 'Road', own_bike: true, instagram: 'karim.rides', linkedin: 'karim-mansour-arch',
    profession: 'Architect', workplace: 'Saudi Aramco', heard_from: 'instagram', lang: 'en', privacy_version: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
  } }]);
  expect(errs).toEqual([]);
});

test('the account step asks what the sign-up page asks, with its rules and words', async ({ page }) => {
  const { of } = await open(page);
  await expect(page.locator('#f-name label')).toHaveText(['First Name', 'Last Name']);
  await expect(page.locator('#f-pwd label')).toHaveText('Password');
  await expect(page.locator('#f-pwd .hint')).toHaveText('At least 8 characters, with an uppercase letter and a number.');
  await expect(page.locator('#f-pwd2 label')).toHaveText('Confirm Password');
  for (const pwd of ['Short1', 'nouppercase1', 'NoDigitsHere']) {
    await accountStep(page, { pwd });
    await expect(page.locator('#f-pwd .err')).toHaveText('Password must be at least 8 characters and include an uppercase letter and a number.');
  }
  await accountStep(page, { pwd: 'Ride2Work', pwd2: 'Ride2Walk' });
  await expect(page.locator('#f-pwd .err')).toHaveText('');
  await expect(page.locator('#f-pwd2 .err')).toHaveText('Passwords do not match.');
  expect(of('customer_signup')).toEqual([]);
});

test('the Privacy Notice is confirmed on the account step, and ride news is optional', async ({ page }) => {
  const { of } = await open(page);
  await accountStep(page, { ack: false });
  await expect(page.locator('#f-ack .err')).toHaveText('Please confirm you’ve read the Privacy Notice.');
  expect(of('customer_signup')).toEqual([]);
  await page.click('#ack .tick-box');
  await page.click('#next');
  await expect(step(page, 2)).toBeVisible();
  expect(of('customer_consents')[0].p_ride_news).toBe(false);
});

test('an email or mobile that already has an account: said on the field, with Sign in', async ({ page }) => {
  let taken = 'email';
  const { of } = await open(page, '', { customer_exists: (b) => json(taken === 'email' ? b.p_email !== '' : b.p_phone !== '') });
  await accountStep(page);
  await expect(page.locator('#f-email .err')).toHaveText('An account with this email already exists. Sign in to apply with it.');
  await expect(page.locator('#banner-signin')).toBeVisible();
  await expect(page.locator('#banner-signin')).toHaveAttribute('href', 'https://micromobilityrentals.pages.dev/?handoff=community&lang=en');
  taken = 'phone';
  await page.click('#next');
  await expect(page.locator('#f-phone .err')).toHaveText('An account with this mobile number already exists. Sign in to apply with it.');
  expect(of('customer_signup')).toEqual([]);
  await expect(step(page, 1)).toBeVisible();
});

test('"Already have an account? Sign in" goes to the booking site, which hands the rider back here', async ({ page }) => {
  await open(page, '?lang=ar');
  await expect(page.locator('.have-acct')).toContainText('لديك حساب بالفعل؟');
  await expect(page.locator('#signin-link')).toHaveText('تسجيل الدخول');
  await expect(page.locator('#signin-link')).toHaveAttribute('href', 'https://micromobilityrentals.pages.dev/?handoff=community&lang=ar');
  await page.selectOption('#lang', 'fr');
  await expect(page.locator('#signin-link')).toHaveAttribute('href', 'https://micromobilityrentals.pages.dev/?handoff=community&lang=fr');
});

test('a sign-up the database refuses says why, on the field or in the banner', async ({ page }) => {
  let answer = refuse({ code: 'P0001', message: 'name_short' });
  await open(page, '', { customer_signup: () => answer });
  await accountStep(page);
  await expect(page.locator('#f-name .err')).toHaveText('Write your first and last name in full, not initials');
  answer = refuse({ code: 'P0001', message: 'RATE_LIMITED' });
  await page.click('#next');
  await expect(page.locator('#banner .banner-text')).toHaveText('Too many tries from this network. Please wait a few minutes and try again.');
  answer = refuse({ code: '23505', message: 'DUPLICATE' }, 409);
  await page.click('#next');
  await expect(page.locator('#f-email .err')).toHaveText('An account with this email already exists. Sign in to apply with it.');
  await expect(step(page, 1)).toBeVisible();
});

test('names: first and last, letters and periods only, no initials, one alphabet', async ({ page }) => {
  await open(page);
  const err = page.locator('#f-name .err');
  for (const [first, last, msg] of [
    ['Karim', '', 'Enter your first and last name'],
    ['K', 'Mansour', 'Write your first and last name in full, not initials'],
    ['Karim A', 'Mansour', 'Write your first and last name in full, not initials'],
    ['J.R.', 'Mansour', 'Write your first and last name in full, not initials'],
    ['Karim', 'منصور', 'Write your name in one alphabet'],
    ['Test', 'User', 'Please enter your real name'],
  ]) {
    await accountStep(page, { first, last });
    await expect(err).toHaveText(msg);
  }
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
});

test('phones: Saudi mobiles only on +966, the mobile rules elsewhere, and a paste with its code', async ({ page }) => {
  await open(page);
  const err = page.locator('#f-phone .err');
  await expect(page.locator('#phone')).toHaveAttribute('placeholder', '5X XXX XXXX');
  await page.fill('#phone', '+966552468013');
  await expect(page.locator('#phone')).toHaveValue('55 246 8013');
  await accountStep(page, { phone: '0112345678' });
  await expect(err).toHaveText('Enter a valid Saudi mobile number (5XXXXXXXX)');
  expect(await page.locator('#cc option').count()).toBeGreaterThan(200);
  await expect(page.locator('#cc option[value="EG+20"]')).toHaveText('🇪🇬 Egypt (+20)');
  await expect(page.locator('#cc option[value="PS+970"]')).toHaveText('🇵🇸 Palestine (+970)');
  await expect(page.locator('#cc option[value="PS+972"]')).toHaveText('🇵🇸 Palestine (+972)');
  await page.fill('#phone', '+972 59 123 4865');
  await expect(page.locator('#cc')).toHaveValue('PS+972');
  await expect(page.locator('#cc-flag')).toHaveText('🇵🇸');
  await page.fill('#phone', '+20 22 345 6789'); // a Cairo landline
  await page.click('#next');
  await expect(err).toHaveText('This is not a mobile number for +20. Please check it.');
  await page.fill('#phone', '+20 106 482 9153');
  await page.click('#next');
  await expect(step(page, 2)).toBeVisible();
});

test('emails: a misspelt provider is refused with a one-tap fix; throwaway and relay addresses are refused', async ({ page }) => {
  await open(page);
  const err = page.locator('#f-email .err');
  await accountStep(page, { email: 'karim@gmail.con' });
  await expect(err).toHaveText('Did you mean karim@gmail.com?');
  await page.click('#email-fix');
  await expect(page.locator('#email')).toHaveValue('karim@gmail.com');
  await accountStep(page, { email: 'karim@mailinator.com' });
  await expect(err).toHaveText('Please use your own, permanent email address');
  await accountStep(page, { email: 'abc123@privaterelay.appleid.com' });
  await expect(err).toHaveText('Please use your own email address, not an Apple hidden (relay) address');
  await accountStep(page, { email: 'karim@gmail' });
  await expect(err).toHaveText('Enter a valid email address');
});

test('a soft warning is said once; pressing the button again goes on', async ({ page }) => {
  const { of } = await open(page);
  await accountStep(page, { height: '212' });
  await expect(page.locator('#f-height .warn')).toHaveText('Is 212 cm right? If it is right, press the button again.');
  expect(of('customer_signup')).toEqual([]);
  await page.click('#next');
  await expect(step(page, 2)).toBeVisible();
  expect(of('customer_signup')[0].p_height).toBe(212);
});

test('LinkedIn must be a personal profile, Instagram a real username; both may be left empty, and nothing says so', async ({ page }) => {
  const { of } = await open(page);
  await accountStep(page);
  await expect(page.locator('body')).not.toContainText(/optional/i);
  await communityStep(page);
  await page.fill('#ig', 'karim rides!');
  await page.fill('#li', 'https://www.linkedin.com/company/micromobility');
  await page.click('#submit');
  await expect(page.locator('#f-ig .err')).toHaveText('An Instagram username has only letters, numbers, dots and underscores');
  await expect(page.locator('#f-li .err')).toHaveText('Paste the link to your own profile (linkedin.com/in/…)');
  await page.fill('#ig', ''); await page.fill('#li', '');
  await page.click('#submit');
  await expect(page.locator('#success')).toBeVisible();
  const p = of('customer_community_apply')[0].p as Record<string, unknown>;
  expect([p.instagram, p.linkedin]).toEqual(['', '']);
});

test('the Privacy Notice opens from the confirmation box without ticking it', async ({ page }) => {
  await open(page);
  await page.click('#pv-open');
  await expect(page.locator('#pv .pv-box')).toBeVisible();
  await expect(page.locator('#pv-body')).toContainText('community membership application');
  await page.keyboard.press('Escape');
  await expect(page.locator('#pv')).toBeHidden();
  await expect(page.locator('#ack')).toHaveAttribute('aria-checked', 'false');
});

test('company: required, beside the profession, and in the page language', async ({ page }) => {
  const { errs, of } = await open(page);
  await accountStep(page);
  await expect(page.locator('#f-work label')).toHaveText('Company');
  await expect(page.locator('#f-work .hint')).toHaveText('The company you work for');
  await communityStep(page, { work: '' });
  await page.click('#submit');
  await expect(page.locator('#f-work .err')).toHaveText('Enter your company');
  for (const bad of ['x', '12345', '<b>Aramco</b>', '--- ...']) {
    await page.fill('#work', bad);
    await expect(page.locator('#f-work .err')).toHaveText('');
    await page.click('#submit');
    await expect(page.locator('#f-work .err')).toHaveText('Enter your company');
  }
  expect(of('customer_community_apply')).toEqual([]);
  await page.selectOption('#lang', 'ar');
  await expect(page.locator('#f-work label')).toHaveText('الشركة');
  await expect(page.locator('#f-work .err')).toHaveText('أدخل اسم شركتك');
  await page.fill('#work', 'جامعة الملك عبدالعزيز');
  await page.click('#submit');
  await expect(page.locator('#success')).toBeVisible();
  expect((of('customer_community_apply')[0].p as Record<string, unknown>).workplace).toBe('جامعة الملك عبدالعزيز');
  expect(errs).toEqual([]);
});

test('how they heard of us: every answer the booking site knows, required, in the page language', async ({ page }) => {
  const { errs } = await open(page);
  await accountStep(page);
  await communityStep(page, { heard: '' });
  const opts = page.locator('#heard option');
  expect(await opts.evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value))).toEqual(['', 'instagram', 'tiktok', 'snapchat', 'x', 'facebook', 'youtube', 'whatsapp', 'google', 'friend', 'invited', 'passed_by', 'event', 'hotel', 'school', 'work', 'community', 'other']);
  await page.click('#submit');
  await expect(page.locator('#f-heard .err')).toHaveText('Please tell us how you heard about us.');
  await expect(page.locator('#heard option[value="invited"]')).toHaveText('Invited by MicroMobility');
  await page.selectOption('#heard', 'passed_by');
  await page.selectOption('#lang', 'ar');
  await expect(page.locator('#f-heard label')).toHaveText('كيف عرفت عنا؟');
  await expect(page.locator('#heard')).toHaveValue('passed_by');
  expect(errs).toEqual([]);
});

test('a server answer about a community field goes back to that field', async ({ page }) => {
  let error = 'workplace';
  await open(page, '', { customer_community_apply: () => json({ ok: false, error }) });
  await accountStep(page);
  await communityStep(page);
  for (const [e, field, msg] of [['workplace', 'f-work', 'Enter your company'], ['heard_from', 'f-heard', 'Please tell us how you heard about us.'], ['birth_date', 'f-birth', 'Choose your date of birth']]) {
    error = e;
    await page.click('#submit');
    await expect(page.locator(`#${field} .err`)).toHaveText(msg);
  }
  error = 'signed_out';
  await page.click('#submit');
  await expect(page.locator('#banner .banner-text')).toHaveText('You were signed out. Sign in again to send your application.');
  await expect(page.locator('#banner-signin')).toBeVisible();
});

// Arriving signed in: the booking site's "Sign in" from here, or the Apply button of its
// members-only popup, sends the rider back with a one-time code.
test('arriving signed in starts on step 2: who is applying, their answers so far, and no account step', async ({ page }) => {
  const { errs, of } = await open(page, `?code=${CODE}&lang=en`, {
    customer_community_me: () => json({ ...ME, pending: true, birth_date: '1994-03-12', nationality: 'Egypt', profession: 'Architect', workplace: 'Saudi Aramco', bike_type: 'Hybrid', own_bike: false, heard_from: 'friend', instagram: 'karim.rides' }),
  });
  await expect(step(page, 2)).toBeVisible();
  await expect(step(page, 1)).toBeHidden();
  expect(new URL(page.url()).search).toBe('?lang=en'); // the code leaves the address at once
  expect(of('customer_handoff_redeem')).toEqual([{ p_code: CODE }]);
  expect(of('customer_community_me')).toEqual([{ p_id: 'c-karim', p_token: 'tok-handed' }]);
  await expect(page.locator('#acct-made')).toBeHidden();
  await expect(page.locator('#acct-who')).toHaveText('Applying as Karim Mansour · ⁦karim.mansour@gmail.com⁩');
  await expect(page.locator('#acct-pending')).toBeVisible();
  await expect(page.locator('#birth-y')).toHaveValue('1994');
  await expect(page.locator('#birth-d')).toHaveValue('12');
  await expect(page.locator('#nat')).toHaveValue('Egypt');
  await expect(page.locator('#types .tile[data-v="Hybrid"]')).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('#owns .tile[data-v="no"]')).toHaveAttribute('aria-checked', 'true'); // their earlier answer
  await expect(page.locator('#heard')).toHaveValue('friend');
  await expect(page.locator('#f-xgender')).toBeHidden();
  await expect(page.locator('#f-xheight')).toBeHidden();
  await page.click('#submit');
  await expect(page.locator('#success')).toBeVisible();
  expect(of('customer_community_apply')).toEqual([{ p_id: 'c-karim', p_token: 'tok-handed', p: expect.objectContaining({ birth_date: '1994-03-12', bike_type: 'Hybrid', own_bike: false, profession: 'Architect', instagram: 'karim.rides' }) }]);
  expect(of('customer_signup')).toEqual([]);
  expect(errs).toEqual([]);
});

test('an account without a gender or height is asked for them on step 2', async ({ page }) => {
  const { of } = await open(page, `?code=${CODE}`, { customer_community_me: () => json({ ...ME, gender: null, height: null }) });
  await expect(page.locator('#f-xgender')).toBeVisible();
  await expect(page.locator('#f-xheight')).toBeVisible();
  await communityStep(page);
  await page.click('#submit');
  await expect(page.locator('#f-xgender .err')).toHaveText('Choose your gender');
  await expect(page.locator('#f-xheight .err')).toHaveText('Enter your height in cm (100 to 250)');
  await page.click('#xgenders .tile[data-v="female"]');
  await page.fill('#xheight', '165');
  await page.click('#submit');
  await expect(page.locator('#success')).toBeVisible();
  expect(of('customer_community_apply')[0].p).toEqual(expect.objectContaining({ gender: 'female', height: 165 }));
});

test('a member already is told so, and a used or late code asks to sign in again', async ({ page }) => {
  await open(page, `?code=${CODE}`, { customer_community_me: () => json({ ...ME, member: true }) });
  await expect(page.locator('#member')).toBeVisible();
  await expect(page.locator('#member .title')).toHaveText('You are already a community member');
  await expect(page.locator('#member-go')).toHaveAttribute('href', 'https://micromobilityrentals.pages.dev/?lang=en');
  await expect(page.locator('#form')).toBeHidden();

  const late = await page.context().newPage();
  const { of } = await open(late, `?code=${CODE}`, { customer_handoff_redeem: () => json([]) });
  await expect(late.locator('#banner .banner-text')).toHaveText('This sign-in link has expired. Sign in again to continue.');
  await expect(late.locator('#banner-signin')).toBeVisible();
  await expect(step(late, 1)).toBeVisible();
  expect(of('customer_community_me')).toEqual([]);
});

test('Arabic: the account step and the account-made note in the page language', async ({ page }) => {
  const { errs } = await open(page, '?lang=ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('#f-name label')).toHaveText(['الاسم الأول', 'اسم العائلة']);
  await expect(page.locator('#next .submit-label')).toHaveText('إنشاء حساب');
  await accountStep(page, { pwd: 'short' });
  await expect(page.locator('#f-pwd .err')).toHaveText('يجب أن تكون كلمة المرور 8 أحرف على الأقل وتحتوي على حرف كبير ورقم.');
  await page.fill('#pwd', 'Ride2Work'); await page.fill('#pwd2', 'Ride2Work');
  await page.click('#next');
  await expect(page.locator('#acct-made .acct-title')).toHaveText('تم إنشاء حسابك');
  expect(errs).toEqual([]);
});

// The owner, 2026-09-30: "add a new field that has two options ask the registrant if he has a bike or not".
test('step 2 asks whether they have their own bike, and will not go on without an answer', async ({ page }) => {
  const { of } = await open(page);
  await accountStep(page);
  await expect(page.locator('#f-own .label')).toHaveText('Do you have your own bike?');
  await expect(page.locator('#owns .tile')).toHaveText(['Yes, I have one', 'No, not yet']);
  await communityStep(page, { own: '' });
  await page.click('#submit');
  await expect(page.locator('#f-own .err')).toHaveText('Tell us whether you have your own bike');
  expect(of('customer_community_apply')).toEqual([]);
  await page.click('#owns .tile[data-v="no"]');
  await expect(page.locator('#f-own .err')).toHaveText('');
  await page.click('#submit');
  await expect(page.locator('#success')).toBeVisible();
  expect(of('customer_community_apply')[0].p).toMatchObject({ own_bike: false });
});

test('the own-bike question reads in Arabic', async ({ page }) => {
  await open(page, '?lang=ar');
  await accountStep(page);
  await expect(page.locator('#f-own .label')).toHaveText('هل لديك دراجة خاصة بك؟');
  await expect(page.locator('#owns .tile')).toHaveText(['نعم، لديّ دراجة', 'لا، ليس بعد']);
});
