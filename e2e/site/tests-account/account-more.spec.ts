import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

// The booking app's Account pieces the website gained on 2026-11-19 (the owner, 2026-10-01: everything a customer sees or
// does in the booking app is also on the main website): Notifications (Ride news) and Updates, Learn to ride, the
// new-badge pop-up, the one-time ask about an old comment and a company challenge's join link. Signed in as the stub's one
// rider (stub-account-db.mjs: Sara Khalid; ride news on; three updates, the newest unread); each test sets its scene.
// Nothing real is read or written.
const STUB = `http://127.0.0.1:${process.env.STUB_PORT || 8797}`;

async function signIn(page: Page, lang = "en", scene: Record<string, boolean> = {}, cookie = true) {
  await page.request.post(`${STUB}/__reset`);
  if (Object.keys(scene).length) await page.request.post(`${STUB}/__scene`, { data: scene });
  const base = test.info().project.use.baseURL as string;
  await page.context().addCookies([
    ...(cookie ? [{ name: "mm_acct", value: "c-test~a1b2c3d4e5f6a7b8c9d0", url: base }] : []),
    { name: "NEXT_LOCALE", value: lang, url: base },
  ]);
}
type State = { rideNews: boolean; tmAnswered: string | null; company: { company: string }[]; updates: { read: boolean }[] };
const state = async (page: Page) => (await (await page.request.get(`${STUB}/__state`)).json()) as State;
const menu = (page: Page) => page.locator("nav.acm-menu");
const row = (page: Page, id: string) => menu(page).locator(`a.acm-row[data-row="${id}"]`);
const pane = (page: Page) => page.locator(".acm-pane");

test("Notifications: the unread count on its row, Ride news switched off and on, and Updates newest first with where each leads", async ({ page, isMobile }) => {
  await signIn(page);
  await page.goto("/account");
  const notif = row(page, "notifications");
  await expect(notif).toContainText("Notifications");
  await expect(notif.locator(".acm-row-v")).toHaveText("1");
  await notif.click();
  await expect(page).toHaveURL(/\/account\/notifications$/);
  await expect(pane(page).locator("#acm-pg-h")).toHaveText("Notifications");
  const upd = pane(page).locator('a.acm-row[data-row="updates"]');
  await expect(upd).toContainText("Updates");
  await expect(upd.locator(".acm-count")).toHaveText("1");
  // Ride news as it is on file, and its one button; no push switch, no line under the heading
  const rn = pane(page).locator(".acm-rn");
  await expect(rn.locator(".acm-rn-state")).toHaveText("You’re getting ride news.");
  await expect(rn.locator("p")).toHaveCount(2); // the state and the Privacy Notice link, nothing else
  await rn.getByRole("button", { name: "Stop ride news" }).click();
  await expect(rn.locator(".acm-rn-state")).toHaveText("You’re not getting ride news.");
  await expect.poll(async () => (await state(page)).rideNews).toBe(false);
  await expect(rn.getByRole("button", { name: "Send me ride news" })).toBeVisible();
  await expect(rn.getByRole("link", { name: "Privacy Notice" })).toHaveAttribute("href", "/privacy");
  // Updates: newest first, the unread one with its dot, each with where a tap leads on this site
  await upd.click();
  await expect(page).toHaveURL(/\/account\/updates$/);
  const rows = pane(page).locator(".acm-upd > li");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText("A place is free");
  await expect(rows.nth(0)).toContainText("Take your place");
  await expect(rows.nth(0).locator(".acm-upd-new")).toHaveCount(1);
  await expect(rows.nth(0).locator("a")).toHaveAttribute("href", "/?claim=0123456789abcdef0123456789abcdef");
  await expect(rows.nth(1).locator("a")).toHaveAttribute("href", "/bookings");
  await expect(rows.nth(1).locator(".acm-upd-new")).toHaveCount(0);
  await expect(rows.nth(2).locator("a")).toHaveCount(0); // a note that leads nowhere
  expect((await state(page)).updates.every((u) => u.read)).toBe(true); // reading the list marked them read
  // the menu's row is Notifications' (Updates sits under it); Back returns to Notifications, where none is unread now
  if (!isMobile) await expect(row(page, "notifications")).toHaveAttribute("aria-current", "page");
  else await expect(pane(page).locator("a.acm-back")).toHaveText("Notifications");
  if (isMobile) await pane(page).locator("a.acm-back").click();
  else await page.goto("/account/notifications");
  await expect(page).toHaveURL(/\/account\/notifications$/);
  await expect(pane(page).locator('a.acm-row[data-row="updates"] .acm-count')).toHaveCount(0);
  if (!isMobile) await expect(row(page, "notifications").locator(".acm-row-v")).toHaveText("Off");
});

