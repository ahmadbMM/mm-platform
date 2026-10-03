import { expect, test, type Page } from "@playwright/test";

const STUB = Number(process.env.STUB_PORT || 8799);

test.beforeEach(async ({ request }) => {
  await request.post(`http://127.0.0.1:${STUB}/__reset`);
});

function watchCsp(page: Page): string[] {
  const seen: string[] = [];
  page.on("console", (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) seen.push(m.text()); });
  page.on("pageerror", (e) => seen.push(String(e)));
  return seen;
}

async function signIn(page: Page, pwd = "Temp1234") {
  await page.goto("/");
  await page.getByLabel("Email or mobile number").fill("cafe@example.com");
  await page.getByLabel("Password", { exact: true }).fill(pwd);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("sign-in refuses a wrong password and says why", async ({ page }) => {
  const errors = watchCsp(page);
  await page.goto("/");
  await expect(page.getByText("Accounts are created by MicroMobility")).toBeVisible();
  await signIn(page, "Wrong1234");
  await expect(page.getByRole("alert")).toContainText("is not right");
  expect(errors).toEqual([]);
});

test("first sign-in: change the password, request a date, see it in My bookings", async ({ page }) => {
  const errors = watchCsp(page);
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Choose your own password" })).toBeVisible();
  await page.getByLabel("New password", { exact: true }).fill("weak");
  await page.getByLabel("Confirm new password").fill("weak");
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page.getByText("This password is too weak")).toBeVisible();
  await page.getByLabel("New password", { exact: true }).fill("Breakfast2026");
  await page.getByLabel("Confirm new password").fill("Breakfast2026");
  await page.getByRole("button", { name: "Save password" }).click();

  await expect(page.getByRole("heading", { name: "Breakfast calendar" })).toBeVisible();
  await expect(page.getByText("Harbour Cafe")).toBeVisible();

  // The header button opens the dialog; one date, the first available.
  await page.getByRole("button", { name: "Request dates" }).first().click();
  const dlg = page.getByRole("dialog");
  await expect(dlg.getByRole("heading", { name: "Request breakfast dates" })).toBeVisible();
  await expect(dlg.getByText("Your plan does not include monthly repeats.")).toBeVisible();
  await dlg.getByRole("button", { name: "Check dates" }).click();
  await expect(dlg.getByText("1 of 1 dates can be requested.")).toBeVisible();
  await expect(dlg.getByText("Free")).toBeVisible();
  await dlg.getByRole("button", { name: "Send request" }).click();
  await expect(dlg.getByText("Requested 1 date. MicroMobility will confirm")).toBeVisible();
  await dlg.getByRole("button", { name: "Done" }).click();
  await expect(dlg).toBeHidden();

  // The main menu's link: on phones a requested date in the list carries its own "My bookings" link too.
  await page.getByRole("navigation").getByRole("link", { name: "My bookings" }).click();
  await expect(page.getByRole("heading", { name: "Upcoming" })).toBeVisible();
  await expect(page.locator(".booking").first()).toContainText("Requested");
  expect(errors).toEqual([]);
});

test("Arabic turns the page right to left and keeps Western digits", async ({ page }) => {
  await signIn(page);
  await page.getByLabel("New password", { exact: true }).fill("Breakfast2026");
  await page.getByLabel("Confirm new password").fill("Breakfast2026");
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page.getByRole("heading", { name: "Breakfast calendar" })).toBeVisible();
  await page.getByRole("button", { name: "Switch to Arabic" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { name: "تقويم الفطور" })).toBeVisible();
  const text = await page.locator("main").innerText();
  expect(text).not.toMatch(/[٠-٩]/);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
});

test("the security headers and robots.txt", async ({ request }) => {
  const res = await request.get("/");
  expect(res.headers()["content-security-policy"]).toContain("script-src 'self'");
  expect(res.headers()["x-robots-tag"]).toContain("noindex");
  const robots = await request.get("/robots.txt");
  expect(await robots.text()).toContain("Disallow: /");
});

