import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

// My Account as the booking app's menu, and Bookings (the user, 2026-11-19: "i want the account page to be very similar on
// main for it on booking app"; "make sure to have a page or dedicated space for purchases and workshop appointments and
// unified place to have all upcoming appointments for everything"). Signed in as the stub's one rider (stub-account-db.mjs:
// Sara Khalid, no photo; a Saturday ride in 2 days, a workshop appointment in 3, a locker in 4, a circuit night in 5, a
// volunteer shift in 8, one ride done 12 days ago). Nothing real is read or written.
const STUB = `http://127.0.0.1:${process.env.STUB_PORT || 8797}`;

async function signIn(page: Page, lang = "en") {
  await page.request.post(`${STUB}/__reset`);
  const base = test.info().project.use.baseURL as string;
  await page.context().addCookies([
    { name: "mm_acct", value: "c-test~a1b2c3d4e5f6a7b8c9d0", url: base },
    { name: "NEXT_LOCALE", value: lang, url: base },
  ]);
}
const state = async (page: Page) => (await (await page.request.get(`${STUB}/__state`)).json()) as { profile: Record<string, unknown>; writes: { fn: string; a: Record<string, unknown> }[] };
const menu = (page: Page) => page.locator("nav.acm-menu");
const row = (page: Page, id: string) => menu(page).locator(`a.acm-row[data-row="${id}"]`);