test("Learn to ride: only for a learner; the ladder, Practising, the instructor's line, a learner picked, a certificate and Back", async ({ page }) => {
  await signIn(page);
  await page.goto("/account");
  await expect(row(page, "learn")).toHaveCount(0);
  await signIn(page, "en", { learner: true });
  await page.goto("/account");
  await row(page, "learn").click();
  await expect(page).toHaveURL(/\/account\/learn$/);
  await expect(pane(page).locator("#acm-pg-h")).toHaveText("Learn to ride");
  await expect(pane(page).locator(".acm-ll-fb")).toContainText("From your instructor");
  await expect(pane(page).locator(".acm-ll-fb")).toContainText("Great balance already");
  const lv = pane(page).locator(".acm-ll-lv");
  await expect(lv).toHaveCount(4);
  await expect(lv.locator(".acm-ll-lv-t")).toContainText(["Balance", "Pedal", "Steer and brake", "Ride the circuit"]);
  await expect(lv.nth(0)).toHaveClass(/done/);
  await expect(lv.nth(0).locator(".acm-ll-lv-c")).toHaveText("2/2");
  await expect(lv.nth(1).locator(".acm-ll-lv-c")).toHaveText("1/2");
  await expect(lv.nth(1).locator(".acm-ll-prac")).toHaveText(["Practising"]);
  await expect(lv.nth(1).getByRole("button", { name: "Certificate" })).toHaveCount(0);
  await expect(pane(page).locator(".acm-ll-inv")).toHaveCount(0); // not all four yet
  // the other learner on the sign-up
  const who = pane(page).locator(".acm-ll-who");
  await expect(who.getByRole("button", { name: "Sara Khalid" })).toHaveAttribute("aria-pressed", "true");
  await who.getByRole("button", { name: "Omar" }).click();
  await expect(lv.nth(0).locator(".acm-ll-prac")).toHaveCount(2);
  await expect(pane(page).locator(".acm-ll-fb")).toHaveCount(0);
  await who.getByRole("button", { name: "Sara Khalid" }).click();
  // a complete level's certificate, drawn here: Save image, and Back to the ladder
  await lv.nth(0).getByRole("button", { name: "Certificate" }).click();
  const img = pane(page).locator("img.acm-ll-img");
  await expect(img).toHaveAttribute("src", /^blob:/);
  await expect(img).toHaveAttribute("alt", "Certificate: Balance");
  await expect(pane(page).getByRole("link", { name: "Save image" })).toHaveAttribute("download", "micromobility-learn-to-ride-level-1.png");
  await pane(page).getByRole("button", { name: "Back" }).click();
  await expect(lv).toHaveCount(4);
});

