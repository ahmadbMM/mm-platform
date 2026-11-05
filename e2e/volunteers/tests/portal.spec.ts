import { expect, test, type Page } from "@playwright/test";

const STUB = Number(process.env.STUB_PORT || 8801);
const BD = "2099-11-05-bd";

test.beforeEach(async ({ request }, info) => {
  info.setTimeout(150_000); // room for one wait on the sign-in meter
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
  await page.getByLabel("Email or mobile number").fill(login);
  await page.getByLabel("Password", { exact: true }).fill(pwd);
  for (let i = 0; i < 3; i++) {
    const answered = page.waitForResponse((r) => r.url().endsWith("/api/login"));
    await page.locator("form").getByRole("button", { name: "Sign in" }).click();
    const res = await answered;
    if (res.status() !== 429 || (await res.json().catch(() => ({}))).error !== "RATE_LIMIT") return;
    await page.waitForTimeout(61_000);
  }
}

const accept = (page: Page, id = BD) => page.request.post(`http://127.0.0.1:${STUB}/__accept`, { data: { id } });

async function registerAndAccept(page: Page): Promise<void> {
  await page.goto(`/#o/${BD}`);
  await page.getByRole("button", { name: "I want to help" }).click();
  await submit(page, "sara@example.com", "Pass1234");
  await page.getByRole("button", { name: "I want to help" }).click();
  await expect(page.getByText("Your interest is sent.")).toBeVisible();
  await accept(page);
}

test("anyone can read the opportunities, with no sign-in and no names", async ({ page }) => {
  const errors = watchCsp(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Volunteer with MicroMobility" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Micromobility Blood Donation" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Beach clean-up" })).toBeVisible();
  await expect(page.getByText("5 volunteers needed")).toBeVisible();
  await expect(page.getByText("Minimum age 18")).toBeVisible();
  await page.getByRole("heading", { name: "Micromobility Blood Donation" }).click();
  await expect(page).toHaveURL(new RegExp(`#o/${BD}`));
  await expect(page.getByText("Help donors at the door.")).toBeVisible();
  await expect(page.getByText("Sign in with your MicroMobility account to register your interest.")).toBeVisible();
  await expect(page.getByText("Meet at gate 3.")).toHaveCount(0); // the briefing is for those accepted
  expect(errors).toEqual([]);
});

test("a wrong password is said, and the other ways in go to the booking app", async ({ page }) => {
  const errors = watchCsp(page);
  await page.goto("/#signin");
  await page.locator("form").getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toContainText("Enter your email or mobile number");
  await submit(page, "sara@example.com", "wrong");
  await expect(page.getByRole("alert")).toContainText("Wrong email, mobile number or password");
  await expect(page.getByLabel("Email or mobile number")).toHaveValue("sara@example.com");
  await expect(page.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", /\/signup\?handoff=volunteer$/);
  await expect(page.getByRole("link", { name: "Sign in with Google or Apple" })).toHaveAttribute("href", /\?handoff=volunteer$/);
  await expect(page.getByRole("link", { name: "Forgot your password?" })).toHaveAttribute("href", /handoff=volunteer&auth=forgot$/);
  expect(errors).toEqual([]);
});

test("registering interest: back to the opportunity after signing in, and nobody works until accepted", async ({ page }) => {
  const errors = watchCsp(page);
  await page.goto(`/#o/${BD}`);
  await page.getByRole("button", { name: "I want to help" }).click();
  await expect(page).toHaveURL(/#signin/);
  await submit(page, "sara@example.com", "Pass1234");
  await expect(page).toHaveURL(new RegExp(`#o/${BD}`));
  await page.getByLabel("Which role would you like?").selectOption("Guide");
  await page.getByLabel("Anything we should know? (optional)").fill("I speak Arabic");
  await page.getByRole("button", { name: "I want to help" }).click();
  await expect(page.getByText("Your interest is sent.")).toBeVisible();
  await expect(page.getByText("Interest sent. Our team will get back to you.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Start work" })).toHaveCount(0);
  // the work page, by its address, says no
  await page.goto(`/#work/${BD}`);
  await page.reload();
  await expect(page.getByText("This session is no longer open to volunteers.")).toBeVisible();
  await expect(page.locator("#vol-q")).toHaveCount(0);
  // withdrawing
  await page.goto(`/#o/${BD}`);
  await page.getByRole("button", { name: "I can no longer help" }).click();
  await expect(page.getByText("You are off this opportunity.")).toBeVisible();
  expect(errors).toEqual([]);
});

test("accepted: the agreement once, then work: find, check in, mark donated, undo, finish", async ({ page }) => {
  const errors = watchCsp(page);
  await registerAndAccept(page);
  await page.goto("/#me");
  await page.reload();
  await expect(page.getByText("You are accepted")).toBeVisible();
  await page.getByRole("link", { name: "Start work" }).click();
  // the agreement comes first, and Continue waits for the tick
  await expect(page.getByRole("heading", { name: "Before you start" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  await page.getByLabel("I have read this and I agree").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("#vol-q")).toBeVisible();
  await expect(page.getByText("Meet at gate 3.")).toBeVisible();
  await expect(page.locator("#vol-counts")).toContainText("0 / 3");
  // a short search is a booking number
  await page.locator("#vol-q").fill("2");
  await page.locator("#vol-find").click();
  const row = page.locator('.row[data-id="q1111111"]');
  await expect(row).toContainText("Dana Donor");
  await expect(row).toContainText("Not checked in");
  await row.getByRole("button", { name: "Check in" }).click();
  await expect(page.locator('.row[data-id="q1111111"]')).toContainText("Checked in");
  await expect(page.locator("#vol-counts")).toContainText("1 / 3");
  await page.locator('.row[data-id="q1111111"]').getByRole("button", { name: "Mark donated" }).click();
  await expect(page.locator('.row[data-id="q1111111"]')).toContainText("Donated");
  await page.locator('.row[data-id="q1111111"]').getByRole("button", { name: "Undo donated" }).click();
  await page.locator('.row[data-id="q1111111"]').getByRole("button", { name: "Undo check-in" }).click();
  await expect(page.locator('.row[data-id="q1111111"]')).toContainText("Not checked in");
  await expect(page.locator("#vol-counts")).toContainText("0 / 3");
  // finishing
  await page.getByRole("button", { name: "I have finished" }).click();
  await expect(page.getByText("Thank you. Your finish time is saved.")).toBeVisible();
  await expect(page).toHaveURL(/#me/);
  expect(errors).toEqual([]);
});

test("what a volunteer may not do: their own booking, money, nonsense", async ({ page }) => {
  await registerAndAccept(page);
  await page.goto(`/#work/${BD}`);
  await page.reload();
  await page.getByLabel("I have read this and I agree").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.locator("#vol-q").fill("4");
  await page.locator("#vol-find").click();
  const own = page.locator('.row[data-id="q3333333"]');
  await expect(own).toContainText("This is your own booking");
  await expect(own.getByRole("button")).toHaveCount(0);
  await page.locator("#vol-q").fill("3");
  await page.locator("#vol-find").click();
  const owes = page.locator('.row[data-id="q2222222"]');
  await expect(owes).toContainText("Please send this person to the desk.");
  await expect(owes).not.toContainText("payment"); // volunteers never see payments
  await expect(owes.getByRole("button")).toHaveCount(0);
  await page.locator("#vol-q").fill("abc");
  await page.locator("#vol-find").click();
  await expect(page.locator("#vol-msg")).toContainText("Type the whole mobile number");
  await page.locator("#vol-q").fill("0500000003");
  await page.locator("#vol-find").click();
  await expect(page.locator('.row[data-id="q1111111"]')).toContainText("Dana Donor");
  await page.locator("#vol-q").fill("999");
  await page.locator("#vol-find").click();
  await expect(page.locator("#vol-msg")).toContainText("No booking found");
});

test("the cut-off ends the work page: the next action says so and leaves", async ({ page }) => {
  await registerAndAccept(page);
  await page.goto(`/#work/${BD}`);
  await page.reload();
  await page.getByLabel("I have read this and I agree").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("#vol-q")).toBeVisible();
  await page.request.post(`http://127.0.0.1:${STUB}/__cutoff`, { data: { id: BD } });
  await page.locator("#vol-q").fill("2");
  await page.locator("#vol-find").click();
  await expect(page.getByText("This session is no longer open to volunteers.")).toBeVisible();
  await expect(page).toHaveURL(/#me/);
  await expect(page.locator("#vol-q")).toHaveCount(0);
  await page.getByRole("link", { name: "Opportunities" }).click();
  await expect(page.getByRole("heading", { name: "Beach clean-up" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Micromobility Blood Donation" })).toHaveCount(0);
});

test("handed over from the booking app with a one-time code, once", async ({ page }) => {
  const errors = watchCsp(page);
  await page.goto(`/?signin=${"a".repeat(48)}`);
  await expect(page).not.toHaveURL(/signin=/);
  await expect(page.getByRole("link", { name: "My volunteering" })).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("link", { name: "My volunteering" })).toHaveCount(0);
  await page.goto(`/?signin=${"a".repeat(48)}`); // spent
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("hours and the certificate; Arabic reads right to left", async ({ page }) => {
  const errors = watchCsp(page);
  await page.goto("/#signin");
  await submit(page, "sara@example.com", "Pass1234");
  await page.request.post(`http://127.0.0.1:${STUB}/__hours`, { data: { hours: 12.5 } });
  await page.goto("/#me");
  await page.reload();
  await expect(page.locator(".hours")).toContainText("12.5");
  await page.getByRole("link", { name: "Certificate" }).click();
  await expect(page.getByRole("heading", { name: "Certificate of Volunteering" })).toBeVisible();
  await expect(page.locator(".cert")).toContainText("Sara Haddad");
  await expect(page.locator(".cert-hours")).toContainText("12.5");
  await page.getByLabel("Language").selectOption("ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await page.getByRole("link", { name: /الفرص|فرص/ }).click();
  await expect(page.locator(".page h1")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("no sideways scrolling on any page", async ({ page }) => {
  await registerAndAccept(page);
  for (const path of ["/", `/#o/${BD}`, "/#me"]) {
    await page.goto(path);
    await page.reload();
    await expect(page.locator(".page")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), path).toBe(true);
  }
});
