import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// The volunteer portal as rebuilt on 2026-11-09 (the owner's decision sheet): Home, Opportunities, Updates and Profile, the
// one-screen work page, the lead's team, the certificates. Against stub-db.mjs, never a real database.
const STUB = Number(process.env.STUB_PORT || 8801);
const BD = "2099-11-05-bd";
const stub = (page: Page, path: string, data: unknown = {}) => page.request.post(`http://127.0.0.1:${STUB}/${path}`, { data });

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
/** Signs in and waits for the page to land where it sends them (the tabs are there only signed in). */
async function signIn(page: Page): Promise<void> {
  await submit(page, "sara@example.com", "Pass1234");
  await expect(page.locator("nav.tabs")).toBeVisible();
}
const tab = (page: Page, name: string) => page.locator("nav.tabs").getByRole("link", { name });

/** An approved volunteer who offered to help on the blood night and was accepted, signed in on Home. */
async function accepted(page: Page, caps?: Record<string, boolean>): Promise<void> {
  await stub(page, "__approve");
  await page.goto(`/#o/${BD}`);
  await signIn(page);
  await page.getByRole("button", { name: "I want to help" }).click();
  await expect(page.getByText("Your interest is sent.")).toBeVisible();
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

test("nobody enters signed out: every address is the sign-in, the server refuses the list, and Home comes after signing in", async ({ page }) => {
  const errors = watchCsp(page);
  for (const path of ["/", `/#o/${BD}`, "/#me", "/#updates", "/#profile", `/#work/${BD}`, `/#team/${BD}`, "/#cert"]) {
    await page.goto(path);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Volunteer sign-in" }), path).toBeVisible();
    await expect(page.locator("nav.tabs")).toHaveCount(0);
    await expect(page.getByText("Micromobility Blood Donation")).toHaveCount(0);
  }
  expect(await page.evaluate(async () => (await fetch("/api/rpc/volunteer_opportunities", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })).status)).toBe(401);
  // a certificate's check is open to anyone with its code
  await page.goto("/#check/ABCDEF123456");
  await expect(page.getByRole("heading", { name: "Check a certificate" })).toBeVisible();
  await page.goto("/");
  await signIn(page);
  await expect(page).toHaveURL(new RegExp(`#o/${BD}$`)); // the last opportunity an address named, after signing in
  await tab(page, "Home").click();
  await expect(page.locator("h1.greet")).toContainText("Sara");
  for (const name of ["Home", "Opportunities", "Updates", "Profile"]) await expect(tab(page, name)).toBeVisible();
  await expect(tab(page, "Home")).toHaveAttribute("aria-current", "page");
  expect(errors).toEqual([]);
});