test("the menu: the profile card above the switch, the two tiles, rows with their values, Log out and Delete last", async ({ page }) => {
  await signIn(page);
  await page.goto("/account");
  const card = page.locator("a.acm-id");
  await expect(card).toContainText("Sara Khalid");
  await expect(card).toContainText("sara@example.com");
  // the card comes before the switch, which is links (not tabs), Account the current page
  const sw = page.locator("nav.acp");
  expect(await card.evaluate((c, s) => !!(c.compareDocumentPosition(s as Node) & Node.DOCUMENT_POSITION_FOLLOWING), await sw.elementHandle())).toBe(true);
  await expect(sw.getByRole("link", { name: "Account" })).toHaveAttribute("aria-current", "page");
  await expect(sw.getByRole("tab")).toHaveCount(0);
  await expect(menu(page).locator(".acm-tile")).toHaveText([/Wallet\s*.*70/, /Invite friends\s*K7MQ2X/]);
  // what is missing is the row's value, in amber; what is there, its value
  await expect(row(page, "personal").locator(".acm-row-v.is-add")).toHaveText("Add profile photo");
  await expect(row(page, "contact")).toContainText("+966500000001");
  await expect(row(page, "emergency")).toContainText("Ali Saleh");
  await expect(row(page, "riding")).toContainText("Hybrid · 168 cm");
  await expect(row(page, "about")).toContainText("Architect");
  await expect(row(page, "purchases")).toBeVisible();
  await expect(row(page, "workshop")).toBeVisible();
  // the groups' headings, then Log out and, last, Delete my account in red
  await expect(menu(page).locator(".acm-grp-h")).toHaveText(["Your details", "Activity", "Settings"]);
  const last = menu(page).locator(".acm-grp").last().locator("li");
  await expect(last).toHaveText([/Log out/, /Delete my account/]);
  await expect(last.last().locator(".acm-row-red")).toBeVisible();
  // no line under a heading but the rows (the owner's rule), and a page that is never indexed
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("a row opens its page at its own address; on a phone Back returns to the menu, on a wide screen both sit side by side", async ({ page, isMobile }) => {
  await signIn(page);
  await page.goto("/account");
  if (isMobile) {
    await expect(page.locator(".acm-pane")).toBeHidden();
  } else {
    // Personal details beside the menu with none picked, its row marked
    await expect(page.locator(".acm-pane h2#acm-pg-h")).toHaveText("Personal details");
    await expect(page.locator("#acm-first")).toHaveValue("Sara");
  }
  await row(page, "contact").click();
  await expect(page).toHaveURL(/\/account\/contact$/);
  await expect(page.locator("h1#acm-pg-h")).toHaveText("Contact");
  await expect(row(page, "contact")).toHaveAttribute("aria-current", "page");
  await expect(page.locator("#acm-email")).toHaveValue("sara@example.com");
  if (isMobile) {
    await expect(menu(page)).toBeHidden();
    await page.getByRole("link", { name: "Back" }).click();
    await expect(page).toHaveURL(/\/account$/);
    await expect(menu(page)).toBeVisible();
  } else {
    await expect(menu(page)).toBeVisible();
    await expect(page.getByRole("link", { name: "Back" })).toBeHidden();
  }
  // a cold deep link draws the page too; an address that is no page is a 404
  await page.goto("/account/riding");
  await expect(page.locator("h1#acm-pg-h")).toHaveText("Riding");
  expect((await page.goto("/account/nope"))?.status()).toBe(404);
});

test("a page's Save writes its own fields only, says Saved, and the row shows the new value", async ({ page }) => {
  await signIn(page);
  await page.goto("/account/riding");
  await page.locator("#acm-height").fill("175");
  await page.getByRole("button", { name: "Mountain" }).click();
  const save = page.locator("button.acm-save");
  await save.click();
  await expect(save).toHaveText(/Saved/);
  await expect(page.locator("p.acm-sr[aria-live]")).toHaveText("Saved");
  const s = await state(page);
  const up = s.writes.filter((x) => x.fn === "customer_update_profile");
  expect(up).toHaveLength(1);
  expect(up[0].a).toMatchObject({ p_height: 175, p_type_preference: "Mountain", p_name: "Sara Khalid", p_email: "sara@example.com", p_city: "Jeddah" });
  expect(s.writes.some((x) => x.fn === "customer_set_blood_type")).toBe(false); // not changed: not written
  // the menu was drawn again from the server
  await expect(row(page, "riding")).toContainText("Mountain · 175 cm");
  // an edit puts Save back
  await page.locator("#acm-height").fill("176");
  await expect(save).toHaveText("Save");
});

test("a box is checked when it is left, and Save focuses the first box with a problem", async ({ page }) => {
  await signIn(page);
  await page.goto("/account/contact");
  await page.locator("#acm-email").fill("not-an-email");
  await page.locator("#acm-email").blur();
  await expect(page.locator("#acm-email-err")).toHaveText("That email address doesn’t look right.");
  await page.locator("button.acm-save").click();
  await expect(page.locator("#acm-email")).toBeFocused();
  expect((await state(page)).writes).toHaveLength(0);
});

test("leaving a page with unsaved edits asks first: Keep editing stays, Discard leaves", async ({ page, isMobile }) => {
  await signIn(page);
  await page.goto("/account/personal");
  await page.locator("#acm-middle").fill("Noor");
  const target = isMobile ? page.getByRole("link", { name: "Back" }) : row(page, "residence");
  await target.click();
  const dlg = page.locator("dialog.acm-dlg[open]");
  await expect(dlg).toContainText("Discard your changes?");
  await dlg.getByRole("button", { name: "Keep editing" }).click();
  await expect(page).toHaveURL(/\/account\/personal$/);
  await expect(page.locator("#acm-middle")).toHaveValue("Noor");
  await target.click();
  await page.locator("dialog.acm-dlg[open]").getByRole("button", { name: "Discard" }).click();
  await expect(page).toHaveURL(isMobile ? /\/account$/ : /\/account\/residence$/);
  expect((await state(page)).writes).toHaveLength(0);
});

test("Bookings: every booking ahead in one list, soonest first, then the rides done; reached from the header's ticket", async ({ page, isMobile }) => {
  await signIn(page);
  await page.goto("/");
  if (!isMobile) {
    await page.locator("header.mm-nav a.mm-nav-tk").click();
    await expect(page).toHaveURL(/\/bookings$/);
  } else {
    await page.goto("/bookings");
  }
  await expect(page.locator("h1")).toHaveText("Bookings");
  // ride tickets and the other appointments together, by day: the Saturday ride (2 days), the workshop (3), the locker
  // (4), the circuit night (5), the volunteer shift (8)
  const kinds = await page.locator(".bk-grid").evaluate((g) => [...g.children].map((c) => {
    if (c.matches(".bk-appt")) return (c.querySelector(".bk-appt-k")?.textContent ?? "").trim();
    if (c.matches(".tk-cx-list")) return "cancelled";
    return "ticket";
  }));
  expect(kinds).toEqual(["ticket", "Workshop", "Your lockers", "ticket", "Volunteering", "cancelled"]);
  await expect(page.locator("article.bk-appt").first()).toContainText("W-0042");
  // the ride done 12 days ago, under Past rides; the cancelled one is not a ride done
  await expect(page.locator("#bk-past-h")).toHaveText("Past rides");
  await expect(page.locator(".bk-past > li")).toHaveCount(1);
});

test("Purchases and Workshop appointments have pages of their own", async ({ page }) => {
  await signIn(page);
  await page.goto("/account/purchases");
  await expect(page.locator("h1#acm-pg-h")).toHaveText("Purchases");
  await expect(page.locator(".acm-lines > li")).toHaveCount(3);
  await expect(page.locator(".acm-lines > li.is-off")).toContainText("Bike gloves");
  await expect(page.locator(".acm-total")).toContainText("14");
  await page.goto("/account/workshop");
  await expect(page.locator("h1#acm-pg-h")).toHaveText("Workshop appointments");
  await expect(page.locator("#acm-ws-up + ul")).toContainText("W-0042");
  await expect(page.locator("#acm-ws-up + ul")).toContainText("Confirmed");
  await expect(page.locator("#acm-ws-past + ul")).toContainText("W-0017");
  await expect(page.locator("#acm-ws-past + ul")).toContainText("Completed");
});

test("Arabic: the page mirrors and the rows speak Arabic", async ({ page }) => {
  await signIn(page, "ar");
  await page.goto("/account");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(row(page, "personal")).toContainText("البيانات الشخصية");
  await expect(row(page, "personal").locator(".acm-row-v.is-add")).toHaveText("أضف صورة الملف");
  await expect(menu(page).locator(".acm-grp-h")).toHaveText(["بياناتك", "النشاط", "الإعدادات"]);
  const box = await row(page, "personal").boundingBox(), ic = await row(page, "personal").locator(".acm-row-ic").boundingBox();
  expect(ic && box && ic.x > box.x + box.width / 2).toBe(true); // the icon on the right
});

// No serious accessibility problems (axe, WCAG 2.1 A/AA), as the site's every page is checked (tests/pages.spec.ts), and no
// script errors, on the menu, a page, Bookings and the two lists, in both directions.
const AXE = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
for (const lang of ["en", "ar"]) {
  test(`no serious accessibility problems or script errors (${lang})`, async ({ page }) => {
    await signIn(page, lang);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_|net::|Download the React DevTools/.test(m.text())) errors.push(m.text()); });
    for (const path of ["/account", "/account/personal", "/account/contact", "/account/emergency", "/account/riding", "/account/about", "/account/purchases", "/account/workshop", "/account/delete", "/bookings"]) {
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
