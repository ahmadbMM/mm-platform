import { test, expect, type Page, type Route } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

// The post-ride rating's last screen (the booking app's _rgFinHtml, 2026-11-13, the Community tab reach build's R5):
// once the last ride waiting is rated, a Community member with something to show gets one more screen in the same
// centred pop-up: a badge just earned, else the month's challenge (dots up to five, a bar above that, and "3 / 4"),
// else the season challenge, with Community (the members' area) and Done, and no sentence. With nothing to show the
// pop-up thanks the rider and goes, as before. The account routes are stubbed here: nothing is read or written anywhere.
const AXE = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const json = (r: Route, body: unknown, status = 200) => r.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
const PENDING = { entryId: "e1", name: "Saturday Social Ride", when: "Saturday 14 November", form: "rental", noBike: true, rgLow: 8, run: false, session: false };

async function rating(page: Page, fin: unknown, o: { delay?: number } = {}) {
  const asked: { entryId?: string; locale?: string }[] = [];
  let rated = false;
  await page.route(/cloudflareinsights\.com|challenges\.cloudflare\.com|google\.com\/maps|gstatic\.com|googleapis\.com/, (r) => r.abort());
  await page.route(/supabase\.co/, (r) => r.abort());
  await page.route("**/api/account/emergency", (r) => json(r, { signedIn: true, need: false, two: true }));
  await page.route("**/api/account/sport", (r) => json(r, { signedIn: true, need: false }));
  for (const p of ["pending-waiver", "pending-share", "pending-race-reg"]) await page.route(`**/api/account/${p}*`, (r) => json(r, { signedIn: true, pending: null }));
  await page.route("**/api/account/pending-rating*", (r) => json(r, { signedIn: true, pending: rated ? null : PENDING }));
  await page.route("**/api/account/rate", (r) => { rated = true; return json(r, { ok: true }); });
  await page.route("**/api/account/rating-fin", async (r) => {
    asked.push(JSON.parse(r.request().postData() || "{}"));
    if (o.delay) await new Promise((res) => setTimeout(res, o.delay));
    return json(r, { fin });
  });
  return asked;
}
async function rate(page: Page) {
  const dlg = page.getByRole("dialog");
  await expect(dlg).toBeVisible();
  await dlg.locator(".rg-scale button", { hasText: /^10$/ }).click();
  await dlg.locator("button[type=submit]").click();
  return dlg;
}

