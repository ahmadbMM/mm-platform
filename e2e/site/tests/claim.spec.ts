import { test, expect, type Page, type Route } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

// The waitlist claim page (/?claim=<token>, components/claim): the card's states in a real browser,
// with the site's own /api/claim answered here (the database is never asked to give a place), in
// English and Arabic, with the accessibility check the other pages get. One test leaves /api/claim to
// the real server: before the owner applies the claim functions it must still draw a card.
const AXE = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const TOK = "0123456789abcdef0123456789abcdef";

async function serious(page: Page) {
  await page.addScriptTag({ content: AXE });
  return page.evaluate(async () => {
    const w = window as unknown as { axe: { run(d: Document, o: object): Promise<{ violations: { id: string; impact: string; nodes: unknown[] }[] }> } };
    const r = await w.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
    return r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id} x${v.nodes.length}`);
  });
}

/** /api/claim answered by the test: the offer (GET) and the answer to a claim (POST). */
async function mock(page: Page, offer: (now: number) => object, answer: (body: { decline?: boolean }) => object = () => ({ state: "done" })) {
  await page.route(/supabase\.co|cloudflareinsights\.com|challenges\.cloudflare\.com/, (r) => r.abort());
  await page.route("**/api/claim**", (r: Route) => {
    const req = r.request();
    const body = req.method() === "POST" ? answer(JSON.parse(req.postData() || "{}")) : offer(Date.now());
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
}
const open = (secs: number) => (now: number) => ({
  state: "ask", title: "Saturday Social Ride", when: "Sunday 11 October · 6:30 AM",
  expiresAt: new Date(now + secs * 1000).toISOString(), now: new Date(now).toISOString(),
});

for (const lang of ["en", "ar"] as const) {
  test(`an open offer is claimed (${lang})`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await mock(page, open(300));
    await page.goto(`/?claim=${TOK}&lang=${lang}`, { waitUntil: "networkidle" });
    await expect(page.locator("html")).toHaveAttribute("dir", lang === "ar" ? "rtl" : "ltr");
    await expect(page.locator("h1:visible")).toHaveCount(1);
    await expect(page.locator("h1:visible")).toHaveText(lang === "ar" ? "يوجد مكان شاغر لك" : "A place is free for you");
    await expect(page.locator(".wlc-ride")).toContainText("Saturday Social Ride");
    await expect(page.locator('.wlc-ends b[role="timer"]')).toHaveText(/^[45]:\d\d$/);
    expect(await serious(page)).toEqual([]);
    await page.getByRole("button", { name: lang === "ar" ? "أكّد مكاني" : "Claim my place" }).click();
    await expect(page.locator("h1:visible")).toHaveText(lang === "ar" ? "تم حجز مكانك" : "Your place is booked");
    await expect(page.locator("a.wlc-btn")).toHaveAttribute("href", /tab=bookings/);
    expect(errors).toEqual([]);
  });
}

test("the countdown ends the offer at 0", async ({ page }) => {
  await mock(page, open(2));
  await page.goto(`/?claim=${TOK}&lang=en`);
  await expect(page.locator("h1:visible")).toHaveText("A place is free for you");
  await expect(page.locator("h1:visible")).toHaveText("This offer has ended", { timeout: 6000 });
  await expect(page.getByRole("button", { name: "Claim my place" })).toHaveCount(0);
});

test("I can't come, a place already gone, and an answer that did not land", async ({ page }) => {
  let reply: object = { retry: true };
  await mock(page, open(300), (b) => (b.decline ? { state: "no" } : reply));
  await page.goto(`/?claim=${TOK}&lang=en`);
  await page.getByRole("button", { name: "Claim my place" }).click();
  await expect(page.locator(".wlc-err")).toHaveText("Couldn’t save. Check your connection and try again.");
  reply = { state: "full" };
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.locator(".wlc-sub")).toHaveText("The place was taken before you claimed it. You are still on the waitlist.");
  await page.goto(`/?claim=${TOK}&lang=en`);
  await page.getByRole("button", { name: "I can't come" }).click();
  await expect(page.locator("h1:visible")).toHaveText("Thank you for telling us");
});

test("an offer that cannot be read offers Try again", async ({ page }) => {
  let down = true;
  await page.route("**/api/claim**", (r) => (down ? r.abort() : r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(open(300)(Date.now())) })));
  await page.goto(`/?claim=${TOK}&lang=en`);
  await expect(page.locator(".wlc-sub")).toHaveText("Couldn’t save. Check your connection and try again.");
  down = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("button", { name: "Claim my place" })).toBeVisible();
});

test("/claim/<token> opens the same card, and the real server draws one whatever the database has", async ({ page }) => {
  await page.route(/supabase\.co|cloudflareinsights\.com|challenges\.cloudflare\.com/, (r) => r.abort());
  const res = await page.goto(`/claim/${TOK}?lang=en`, { waitUntil: "networkidle" });
  expect(res?.status()).toBe(200);
  expect(new URL(page.url()).search).toContain(`claim=${TOK}`);
  // no such offer (or no claim functions yet): ended; the database unreachable: Try again
  await expect(page.locator("h1:visible")).toHaveText(/This offer has ended|A place is free for you/);
  await expect(page.locator(".wlc-sub")).toBeVisible();
});