test("a badge staff gave yesterday pops up once on the account page, centred, and not again on this device", async ({ page, context }) => {
  await signIn(page, "en", { freshBadge: true });
  await page.goto("/account");
  const pop = page.locator("dialog.bdg-new[open]");
  await expect(pop).toBeVisible();
  await expect(pop.locator(".badge-pop-new")).toHaveText("New badge!");
  await expect(pop.locator(".badge-pop-nm")).toHaveText("Race Spirit");
  await expect(pop).toContainText("For helping a new rider all evening.");
  await expect(pop).toContainText("Given by the MicroMobility team");
  // centred (the owner's rule)
  const box = await pop.boundingBox(), vp = page.viewportSize();
  expect(box && vp && Math.abs(box.x + box.width / 2 - vp.width / 2) < 4 && Math.abs(box.y + box.height / 2 - vp.height / 2) < 40).toBe(true);
  await pop.getByRole("button", { name: "Close" }).click();
  await expect(pop).toHaveCount(0);
  // another tab of this browser: asked again, and not shown again
  const two = await context.newPage();
  await two.goto("/account/stats");
  await expect(two.locator("nav.acp")).toBeVisible();
  await two.waitForTimeout(2500);
  await expect(two.locator("dialog.bdg-new")).toHaveCount(0);
  // without the badge nothing pops
  await signIn(page);
  const three = await context.newPage();
  await three.evaluate(() => localStorage.clear()).catch(() => null);
  await three.goto("/account");
  await three.waitForTimeout(2500);
  await expect(three.locator("dialog.bdg-new")).toHaveCount(0);
});

test("the one-time ask about an old comment: the ride by its kind, the words, the tick required, Publish it, and never again", async ({ page }) => {
  await signIn(page, "en", { tmAsk: true });
  await page.goto("/account/personal");
  const ask = page.locator(".tm-old[role=dialog]");
  await expect(ask.locator("#tm-old-h")).toHaveText("May we publish your words?");
  await expect(ask.locator(".rg-meta")).toContainText("Session or rental · ");
  await expect(ask.locator(".tm-old-q")).toHaveText("The best evening at the circuit, the team made sure everyone felt safe and had fun.");
  await ask.getByRole("button", { name: "Publish it" }).click();
  await expect(ask.locator(".ac-err")).toBeVisible(); // the tick first
  expect((await state(page)).tmAnswered).toBeNull();
  await ask.getByRole("radio", { name: "Sara K." }).check();
  await ask.getByRole("checkbox").check();
  await ask.getByRole("button", { name: "Publish it" }).click();
  await expect(ask.locator(".rr-thanks")).toBeVisible();
  await expect.poll(async () => (await state(page)).tmAnswered).toBe("yes");
  await expect(ask).toHaveCount(0, { timeout: 5000 });
  await page.reload();
  await page.waitForTimeout(2500);
  await expect(page.locator(".tm-old")).toHaveCount(0);
  // No thanks ends it too
  await signIn(page, "en", { tmAsk: true });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto("/account/contact");
  await page.locator(".tm-old").getByRole("button", { name: "No thanks" }).click();
  await expect(page.locator(".tm-old")).toHaveCount(0);
  await expect.poll(async () => (await state(page)).tmAnswered).toBe("no");
});

test("a company challenge's join link keeps its code through the sign-in, joins at once, and Log out drops it", async ({ page }) => {
  // signed out: the code comes off the address and is kept
  await signIn(page, "en", {}, false);
  await page.goto("/account/company?company=acme2026");
  await expect(page).toHaveURL(/\/account\/company$/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("mm_co_code") || "null")?.c)).toBe("ACME2026");
  // signed in (the cookie a sign-in sets), anywhere on the account: Company challenge opens and joins
  await signIn(page, "en");
  await page.evaluate(() => localStorage.setItem("mm_co_code", JSON.stringify({ c: "ACME2026", t: Date.now() })));
  await page.goto("/account");
  await expect(page).toHaveURL(/\/account\/company$/, { timeout: 15000 });
  await expect(pane(page).locator(".acm-co h3")).toHaveText("Acme");
  expect((await state(page)).company.map((c) => c.company)).toEqual(["Acme"]);
  expect(await page.evaluate(() => localStorage.getItem("mm_co_code"))).toBeNull();
  // a code that is not one says so under the box
  await signIn(page, "en");
  await page.goto("/account/company?company=NOPE1");
  await expect(pane(page).locator(".acm-err")).toHaveText("We do not know this code. Check it and try again.");
  // Log out drops a code still kept
  await page.goto("/account");
  await page.evaluate(() => localStorage.setItem("mm_co_code", JSON.stringify({ c: "ACME2026", t: Date.now() })));
  await page.route("**/api/account", (r) => (r.request().method() === "DELETE" ? r.fulfill({ status: 200, body: "{}" }) : r.continue()));
  await Promise.all([page.waitForEvent("load"), menu(page).getByRole("button", { name: "Log out" }).click()]);
  await expect.poll(async () => page.evaluate(() => localStorage.getItem("mm_co_code")).catch(() => "reloading")).toBeNull();
});

