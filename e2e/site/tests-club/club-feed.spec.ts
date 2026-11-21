import { expect, test, type Page } from "@playwright/test";

// The booking app's Community tab cards in /club's members' area (the owner, 2026-10-01: everything a customer sees or does
// in the booking app is also on the main website). Signed in as the stub's one member (stub-club-db.mjs: Sara Khalid; six
// rides done and a Saturday ride booked ahead, unless a scene says otherwise). Nothing real is read or written.
const STUB = `http://127.0.0.1:${process.env.STUB_PORT || 8780}`;
const SHOTS = process.env.CLUB_SHOTS || "";

async function signIn(page: Page, lang = "en", scene = "regular") {
  await page.request.post(`${STUB}/__reset`, { data: { scene } });
  const base = test.info().project.use.baseURL as string;
  await page.context().addCookies([
    { name: "mm_acct", value: "c-test~a1b2c3d4e5f6a7b8c9d0", url: base },
    { name: "NEXT_LOCALE", value: lang, url: base },
  ]);
}
type State = { me: { target: number; chosen: boolean }; mentor: { mentor: unknown; ask: { status: string } | null; offers: { num: number }[] }; writes: { fn: string; a: Record<string, unknown> }[] };
const state = async (page: Page) => (await (await page.request.get(`${STUB}/__state`)).json()) as State;
const area = (page: Page) => page.locator(".club-members");
// The area's three parts (2026-11-20, as the booking app's Community tab): a card outside Sessions is reached through the
// switch first, as a member does.
async function part(page: Page, k: "sess" | "goals" | "club") {
  const b = page.locator(`.club-members .club-part[data-part="${k}"]`);
  await b.click();
  await expect(b).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(`#club-pane-${k}`)).toBeVisible();
}
async function ordered(page: Page, sels: string[]) {
  for (let i = 1; i < sels.length; i++) {
    const a = page.locator(sels[i - 1]).first(), b = await page.locator(sels[i]).first().elementHandle();
    expect(await a.evaluate((x, y) => !!(x.compareDocumentPosition(y as Node) & Node.DOCUMENT_POSITION_FOLLOWING), b), `${sels[i - 1]} before ${sels[i]}`).toBe(true);
  }
}