test("a wrong password is said, and the other ways in go to the booking app", async ({ page }) => {
  const errors = watchCsp(page);
  await page.goto("/");
  await page.locator("form").getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toContainText("Enter your email or mobile number");
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

test("the profile first, then staff's yes: no offers until approved, and waiting is said once", async ({ page }) => {
  const errors = watchCsp(page);
  await page.goto(`/#o/${BD}`);
  await signIn(page);
  await expect(page).toHaveURL(new RegExp(`#o/${BD}`)); // back to the opportunity they came for
  await expect(page.locator("#opp-action")).toContainText("First, set up your volunteer profile.");
  await expect(page.getByRole("button", { name: "I want to help" })).toHaveCount(0);
  await tab(page, "Home").click();
  await expect(page.getByText("First, set up your volunteer profile.")).toBeVisible();
  await page.getByRole("link", { name: "Set up my profile" }).click();
  await expect(page).toHaveURL(/#profile$/);
  // the account's own birth date and emergency contact are shown, kept in the booking app
  await expect(page.locator("#fact-dob")).toContainText("1995");
  await expect(page.locator("#fact-em")).toContainText("Huda Haddad");
  // at least one day
  await page.getByRole("button", { name: "Send my profile" }).click();
  await expect(page.getByText("Pick at least one day.")).toBeVisible();
  await page.getByRole("button", { name: "Friday" }).click();
  await page.getByRole("button", { name: "Saturday" }).click();
  await expect(page.getByRole("button", { name: "Friday" })).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Skills or experience").fill("First aid");
  await page.getByRole("button", { name: "M", exact: true }).click();
  await page.getByRole("button", { name: "Send my profile" }).click();
  await expect(page.getByText("Profile sent. Staff will let you know.")).toBeVisible();
  await expect(page).toHaveURL(/#me$/);
  await expect(page.getByText("Your profile is waiting for staff.")).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Set up my profile" })).toHaveCount(0);
  await page.goto(`/#o/${BD}`);
  await expect(page.locator("#opp-waiting")).toHaveText("Your profile is waiting for staff.");
  await expect(page.getByRole("button", { name: "I want to help" })).toHaveCount(0);
  // the profile keeps what was saved
  await tab(page, "Profile").click();
  await expect(page.getByText("Waiting for staff")).toBeVisible();
  await expect(page.getByRole("button", { name: "Saturday" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "M", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(errors).toEqual([]);
});

test("a missing emergency contact is added in the booking app, and the profile says so", async ({ page }) => {
  await stub(page, "__account", { emergency: null });
  await page.goto("/#profile");
  await signIn(page);
  await page.goto("/#profile");
  await expect(page.locator("#fact-em")).toContainText("Missing");
  await expect(page.locator("#fact-em").getByRole("link", { name: "Add it in the booking app" })).toHaveAttribute("href", "https://experiences.micromobility.sa/account");
  await page.getByRole("button", { name: "Sunday" }).click();
  await page.getByRole("button", { name: "Send my profile" }).click();
  await expect(page.getByText("Add an emergency contact to your account first, then come back.")).toBeVisible();
});

test("approved: one tap to offer help, with a role and a message, and a way back out", async ({ page }) => {
  const errors = watchCsp(page);
  await stub(page, "__approve");
  await page.goto("/");
  await signIn(page);
  await tab(page, "Opportunities").click();
  const card = page.locator(`a.opp[data-id="${BD}"]`);
  await expect(card).toContainText("Micromobility Blood Donation");
  await expect(card).toContainText("5 places left");
  await expect(card).toContainText("Guide");
  await expect(card.locator(".dblock")).toContainText("5");
  await expect(page.locator('a.opp[data-id="2099-12-01"]')).toContainText("Sign-up closed");
  await card.click();
  await expect(page.getByText("Help donors at the door.")).toBeVisible();
  await expect(page.getByText("Meet at gate 3.")).toHaveCount(0); // the briefing is for those accepted
  await page.getByRole("radio", { name: "Guide" }).check();
  await page.getByLabel("Anything we should know? (optional)").fill("I speak Arabic");
  await page.getByRole("button", { name: "I want to help" }).click();
  await expect(page.getByText("Your interest is sent.")).toBeVisible();
  await expect(page.locator("#opp-action")).toContainText("Interest sent. Our team will get back to you.");
  await expect(page.getByRole("link", { name: "Start work" })).toHaveCount(0);
  await tab(page, "Home").click();
  await expect(page.getByRole("heading", { name: "Waiting for an answer" })).toBeVisible();
  // the work page, by its address, says no
  await page.goto(`/#work/${BD}`);
  await page.reload();
  await expect(page.getByText("This session is no longer open to volunteers.")).toBeVisible();
  await expect(page.locator("#w-q")).toHaveCount(0);
  await page.goto(`/#o/${BD}`);
  await page.getByRole("button", { name: "I can no longer help" }).click();
  await expect(page.getByText("You are off this opportunity.")).toBeVisible();
  expect(errors).toEqual([]);
});

test("updates: a dot on the tab while something is unread, the portal's own words, read once opened", async ({ page }) => {
  const errors = watchCsp(page);
  await accepted(page);
  await expect(page.locator("#unread-dot")).toBeVisible();
  await tab(page, "Updates").click();
  const list = page.locator("#updates");
  await expect(list.locator("li")).toHaveCount(2);
  await expect(list.locator('li[data-kind="accepted"]')).toContainText("You are on the volunteer team for Micromobility Blood Donation on");
  await expect(list.locator('li[data-kind="approved"]')).toContainText("You are a MicroMobility volunteer.");
  await expect(list.locator("li.is-new")).toHaveCount(2);
  await expect(page.locator("#unread-dot")).toHaveCount(0);
  await page.reload();
  await expect(list.locator("li")).toHaveCount(2);
  await expect(list.locator("li.is-new")).toHaveCount(0);
  // a new one brings the dot back
  await stub(page, "__lead", { id: BD });
  await tab(page, "Home").click();
  await page.reload();
  await expect(page.locator("#unread-dot")).toBeVisible();
  await tab(page, "Updates").click();
  await expect(list.locator('li[data-kind="lead"]')).toContainText("You lead the volunteer team at Micromobility Blood Donation");
  expect(errors).toEqual([]);
});

test("Home: the next shift with its place and calendar, the hours to the next badge, and what an event gave", async ({ page }) => {
  const errors = watchCsp(page);
  await accepted(page);
  const next = page.locator("#next-shift");
  await expect(next).toContainText("Next shift");
  await expect(next).toContainText("Micromobility Blood Donation");
  await expect(next).toContainText("JCC");
  await expect(next).toContainText("Guide");
  await expect(next.locator(".dblock")).toContainText("Nov");
  await expect(next).toContainText("Meet at gate 3.");
  await expect(next.getByRole("link", { name: "Get directions" })).toHaveAttribute("href", "https://www.google.com/maps/search/?api=1&query=JCC");
  const dl = page.waitForEvent("download");
  await next.getByRole("button", { name: "Add to calendar" }).click();
  const file = await dl;
  expect(file.suggestedFilename()).toMatch(/\.ics$/);
  const ics = readFileSync(await file.path(), "utf8");
  expect(ics).toContain("BEGIN:VEVENT");
  expect(ics).toContain("SUMMARY:Micromobility Blood Donation");
  expect(ics).toContain("DTSTART:20991105T140000Z"); // 17:00 in Riyadh
  expect(ics).toContain("DTEND:20991105T200000Z");
  expect(ics).toContain("LOCATION:JCC");
  // the briefing, read
  await next.getByLabel("I have read the briefing").click(); // the tick becomes a "read" mark
  await expect(next.getByText("Briefing read")).toBeVisible();
  await expect(page.locator("#stats")).toContainText("10 more hours to the 10-hour badge");
  // staff give the night's hours: a free ride and the certificate, and the update that says so
  await stub(page, "__reward", { id: BD, hours: 4 });
  await page.reload();
  await expect(page.locator("#home-hours")).toContainText("4");
  await expect(page.locator("#stats")).toContainText("6 more hours to the 10-hour badge");
  const reward = page.locator(`#rewards [data-session="${BD}"]`);
  await expect(reward).toContainText("VL-1A2B3C4D");
  await expect(reward).toContainText("Free ride");
  await expect(reward).toContainText("Use by");
  await expect(page.getByRole("heading", { name: "Past shifts" })).toBeVisible();
  await expect(page.getByText("Thank you for helping")).toBeVisible();
  const popup = page.waitForEvent("popup");
  await reward.getByRole("button", { name: "Get certificate" }).click();
  const sheet = await popup;
  await expect(sheet.locator(".name")).toHaveText("Sara Haddad");
  await sheet.close();
  expect(errors).toEqual([]);
});

test("the work page: arrive, one search box, check in, the donation asks first, the menu holds the rest, finish", async ({ page }) => {
  const errors = watchCsp(page);
  await accepted(page);
  await atWork(page);
  await expect(page.getByText("Meet at gate 3.")).toBeVisible();
  await expect(page.locator("#w-counts")).toContainText("0 / 3");
  await page.locator("#w-arrive").click();
  await expect(page.locator("#w-head")).toContainText("You arrived");
  // a short number is a booking number
  await page.locator("#w-q").fill("2");
  await page.locator("#w-q").press("Enter");
  await expect(row(page, "q1111111")).toContainText("Dana Donor");
  await expect(row(page, "q1111111")).toContainText("Not checked in");
  await row(page, "q1111111").getByRole("button", { name: "Check in" }).click();
  await expect(row(page, "q1111111")).toContainText("Checked in");
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
  // finishing asks first
  await page.getByRole("button", { name: "I have finished" }).click();
  await expect(ask).toContainText("Have you finished for today?");
  await ask.getByRole("button", { name: "I have finished" }).click();
  await expect(page.getByText("Thank you. Your finish time is saved.")).toBeVisible();
  await expect(page).toHaveURL(/#me/);
  expect(errors).toEqual([]);
});

test("Scan keeps scanning: each ticket read comes up at the top, and the camera stays on until Stop", async ({ page }) => {
  const errors = watchCsp(page);
  // The phone's own QR reader, standing in for a ticket held up to the camera: the fourth frame reads Dana's ticket.
  await page.addInitScript(() => {
    let n = 0;
    (window as unknown as { BarcodeDetector: unknown }).BarcodeDetector = class {
      async detect() { n += 1; return n === 4 ? [{ rawValue: "MMC-2-q1111111" }] : []; }
    };
  });
  await accepted(page);
  await atWork(page);
  await page.getByRole("button", { name: "Scan tickets" }).click();
  await expect(page.locator("#w-camera video")).toBeVisible();
  await expect(row(page, "q1111111")).toContainText("Dana Donor");
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
  const state = await (await stub(page, "__state")).json() as { bookings: { id: string; checked_in: boolean }[] };
  expect(state.bookings.find((b) => b.id === "q1111111")?.checked_in).toBe(true);
  expect(errors).toEqual([]);
});

test("the list staff let volunteers see: the one search box filters it by name, number or mobile; filter and sort", async ({ page }) => {
  const errors = watchCsp(page);
  await accepted(page, { list: true, phone: true, details: true });
  await atWork(page);
  const rows = page.locator("#w-list .row");
  await expect(rows).toHaveCount(3);
  await expect(page.locator("#w-list-n")).toHaveText("3 / 3");
  await expect(page.locator('#w-list a.tel[href="tel:500000003"]')).toBeVisible();
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

test("the team lead sees the team by name, checks them in and out, and undoes their own marks", async ({ page }) => {
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
  const state = await (await stub(page, "__state")).json() as { mates: { shift: number; clock_in: string | null }[] };
  expect(state.mates.find((m) => m.shift === 11)?.clock_in).toBeNull();
  expect(errors).toEqual([]);
});

test("certificates: one per event worked, the one already made comes back, other dates behind one button", async ({ page }) => {
  const errors = watchCsp(page);
  await accepted(page);
  await stub(page, "__reward", { id: BD, hours: 4 });
  await page.goto("/#cert");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Certificates" })).toBeVisible();
  const ev = page.locator(".ev-row").filter({ hasText: "Micromobility Blood Donation" });
  await expect(ev).toContainText("4 hours");
  await expect(page.getByLabel("What it covers")).toHaveCount(0);
  const popup = page.waitForEvent("popup");
  await ev.getByRole("button", { name: "Get certificate" }).click();
  const sheet = await popup;
  // The certificate is the company's one design, printed from its own window (certificate/ in the booking site's repo).
  await expect(sheet.locator(".name")).toHaveText("Sara Haddad");
  await expect(sheet.locator(".name-ar")).toHaveText("سارة حداد");
  await expect(sheet.locator(".thanks-ar")).toHaveText("تقديرًا لعطائها ومشاركتها التطوعية في المبادرة");
  await expect(sheet.locator(".recognition")).toHaveText("in recognition of her time, energy and commitment as a volunteer in");
  await expect(sheet.locator(".signer-name")).toHaveText("Ahmad Babalghoum");
  // once its stylesheet is in (the window is written, then fetches it)
  await expect.poll(() => sheet.locator(".page").evaluate((el: HTMLElement) => [el.offsetWidth, el.offsetHeight])).toEqual([1123, 794]);
  // its own two faces, never the portal's
  expect(await sheet.evaluate(() => [...document.styleSheets].map((s) => s.href ?? "").filter(Boolean).map((h) => new URL(h).pathname).sort())).toEqual(["/certificate-fonts.css", "/certificate.css"]);
  await sheet.close();
  await page.getByRole("button", { name: "Other dates" }).click();
  await expect(page.getByLabel("What it covers")).toBeVisible();
  await expect(page.getByRole("button", { name: "Make it with a check code" })).toBeVisible();
  // an employer checks it with the code printed on it, signed in or not
  await tab(page, "Profile").click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Volunteer sign-in" })).toBeVisible();
  await checkCert(page, "ZZZZ11112222");
  await expect(page.locator("#check-res")).toContainText("This certificate is valid.");
  await expect(page.locator("#check-res")).toContainText("Sara Haddad");
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
  const pages = ["/", `/#o/${BD}`, "/#me", "/#updates", "/#profile", "/#cert", `/#work/${BD}`, `/#team/${BD}`, "/#check/ZZZZ11112222"];
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
  await expect(page.getByRole("heading", { name: "Micromobility Blood Donation" })).toHaveCount(0);
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

test("phone notifications: no switch for now (the user, 2026-11-09), and the page has a manifest and a worker that only notifies", async ({ page }) => {
  const errors = watchCsp(page);
  await page.goto("/");
  await signIn(page);
  await tab(page, "Profile").click();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  await expect(page.getByRole("switch", { name: "Notifications" })).toHaveCount(0);
  const manifest = await (await page.request.get("/manifest.webmanifest")).json() as { start_url: string; icons: { src: string }[] };
  expect(manifest.start_url).toBe("/#me");
  expect(manifest.icons.map((i) => i.src)).toContain("/icon-512.png");
  const sw = await (await page.request.get("/sw.js")).text();
  expect(sw).toContain('addEventListener("push"');
  expect(sw).toContain('addEventListener("notificationclick"');
  expect(sw).not.toContain('addEventListener("fetch"');
  expect(sw).not.toMatch(/caches\./);
  expect(errors).toEqual([]);
});
