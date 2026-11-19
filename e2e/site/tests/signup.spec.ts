import { test, expect, type Page, type Route } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

// Create account and Forgot password on micromobility.sa itself (the user, 2026-11-19: "make sure all customers can do
// everything they want in the booking app to do it on the main website"): /signup with the booking app's fields, order
// and words, the sign-in's "New to MicroMobility? Create account" and "Forgot password?", the WhatsApp panel, and the
// booking app's hand-overs turned into the site's own pages. The site's /api/account/signup is answered here and the
// database is blocked: no account is ever made anywhere.
const AXE = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const json = (r: Route, body: unknown, status = 200) => r.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

async function axe(page: Page, root = "main") {
  await page.addScriptTag({ content: AXE });
  return page.evaluate(async (sel) => {
    const w = window as unknown as { axe: { run(d: Element, o: object): Promise<{ violations: { id: string; impact: string; nodes: unknown[] }[] }> } };
    const r = await w.axe.run(document.querySelector(sel) ?? document.body, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
    return r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id} x${v.nodes.length}`);
  }, root);
}

/** Nothing leaves the page but to the site, and the sign-up's answers come from `answer`. */
async function stub(page: Page, answer: (body: Record<string, unknown>) => { status?: number; body: unknown } = () => ({ body: { ok: true, name: "Sara Al Harbi" } })) {
  const sent: Record<string, unknown>[] = [];
  await page.route(/supabase\.co|cloudflareinsights\.com|challenges\.cloudflare\.com|google\.com\/maps|gstatic\.com|googleapis\.com/, (r) => r.abort());
  await page.route("**/api/account/signup", (r) => {
    const b = JSON.parse(r.request().postData() || "{}");
    sent.push(b);
    const a = answer(b);
    return json(r, a.body, a.status ?? 200);
  });
  return sent;
}

const W = {
  en: {
    title: "Create account", have: "Already have an account?", signIn: "Sign in", male: "Male", female: "Female",
    enterName: "Enter a first and last name.", gender: "Choose your gender.", email: "That email address doesn’t look right.", pwd: "Use at least 8 characters.",
    em: "Enter your contact’s name.", privacy: "Tick to confirm you’ve read the Privacy Notice.", taken: "An account with this email already exists.",
    newTo: "New to MicroMobility?", create: "Create account", forgot: "Forgot password?", reset: "Reset your password", wa: "Message us on WhatsApp", back: "Back to sign in",
    waText: "Hi MicroMobility, I forgot my password. Please send me a temporary one.",
  },
  ar: {
    title: "إنشاء حساب", have: "لديك حساب بالفعل؟", signIn: "تسجيل الدخول", male: "ذكر", female: "أنثى",
    enterName: "الرجاء إدخال اسمك الكامل (الاسم الأول والأخير).", gender: "الرجاء اختيار جنسك.", email: "الرجاء إدخال بريد إلكتروني صحيح.", pwd: "استخدم 8 أحرف على الأقل.",
    em: "أدخل اسم جهة الاتصال.", privacy: "يرجى تأكيد قراءتك لإشعار الخصوصية.", taken: "يوجد حساب بهذا البريد الإلكتروني مسبقاً.",
    newTo: "جديد في مايكروموبيليتي؟", create: "إنشاء حساب", forgot: "نسيت كلمة المرور؟", reset: "إعادة تعيين كلمة المرور", wa: "راسلنا على واتساب", back: "العودة لتسجيل الدخول",
    waText: "مرحباً MicroMobility، نسيت كلمة المرور. أرجو إرسال كلمة مرور مؤقتة.",
  },
} as const;

for (const lang of ["en", "ar"] as const) {
  const w = W[lang];
  test(`create account: the form's own refusals, an email already taken, then signed in and on to next (${lang})`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    let reply: { status?: number; body: unknown } = { status: 409, body: { ok: false, error: "email_taken", field: "email" } };
    const sent = await stub(page, () => reply);
    await page.goto(`/signup?next=%2Flive&lang=${lang}`, { waitUntil: "networkidle" });
    await expect(page.locator("html")).toHaveAttribute("dir", lang === "ar" ? "rtl" : "ltr");
    await expect(page.locator("h1")).toHaveText(w.title);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    // "Already have an account? Sign in", to the site's sign-in, carrying next
    await expect(page.locator(".su-card > .su-switch")).toHaveText(`${w.have} ${w.signIn}`);
    await expect(page.getByRole("link", { name: w.signIn, exact: true })).toHaveAttribute("href", "/account?next=%2Flive");
    // no Google or Apple sign-in, no emoji
    await expect(page.locator(".su-card")).not.toContainText(/Google|Apple/);
    expect(await page.locator(".su-card").innerText()).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(await axe(page)).toEqual([]);

    const form = page.locator("form.su-form");
    const go = form.getByRole("button", { name: w.title, exact: true });
    const said = (sel: string) => form.locator(sel);
    await go.click();
    await expect(said("[data-su=first] + .su-ferr")).toHaveText(w.enterName);
    await expect(form.locator("[data-su=first]")).toBeFocused();
    // a typed dash becomes a space, as the booking app's
    await form.locator("[data-su=first]").fill("Sara");
    await form.locator("[data-su=last]").fill("Al-Harbi");
    await expect(form.locator("[data-su=last]")).toHaveValue("Al Harbi");
    await go.click();
    await expect(form.getByRole("alert")).toHaveText(w.gender);
    await form.getByRole("button", { name: w.female, exact: true }).click();
    await expect(form.getByRole("button", { name: w.female, exact: true })).toHaveAttribute("aria-pressed", "true");
    await form.locator("[data-su=email]").fill("sara@");
    await go.click();
    await expect(form.getByRole("alert")).toHaveText(w.email);
    await form.locator("[data-su=email]").fill("sara.harbi@example.com");
    await form.locator("[data-su=phone]").fill("0551234567");
    await form.locator("[data-su=password]").fill("short");
    await form.locator("[data-su=height]").fill("165");
    await go.click();
    await expect(form.getByRole("alert")).toHaveText(w.pwd);
    await form.locator("[data-su=password]").fill("corniche at dawn");
    await go.click();
    // the first emergency contact is required
    await expect(form.getByRole("alert")).toHaveText(w.em);
    await expect(form.locator("[data-em='1-name']")).toBeFocused();
    await form.locator("[data-em='1-name']").fill("Huda Ali");
    await form.locator("[data-em='1-phone']").fill("0559876543");
    await form.locator("[data-em='1-rel']").selectOption("sibling");
    await go.click();
    await expect(form.getByRole("alert")).toHaveText(w.privacy);
    expect(sent).toEqual([]);
    await form.locator("[data-su=privacy]").check();
    await go.click();
    // the server's answer, in the booking app's words, under the email
    await expect(said("[data-su=email] + .su-ferr")).toHaveText(w.taken);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      first: "Sara", last: "Al Harbi", gender: "female", email: "sara.harbi@example.com", cc: "+966", phone: "0551234567", password: "corniche at dawn",
      height: "165", em1: { name: "Huda Ali", cc: "+966", phone: "0559876543", rel: "sibling" }, em2: null, privacy: true, news: false,
    });
    reply = { body: { ok: true, name: "Sara Al Harbi" } };
    await form.locator("[data-su=email]").fill("sara.alharbi@example.com");
    await go.click();
    await page.waitForURL(/\/live$/);
    expect(sent).toHaveLength(2);
    expect(errors).toEqual([]);
  });

  test(`forgot password: the sign-in's link shows the WhatsApp panel, and Back to sign in (${lang})`, async ({ page }) => {
    await stub(page);
    await page.goto(`/account?lang=${lang}`, { waitUntil: "networkidle" });
    const form = page.locator("form.ac-form");
    // "New to MicroMobility? Create account" right above the form, to the site's own sign-up
    await expect(form.locator(".su-switch")).toHaveText(`${w.newTo} ${w.create}`);
    await expect(form.locator(".su-switch a")).toHaveAttribute("href", "/signup");
    await form.getByRole("button", { name: w.forgot }).click();
    const h = page.getByRole("heading", { name: w.reset });
    await expect(h).toBeVisible();
    await expect(h).toBeFocused();
    const wa = page.getByRole("link", { name: w.wa, exact: true });
    await expect(wa).toHaveAttribute("href", `https://wa.me/966579543997?text=${encodeURIComponent(w.waText)}`);
    await expect(wa).toHaveAttribute("target", "_blank");
    await expect(page.locator(".su-fg-num")).toHaveText("+966 57 954 3997");
    expect(await axe(page)).toEqual([]);
    await page.getByRole("button", { name: w.back }).click();
    await expect(page.locator("form.ac-form input[autocomplete=username]")).toBeVisible();
  });
}

