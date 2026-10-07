import { test, expect, type Page, type Route } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

// The account's emergency contact (the owner, 2026-10-07: the first required and unskippable for every
// customer, a second optional): the check-up every page puts up for a signed-in account without one,
// before any other pop-up, and the learn form's sign-up, which asks it with the account. The account
// routes and the database are stubbed here: nothing is read or written anywhere.
const AXE = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const json = (r: Route, body: unknown, status = 200) => r.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

async function blockOutside(page: Page) {
  await page.route(/cloudflareinsights\.com|challenges\.cloudflare\.com|google\.com\/maps|gstatic\.com|googleapis\.com/, (r) => r.abort());
}

async function gate(page: Page, o: { two?: boolean; post?: (body: Record<string, unknown>) => unknown } = {}) {
  const asked: string[] = [];
  const posts: Record<string, unknown>[] = [];
  await blockOutside(page);
  await page.route(/supabase\.co/, (r) => r.abort());
  await page.route("**/api/account/emergency", async (r) => {
    if (r.request().method() === "POST") {
      const b = JSON.parse(r.request().postData() || "{}");
      posts.push(b);
      const a = o.post ? o.post(b) : { ok: true };
      return json(r, a, (a as { ok?: boolean }).ok ? 200 : 400);
    }
    asked.push("emergency");
    return json(r, posts.length ? { signedIn: true, need: false, two: true } : { signedIn: true, need: true, two: o.two ?? true });
  });
  for (const p of ["pending-waiver", "pending-share", "pending-rating"]) {
    await page.route(`**/api/account/${p}*`, (r) => { asked.push(p); return json(r, { signedIn: true, pending: null }); });
  }
  return { asked, posts };
}

test("a signed-in account without an emergency contact cannot use the site until it gives one", async ({ page }) => {
  const { asked, posts } = await gate(page, { post: (b) => ((b.one as { phone?: string }).phone === "0552468013" ? { ok: false, error: "refused", problem: { error: "em_self", which: 1 } } : { ok: true }) });
  await page.goto("/");
  const dlg = page.getByRole("dialog");
  await expect(dlg).toBeVisible();
  await expect(dlg.getByRole("heading")).toHaveText("Add your emergency contact");
  await expect(dlg).toContainText("We now ask every rider for someone we can call if you need help at a ride or event. Add them once and you can book.");
  // the waiver, the run's agreement and the rating wait for it
  expect(asked).toEqual(["emergency"]);
  // no way off but signing out: Escape and a click outside keep it, the page behind is inert
  await page.keyboard.press("Escape");
  await page.mouse.click(5, 5);
  await expect(dlg).toBeVisible();
  const inert = () => page.locator("header").first().evaluate((h) => !!h.closest("[inert]"));
  expect(await inert()).toBe(true);
  await expect(dlg.getByRole("button", { name: "Sign out" })).toBeVisible();
  expect(await dlg.getByRole("button").allTextContents()).toEqual(["Add a second contact", "Save", "Sign out"]);

  // required: nothing is sent without it
  await dlg.getByRole("button", { name: "Save" }).click();
  await expect(dlg.getByRole("alert")).toHaveText("Enter your contact’s name.");
  expect(posts).toEqual([]);
  await dlg.locator("[data-em='1-name']").fill("Layla-Mansour");
  await expect(dlg.locator("[data-em='1-name']")).toHaveValue("Layla Mansour");
  await dlg.locator("[data-em='1-phone']").fill("0552468013");
  await dlg.locator("[data-em='1-rel']").selectOption("spouse");
  await expect(dlg.locator("[data-em='1-cc'] option").first()).toHaveText("+966 Saudi Arabia");
  expect(await dlg.locator("[data-em='1-cc'] option").evaluateAll((os) => os.some((o) => /israel/i.test(o.textContent || "")))).toBe(false);

  // the database refuses the rider's own number
  await dlg.getByRole("button", { name: "Save" }).click();
  await expect(dlg.getByRole("alert")).toHaveText("Your contact’s number can’t be your own.");
  await dlg.locator("[data-em='1-phone']").fill("0551234567");

  // the optional second: behind its button, never the first one's number
  await dlg.getByRole("button", { name: "Add a second contact" }).click();
  await expect(dlg).toContainText("Second emergency contact (optional)");
  await dlg.locator("[data-em='2-name']").fill("Omar Mansour");
  await dlg.locator("[data-em='2-phone']").fill("055 123 4567");
  await dlg.locator("[data-em='2-rel']").selectOption("sibling");
  await dlg.getByRole("button", { name: "Save" }).click();
  await expect(dlg.getByRole("alert")).toHaveText("The two emergency contacts can’t have the same number.");
  expect(posts).toHaveLength(1);
  await dlg.locator("[data-em='2-phone']").fill("0559876541");
  await dlg.getByRole("button", { name: "Save" }).click();
  await expect(dlg).toBeHidden();
  expect(posts.at(-1)).toEqual({
    one: { name: "Layla Mansour", cc: "+966", phone: "0551234567", rel: "spouse" },
    two: { name: "Omar Mansour", cc: "+966", phone: "0559876541", rel: "sibling" },
  });
  expect(await inert()).toBe(false);
  // then the next pop-ups ask
  await expect.poll(() => asked.includes("pending-waiver")).toBe(true);
});

