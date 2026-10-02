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

  await page.getByRole("link", { name: "My bookings" }).click();
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
