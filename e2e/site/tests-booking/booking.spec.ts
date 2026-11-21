import { expect, test, type Page, type Route } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

// Booking on micromobility.sa itself (the user, 2026-11-19: "make sure all customers can do everything they want in the
// booking app to do it on the main website"): Experiences' last step opens the booking steps on the date picked
// (/experiences?ev=&session=, BookingFlow), and the booking goes through the site's own /api/booking to the stub's
// customer_create_booking (stub-booking-db.mjs: a circuit night, a Saturday Social Ride for members, a men-only pool session,
// yoga and a Farm House Night; one rider, Sara Khalid, a member, female, 168 cm). The pop-ups the layout asks of a signed-in
// rider (the emergency contact, the sport question, a pending waiver or rating) are answered here as already done.
// Nothing real is read or written.
const STUB = `http://127.0.0.1:${process.env.STUB_PORT || 8796}`;
const AXE = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const json = (r: Route, body: unknown, status = 200) => r.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

async function scene(page: Page, s: Record<string, unknown> = {}, signedIn = true) {
  await page.request.post(`${STUB}/__reset`);
  if (Object.keys(s).length) await page.request.post(`${STUB}/__scene`, { data: s });
  const base = test.info().project.use.baseURL as string;
  if (signedIn) await page.context().addCookies([{ name: "mm_acct", value: "c-test~a1b2c3d4e5f6a7b8c9d0", url: base }]);
  await page.route(/cloudflareinsights\.com|challenges\.cloudflare\.com|google\.com\/maps|gstatic\.com|googleapis\.com/, (r) => r.abort());
  await page.route("**/api/account/emergency", (r) => json(r, { signedIn: true, need: false, two: true }));
  await page.route("**/api/account/sport", (r) => json(r, { signedIn: true, need: false }));
  await page.route("**/api/account/birthday", (r) => json(r, { signedIn: true, on: false }));
  for (const p of ["pending-waiver", "pending-share", "pending-race-reg", "pending-club", "pending-rating"]) await page.route(`**/api/account/${p}*`, (r) => json(r, { signedIn: true, pending: null }));
  await page.route("**/api/google-wallet**", (r) => json(r, { ok: false }, 501));
}
const state = async (page: Page) => (await (await page.request.get(`${STUB}/__state`)).json()) as { bookings: Record<string, unknown>[]; writes: { fn: string; a: Record<string, unknown> }[] };
async function axe(page: Page) {
  await page.addScriptTag({ content: AXE });
  return page.evaluate(async () => {
    const w = window as unknown as { axe: { run(d: Element, o: object): Promise<{ violations: { id: string; impact: string; nodes: unknown[] }[] }> } };
    const r = await w.axe.run(document.querySelector(".xs.bk")!, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
    return r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id} x${v.nodes.length}`);
  });
}
const shot = async (page: Page, name: string) => {
  if (!process.env.SHOTS) return;
  const w = page.viewportSize()?.width ?? 0;
  await page.screenshot({ path: `${process.env.SHOTS}/book-${name}-${w}.png`, fullPage: false });
};

for (const lang of ["en", "ar"] as const) {
  test(`a circuit night is booked on the site, paid at the desk (${lang})`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await scene(page);
    await page.goto(`/experiences?ev=jcc&session=t-jcc&lang=${lang}`);
    await expect(page.locator("html")).toHaveAttribute("dir", lang === "ar" ? "rtl" : "ltr");
    // the date was picked on Experiences: the steps open on the riders, the account's height already there
    await expect(page.locator("#bk-riders-h")).toHaveText(lang === "ar" ? "بيانات الراكب" : "Rider details");
    await expect(page.locator(".sx6-fact-v")).toHaveText(lang === "ar" ? "168 سم" : "168 cm");
    // no "Any" for a rider; the bike types the circuit rents, each with its fare
    await expect(page.locator(".bk-pill-n")).not.toContainText([lang === "ar" ? "بلا تفضيل" : "No preference"]);
    await shot(page, `riders-${lang}`);
    await page.locator('.bk-pill[data-ty="Hybrid"]').click();
    await page.locator(".bk-foot .bk-btn").click();
    await expect(page.locator("#bk-review-h")).toBeVisible();
    // Book rests until the waiver is ticked; no online payment here
    const book = page.locator(".bk-foot .bk-btn.grow");
    await expect(book).toBeDisabled();
    await expect(page.locator(".bk-paybox")).toHaveCount(0);
    expect(await axe(page)).toEqual([]);
    await shot(page, `review-${lang}`);
    await page.locator("#bk-wv-cb").check();
    await book.click();
    await expect(page.locator("#bk-done-h")).toHaveText(lang === "ar" ? "تم حجزك" : "You’re booked");
    await expect(page.locator(".tk-card .tk-num")).toHaveText(/#\d+/);
    await shot(page, `done-${lang}`);
    const st = await state(page);
    const made = st.writes.find((w) => w.fn === "customer_create_booking")!.a.p_entries as Record<string, unknown>[];
    expect(made).toHaveLength(1);
    expect(made[0]).toMatchObject({ session_id: "t-jcc", type_preference: "Hybrid", height: 168, size: "S", seat_only: true, waiver_version: "2026-11-v4", paid: false });
    expect(made[0]).not.toHaveProperty("price"); // the database prices every row
    expect(errors).toEqual([]);
  });
}

test("a locker for the evening on the review: a time, a door, its fee in the total, reserved on the booking", async ({ page }) => {
  await scene(page);
  await page.goto("/experiences?ev=jcc&session=t-jcc&lang=en");
  await page.locator('.bk-pill[data-ty="Hybrid"]').click();
  await page.locator(".bk-foot .bk-btn").click();
  const lk = page.locator(".bk-card.bk-lk");
  await expect(lk).toBeVisible();
  await shot(page, "locker");
  await lk.getByRole("radio").first().click();
  await page.locator("#bk-wv-cb").check();
  // a time with no door yet: Book waits
  const book = page.locator(".bk-foot .bk-btn.grow");
  if (await book.isDisabled()) await lk.locator("button:not([disabled])").filter({ hasText: /^\d+$/ }).first().click();
  await expect(book).toBeEnabled();
  await expect(page.locator(".bk-sum-tot")).not.toContainText("57.50");
  await book.click();
  await expect(page.locator("#bk-done-h")).toBeVisible();
  const st = await state(page);
  expect(st.writes.map((w) => w.fn)).toEqual(["customer_create_booking", "customer_locker_reserve"]);
  expect(st.writes[1].a).toMatchObject({ p_booking_ids: [st.bookings[0].id] });
});

test("a party of two on the circuit: each rider named, and the account's cap on the party", async ({ page }) => {
  await scene(page);
  await page.goto("/experiences?ev=jcc&session=t-jcc&lang=en");
  await page.locator(".sx6-party-row").first().getByRole("button", { name: "One adult more" }).click();
  // rider 1 is the account holder; rider 2 needs a name and a height
  await page.locator('.bk-pill[data-ty="Road"]').first().click();
  await page.locator(".bk-foot .bk-btn").click();
  await expect(page.locator(".bk-ferr")).toHaveText(/height between 100 and 250 cm|full name/);
  await page.locator("#bk-name-in-1").fill("Omar-Ali Khalid");
  await expect(page.locator("#bk-name-in-1")).toHaveValue("Omar Ali Khalid"); // a dash becomes a space
  await page.locator("#bk-h-1").fill("١٨٠"); // Arabic-Indic digits are read
  await expect(page.locator("#bk-h-1")).toHaveValue("180");
  await page.locator("#bk-rb-1 .bk-pill[data-ty=\"Mountain\"]").click();
  await page.locator(".bk-foot .bk-btn").click();
  await expect(page.locator("#bk-review-h")).toBeVisible();
  await page.locator("#bk-wv-cb").check();
  await page.locator(".bk-foot .bk-btn.grow").click();
  await expect(page.locator("#bk-done-h")).toBeVisible();
  const made = (await state(page)).writes.find((w) => w.fn === "customer_create_booking")!.a.p_entries as Record<string, unknown>[];
  expect(made.map((e) => [e.name, e.type_preference, e.height])).toEqual([["Sara Khalid", "Road", 168], ["Omar Ali Khalid", "Mountain", 180]]);
});

test("a Saturday Social Ride as a member: the group, no price, Reservation received", async ({ page }) => {
  await scene(page);
  await page.goto("/experiences?ev=community&session=t-sat&lang=en");
  await expect(page.locator("#bk-riders-h")).toBeVisible();
  // one place per member: no party on a community ride, and no price on a free ride
  await expect(page.locator(".sx6-party")).toHaveCount(0);
  await expect(page.locator(".bk-pill-p .tk-amt")).toHaveCount(0);
  await page.locator('.bk-pill[data-ty="Hybrid"]').click();
  await page.locator(".bk-foot .bk-btn").click();
  await expect(page.locator(".bk-ferr")).toHaveText("Choose your group");
  await page.locator('.bk-pill[data-g="beg"]').click();
  await page.locator(".bk-foot .bk-btn").click();
  await expect(page.locator(".bk-promo")).toHaveCount(0); // a free ride shows no pay controls
  await expect(page.locator(".bk-sum-tot")).toContainText("Free");
  await page.locator("#bk-wv-cb").check();
  await page.locator(".bk-foot .bk-btn.grow").click();
  await expect(page.locator("#bk-done-h")).toHaveText("Reservation received");
  const made = (await state(page)).writes.find((w) => w.fn === "customer_create_booking")!.a.p_entries as Record<string, unknown>[];
  expect(made[0]).toMatchObject({ session_id: "t-sat", ride_group: "beg", approval: "pending", type_preference: "Hybrid" });
});

test("a Saturday Social Ride for someone who is not a member: the members' pop-up, and nothing is sent", async ({ page }) => {
  await scene(page, { member: false });
  await page.goto("/experiences?ev=community&session=t-sat&lang=en");
  const pop = page.getByRole("dialog");
  await expect(pop.locator(".bk-pop-title")).toHaveText("Community members only");
  await expect(pop.getByRole("link", { name: "Apply for MicroMobility’s Community Membership" })).toHaveAttribute("href", "/community/registration");
  await shot(page, "members");
  expect((await state(page)).writes).toEqual([]);
});

test("a refusal the database gives is said in the booking app's words: a bike type full since the page was read", async ({ page }) => {
  await scene(page, { refuse: "TYPE_FULL" });
  await page.goto("/experiences?ev=jcc&session=t-jcc&lang=en");
  await page.locator('.bk-pill[data-ty="Road"]').click();
  await page.locator(".bk-foot .bk-btn").click();
  await page.locator("#bk-wv-cb").check();
  await page.locator(".bk-foot .bk-btn.grow").click();
  // back on the riders, at the type, in the app's words
  await expect(page.locator("#bk-riders-h")).toBeVisible();
  await expect(page.locator(".bk-ferr")).toHaveText("That bike type is full on this ride. Please choose another.");
  await shot(page, "refused");
  expect((await state(page)).bookings).toEqual([]);
});

test("a bike type whose own places are taken says Full on its pill and cannot be picked", async ({ page }) => {
  await scene(page, { fullTypes: ["Road"] });
  await page.goto("/experiences?ev=jcc&session=t-jcc&lang=en");
  const road = page.locator('.bk-pill[data-ty="Road"]');
  await expect(road).toHaveAttribute("aria-disabled", "true");
  await expect(road.locator(".bk-pill-p")).toHaveText("Full");
  await road.click({ force: true });
  await expect(road).toHaveAttribute("aria-checked", "false");
  await expect(page.locator('.bk-pill[data-ty="Hybrid"] .bk-pill-p')).toContainText("57.50");
  await shot(page, "type-full");
});

test("members book first: the database's MEMBERS_FIRST says when everyone may book", async ({ page }) => {
  await scene(page, { refuse: "MEMBERS_FIRST" });
  await page.goto("/experiences?ev=jcc&session=t-jcc&lang=en");
  await page.locator('.bk-pill[data-ty="Road"]').click();
  await page.locator(".bk-foot .bk-btn").click();
  await page.locator("#bk-wv-cb").check();
  await page.locator(".bk-foot .bk-btn.grow").click();
  await expect(page.locator(".bk-err")).toHaveText(/^Members book first on this date\. Everyone can book from .+\.$/);
});

test("a men-only pool session to a woman's account: the gender pop-up, and nothing is sent", async ({ page }) => {
  await scene(page);
  await page.goto("/experiences?ev=community&session=t-swim&lang=en");
  await expect(page.getByRole("dialog").locator(".bk-pop-title")).toHaveText("This session is for men only.");
  await expect(page.getByRole("dialog").locator(".sg-chip")).toHaveText("Men only");
  expect((await state(page)).writes).toEqual([]);
});

test("yoga: no bike, no riders step, the activity waiver, one place", async ({ page }) => {
  await scene(page);
  await page.goto("/experiences?ev=community&session=t-yg&lang=en");
  await expect(page.locator("#bk-review-h")).toBeVisible();
  await expect(page.locator(".bk-stepper .bk-step-wrap")).toHaveCount(2);
  await expect(page.locator("#bk-waiver .sx6-fold-tog")).toHaveText("Activity waiver");
  await page.locator("#bk-wv-cb").check();
  await page.locator(".bk-foot .bk-btn.grow").click();
  await expect(page.locator("#bk-done-h")).toBeVisible();
  const made = (await state(page)).writes.find((w) => w.fn === "customer_create_booking")!.a.p_entries as Record<string, unknown>[];
  expect(made).toHaveLength(1);
  expect(made[0]).toMatchObject({ session_id: "t-yg", type_preference: "None", size: "", height: null, waiver_version: "activity-2026-11-v4" });
});

test("the Farm House Night: the member and their family by name, its own waiver", async ({ page }) => {
  await scene(page);
  await page.goto("/experiences?ev=community&session=t-fh&lang=en");
  await expect(page.locator("#bk-riders-h")).toHaveText("People coming");
  await expect(page.locator("#bk-name-in-0")).toHaveValue("Sara Khalid");
  await page.getByRole("button", { name: "More" }).click();
  await page.getByRole("button", { name: "More" }).click();
  await page.locator(".bk-foot .bk-btn").click();
  await expect(page.locator(".bk-ferr")).toHaveText("Please enter your full name (first and last name).");
  await page.locator("#bk-name-in-1").fill("Lina Khalid");
  await page.locator("#bk-name-in-2").fill("Yusuf Khalid");
  await shot(page, "farm");
  await page.locator(".bk-foot .bk-btn").click();
  await expect(page.locator("#bk-waiver .sx6-fold-tog")).toHaveText("Farm House Night waiver");
  await page.locator("#bk-wv-cb").check();
  await page.locator(".bk-foot .bk-btn.grow").click();
  await expect(page.locator("#bk-done-h")).toHaveText("Reservation received");
  const made = (await state(page)).writes.find((w) => w.fn === "customer_create_booking")!.a.p_entries as Record<string, unknown>[];
  expect(made.map((e) => e.name)).toEqual(["Sara Khalid", "Lina Khalid", "Yusuf Khalid"]);
  expect(made.every((e) => e.waiver_version === "farm-2026-11-v1" && e.approval === "pending")).toBe(true);
});

test("signed out: the sign-in pop-up on the date, with Create account on this site coming back to it", async ({ page }) => {
  await scene(page, {}, false);
  await page.goto("/experiences?ev=jcc&session=t-jcc&lang=en");
  const pop = page.getByRole("dialog");
  await expect(pop.locator(".bk-pop-title")).toHaveText("Sign in to book");
  const create = pop.getByRole("link", { name: "Create account" });
  await expect(create).toHaveAttribute("href", /^\/signup\?next=/);
  expect(decodeURIComponent((await create.getAttribute("href"))!)).toContain("/experiences?ev=jcc&session=t-jcc");
  await shot(page, "signin");
});

test("Experiences' last step opens the booking steps here for a kind booked on the site", async ({ page }) => {
  await scene(page);
  await page.goto("/experiences?lang=en");
  const html = await page.content();
  expect(html).not.toContain("experiences.micromobility.sa/?lang=en&amp;ev=jcc&amp;session=t-jcc");
  await page.goto("/experiences?ev=nothing&session=t-jcc&lang=en");
  await expect(page.locator(".xs.bk")).toHaveCount(0); // an unknown card: the list as usual
});
