import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// The volunteer portal as rebuilt on 2026-11-09 (the owner's decision sheet) and enhanced on 2026-11-11 (the report's
// fixes, Tier 1 and Tier 2): Home with its next-step card, Opportunities, Updates and Profile, the one-screen work page,
// the lead's team, the certificates. Against stub-db.mjs, never a real database.
const STUB = Number(process.env.STUB_PORT || 8801);
const BD = "2099-11-05-bd";
const NAME = "MicroMobility Blood Donation";
const stub = (page: Page, path: string, data: unknown = {}) => page.request.post(`http://127.0.0.1:${STUB}/${path}`, { data });
type State = { shifts: Record<string, { status: string; withdraw_reason?: string | null; plan_leave?: string | null; coming_at?: string | null }>;
  feedback: Record<string, { rating: number; again: string | null; comment: string | null }>; rider: { motive: string | null };
  bookings: { id: string; checked_in: boolean }[]; mates: { shift: number; clock_in: string | null }[] };
const state = async (page: Page) => (await (await stub(page, "__state")).json()) as State;

test.beforeEach(async ({ request }, info) => {
  info.setTimeout(210_000); // room for two waits on the sign-in meter
  await request.post(`http://127.0.0.1:${STUB}/__reset`);
});

function watchCsp(page: Page): string[] {
  const seen: string[] = [];
  page.on("console", (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) seen.push(m.text()); });
  page.on("pageerror", (e) => seen.push(String(e)));
  return seen;
}

// iPhone Safari's rule for new windows: one opened straight from a tap goes through, one opened after a wait (the
// server's answer) is refused and window.open gives null. Chromium lets a late one through for five seconds, which is
// how Get certificate passed here while it never opened on an iPhone (2026-11-10). The tap's own handlers run before
// the window's bubbling listener, so anything later is not the tap.
async function safariWindows(page: Page): Promise<void> {
  await page.addInitScript(() => {
    let tap = false;
    window.addEventListener("click", (e) => { if (e.isTrusted) tap = true; }, true);
    window.addEventListener("click", () => { tap = false; });
    const open = window.open.bind(window);
    window.open = (...a: Parameters<typeof window.open>) => (tap ? open(...a) : null);
  });
}

// The Worker meters sign-in per connection, and `wrangler dev` enforces it, every test arriving from 127.0.0.1: a run that
// signs in more often than that waits for the next minute instead of failing.
async function submit(page: Page, login: string, pwd: string): Promise<void> {
  for (let i = 0; i < 3; i++) {
    // filled on every try: the page clears the password when it says why a try failed
    await page.getByLabel("Email or mobile number").fill(login);
    await page.getByLabel("Password", { exact: true }).fill(pwd);
    const answered = page.waitForResponse((r) => r.url().endsWith("/api/login"));
    await page.locator("form").getByRole("button", { name: "Sign in" }).click();
    const res = await answered;
    if (res.status() !== 429 || (await res.json().catch(() => ({}))).error !== "RATE_LIMIT") return;
    await page.waitForTimeout(61_000);
  }
}
/** Signs in and waits for the page to land where it sends them (signed in, the page has its tabs; the work page hides
 *  them on a phone). */
async function signIn(page: Page): Promise<void> {
  await submit(page, "sara@example.com", "Pass1234");
  await expect(page.locator("body.signed-in")).toHaveCount(1);
  await expect(page.locator("nav.tabs")).toHaveCount(1);
}
const tab = (page: Page, name: string) => page.locator("nav.tabs").getByRole("link", { name });
/** The one-time Add to Home Screen how-to, after the first "I want to help": closed. */
async function notNow(page: Page): Promise<void> {
  const how = page.locator("dialog.ask-a2hs");
  await expect(how).toBeVisible();
  await how.getByRole("button", { name: "Not now" }).click();
  await expect(how).toHaveCount(0);
}