test("the booking app's hand-overs open the site's own pages, coming back where they started", async ({ page }) => {
  await stub(page);
  await page.goto("/live?lang=en", { waitUntil: "networkidle" });
  const links = page.locator(".ac-notes a");
  await expect(links).toHaveCount(2);
  await expect(links.nth(0)).toHaveAttribute("href", "/signup?next=%2Flive&lang=en");
  await expect(links.nth(1)).toHaveAttribute("href", "/forgot-password?next=%2Flive&lang=en");
  await expect(page.locator("form.ac-form .su-switch a")).toHaveAttribute("href", "/signup?next=%2Flive");
  await links.nth(1).click();
  await page.waitForURL(/\/forgot-password\?/);
  await expect(page.locator("h1")).toHaveText("Reset your password");
  await expect(page.getByRole("link", { name: "Back to sign in" })).toHaveAttribute("href", "/live");
  expect(await axe(page)).toEqual([]);
  await page.goto("/forgot-password?lang=en&next=https%3A%2F%2Fevil.example");
  await expect(page.getByRole("link", { name: "Back to sign in" })).toHaveAttribute("href", "/account");
});

test("a second emergency contact waits behind its button, and a next that leaves the site is not followed", async ({ page }) => {
  const sent = await stub(page);
  await page.goto("/signup?lang=en&next=%2F%2Fevil.example", { waitUntil: "networkidle" });
  await expect(page.getByRole("link", { name: "Sign in", exact: true })).toHaveAttribute("href", "/account");
  const form = page.locator("form.su-form");
  await expect(form.locator("[data-em='2-name']")).toHaveCount(0);
  await form.getByRole("button", { name: "Add a second contact" }).click();
  await expect(form.locator("[data-em='2-name']")).toBeVisible();
  await form.locator("[data-su=first]").fill("Omar");
  await form.locator("[data-su=last]").fill("Saleh");
  await form.getByRole("button", { name: "Male", exact: true }).click();
  await form.locator("[data-su=email]").fill("omar.saleh@example.com");
  await form.locator("[data-su=phone]").fill("0551112222");
  await form.locator("[data-su=password]").fill("corniche at dawn");
  await form.locator("[data-su=height]").fill("180");
  await form.locator("[data-em='1-name']").fill("Huda Saleh");
  await form.locator("[data-em='1-phone']").fill("0559876543");
  await form.locator("[data-em='1-rel']").selectOption("spouse");
  await form.locator("[data-em='2-name']").fill("Ali Saleh");
  await form.getByRole("button", { name: "Create account" }).click();
  await expect(form.getByRole("alert")).toHaveText("Enter your contact’s mobile number.");
  await form.locator("[data-em='2-phone']").fill("0559876543");
  await form.locator("[data-em='2-rel']").selectOption("parent");
  await form.getByRole("button", { name: "Create account" }).click();
  await expect(form.getByRole("alert")).toHaveText("The two emergency contacts can’t have the same number.");
  await form.locator("[data-em='2-phone']").fill("0553334444");
  await form.locator("[data-su=privacy]").check();
  await form.locator(".su-tick input").nth(1).check(); // ride news
  await form.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/account$/);
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatchObject({ em2: { name: "Ali Saleh", cc: "+966", phone: "0553334444", rel: "parent" }, news: true });
});