test("details the account owes open as a pop-up it cannot skip, whose Add details opens the owed detail's own page here, where it stays away", async ({ page }) => {
  await signIn(page, "en", { owes: true });
  await page.goto("/account/riding");
  const gate = page.locator(".fx-gate[role=dialog]");
  await expect(gate.locator(".rg-kicker")).toHaveText("Account check-up");
  await expect(gate.locator("#fx-gate-h")).toHaveText("A few details for your account");
  await expect(gate.locator("p:not(.rg-kicker)")).toHaveCount(0); // no line under the heading
  // the rest of the page is out of reach: no close, Escape does nothing
  await page.keyboard.press("Escape");
  await expect(gate).toBeVisible();
  expect(await page.evaluate(() => !!document.querySelector("main")?.closest("[inert]"))).toBe(true);
  const go = gate.getByRole("link", { name: "Add details" });
  await expect(go).toHaveAttribute("href", "/account/personal"); // birth_date first: Personal details on this site
  await expect(gate.getByRole("button", { name: "Log out" })).toBeVisible();
  // on the owed detail's own page the rider puts it right: no pop-up there
  await page.goto("/account/personal");
  await page.waitForTimeout(2000);
  await expect(page.locator(".fx-gate")).toHaveCount(0);
  await expect(page.locator("main")).not.toHaveAttribute("inert", "");
  // a password the account lacks, or a key this site does not know, still goes to the booking app, signed in by a one-time
  // code (followed here only as far as the address it sends to)
  const r = await page.request.get("/api/account/app-signin?lang=en", { maxRedirects: 0 });
  expect(r.status()).toBe(303);
  expect(r.headers().location).toBe("https://experiences.micromobility.sa/?lang=en&signin=0123456789abcdef0123456789abcdef0123456789abcdef");
  // nothing owed: no pop-up
  await signIn(page);
  await page.evaluate(() => sessionStorage.clear());
  await page.goto("/account/riding");
  await page.waitForTimeout(2000);
  await expect(page.locator(".fx-gate")).toHaveCount(0);
});

// No serious accessibility problems (axe, WCAG 2.1 A/AA) and no script errors on the new pages, in both directions.
const AXE = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
for (const lang of ["en", "ar"]) {
  test(`the new pages: no serious accessibility problems or script errors (${lang})`, async ({ page }) => {
    await signIn(page, lang, { learner: true });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_|net::|Download the React DevTools/.test(m.text())) errors.push(m.text()); });
    for (const path of ["/account/notifications", "/account/updates", "/account/learn"]) {
      await page.goto(path);
      await expect(page.locator("h1")).toHaveCount(1);
      await page.addScriptTag({ content: AXE });
      const bad = await page.evaluate(async () => {
        const w = window as unknown as { axe: { run(d: Document, o: object): Promise<{ violations: { id: string; impact: string; nodes: unknown[] }[] }> } };
        const r = await w.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
        return r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id} x${v.nodes.length}`);
      });
      expect(bad, path).toEqual([]);
    }
    expect(errors).toEqual([]);
  });
}