/** An approved volunteer who offered to help on the blood night and was accepted, signed in on Home. */
async function accepted(page: Page, caps?: Record<string, boolean>): Promise<void> {
  await stub(page, "__approve");
  await page.goto(`/#o/${BD}`);
  await signIn(page);
  await page.getByRole("button", { name: "I want to help" }).click();
  await notNow(page);
  await expect(page.locator("#opp-action")).toContainText("Interest sent. Our team will get back to you.");
  await stub(page, "__accept", { id: BD, role: "Guide" });
  if (caps) await stub(page, "__caps", { id: BD, caps });
  await page.goto("/#me");
  await page.reload();
}
/** On the work page; the agreement comes first, once, and Continue waits for the tick. */
async function atWork(page: Page, first = true): Promise<void> {
  await page.locator("#next-shift").getByRole("link", { name: "Start work" }).click();
  if (first) {
    await expect(page.getByRole("heading", { name: "Before you start" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
    await page.getByLabel("I have read this and I agree").check();
    await page.getByRole("button", { name: "Continue" }).click();
  }
  await expect(page.locator("#w-q")).toBeVisible();
}
/** A certificate's check, metered like a sign-in: a run that checks more often than that waits for the next minute. */
async function checkCert(page: Page, code: string): Promise<void> {
  for (let i = 0; i < 3; i++) {
    await page.goto(`/#check/${code}`);
    await page.reload();
    const said = page.locator("#check-res, main .note[role=alert]").first();
    await expect(said).toBeVisible();
    if (!/Too many tries/.test(await said.innerText())) return;
    await page.waitForTimeout(61_000);
  }
}
const row = (page: Page, id: string) => page.locator(`#w-found .row[data-id="${id}"]`);
const noSideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
const step = (page: Page) => page.locator("#next-step");

test("nobody enters signed out: every address is the sign-in, the server refuses the list, and a work link survives the sign-in", async ({ page }) => {
  const errors = watchCsp(page);
  for (const path of ["/", `/#o/${BD}`, "/#me", "/#updates", "/#profile", `/#work/${BD}`, `/#team/${BD}`, "/#cert"]) {
    await page.goto(path);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Volunteer sign-in" }), path).toBeVisible();
    await expect(page.locator("nav.tabs")).toHaveCount(0);
    await expect(page.getByText(NAME)).toHaveCount(0);
  }
  expect(await page.evaluate(async () => (await fetch("/api/rpc/volunteer_opportunities", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })).status)).toBe(401);
  // the calendar file is the volunteer's own: signed out it is the sign-in
  const cal = await page.request.get(`/cal/${BD}.ics`, { maxRedirects: 0 });
  expect(cal.status()).toBe(302);
  // a certificate's check is open to anyone with its code
  await page.goto("/#check/ABCDEF123456");
  await expect(page.getByRole("heading", { name: "Check a certificate" })).toBeVisible();
  await page.goto("/");
  await signIn(page);
  await expect(page).toHaveURL(new RegExp(`#work/${BD}$`)); // the last work page an address named, after signing in (fix 14)
  await expect(page.getByText("You are not on the team for this session.")).toBeVisible();
  // the bare address is Home once signed in (fix 14)
  await page.goto("/");
  await expect(page.locator("h1.greet")).toContainText("Sara");
  for (const name of ["Home", "Opportunities", "Updates", "Profile"]) await expect(tab(page, name)).toBeVisible();
  await expect(tab(page, "Home")).toHaveAttribute("aria-current", "page");
  await expect(tab(page, "Opportunities")).toHaveAttribute("href", "#opps");
  expect(errors).toEqual([]);
});

test("a wrong password is said; the password can be shown, pasted and filled by a password manager; the other ways in go to the booking app", async ({ page }) => {
  const errors = watchCsp(page);
  await page.goto("/");
  await page.locator("form").getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toContainText("Enter your email or mobile number");
  await expect(page.getByLabel("Email or mobile number")).toHaveAttribute("autocomplete", "username");
  const pwd = page.getByLabel("Password", { exact: true });
  await expect(pwd).toHaveAttribute("autocomplete", "current-password");
  await expect(pwd).toHaveAttribute("type", "password");
  await pwd.fill("secret");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(pwd).toHaveAttribute("type", "text");
  await expect(page.getByRole("button", { name: "Hide password" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Hide password" }).click();
  await expect(pwd).toHaveAttribute("type", "password");
  await submit(page, "sara@example.com", "wrong");
  await expect(page.getByRole("alert")).toContainText("Wrong email, mobile number or password");
  await expect(page.getByLabel("Email or mobile number")).toHaveValue("sara@example.com");
  await expect(page.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", /\/signup\?handoff=volunteer$/);
  await expect(page.getByRole("link", { name: "Forgot your password?" })).toHaveAttribute("href", /handoff=volunteer&auth=forgot$/);
  // No Google or Apple sign-in (the owner, 2026-11-09): only these two ways in, nothing else.
  await expect(page.locator("form .alt a")).toHaveCount(2);
  await expect(page.getByText(/Google|Apple/)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("the profile first, then staff's yes: no offers until approved, and the next step says where they stand", async ({ page }) => {
  const errors = watchCsp(page);
  await page.goto(`/#o/${BD}`);
  await signIn(page);
  await expect(page).toHaveURL(new RegExp(`#o/${BD}`)); // back to the opportunity they came for
  await expect(page.locator("#opp-action")).toContainText("First, set up your volunteer profile.");
  await expect(page.getByRole("button", { name: "I want to help" })).toHaveCount(0);
  await tab(page, "Home").click();
  await expect(step(page)).toHaveAttribute("data-step", "profile");
  await expect(step(page)).toContainText("First, set up your volunteer profile.");
  await expect(page.locator("#stats")).toHaveCount(0); // no 0 / 0 for someone new (fix 11)
  await step(page).getByRole("link", { name: "Set up my profile" }).click();
  await expect(page).toHaveURL(/#profile$/);
  // the account's own birth date and emergency contact are shown, kept in the booking app
  await expect(page.locator("#fact-dob")).toContainText("1995");
  await expect(page.locator("#fact-em")).toContainText("Huda Haddad");
  await expect(page.locator("#fact-em")).toContainText("+966 50 000 0009"); // fix 16
  await expect(page.locator("dialog.ask-owed")).toHaveCount(0);
  // at least one day
  await page.getByRole("button", { name: "Send my profile" }).click();
  await expect(page.getByText("Pick at least one day.")).toBeVisible();
  await page.getByRole("button", { name: "Friday" }).click();
  await page.getByRole("button", { name: "Saturday" }).click();
  await expect(page.getByRole("button", { name: "Friday" })).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Skills or experience").fill("First aid");
  await page.getByRole("button", { name: "M", exact: true }).click();
  await page.getByRole("button", { name: "Send my profile" }).click();
  await expect(page).toHaveURL(/#me$/);
  await expect(step(page)).toHaveAttribute("data-step", "waiting");
  await expect(page.getByText("Your profile is waiting for staff.")).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Set up my profile" })).toHaveCount(0);
  await page.goto(`/#o/${BD}`);
  await expect(page.locator("#opp-waiting")).toHaveText("Your profile is waiting for staff.");
  await expect(page.getByRole("button", { name: "I want to help" })).toHaveCount(0);
  // the profile keeps what was saved, and a second Save says so on its own button
  await tab(page, "Profile").click();
  await expect(page.getByText("Waiting for staff")).toBeVisible();
  await expect(page.getByRole("button", { name: "Saturday" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "M", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.locator("#prof-form").getByRole("button", { name: "Save" }).click();
  await expect(page.locator("#prof-form").getByRole("button", { name: "Saved" })).toBeVisible();
  await expect(page.locator("main .note")).toHaveCount(0); // no bar after an action
  // the certificates have a fixed place in Profile too
  await expect(page.locator("#prof-certs")).toHaveAttribute("href", "#cert");
  expect(errors).toEqual([]);
});

test("a missing birth date or emergency contact is asked for before the form, in a pop-up that leads to the booking app", async ({ page }) => {
  const errors = watchCsp(page);
  await stub(page, "__account", { emergency: null });
  await page.goto("/#profile");
  await signIn(page);
  await page.goto("/#profile");
  const ask = page.locator("dialog.ask-owed");
  await expect(ask).toBeVisible();
  await expect(ask).toContainText("Your account needs a few details");
  await expect(ask).toContainText("Emergency contact");
  await expect(ask.getByRole("link", { name: "Add details" })).toHaveAttribute("href", "https://experiences.micromobility.sa/account");
  await page.keyboard.press("Escape"); // it is not skipped
  await expect(ask).toBeVisible();
  await expect(page.locator("#fact-em")).toContainText("Missing");
  await ask.getByRole("button", { name: "Home" }).click();
  await expect(page).toHaveURL(/#me$/);
  await expect(step(page)).toHaveAttribute("data-step", "details");
  await expect(step(page).getByRole("link", { name: "Add details" })).toHaveAttribute("href", "https://experiences.micromobility.sa/account");
  // a refusal about a missing detail carries the same button (VOL_DOB on any new offer, 20261111140000)
  await stub(page, "__account", { emergency: { name: "Huda Haddad", phone: "+966500000009", relation: "Sister" }, birth_date: null });
  await stub(page, "__approve");
  await page.goto(`/#o/${BD}`);
  await page.reload();
  await page.getByRole("button", { name: "I want to help" }).click();
  const said = page.locator("main .note[role=alert]");
  await expect(said).toContainText("Add your birth date to your account first, then come back.");
  await expect(said.getByRole("link", { name: "Add details" })).toHaveAttribute("href", "https://experiences.micromobility.sa/account");
  expect(errors).toEqual([]);
});

test("approved: one tap to offer help, busy while it goes, the Home Screen how-to once, and one tap back out", async ({ page }) => {
  const errors = watchCsp(page);
  await stub(page, "__approve");
  await page.goto("/");
  await signIn(page);
  // the next step is the next opportunity they could say yes to
  await expect(step(page)).toHaveAttribute("data-step", "opp");
  await expect(step(page)).toContainText(NAME);
  await tab(page, "Opportunities").click();
  const card = page.locator(`a.opp[data-id="${BD}"]`);
  await expect(card).toContainText(NAME);
  await expect(card).toContainText("5 places left");
  await expect(card).toContainText("Roles: Check-in, Guide"); // a line, not chips (fix 9)
  await expect(card.locator(".chip")).toHaveCount(0);
  await expect(card.locator(".dblock")).toContainText("5");
  await expect(page.locator('a.opp[data-id="2099-12-01"]')).toContainText("Sign-up closed");
  await card.click();
  await expect(page.getByText("Help donors at the door.")).toBeVisible();
  await expect(page.getByText("Meet at gate 3.")).toHaveCount(0); // the briefing is for those accepted
  await expect(page.locator(".opp-head")).toContainText("Register before"); // sign-up closes before the event (fix 4)
  // what staff wrote for the day, and the partner and skills
  for (const t of ["North gate, by the flags", "Comfortable shoes and a cap", "Water and a snack", "At the desk from 4 PM", "Standing for about three hours", "Saudi Red Crescent", "Event check-in and guiding"]) {
    await expect(page.locator(".opp-head")).toContainText(t);
  }
  await expect(page.locator(".opp-head").getByRole("link", { name: "Open map" })).toHaveAttribute("href", "https://maps.google.com/?q=21.5433,39.1728");
  await expect(page.locator(".opp-head")).not.toContainText("+966500000010"); // the staff contact is for the team only
  await page.getByRole("radio", { name: "Guide" }).check();
  await page.getByLabel("Anything we should know? (optional)").fill("I speak Arabic");
  // busy while it goes: no second tap (fix 2)
  await page.route("**/api/rpc/volunteer_interest", async (r) => { await new Promise((ok) => setTimeout(ok, 800)); await r.continue(); });
  const help = page.getByRole("button", { name: "I want to help" });
  await help.click();
  await expect(help).toBeDisabled();
  await expect(help).toHaveAttribute("aria-busy", "true");
  await notNow(page); // the how-to, after the first offer
  await page.unroute("**/api/rpc/volunteer_interest");
  await expect(page.locator("#opp-action")).toContainText("Interest sent. Our team will get back to you.");
  await expect(page.locator("main .note")).toHaveCount(0); // the card changed in place: no bar after an action
  await expect(page.getByRole("link", { name: "Start work" })).toHaveCount(0);
  await tab(page, "Home").click();
  await expect(page.getByRole("heading", { name: "Waiting for an answer" })).toBeVisible();
  await expect(page.locator(".shift").filter({ hasText: NAME })).toContainText("Interest sent");
  // the work page, by its address, says no
  await page.goto(`/#work/${BD}`);
  await page.reload();
  await expect(page.getByText("This session is no longer open to volunteers.")).toBeVisible();
  await expect(page.locator("#w-q")).toHaveCount(0);
  // an offer staff have not answered goes back in one tap
  await page.goto(`/#o/${BD}`);
  await page.getByRole("button", { name: "I can no longer help" }).click();
  await expect(page.locator("#opp-action")).toContainText("You withdrew");
  await expect(page.getByRole("button", { name: "I want to help" })).toBeVisible();
  // the how-to is shown once only
  await page.getByRole("button", { name: "I want to help" }).click();
  await expect(page.locator("#opp-action")).toContainText("Interest sent");
  await expect(page.locator("dialog.ask-a2hs")).toHaveCount(0);
  // "Register before" only when it is before the event
  await stub(page, "__opp", { id: BD, patch: { closes_at: "2099-11-06T00:00:00Z" } });
  await page.reload();
  await expect(page.locator(".opp-head")).not.toContainText("Register before");
  expect(errors).toEqual([]);
});

test("an opportunity for women only or men only (decision 12) says so, and a refusal is said in words", async ({ page }) => {
  const errors = watchCsp(page);
  await stub(page, "__approve");
  await stub(page, "__opp", { id: BD, patch: { gender: "male" } });
  await page.goto("/#opps");
  await signIn(page);
  await page.goto("/#opps");
  await expect(page.locator(`a.opp[data-id="${BD}"]`)).toContainText("Men only");
  await page.locator(`a.opp[data-id="${BD}"]`).click();
  await expect(page.locator("#opp-gender")).toHaveText("This opportunity is for men only.");
  await expect(page.getByRole("button", { name: "I want to help" })).toHaveCount(0);
  await stub(page, "__opp", { id: BD, patch: { gender: "female" } });
  await page.reload();
  await expect(page.locator(".opp-head")).toContainText("Women only");
  await expect(page.getByRole("button", { name: "I want to help" })).toBeVisible();
  // the server still decides: a refusal it gives is said
  await page.route("**/api/rpc/volunteer_interest", (r) => r.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "VOL_GENDER" }) }));
  await page.getByRole("button", { name: "I want to help" }).click();
  await expect(page.locator("main .note[role=alert]")).toContainText("This opportunity is open to women only or to men only.");
  await page.unroute("**/api/rpc/volunteer_interest");
  expect(errors).toEqual([]);
});

test("a decline says its reason (decision 9), on the opportunity and in Updates, and every update opens its opportunity", async ({ page }) => {
  const errors = watchCsp(page);
  await stub(page, "__approve");
  await page.goto(`/#o/${BD}`);
  await signIn(page);
  await page.getByRole("button", { name: "I want to help" }).click();
  await notNow(page);
  await stub(page, "__decline", { id: BD, reason: "full" });
  await page.reload();
  await expect(page.locator("#opp-action")).toContainText("Not this time");
  await expect(page.locator("#opp-reason")).toHaveText("Reason: the team was full");
  await tab(page, "Updates").click();
  const declined = page.locator('#updates li[data-kind="declined"]');
  await expect(declined).toContainText("Not this time for MicroMobility Blood Donation");
  await expect(declined).toContainText("Reason: the team was full");
  await expect(declined.locator("a")).toHaveAttribute("href", `#o/${BD}`);
  await expect(page.locator('#updates li[data-kind="approved"] a')).toHaveAttribute("href", "#opps");
  await declined.locator("a").click();
  await expect(page).toHaveURL(new RegExp(`#o/${BD}$`));
  expect(errors).toEqual([]);
});

test("updates: a dot on the tab while something is unread, the portal's own words, read once opened", async ({ page }) => {
  const errors = watchCsp(page);
  await accepted(page);
  await expect(page.locator("#unread-dot")).toBeVisible();
  await tab(page, "Updates").click();
  const list = page.locator("#updates");
  await expect(list.locator("li")).toHaveCount(2);
  await expect(list.locator('li[data-kind="accepted"]')).toContainText(`You are on the volunteer team for ${NAME} on`);
  await expect(list.locator('li[data-kind="approved"]')).toContainText("You are a MicroMobility volunteer.");
  await expect(list.locator("li.is-new")).toHaveCount(2);
  await expect(page.locator("#unread-dot")).toHaveCount(0);
  await page.reload();
  await expect(list.locator("li")).toHaveCount(2);
  await expect(list.locator("li.is-new")).toHaveCount(0);
  // a new one brings the dot back on the next tab change, without a reload (fix 1)
  await stub(page, "__lead", { id: BD });
  await tab(page, "Home").click();
  await expect(page.locator("#unread-dot")).toBeVisible();
  await tab(page, "Updates").click();
  await expect(list.locator('li[data-kind="lead"]')).toContainText(`You lead the volunteer team at ${NAME}`);
  // and every update about an opportunity opens it (fix 13)
  await list.locator('li[data-kind="accepted"] a').click();
  await expect(page).toHaveURL(new RegExp(`#o/${BD}$`));
  expect(errors).toEqual([]);
});

test("Home: the next shift with its meeting point and calendar (a file with two reminders, or Google), the hours, the team's year, and what an event gave", async ({ page }) => {
  const errors = watchCsp(page);
  await safariWindows(page);
  await accepted(page);
  // the plan prompt comes first: one optional question
  await expect(step(page)).toHaveAttribute("data-step", "plan");
  await expect(step(page)).toContainText("What time will you leave?");
  await step(page).getByRole("button", { name: "Skip" }).click();
  await expect(page.locator('#next-step[data-step="plan"]')).toHaveCount(0);
  const next = page.locator("#next-shift");
  await expect(next).toContainText("Next shift");
  await expect(next).toContainText(NAME);
  await expect(next).toContainText("North gate, by the flags");
  await expect(next).toContainText("Role: Guide");
  await expect(next.locator(".dblock")).toContainText("Nov");
  await expect(next.locator(".metas")).not.toContainText("Thu, Nov 5"); // the date block says it once (fix 10)
  await expect(next).toContainText("Meet at gate 3.");
  await expect(next.getByRole("link", { name: "Get directions" })).toHaveAttribute("href", "https://maps.google.com/?q=21.5433,39.1728");
  await next.getByRole("button", { name: "Add to calendar" }).click();
  const ask = page.locator("dialog.ask");
  await expect(ask.getByRole("link", { name: "Google Calendar" })).toHaveAttribute("href", /^https:\/\/calendar\.google\.com\/calendar\/render\?action=TEMPLATE&.*dates=20991105T140000Z%2F20991105T200000Z/);
  const dl = page.waitForEvent("download");
  await ask.getByRole("link", { name: "Calendar app" }).click();
  const file = await dl;
  expect(file.suggestedFilename()).toBe(`micromobility-volunteer-${BD}.ics`);
  const ics = readFileSync(await file.path(), "utf8");
  expect(ics).toContain("BEGIN:VEVENT");
  expect(ics).toContain(`SUMMARY:${NAME}`);
  expect(ics).toContain("DTSTART:20991105T140000Z"); // 17:00 in Riyadh
  expect(ics).toContain("DTEND:20991105T200000Z");
  expect(ics).toContain("LOCATION:North gate\\, by the flags");
  expect(ics).toContain("TRIGGER:-P1D");
  expect(ics).toContain("TRIGGER:-PT2H");
  const served = await page.request.get(`/cal/${BD}.ics`);
  expect(served.headers()["content-type"]).toBe("text/calendar; charset=utf-8");
  // the briefing, read
  await next.getByLabel("I have read the briefing").click(); // the tick becomes a "read" mark
  await expect(next.getByText("Briefing read")).toBeVisible();
  await expect(page.locator("#stats")).toHaveCount(0);
  await expect(page.locator("#team-total")).toContainText("This year our volunteers have given 54 hours.");
  await expect(page.locator("#home-certs")).toHaveAttribute("href", "#cert");
  // staff give the night's hours: a free ride and the certificate, and hours with no session have their own row
  await stub(page, "__reward", { id: BD, hours: 4 });
  await stub(page, "__extra", { hours: 2 });
  await page.reload();
  await expect(page.locator("#home-hours")).toContainText("6");
  await expect(page.locator("#stats")).toContainText("6 hours given. Next: the 10-hour badge."); // what was done (fix 11)
  const reward = page.locator(`#rewards [data-session="${BD}"]`);
  await expect(reward).toContainText("VL-1A2B3C4D");
  await expect(reward).toContainText("A free ride, with our thanks");
  await expect(reward).toContainText("Use by");
  await expect(reward.getByRole("link", { name: "Book a ride" })).toHaveAttribute("href", "https://experiences.micromobility.sa/");
  await expect(page.locator("#rewards .extra")).toContainText("Hours added by staff");
  await expect(page.locator("#rewards .extra")).toContainText("2 hours");
  await expect(page.getByRole("heading", { name: "Past shifts" })).toBeVisible();
  await expect(page.getByText("Thank you for helping")).toBeVisible();
  const popup = page.waitForEvent("popup");
  await reward.getByRole("button", { name: "Get certificate" }).click();
  const sheet = await popup;
  await expect(sheet.locator(".name")).toHaveText("Sara Haddad");
  await sheet.close();
  expect(errors).toEqual([]);
});

test("the next step through an event: Still coming? from 48 hours before, the Today card on the day, the close-out after it, how it was", async ({ page }) => {
  const errors = watchCsp(page);
  await accepted(page);
  // the plan, answered on the card
  await step(page).getByLabel("What time will you leave?").fill("16:30");
  await step(page).getByRole("button", { name: "Save" }).click();
  await expect(page.locator("#next-shift")).toContainText("You leave at 16:30");
  expect((await state(page)).shifts[BD].plan_leave).toBe("16:30");
  // tomorrow: Still coming?
  await stub(page, "__date", { id: BD, days: 1 });
  await page.reload();
  await expect(step(page)).toHaveAttribute("data-step", "coming");
  await expect(step(page)).toContainText(`Still coming to ${NAME}`);
  await step(page).getByRole("button", { name: "Yes, I am coming" }).click();
  await expect(page.locator('#next-step[data-step="coming"]')).toHaveCount(0);
  await expect(page.locator("#next-shift")).toContainText("Coming");
  expect((await state(page)).shifts[BD].coming_at).toBeTruthy();
  // the day itself: everything on one card
  await stub(page, "__date", { id: BD, days: 0 });
  await page.reload();
  const today = step(page);
  await expect(today).toHaveAttribute("data-step", "today");
  await expect(today).toContainText("Today");
  await expect(today).toContainText("Role: Guide");
  await expect(today).toContainText("North gate, by the flags");
  await expect(today).toContainText("Meet at gate 3.");
  await expect(today).toContainText("Ahmad");
  await expect(today.locator("a.tel")).toHaveAttribute("href", "tel:+966500000010");
  await expect(today.locator("a.tel")).toHaveText("+966 50 000 0010");
  await expect(today.getByRole("link", { name: "Start work" })).toBeVisible();
  await expect(page.locator("#next-shift")).toHaveCount(0); // the Today card is the shift
  // the day after: the close-out, with the team's note, what the evening did, the hours, the free ride, the badge
  await stub(page, "__opp", { id: "2099-12-01", patch: { signup_open: true } });
  await stub(page, "__reward", { id: BD, hours: 4 });
  await stub(page, "__date", { id: BD, days: -1 });
  await stub(page, "__thanks", { id: BD, note: "You kept the line moving all night." });
  await page.reload();
  const co = step(page);
  await expect(co).toHaveAttribute("data-step", "closeout");
  await expect(co).toContainText(`Thank you for helping at ${NAME}`);
  await expect(co.locator(".impact")).toHaveCount(0); // nobody checked in on the stub's night
  await expect(co).toContainText("4 hours");
  await expect(co.locator(".thanks-note")).toContainText("You kept the line moving all night.");
  await expect(co).toContainText("A free ride, with our thanks");
  await expect(co).toContainText("Volunteer badge");
  await expect(co.getByRole("link", { name: "Badges" })).toHaveAttribute("href", "https://experiences.micromobility.sa/account/badges");
  await expect(co.locator("#co-next")).toContainText("Beach clean-up");
  // how it was: optional, and Send waits for a step to be picked
  const send = co.getByRole("button", { name: "Send" });
  await expect(send).toBeDisabled();
  await co.getByRole("radio", { name: "Very good" }).check();
  await expect(co.locator(".scale-picked")).toHaveText("Very good");
  await co.getByRole("radio", { name: "Yes" }).check();
  await co.getByLabel("Anything to tell us? (optional)").fill("Great team.");
  await send.click();
  await expect(co.locator(".rate-done")).toContainText("Thank you for telling us.");
  await expect(co.locator(".rate-done")).toContainText("Very good");
  expect((await state(page)).feedback[BD]).toEqual({ rating: 4, again: "yes", comment: "Great team." });
  // the update about it, with the note
  await tab(page, "Updates").click();
  await expect(page.locator('#updates li[data-kind="thanks"]')).toContainText("You kept the line moving all night.");
  expect(errors).toEqual([]);
});

test("I can no longer help on an accepted place asks first, with a reason, and keeps the place on Keep", async ({ page }) => {
  const errors = watchCsp(page);
  await accepted(page);
  await page.goto(`/#o/${BD}`);
  await expect(page.locator("#opp-action")).toContainText("Ahmad"); // the staff contact, for the team
  await page.locator("#opp-withdraw").click();
  const ask = page.locator("dialog.ask-wd");
  await expect(ask).toContainText(`Can you no longer help at ${NAME}?`);
  await ask.getByRole("button", { name: "Keep my place" }).click();
  await expect(ask).toHaveCount(0);
  expect((await state(page)).shifts[BD].status).toBe("accepted");
  await page.locator("#opp-withdraw").click();
  await ask.getByRole("radio", { name: "I am travelling" }).check();
  await ask.getByRole("button", { name: "I can no longer help" }).click();
  await expect(ask).toHaveCount(0);
  await expect(page.locator("#opp-action")).toContainText("You withdrew");
  const s = (await state(page)).shifts[BD];
  expect([s.status, s.withdraw_reason]).toEqual(["withdrawn", "travel"]);
  expect(errors).toEqual([]);
});

test("what they most want from volunteering puts its reward first on Home", async ({ page }) => {
  const errors = watchCsp(page);
  await stub(page, "__approve");
  await page.goto("/#profile");
  await signIn(page);
  await page.goto("/#profile");
  await expect(page.locator("#motive")).toContainText("What do you most want from volunteering with us?");
  await page.locator('#motive [data-motive="cv"]').click();
  await expect(page.locator('#motive [data-motive="cv"]')).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => (await state(page)).rider.motive).toBe("cv");
  await tab(page, "Home").click();
  await expect(page.locator("#highlights > *").first()).toHaveAttribute("data-reward", "cert");
  await tab(page, "Profile").click();
  await page.locator('#motive [data-motive="people"]').click();
  await expect(page.locator('#motive [data-motive="people"]')).toHaveAttribute("aria-pressed", "true");
  await tab(page, "Home").click();
  await expect(page.locator("#highlights > *").first()).toHaveAttribute("data-reward", "team");
  expect(errors).toEqual([]);
});

test("a database from before the enhancements: every page still draws, with nothing new on it", async ({ page }) => {
  const errors = watchCsp(page);
  await stub(page, "__old");
  await accepted(page);
  await expect(page.locator("#next-shift")).toContainText(NAME);
  await expect(page.locator("#next-shift")).toContainText("JCC");
  await expect(page.locator('#next-step[data-step="plan"]')).toHaveCount(0); // no plan prompt without the field
  await page.goto(`/#o/${BD}`);
  await expect(page.locator("#opp-action")).toContainText("You are accepted");
  await expect(page.getByLabel("What time will you leave?")).toHaveCount(0);
  await page.goto("/#profile");
  await expect(page.locator("#motive")).toHaveCount(0);
  await stub(page, "__reward", { id: BD, hours: 4 });
  await page.goto("/#cert");
  await page.reload();
  await expect(page.locator("#record")).toContainText("4 hours");
  expect(errors).toEqual([]);
});

test("the work page: no tab bar on a phone, arrive, the search as big as Scan keeps its text, check in, the donation asks first, finish", async ({ page, isMobile }) => {
  const errors = watchCsp(page);
  await accepted(page);
  await atWork(page);
  if (isMobile) await expect(page.locator("nav.tabs")).toBeHidden(); // a stray tap ended the camera (fix 6)
  await expect(page.getByText("Meet at gate 3.")).toBeVisible();
  await expect(page.locator("#w-counts")).toContainText("0 / 3");
  // one green pill: I have arrived; Scan is not one
  await expect(page.locator(".page .btn-primary")).toHaveCount(1);
  const [q, scan] = [await page.locator("#w-q").boundingBox(), await page.locator("#w-scan-btn").boundingBox()];
  expect(q!.height).toBeGreaterThanOrEqual(scan!.height - 1);
  await page.locator("#w-arrive").click();
  await expect(page.locator("#w-head")).toContainText("You arrived");
  // a short number is a booking number
  await page.locator("#w-q").fill("2");
  await page.locator("#w-q").press("Enter");
  await expect(row(page, "q1111111")).toContainText("Dana Donor");
  await expect(row(page, "q1111111")).toContainText("Not checked in");
  await row(page, "q1111111").getByRole("button", { name: "Check in" }).click();
  await expect(row(page, "q1111111")).toContainText("Checked in");
  await expect(page.locator("#w-q")).toHaveValue("2"); // the next lookup is one edit away
  await expect(page.locator("#w-counts")).toContainText("1 / 3");
  // Checking in and donating are two steps: the tap only asks, naming the person, and Not yet marks nothing.
  const ask = page.locator("dialog.ask");
  await row(page, "q1111111").getByRole("button", { name: "Mark donated" }).click();
  await expect(ask).toContainText("Has Dana Donor donated?");
  await ask.getByRole("button", { name: "Not yet" }).click();
  await expect(ask).toHaveCount(0);
  await row(page, "q1111111").getByRole("button", { name: "Mark donated" }).click();
  await ask.getByRole("button", { name: "Mark donated" }).click();
  await expect(row(page, "q1111111")).toContainText("Donated");
  // the rest is in the row's menu, which names the person
  await row(page, "q1111111").getByRole("button", { name: "More for Dana Donor" }).click();
  await expect(ask.getByRole("heading", { name: "Dana Donor" })).toBeVisible();
  await ask.getByRole("button", { name: "Undo donated" }).click();
  await expect(row(page, "q1111111")).not.toContainText("Donated");
  await row(page, "q1111111").getByRole("button", { name: "More for Dana Donor" }).click();
  await ask.getByRole("button", { name: "Undo check-in" }).click();
  await expect(row(page, "q1111111")).toContainText("Not checked in");
  await expect(page.locator("#w-counts")).toContainText("0 / 3");
  // a visitor has nothing to mark
  await row(page, "q1111111").getByRole("button", { name: "More for Dana Donor" }).click();
  await ask.getByRole("button", { name: "Make visitor" }).click();
  await expect(row(page, "q1111111").locator(".chip-visitor")).toHaveText("Visitor");
  await expect(page.locator("#w-counts")).toContainText("1Visitors");
  // what a volunteer may not do: their own booking, money, nonsense
  await page.locator("#w-q").fill("4");
  await page.locator("#w-find").click();
  await expect(row(page, "q3333333")).toContainText("This is your own booking");
  await expect(row(page, "q3333333").getByRole("button")).toHaveCount(0);
  await page.locator("#w-q").fill("3");
  await page.locator("#w-find").click();
  await expect(row(page, "q2222222")).toContainText("Please send this person to the desk.");
  await expect(row(page, "q2222222")).not.toContainText("payment");
  await expect(row(page, "q2222222").getByRole("button", { name: "Check in" })).toHaveCount(0);
  await page.locator("#w-q").fill("abc");
  await page.locator("#w-find").click();
  await expect(page.locator("#w-msg")).toContainText("Type the whole mobile number");
  await page.locator("#w-q").fill("0500000003");
  await page.locator("#w-find").click();
  await expect(row(page, "q1111111")).toContainText("Dana Donor");
  await page.locator("#w-q").fill("MMC-2-q1111111"); // a ticket's text, typed
  await page.locator("#w-find").click();
  await expect(row(page, "q1111111")).toContainText("Dana Donor");
  await page.locator("#w-q").fill("999");
  await page.locator("#w-find").click();
  await expect(page.locator("#w-msg")).toContainText("No booking found");
  // finishing asks first, then Home, quietly
  await page.getByRole("button", { name: "I have finished" }).click();
  await expect(ask).toContainText("Have you finished for today?");
  await ask.getByRole("button", { name: "I have finished" }).click();
  await expect(page).toHaveURL(/#me/);
  await expect(page.locator("main [role=status].sr-only")).toHaveText("Thank you. Your finish time is saved.");
  await expect(page.locator("nav.tabs")).toBeVisible();
  expect(errors).toEqual([]);
});

test("Scan keeps scanning: each ticket read comes up at the top with a sound, and the camera stays on until Stop", async ({ page }) => {
  const errors = watchCsp(page);
  // The phone's own QR reader, standing in for a ticket held up to the camera: the fourth frame reads Dana's ticket.
  await page.addInitScript(() => {
    let n = 0;
    (window as unknown as { BarcodeDetector: unknown }).BarcodeDetector = class {
      async detect() { n += 1; return n === 4 ? [{ rawValue: "MMC-2-q1111111" }] : []; }
    };
    // count the sounds the page starts
    const w = window as unknown as { __beeps: number; AudioContext: typeof AudioContext };
    w.__beeps = 0;
    const Real = w.AudioContext;
    w.AudioContext = class extends Real {
      createOscillator() { w.__beeps += 1; return super.createOscillator(); }
    } as typeof AudioContext;
  });
  await accepted(page);
  await atWork(page);
  await page.getByRole("button", { name: "Scan tickets" }).click();
  await expect(page.locator("#w-camera video")).toBeVisible();
  await expect(row(page, "q1111111")).toContainText("Dana Donor");
  await expect.poll(() => page.evaluate(() => (window as unknown as { __beeps: number }).__beeps)).toBe(1);
  await expect(page.locator("#w-torch")).toHaveCount(0); // the test camera has no light
  await row(page, "q1111111").getByRole("button", { name: "Check in" }).click();
  await expect(row(page, "q1111111")).toContainText("Checked in");
  await expect(page.locator("#w-camera video")).toBeVisible(); // still scanning after a mark
  await page.getByRole("button", { name: "Stop scanning" }).click();
  await expect(page.locator("#w-camera")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Scan tickets" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("online only: a mark that cannot get through says Not sent, and goes by itself when the connection is back", async ({ page, context }) => {
  const errors = watchCsp(page);
  await accepted(page);
  await atWork(page);
  await page.locator("#w-q").fill("2");
  await page.locator("#w-q").press("Enter");
  await expect(row(page, "q1111111")).toContainText("Dana Donor");
  await context.setOffline(true);
  await row(page, "q1111111").getByRole("button", { name: "Check in" }).click();
  await expect(row(page, "q1111111")).toContainText("Not sent");
  await expect(row(page, "q1111111")).toContainText("Checked in");
  await expect(page.locator("#w-counts")).toContainText("0 / 3"); // the figures are what the database has
  // nothing about it is kept on the phone
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain("q1111111");
  expect(await page.evaluate(() => JSON.stringify(sessionStorage))).not.toContain("q1111111");
  await context.setOffline(false);
  await expect(row(page, "q1111111")).not.toContainText("Not sent", { timeout: 20_000 }); // the online event, or the next try
  await expect(page.locator("#w-counts")).toContainText("1 / 3");
  expect((await state(page)).bookings.find((b) => b.id === "q1111111")?.checked_in).toBe(true);
  expect(errors).toEqual([]);
});

test("the list staff let volunteers see: the one search box filters it by name, number or mobile; filter and sort; phones quiet and formatted", async ({ page }) => {
  const errors = watchCsp(page);
  await accepted(page, { list: true, phone: true, details: true });
  await atWork(page);
  const rows = page.locator("#w-list .row");
  await expect(rows).toHaveCount(3);
  await expect(page.locator("#w-list-n")).toHaveText("3 / 3");
  const tel = page.locator('#w-list a.tel[href="tel:+966500000003"]');
  await expect(tel).toBeVisible();
  await expect(tel).toHaveText("+966 50 000 0003"); // fix 16
  await expect(page.locator("#w-list")).toContainText("Blood type: O+");
  await page.locator("#w-q").fill("dana");
  await expect(rows).toHaveCount(1);
  await page.locator("#w-find").click(); // a name only filters: nothing to say
  await expect(page.locator("#w-msg")).toHaveText("");
  await page.locator("#w-refresh").click();
  await expect(page.locator("#w-list-n")).toHaveText("1 / 3");
  await expect(page.locator("#w-q")).toHaveValue("dana");
  await page.locator("#w-q").fill("٥٠٠٠٠٠٠٠٣"); // a mobile, in Arabic digits too
  await expect(rows).toHaveCount(1);
  await page.locator("#w-q").fill("");
  await expect(rows).toHaveCount(3);
  await rows.filter({ hasText: "Dana Donor" }).getByRole("button", { name: "Check in" }).click();
  await expect(page.locator("#w-counts")).toContainText("1 / 3");
  await page.locator("#w-show").selectOption("in");
  await expect(rows).toHaveCount(1);
  await page.locator("#w-show").selectOption("all");
  await page.locator("#w-sort").selectOption("name");
  await expect(rows.first()).toContainText("Ali Owes");
  await page.locator("#w-sort").selectOption("out");
  await expect(rows.last()).toContainText("Dana Donor");
  await expect(rows.filter({ hasText: "Sara Haddad" }).getByRole("button")).toHaveCount(0);
  expect(await noSideways(page)).toBe(true);
  expect(errors).toEqual([]);
});

test("the team lead sees the team by name, checks them in and out, and undoes their own marks", async ({ page, isMobile }) => {
  const errors = watchCsp(page);
  await accepted(page);
  // not the lead: no team
  await atWork(page);
  await expect(page.getByRole("link", { name: "My team" })).toHaveCount(0);
  await page.goto(`/#team/${BD}`);
  await expect(page.getByText("Only the team lead can see the team.")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`#work/${BD}`));
  await stub(page, "__lead", { id: BD });
  await page.goto("/#me");
  await page.reload();
  await expect(page.locator("#next-shift")).toContainText("Team lead");
  await atWork(page, false);
  await page.getByRole("link", { name: "My team" }).click();
  await expect(page.getByRole("heading", { name: "Team" })).toBeVisible();
  if (isMobile) await expect(page.locator("nav.tabs")).toBeHidden();
  const mates = page.locator("#t-list .mate");
  await expect(mates).toHaveCount(3);
  await expect(mates.first()).toContainText("Lina Farouk"); // on duty first
  await expect(page.locator("#t-counts")).toContainText("1 / 3");
  await expect(page.locator("#t-list")).not.toContainText("+966"); // names only
  const omar = mates.filter({ hasText: "Omar Saleh" }), lina = mates.filter({ hasText: "Lina Farouk" }), me = mates.filter({ hasText: "Sara Haddad" });
  await expect(me.getByRole("button")).toHaveCount(0);
  await omar.getByRole("button", { name: "Check in" }).click();
  await expect(omar).toContainText("Arrived");
  await expect(page.locator("#t-counts")).toContainText("2 / 3");
  await lina.getByRole("button", { name: "Check out" }).click();
  await expect(lina).toContainText("Finished");
  const ask = page.locator("dialog.ask");
  await lina.getByRole("button", { name: "More for Lina Farouk" }).click();
  await ask.getByRole("button", { name: "Undo check-out" }).click();
  await expect(lina).toContainText("Arrived");
  await omar.getByRole("button", { name: "More for Omar Saleh" }).click();
  await ask.getByRole("button", { name: "Undo check-in" }).click();
  await expect(omar).toContainText("Not arrived");
  expect((await state(page)).mates.find((m) => m.shift === 11)?.clock_in).toBeNull();
  expect(errors).toEqual([]);
});

test("certificates: one per event worked, shared as a credential, the volunteer record with every hour, and a certificate for dates", async ({ page, context, browserName }) => {
  const errors = watchCsp(page);
  await safariWindows(page); // the window opens on the tap, as an iPhone wants it
  if (browserName === "chromium") await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await accepted(page);
  await stub(page, "__reward", { id: BD, hours: 4 });
  await stub(page, "__extra", { hours: 2, on: "2026-10-20" });
  await page.goto("/#cert");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Certificates" })).toBeVisible();
  const ev = page.locator(".ev-row").filter({ hasText: NAME });
  await expect(ev).toContainText("4 hours");
  // the volunteer record: every hour, the ones staff added with no session among them (fix 12)
  const rec = page.locator("#record");
  await expect(rec.getByRole("heading", { name: "Volunteer record" })).toBeVisible();
  await expect(rec.locator(".big-n b")).toHaveText("6");
  await expect(rec.locator("#record-rows li")).toHaveCount(2);
  await expect(rec).toContainText("Hours added by staff");
  const popup = page.waitForEvent("popup");
  await ev.getByRole("button", { name: "Get certificate" }).click();
  const sheet = await popup;
  // The certificate is the company's one design, printed from its own window (certificate/ in the booking site's repo).
  await expect(sheet.locator(".name")).toHaveText("Sara Haddad");
  await expect(sheet.locator(".name-ar")).toHaveText("سارة حداد");
  await expect(sheet.locator(".thanks-ar")).toHaveText("تقديرًا لعطائها ومشاركتها التطوعية في المبادرة");
  await expect(sheet.locator(".recognition")).toHaveText("in recognition of her time, energy and commitment as a volunteer in");
  await expect(sheet.locator(".signer-name")).toHaveText("Ahmad Babalghoum");
  // the hours, a line of their own under the thank-you (the owner, 2026-11-10)
  await expect(sheet.locator(".hours-n")).toHaveText("4");
  await expect(sheet.locator(".hours-label")).toHaveText("Volunteer hours · ساعات التطوع");
  // the Saudi field set (SPEC.md, amendment 7): the role, the skills, the partner, and a QR code drawn here to the check page
  await expect(sheet.locator("body")).toContainText("Guide");
  await expect(sheet.locator(".skills").first()).toContainText("Event check-in and guiding");
  await expect(sheet.locator("body")).toContainText("Saudi Red Crescent");
  await expect(sheet.locator("img.qr")).toHaveAttribute("src", /^data:image\/png;base64,/);
  // once its stylesheet is in (the window is written, then fetches it)
  await expect.poll(() => sheet.locator(".page").evaluate((el: HTMLElement) => [el.offsetWidth, el.offsetHeight])).toEqual([1123, 794]);
  // its own two faces, never the portal's
  expect(await sheet.evaluate(() => [...document.styleSheets].map((s) => s.href ?? "").filter(Boolean).map((h) => new URL(h).pathname).sort())).toEqual(["/certificate-fonts.css", "/certificate.css"]);
  await sheet.close();
  // Share: the check link, the credential ID, LinkedIn's Add to profile (the report's Tier 2)
  await ev.getByRole("button", { name: "Share" }).click();
  const share = page.locator("dialog.ask-share");
  await expect(share.getByLabel("Credential ID")).toHaveValue("MMV-2026-00002");
  await expect(share.getByLabel("Check link")).toHaveValue("https://volunteer.micromobility.sa/#check/ZZZZ11112222");
  const li = await share.getByRole("link", { name: "Add to LinkedIn" }).getAttribute("href");
  const lin = new URL(li!);
  expect(`${lin.origin}${lin.pathname}`).toBe("https://www.linkedin.com/profile/add");
  expect(lin.searchParams.get("startTask")).toBe("CERTIFICATION_NAME");
  expect(lin.searchParams.get("certId")).toBe("MMV-2026-00002");
  expect(lin.searchParams.get("certUrl")).toBe("https://volunteer.micromobility.sa/#check/ZZZZ11112222");
  if (browserName === "chromium") {
    await share.getByRole("button", { name: "Copy link" }).click();
    await expect(share.getByRole("button", { name: "Copied" })).toBeVisible();
  }
  await share.getByRole("button", { name: "Close" }).click();
  // a certificate for dates: one day
  await page.getByLabel("Dates").selectOption("day"); // today: the stub's first day worked is in 2099
  const make = page.getByRole("button", { name: "Make certificate" });
  const other = page.waitForEvent("popup");
  await make.click();
  const period = await other;
  await expect(period.locator(".name")).toHaveText("Sara Haddad");
  await period.close();
  // a refusal closes the window it opened on the tap, and says why on the page: a fault on our side is said as such
  await page.route("**/api/rpc/volunteer_cert_issue", (r) => r.fulfill({ status: 503, contentType: "application/json", body: "{}" }));
  const refused = page.waitForEvent("popup");
  await make.click();
  const gone = await refused;
  await expect.poll(() => gone.isClosed()).toBe(true);
  await expect(page.getByText("Something went wrong on our side. Please try again.")).toBeVisible();
  await page.unroute("**/api/rpc/volunteer_cert_issue");
  expect(page.context().pages()).toHaveLength(1);
  // an employer checks it with the code printed on it, signed in or not
  await tab(page, "Profile").click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Volunteer sign-in" })).toBeVisible();
  await checkCert(page, "ZZZZ11112222");
  await expect(page.locator("#check-res")).toContainText("This certificate is valid.");
  await expect(page.locator("#check-res")).toContainText("Sara Haddad");
  await expect(page.locator("#check-res")).toContainText("With Saudi Red Crescent");
  await checkCert(page, "AAAA00000000");
  await expect(page.getByText("No certificate has this code.")).toBeVisible();
  expect(errors).toEqual([]);
});

test("Arabic reads right to left, and no page runs off the side at phone width", async ({ page }) => {
  const errors = watchCsp(page);
  await accepted(page, { list: true, phone: true, details: true });
  await stub(page, "__lead", { id: BD });
  await atWork(page);
  await stub(page, "__reward", { id: BD, hours: 4 });
  const pages = ["/", "/#opps", `/#o/${BD}`, "/#me", "/#updates", "/#profile", "/#cert", `/#work/${BD}`, `/#team/${BD}`, "/#check/ZZZZ11112222"];
  for (const path of pages) {
    await page.goto(path);
    await page.reload();
    await expect(page.locator("main.page")).toBeVisible();
    await page.waitForTimeout(150);
    expect(await noSideways(page), path).toBe(true);
  }
  await tab(page, "Profile").click();
  await page.getByLabel("Language").selectOption("ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(tab(page, "الرئيسية")).toBeVisible();
  await expect(page.getByRole("heading", { name: "الملف الشخصي" })).toBeVisible();
  for (const path of pages) {
    await page.goto(path);
    await page.reload();
    await expect(page.locator("main.page")).toBeVisible();
    await page.waitForTimeout(150);
    expect(await noSideways(page), `ar ${path}`).toBe(true);
  }
  await page.goto("/#me");
  await expect(page.locator("h1.greet")).toContainText("Sara");
  await tab(page, "الفرص التطوعية").click();
  await expect(page.locator("main.page h1")).toHaveCount(1);
  // Hindi and Bengali come in their own Noto faces, with room for their marks (fix 17)
  for (const [code, family] of [["hi", "Noto Sans Devanagari"], ["bn", "Noto Sans Bengali"]]) {
    await page.goto("/#profile");
    await page.locator("main select.lang").selectOption(code);
    await expect(page.locator("html")).toHaveAttribute("lang", code);
    // the face itself, fetched because its script is on the screen (an unknown family would pass fonts.check)
    await expect.poll(() => page.evaluate((f) => [...document.fonts].some((x) => x.family.replace(/"/g, "") === f && x.status === "loaded"), family)).toBe(true);
    expect(await page.evaluate(() => parseFloat(getComputedStyle(document.body).lineHeight) / parseFloat(getComputedStyle(document.body).fontSize))).toBeGreaterThanOrEqual(1.55);
  }
  expect(errors).toEqual([]);
});

test("the cut-off ends the work page: the next action says so and leaves", async ({ page }) => {
  await accepted(page);
  await atWork(page);
  await stub(page, "__cutoff", { id: BD });
  await page.locator("#w-q").fill("2");
  await page.locator("#w-find").click();
  await expect(page.getByText("This session is no longer open to volunteers.")).toBeVisible();
  await expect(page).toHaveURL(/#me/);
  await expect(page.locator("#w-q")).toHaveCount(0);
  await tab(page, "Opportunities").click();
  await expect(page.getByRole("heading", { name: "Beach clean-up" })).toBeVisible();
  await expect(page.getByRole("heading", { name: NAME })).toHaveCount(0);
});

test("handed over from the booking app with a one-time code, once; signing out is on Profile", async ({ page }) => {
  const errors = watchCsp(page);
  await page.goto(`/?signin=${"a".repeat(48)}`);
  await expect(page).not.toHaveURL(/signin=/);
  await expect(tab(page, "Home")).toBeVisible();
  await tab(page, "Profile").click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.locator("nav.tabs")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Volunteer sign-in" })).toBeVisible();
  await page.goto(`/?signin=${"a".repeat(48)}`); // spent
  await expect(page.getByRole("heading", { name: "Volunteer sign-in" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("a first read that fails says so with Try again, a fault on our side apart from a lost connection (fix 3)", async ({ page }) => {
  const errors = watchCsp(page);
  await page.route("**/api/rpc/volunteer_me", (r) => r.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "SERVER" }) }));
  await page.goto("/");
  await expect(page.locator("#boot-err")).toContainText("Something went wrong");
  await expect(page.getByRole("heading", { name: "Volunteer sign-in" })).toHaveCount(0);
  await page.unroute("**/api/rpc/volunteer_me");
  await page.locator("#boot-retry").click();
  await expect(page.getByRole("heading", { name: "Volunteer sign-in" })).toBeVisible();
  await page.route("**/api/rpc/volunteer_me", (r) => r.abort("internetdisconnected"));
  await page.reload();
  await expect(page.locator("#boot-err")).toContainText("You are offline");
  await expect(page.locator("#boot-err")).toContainText("Connection problem. Please try again.");
  await page.unroute("**/api/rpc/volunteer_me");
  expect(errors.filter((e) => !/Failed to load resource/.test(e))).toEqual([]);
});

test("phone notifications: no switch for now (the user, 2026-11-09); the manifest; a worker that notifies and keeps only the shell; hashed files kept a year", async ({ page }) => {
  const errors = watchCsp(page);
  await page.goto("/");
  await signIn(page);
  await tab(page, "Profile").click();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  await expect(page.getByRole("switch", { name: "Notifications" })).toHaveCount(0);
  const manifest = await (await page.request.get("/manifest.webmanifest")).json() as { start_url: string; icons: { src: string }[] };
  expect(manifest.start_url).toBe("/#me");
  expect(manifest.icons.map((i) => i.src)).toContain("/icon-512.png");
  const swRes = await page.request.get("/sw.js");
  expect(swRes.headers()["cache-control"]).toBe("no-cache");
  const sw = await swRes.text();
  expect(sw).toContain('addEventListener("push"');
  expect(sw).toContain('addEventListener("notificationclick"');
  expect(sw).toContain('addEventListener("fetch"');
  const shell = JSON.parse(/const SHELL = (\[[^\]]*\]);/.exec(sw)![1]) as string[];
  expect(shell[0]).toBe("/");
  expect(shell).not.toContain("/index.html"); // Cloudflare redirects it, and a redirect cannot answer a page load
  expect(sw).toMatch(/const CACHE = "mmv-[0-9a-f]{10}";/);
  // the page names its script and styles by their content, and those are kept a year
  const html = await (await page.request.get("/")).text();
  const js = /src="\/(app-[A-Za-z0-9]+\.js)"/.exec(html)![1], css = /href="\/(app-[A-Za-z0-9]+\.css)"/.exec(html)![1];
  expect(shell).toEqual(expect.arrayContaining([`/${js}`, `/${css}`]));
  expect((await page.request.get(`/${js}`)).headers()["cache-control"]).toBe("public, max-age=31536000, immutable");
  expect((await page.request.get(`/${css}`)).headers()["cache-control"]).toBe("public, max-age=31536000, immutable");
  expect(errors).toEqual([]);
});

test.describe("offline", () => {
  test.use({ serviceWorkers: "allow" });
  test("with no connection, the kept shell opens and says the portal is offline (decision 11)", async ({ page, context }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Volunteer sign-in" })).toBeVisible();
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
    await expect.poll(() => page.evaluate(async () => (await caches.keys()).some((k) => k.startsWith("mmv-")))).toBe(true);
    await expect.poll(() => page.evaluate(async () => {
      const k = (await caches.keys()).find((x) => x.startsWith("mmv-"));
      return k ? (await (await caches.open(k)).keys()).map((r) => new URL(r.url).pathname) : [];
    })).toContain("/");
    await page.reload(); // now under the worker
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator("#boot-err")).toContainText("You are offline");
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    // back online, the page reads itself again without a tap (Try again is fix 3's own test)
    await context.setOffline(false);
    await expect(page.getByRole("heading", { name: "Volunteer sign-in" })).toBeVisible();
  });
});