test("the check-up reads well in Arabic, offers no second contact on an older database, and passes axe", async ({ page }) => {
  await gate(page, { two: false });
  await page.goto("/?lang=ar");
  const dlg = page.getByRole("dialog");
  await expect(dlg.getByRole("heading")).toHaveText("أضف جهة اتصال للطوارئ");
  await expect(dlg).toContainText("نطلب الآن من كل راكب شخصًا نتصل به إن احتجت إلى مساعدة في رحلة أو فعالية. أضفه مرة واحدة وتستطيع الحجز.");
  await expect(dlg.getByRole("button", { name: "إضافة جهة اتصال ثانية" })).toHaveCount(0);
  await page.addScriptTag({ content: AXE });
  const bad = await page.evaluate(async () => {
    const w = window as unknown as { axe: { run(d: Element, o: object): Promise<{ violations: { id: string; impact: string; nodes: unknown[] }[] }> } };
    const r = await w.axe.run(document.querySelector("[role=dialog]")!, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
    return r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id} x${v.nodes.length}`);
  });
  expect(bad).toEqual([]);
});

test("a signed-out visitor, or an account with its contact, is never asked", async ({ page }) => {
  await blockOutside(page);
  await page.route(/supabase\.co/, (r) => r.abort());
  await page.route("**/api/account/emergency", (r) => json(r, { signedIn: false }));
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

// The learn form's sign-up: the contact with the account, saved the moment it exists.
test("the learn form will not make the account without an emergency contact, and saves it with the account", async ({ page }) => {
  const calls: { fn: string; body: Record<string, unknown> }[] = [];
  await blockOutside(page);
  await page.route("**/api/account/emergency", (r) => json(r, { signedIn: false }));
  await page.route(/supabase\.co\/rest\/v1\/rpc\//, (r) => {
    const fn = r.request().url().split("/rpc/")[1].split("?")[0];
    calls.push({ fn, body: JSON.parse(r.request().postData() || "{}") });
    const a: Record<string, unknown> = {
      customer_exists: false, customer_signup: [{ id: "x", session_token: "tok-new" }], customer_consents: { privacy_version: "2026-10-06", ride_news: false },
      customer_set_emergency: true, customer_set_emergency2: true,
    };
    return fn in a ? json(r, a[fn]) : json(r, { code: "PGRST202", message: "Could not find the function" }, 404);
  });
  await page.route(/supabase\.co(?!\/rest\/v1\/rpc\/)/, (r) => r.abort());
  await page.goto("/experiences/learn");
  const card = page.locator(".ln-card").first();
  test.skip(!(await card.getByRole("radio", { name: "No, I'm new" }).count()), "sign-ups are switched off on this database");
  await card.getByRole("radio", { name: "No, I'm new" }).click();
  await card.getByLabel("First name").fill("Karim");
  await card.getByLabel("Last name").fill("Mansour");
  await card.getByRole("radio", { name: "Male", exact: true }).click();
  await card.getByLabel("Email", { exact: true }).fill("karim.mansour@gmail.com");
  await card.getByLabel("Mobile number", { exact: true }).fill("0552468013");
  await card.locator("input[autocomplete='new-password']").nth(0).fill("Ride2Work");
  await card.locator("input[autocomplete='new-password']").nth(1).fill("Ride2Work");
  await card.getByLabel("Height (cm)").fill("178");
  await card.locator(".ln-check input").first().check();
  await card.getByRole("button", { name: "Create account" }).click();
  await expect(card.getByRole("alert")).toHaveText("Enter your contact’s name.");
  expect(calls.filter((c) => c.fn === "customer_signup")).toEqual([]);
  await card.locator("[data-em='1-name']").fill("Layla Mansour");
  await card.locator("[data-em='1-phone']").fill("0552468013");
  await card.locator("[data-em='1-rel']").selectOption("parent");
  await card.getByRole("button", { name: "Create account" }).click();
  await expect(card.getByRole("alert")).toHaveText("Your contact’s number can’t be your own.");
  await card.locator("[data-em='1-phone']").fill("0551234567");
  await card.getByRole("button", { name: "Create account" }).click();
  await expect(card).toContainText("Your account has been created");
  const signup = calls.find((c) => c.fn === "customer_signup")!;
  expect(calls.filter((c) => c.fn === "customer_set_emergency").map((c) => c.body)).toEqual([
    { p_id: signup.body.p_id, p_token: "tok-new", p_name: "Layla Mansour", p_phone: "+966551234567", p_relation: "parent" },
  ]);
  expect(calls.filter((c) => c.fn === "customer_set_emergency2")).toEqual([]);
  // saved: step 2 does not ask again
  await expect(card.locator("[data-em='1-name']")).toHaveCount(0);
});