test("the cards stand in the parts the app's tab has them in, each with its own words, and no head count anywhere", async ({ page }) => {
  await signIn(page);
  await page.goto("/club");
  const a = area(page);
  await expect(a.locator("#club-hub-me-h")).toHaveText("Your challenge");
  // three parts behind a switch, Sessions showing first; the card and its tier bar above them
  await expect(a.locator(".club-parts button")).toHaveText(["Sessions", "Challenges", "Club"]);
  await expect(a.locator("#club-pane-sess")).toBeVisible();
  await expect(a.locator("#club-pane-goals")).toBeHidden();
  await expect(a.locator("#club-pane-club")).toBeHidden();
  await ordered(page, [".club-members .club-cardviz", ".club-parts", "#club-pane-sess", ".club-up", "#club-hub-report-h", "#club-pane-goals", "#club-hub-yr-h", "#club-hub-me-h", ".club-hub-season", "#club-hub-club-h", "#club-pane-club", "#club-hub-mt-h", "#club-hub-vol-h", ".club-hub-inv"]);
  // the Saturday report: its photo, the member's own Saturdays this month, the staff's line
  const rep = a.locator(".club-hub-report");
  await expect(rep.locator("h3")).toContainText("Saturday report");
  await expect(rep.locator(".club-hub-minebox")).toHaveText(/Your Saturday rides this month\s*2/);
  await expect(rep.locator(".club-hub-line")).toHaveText("A calm sea and a full breakfast table.");
  await expect.poll(() => rep.locator("img.club-hub-photo").evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);
  let text = await page.locator("body").innerText();
  await part(page, "goals");
  await expect(a.locator("#club-pane-sess")).toBeHidden();
  await expect(a.locator(".club-hub-season h3")).toHaveText(["Season challenge", "Season challenge"]);
  // the season challenges: the Ramadan challenge done with its medal and Share, the Eid ride under way
  const ram = a.locator(".club-hub-season").first();
  await expect(ram.locator(".club-hub-name")).toHaveText("Ramadan challenge");
  await expect(ram.locator("svg.bdg-m")).toBeVisible();
  await expect(ram.locator(".club-hub-meta")).toContainText(/^Done · 4 of 4, until /);
  await expect(ram.getByRole("button", { name: "Share" })).toBeVisible();
  const eid = a.locator(".club-hub-season").nth(1);
  await expect(eid.locator(".club-hub-name")).toHaveText("Eid ride");
  await expect(eid.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  // the club goal reached: the member's own share and the next Saturday's target
  const club = a.locator(".club-hub-club");
  await expect(club.locator(".club-hub-name")).toHaveText("40 Saturday rides this month");
  await expect(club).toContainText("The club reached it");
  await expect(club).toContainText("You: 3 of them");
  await expect(club.locator(".club-hub-fields")).toContainText("Next Saturday");
  await expect(club.locator(".club-hub-fields")).toContainText(/Target\s*12/);
  text += await page.locator("body").innerText();
  await part(page, "club");
  // volunteers: the portal opened on the call, in a new tab
  const vol = a.locator(".club-hub-vol a");
  await expect(vol).toHaveText("Volunteer");
  await expect(vol).toHaveAttribute("href", "https://volunteer.micromobility.sa/#o/s-vol");
  await expect(vol).toHaveAttribute("target", "_blank");
  await expect(a.locator(".club-hub-inv button")).toHaveText("Invite a friend to a Saturday social ride");
  // hub_feed's club numbers, the report's counts, the year's club total and each session's riders: never on the page, in any part
  text += await page.locator("body").innerText();
  for (const n of ["873", "891", "3107", "3,107", "54021", "54,021", "24019", "24,019", "457", "871", "889", "113", "117", "119", "129", "802"]) expect(text, n).not.toContain(n);
  // the tip of the week only stands in for a report and the news
  await expect(a.locator(".club-hub-tip")).toHaveCount(0);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/club-${test.info().project.name}-en.png`, fullPage: true });
});

test("Pick your challenge: a tap picks the level at once and the choice goes; the page says the same after a reload", async ({ page }) => {
  await signIn(page);
  await page.goto("/club");
  await part(page, "goals");
  const me = area(page).locator(".club-hub-me");
  await expect(me.locator(".club-hub-name")).toHaveText("4 sessions this month");
  await expect(me.getByRole("group", { name: "Pick your challenge" }).getByRole("button")).toHaveText(["2", "4", "6"]);
  await expect(me.getByRole("button", { name: "4" })).toHaveAttribute("aria-pressed", "true");
  await me.getByRole("button", { name: "6" }).click();
  await expect(me.getByRole("group", { name: "Pick your challenge" })).toHaveCount(0);
  await expect(me.locator(".club-hub-name")).toHaveText("6 sessions this month");
  await expect(me.locator(".club-hub-meta")).toContainText(/^1 of 6, until /);
  expect((await state(page)).me).toMatchObject({ target: 6, chosen: true });
  await page.reload();
  await expect(area(page).locator(".club-hub-me .club-hub-name")).toHaveText("6 sessions this month");
  await expect(area(page).locator(".club-hub-pick")).toHaveCount(0);
});

test("under five rides the first five rides take the challenge's place", async ({ page }) => {
  await signIn(page, "en", "new");
  await page.goto("/club");
  const p5 = area(page).locator(".club-hub-p5");
  await expect(p5.locator("h3")).toHaveText("Your challenge");
  await expect(p5.locator(".club-hub-name")).toHaveText("Your first five rides");
  await expect(p5.locator(".club-hub-meta")).toHaveText("2 of 5");
  await expect(p5.locator(".club-hub-dots span.on")).toHaveCount(2);
  await expect(area(page).locator(".club-hub-me")).toHaveCount(0);
});

test("a ride done yesterday with nothing booked ahead: its Saturday report leads the Sessions part", async ({ page }) => {
  await signIn(page, "en", "recap");
  await page.goto("/club");
  await ordered(page, ["#club-pane-sess", ".club-members .club-hub-report", ".club-members .club-up"]);
  await expect(area(page).locator(".club-hub-report")).toHaveCount(1);
});

test("Your year: See your year opens the slides, moved by the member, Share my year on the last, Close back to the card", async ({ page }) => {
  await signIn(page);
  await page.goto("/club");
  await part(page, "goals");
  const yr = area(page).locator(".club-hub-yr");
  await expect(yr.locator("h3")).toHaveText("Your year so far");
  await expect(yr.locator(".club-yr-num")).toHaveText("14");
  await yr.getByRole("button", { name: "See your year" }).click();
  await expect(area(page).locator(".club-yr-slide")).toContainText(`Your ${new Date().getFullYear()} with MicroMobility`);
  await expect(area(page).locator(".club-yr-slide")).toContainText("February to December");
  const next = area(page).getByRole("button", { name: "Next", exact: true });
  await next.click();
  await expect(area(page).locator(".club-yr-slide")).toContainText(/14\s*Sessions\s*9 of 30 Saturdays/);
  await next.click();
  await expect(area(page).locator(".club-yr-kinds li")).toHaveCount(3);
  await next.click();
  await expect(area(page).locator(".club-yr-slide")).toContainText("October");
  await expect(area(page).locator(".club-yr-slide")).toContainText("Badges this year: 3");
  await expect(area(page).locator(".club-yr-slide")).not.toContainText("24019");
  await next.click();
  await expect(area(page).locator(".club-yr-slide")).toHaveText("Your next challenge is ready");
  await expect(area(page).getByRole("button", { name: "Share my year" })).toBeVisible();
  await area(page).locator(".club-yr-close").click();
  await expect(area(page).getByRole("button", { name: "See your year" })).toBeFocused();
});

test("the invitation: the app's own message with the member's code goes to the share sheet", async ({ page }) => {
  await signIn(page);
  await page.addInitScript(() => {
    (window as unknown as { __shared: string[] }).__shared = [];
    Object.defineProperty(navigator, "share", { configurable: true, value: async (d: { text?: string }) => { (window as unknown as { __shared: string[] }).__shared.push(d.text || ""); } });
  });
  await page.goto("/club");
  await part(page, "club");
  await area(page).getByRole("button", { name: "Invite a friend to a Saturday social ride" }).click();
  const shared = await page.evaluate(() => (window as unknown as { __shared: string[] }).__shared);
  expect(shared).toEqual(["Hi! I ride with the MicroMobility community in Jeddah and I would love you to join us on a Saturday social ride. Please fill in this form to apply: https://micromobility.sa/community/registration?inv=INV7Q2&lang=en"]);
});

test("Mentorship: register as a mentor, offer to help a student (number, university and field only), withdraw, and ask for a mentor", async ({ page }) => {
  await signIn(page);
  await page.goto("/club");
  await part(page, "club");
  const card = area(page).locator(".club-hub-mt");
  await expect(card.locator(".club-hub-name")).toHaveText("Help a member starting university");
  await expect(card).toContainText("Students looking for a mentor: 2");
  await card.getByRole("button", { name: "Register as a mentor" }).click();
  const dlg = page.locator("dialog.club-mt-dlg[open]");
  await expect(dlg.locator("h2")).toHaveText("Register as a mentor");
  // a centred pop-up
  const box = await dlg.boundingBox(), vp = page.viewportSize();
  expect(Math.abs(box!.x + box!.width / 2 - vp!.width / 2)).toBeLessThan(4);
  await dlg.getByRole("button", { name: "Send" }).click();
  await expect(dlg.locator(".club-mt-msg")).toHaveText(["Please fill this in.", "Please fill this in.", "Please pick at least one.", "Please fill this in.", "Please tick to agree."]);
  expect((await state(page)).writes).toHaveLength(0);
  await dlg.getByLabel("Where you studied").fill("King Abdulaziz University");
  await dlg.getByLabel("What you studied").fill("Engineering");
  await dlg.getByRole("button", { name: "CV review" }).click();
  await dlg.getByLabel("How your experience could help students").fill("I studied there and now hire graduates.");
  await dlg.getByText("I agree to the mentorship rules").click();
  await dlg.getByRole("button", { name: "Send" }).click();
  await expect(page.locator("dialog.club-mt-dlg[open]")).toHaveCount(0);
  expect((await state(page)).mentor.mentor).toMatchObject({ university: "King Abdulaziz University", helps: ["cv"] });
  await expect(card.getByRole("button", { name: "Register as a mentor" })).toHaveCount(0);
  await card.getByRole("button", { name: "See the students" }).click();
  const pg = area(page).locator(".club-mt-page");
  await expect(pg.locator(".club-mt-prof")).toHaveCount(2);
  await expect(pg.locator(".club-mt-prof").first()).toHaveText(/Profile 12\s*King Abdulaziz University\s*Computer science\s*I can help/);
  await pg.locator(".club-mt-prof").first().getByRole("button", { name: "I can help" }).click();
  await expect(dlg.locator("h2")).toHaveText("Profile 12");
  await expect(dlg.getByRole("button", { name: "Lived or studied in this city" })).toHaveCount(0); // a mentee's city reaches staff only
  await expect(dlg.getByRole("button", { name: "CV review" })).toHaveAttribute("aria-pressed", "true"); // the mentor's own helps, picked
  await dlg.getByRole("button", { name: "Same university" }).click();
  await dlg.getByLabel("How could your experience help?").fill("Same faculty.");
  await dlg.getByRole("button", { name: "Send" }).click();
  await expect(pg.locator(".club-mt-prof").first().locator(".club-mt-pill")).toHaveText("Offer sent");
  await expect(pg.locator(".club-mt-row")).toHaveText(/Profile 12.*Offer sent\s*Withdraw offer/s);
  await pg.locator(".club-mt-row").getByRole("button", { name: "Withdraw offer" }).click();
  await expect(dlg.locator("h2")).toHaveText("Withdraw this offer?");
  await dlg.getByRole("button", { name: "Withdraw offer" }).click();
  await expect(pg.locator(".club-mt-row")).toHaveCount(0);
  expect((await state(page)).mentor.offers).toHaveLength(0);
  // a student asks for a mentor
  await pg.getByRole("button", { name: "Register as a mentee" }).click();
  await expect(dlg.locator("h2")).toHaveText("Register as a mentee");
  await dlg.getByLabel("University", { exact: true }).fill("Effat University");
  await dlg.getByLabel("Field of study").fill("Architecture");
  await dlg.getByLabel("City").fill("Jeddah");
  await dlg.getByLabel("Country").selectOption("SA");
  await expect(dlg.getByLabel("Country").locator("option", { hasText: "Israel" })).toHaveCount(0);
  await dlg.getByRole("button", { name: "Choosing subjects" }).click();
  await dlg.getByText("I agree to the mentorship rules").click();
  await dlg.getByRole("button", { name: "Send" }).click();
  await expect(pg.locator(".club-mt-ask .club-mt-pill")).toHaveText("Waiting for our team");
  await expect(pg.locator(".club-mt-ask")).toContainText("Jeddah, Saudi Arabia");
  expect((await state(page)).mentor.ask).toMatchObject({ status: "pending" });
  if (SHOTS) await pg.screenshot({ path: `${SHOTS}/club-mentor-${test.info().project.name}-en.png` });
  await pg.getByRole("button", { name: "Close", exact: true }).click();
  await expect(card.getByRole("button", { name: "See the students" })).toBeFocused();
});

test("in Arabic: the app's own words, right to left", async ({ page }) => {
  await signIn(page, "ar");
  await page.goto("/club");
  const a = area(page);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(a.locator(".club-parts button")).toHaveText(["الجلسات", "التحديات", "النادي"]);
  await expect(a.locator("#club-hub-me-h")).toHaveText("تحديك");
  await expect(a.locator("#club-hub-club-h")).toHaveText("هدف المجتمع");
  await expect(a.locator(".club-hub-season .club-hub-name").first()).toHaveText("تحدي رمضان");
  await expect(a.locator("#club-hub-report-h")).toContainText("تقرير السبت");
  await expect(a.locator("#club-hub-mt-h")).toHaveText("الإرشاد");
  await expect(a.locator(".club-hub-inv button")).toHaveText("ادعُ صديقًا إلى جولة السبت الاجتماعية");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/club-${test.info().project.name}-ar.png`, fullPage: true });
});

test("/club#challenges (a badge's pop-up, the rating's last screen) opens Challenges; the switch spans a phone in one row", async ({ page }) => {
  await signIn(page);
  await page.goto("/club#challenges");
  await expect(area(page).locator("#club-pane-goals")).toBeVisible();
  await expect(area(page).locator("#club-pane-sess")).toBeHidden();
  await expect(area(page).locator('.club-part[data-part="goals"]')).toHaveAttribute("aria-pressed", "true");
  const geo = await area(page).locator(".club-parts").evaluate((bar) => {
    const r = bar.getBoundingClientRect(), b = [...bar.querySelectorAll("button")].map((x) => x.getBoundingClientRect());
    return { n: b.length, oneRow: new Set(b.map((x) => Math.round(x.top))).size === 1, inside: b.every((x) => x.left >= r.left - 0.5 && x.right <= r.right + 0.5), side: document.documentElement.scrollWidth <= window.innerWidth };
  });
  expect(geo).toEqual({ n: 3, oneRow: true, inside: true, side: true });
  await part(page, "sess");
  await expect(area(page).locator("#club-pane-goals")).toBeHidden();
});