test("after a breakfast: the calendar marks it, My bookings asks how it went, and the feedback is saved", async ({ page, request }) => {
  const errors = watchCsp(page);
  const past = await (await request.post(`http://127.0.0.1:${STUB}/__past`)).json() as { day: string };
  await signIn(page);
  await page.getByLabel("New password", { exact: true }).fill("Breakfast2026");
  await page.getByLabel("Confirm new password").fill("Breakfast2026");
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page.getByRole("heading", { name: "Breakfast calendar" })).toBeVisible();

  // The calendar: the breakfast's month shows a Feedback marker that opens the dialog.
  const thisMonth = await page.locator("#cal-month").innerText();
  const pastMonth = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${past.day}T00:00:00Z`));
  if (thisMonth !== pastMonth) await page.getByRole("button", { name: "Previous month" }).click();
  await expect(page.locator("#cal-month")).toHaveText(pastMonth);
  const isPhone = (page.viewportSize()?.width || 0) < 760;
  const marker = isPhone
    ? page.locator(".cal-list").getByRole("button", { name: /^Feedback:/ })
    : page.locator(`.cal-grid button[data-day="${past.day}"]`);
  await expect(marker).toBeVisible();
  if (!isPhone) await expect(marker).toContainText("Feedback");
  await marker.click();
  const fromCal = page.getByRole("dialog");
  await expect(fromCal.getByRole("heading", { name: "Breakfast feedback" })).toBeVisible();
  await fromCal.getByRole("button", { name: "Close", exact: true }).first().click();
  await expect(fromCal).toBeHidden();

  // My bookings: the banner and the button.
  await page.getByRole("navigation").getByRole("link", { name: "My bookings" }).click();
  await expect(page.getByText("1 breakfast is waiting for your feedback.")).toBeVisible();
  const pastList = page.getByRole("region", { name: "Past" });
  await pastList.getByRole("button", { name: "How did it go?" }).click();

  const dlg = page.getByRole("dialog");
  await expect(dlg.getByRole("heading", { name: "Breakfast feedback" })).toBeVisible();
  await expect(dlg.getByText("12 riders booked")).toBeVisible();
  await expect(dlg.getByText("You can edit your feedback for 14 days after the breakfast.")).toBeVisible();

  // The rating is required.
  await dlg.getByRole("button", { name: "Send feedback" }).click();
  await expect(dlg.getByText("Choose a rating from 1 to 5.")).toBeVisible();

  // Stars: a radiogroup; arrows move the choice.
  const stars = dlg.getByRole("radiogroup", { name: "Overall, how did it go?" });
  await stars.getByRole("radio", { name: "3 – Good" }).click();
  await expect(stars.getByRole("radio", { name: "3 – Good" })).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("ArrowRight");
  await expect(stars.getByRole("radio", { name: "4 – Very good" })).toHaveAttribute("aria-checked", "true");
  await expect(stars.getByRole("radio", { name: "4 – Very good" })).toBeFocused();

  await dlg.getByLabel("How many riders came?").fill("9");
  await dlg.getByLabel("What went well?").fill("The riders arrived together and on time.");
  await dlg.getByLabel("What could we do better?").fill("Tell us the count a day earlier.");
  await dlg.getByRole("button", { name: "Send feedback" }).click();
  await expect(dlg.getByText("Thank you. Your feedback goes to the MicroMobility team.")).toBeVisible();
  await dlg.getByRole("button", { name: "Done" }).click();
  await expect(dlg).toBeHidden();

  // The rating shows, Edit is offered, and the banner is gone.
  await expect(pastList.getByText("Your rating: 4 – Very good")).toBeVisible();
  await expect(pastList.getByText("Riders who came: 9")).toBeVisible();
  await expect(page.getByText("1 breakfast is waiting for your feedback.")).toHaveCount(0);
  await expect(pastList.getByRole("button", { name: "How did it go?" })).toHaveCount(0);
  await pastList.getByRole("button", { name: "Edit feedback" }).click();
  await expect(dlg.getByRole("radio", { name: "4 – Very good" })).toHaveAttribute("aria-checked", "true");
  await expect(dlg.getByLabel("How many riders came?")).toHaveValue("9");
  await expect(dlg.getByRole("button", { name: "Save changes" })).toBeVisible();
  expect(errors).toEqual([]);
});