test("a member's last rating ends on the month's challenge, with Community and Done and no sentence", async ({ page }) => {
  const asked = await rating(page, { k: "me", kind: "level", n: 3, tg: 4 }, { delay: 300 });
  await page.goto("/");
  const dlg = await rate(page);
  // the thank-you while the screen is asked for, then the screen in the same pop-up
  await expect(dlg.getByRole("status")).toHaveText("Thanks for rating your ride.");
  await expect(dlg.getByRole("heading")).toHaveText("4 sessions this month");
  expect(asked).toEqual([{ entryId: "e1", locale: "en" }]);
  const bar = dlg.getByRole("progressbar");
  await expect(bar).toHaveAttribute("aria-valuenow", "3");
  await expect(bar).toHaveAttribute("aria-valuemax", "4");
  await expect(bar).toHaveAttribute("aria-valuetext", "3 / 4");
  expect(await bar.locator(".hp-dots i").evaluateAll((d) => d.map((i) => i.className))).toEqual(["on", "on", "on", ""]);
  await expect(bar.locator(".rg-fin-n")).toHaveText("3 / 4");
  // Community and Done, nothing else: no sentence, no sign-out, no kicker
  expect(await dlg.locator("a, button").allTextContents()).toEqual(["Community", "Done"]);
  expect((await dlg.innerText()).split("\n").map((s) => s.trim()).filter(Boolean)).toEqual(["4 sessions this month", "3 / 4", "Community", "Done"]);
  // still the pop-up nobody skips: centred, the page behind inert
  const inert = () => page.locator("header").first().evaluate((h) => !!h.closest("[inert]"));
  expect(await inert()).toBe(true);
  const box = await dlg.boundingBox(), vp = page.viewportSize()!;
  expect(Math.abs(box!.x + box!.width / 2 - vp.width / 2)).toBeLessThan(2);
  await page.addScriptTag({ content: AXE });
  const bad = await page.evaluate(async () => {
    const w = window as unknown as { axe: { run(d: Element, o: object): Promise<{ violations: { id: string; impact: string; nodes: unknown[] }[] }> } };
    const r = await w.axe.run(document.querySelector("[role=dialog]")!, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
    return r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id} x${v.nodes.length}`);
  });
  expect(bad).toEqual([]);
  // Community: the members' area, the pop-up gone
  await dlg.getByRole("link", { name: "Community" }).click();
  await page.waitForURL("**/club");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await inert()).toBe(false);
});

test("a new Community badge is the last screen: New badge!, the medal and its name; Done closes the pop-up", async ({ page }) => {
  await rating(page, { k: "badge", name: "Challenge Met", icon: "target", color: "orange" });
  await page.goto("/");
  const dlg = await rate(page);
  await expect(dlg.getByRole("heading")).toHaveText("Challenge Met");
  await expect(dlg.locator(".rg-fin-k")).toHaveText("New badge!");
  await expect(dlg.locator("svg.bdg-m.bdc-orange.rg-fin-medal")).toBeVisible();
  expect((await dlg.locator("svg.bdg-m").boundingBox())!.width).toBeGreaterThan(70); // drawn large, the medal's own styles loaded on any page
  await expect(dlg.getByRole("progressbar")).toHaveCount(0);
  await dlg.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(page.url()).not.toContain("/club");
});

test("a season challenge above five is a bar; in Arabic the screen reads right to left", async ({ page }) => {
  await rating(page, { k: "goal", name: "موسم البرودة", n: 3, tg: 8 });
  await page.goto("/?lang=ar");
  const dlg = await rate(page);
  await expect(dlg.getByRole("heading")).toHaveText("موسم البرودة");
  await expect(dlg.locator(".hp-bar i.on")).toHaveAttribute("style", /width: ?37\.5%/);
  await expect(dlg.locator(".rg-fin-n")).toHaveText("3 / 8");
  expect(await dlg.locator("a, button").allTextContents()).toEqual(["المجتمع", "تم"]);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
});

// The first five rides (the booking app's new features build F1, 2026-11-13): a rider with 1 to 4 bike rides sees that
// path in place of the month's challenge, member or not, with Book when nothing is booked ahead; a non-member's screen
// has no Community button.
test("a non-member on the first five rides: five marks, \"2 of 5\", Book and Done; Book opens Experiences", async ({ page }) => {
  await rating(page, { k: "p5", n: 2, tg: 5, book: true, mem: false });
  await page.goto("/");
  const dlg = await rate(page);
  await expect(dlg.getByRole("heading")).toHaveText("Your first five rides");
  const bar = dlg.getByRole("progressbar");
  await expect(bar).toHaveAttribute("aria-valuetext", "2 of 5");
  await expect(bar).toHaveAttribute("aria-valuemax", "5");
  expect(await bar.locator(".hp-dots i").evaluateAll((d) => d.map((i) => i.className))).toEqual(["on", "on", "", "", ""]);
  await expect(bar.locator(".rg-fin-n")).toHaveText("2 of 5");
  await expect(bar.locator(".rg-fin-n")).not.toHaveAttribute("dir", "ltr");
  expect((await dlg.innerText()).split("\n").map((s) => s.trim()).filter(Boolean)).toEqual(["Your first five rides", "2 of 5", "Book your next ride", "Done"]);
  const box = await dlg.boundingBox(), vp = page.viewportSize()!;
  expect(Math.abs(box!.x + box!.width / 2 - vp.width / 2)).toBeLessThan(2);
  await page.addScriptTag({ content: AXE });
  const bad = await page.evaluate(async () => {
    const w = window as unknown as { axe: { run(d: Element, o: object): Promise<{ violations: { id: string; impact: string; nodes: unknown[] }[] }> } };
    const r = await w.axe.run(document.querySelector("[role=dialog]")!, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
    return r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id} x${v.nodes.length}`);
  });
  expect(bad).toEqual([]);
  // Book: Experiences, nothing chosen, the pop-up gone
  await dlg.getByRole("link", { name: "Book your next ride" }).click();
  await page.waitForURL("**/experiences");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("a member on the path: Book filled, then Community outlined, then Done", async ({ page }) => {
  await rating(page, { k: "p5", n: 3, tg: 5, book: true });
  await page.goto("/");
  const dlg = await rate(page);
  await expect(dlg.getByRole("heading")).toHaveText("Your first five rides");
  await expect(dlg.locator(".rg-fin-n")).toHaveText("3 of 5");
  expect(await dlg.locator("a, button").allTextContents()).toEqual(["Book your next ride", "Community", "Done"]);
  const community = dlg.getByRole("link", { name: "Community" });
  await expect(community).toHaveClass(/rg-fin-2/);
  const bg = (name: string) => dlg.getByRole("link", { name }).evaluate((a) => getComputedStyle(a).backgroundColor);
  expect(await bg("Community")).not.toBe(await bg("Book your next ride"));
  await community.click();
  await page.waitForURL("**/club");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("a member on the path with a booking ahead: no Book, Community filled as before", async ({ page }) => {
  await rating(page, { k: "p5", n: 4, tg: 5 });
  await page.goto("/");
  const dlg = await rate(page);
  await expect(dlg.locator(".rg-fin-n")).toHaveText("4 of 5");
  expect(await dlg.locator("a, button").allTextContents()).toEqual(["Community", "Done"]);
  await expect(dlg.getByRole("link", { name: "Community" })).not.toHaveClass(/rg-fin-2/);
});

test("a badge just earned still comes first, with Book for a rider on the path", async ({ page }) => {
  await rating(page, { k: "badge", name: "Challenge Met", icon: "target", color: "orange", book: true });
  await page.goto("/");
  const dlg = await rate(page);
  await expect(dlg.getByRole("heading")).toHaveText("Challenge Met");
  await expect(dlg.getByRole("progressbar")).toHaveCount(0);
  expect(await dlg.locator("a, button").allTextContents()).toEqual(["Book your next ride", "Community", "Done"]);
});

test("in Arabic the path's count reads in its own direction; with a booking ahead only Done", async ({ page }) => {
  await rating(page, { k: "p5", n: 2, tg: 5, mem: false });
  await page.goto("/?lang=ar");
  const dlg = await rate(page);
  await expect(dlg.getByRole("heading")).toHaveText("جولاتك الخمس الأولى");
  await expect(dlg.locator(".rg-fin-n")).toHaveText("2 من 5");
  await expect(dlg.locator(".rg-fin-n")).not.toHaveAttribute("dir", "ltr");
  expect(await dlg.locator("a, button").allTextContents()).toEqual(["تم"]);
  await dlg.getByRole("button", { name: "تم" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("nothing to show: the thank-you, then the pop-up goes as before", async ({ page }) => {
  const asked = await rating(page, null);
  await page.goto("/");
  const dlg = await rate(page);
  await expect(dlg.getByRole("status")).toHaveText("Thanks for rating your ride.");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(asked).toHaveLength(1);
});
