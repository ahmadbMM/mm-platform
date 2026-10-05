// Signing in from the specs. The Worker meters sign-in per connection (LOGIN_LIMIT: 10 a minute, and
// `wrangler dev` enforces it, every test arriving from 127.0.0.1), so a run that signs in more often
// than that waits for the next minute instead of failing on RATE_LIMIT.
import { expect, type Page } from "@playwright/test";

export async function signIn(page: Page, pwd: string, login = "cafe@example.com"): Promise<void> {
  await page.goto("/");
  await page.getByLabel("Email or mobile number").fill(login);
  await page.getByLabel("Password", { exact: true }).fill(pwd);
  for (let i = 0; i < 3; i++) {
    const answered = page.waitForResponse((r) => r.url().endsWith("/api/login"));
    await page.getByRole("button", { name: "Sign in" }).click();
    const res = await answered;
    if (res.status() !== 429 || (await res.json().catch(() => ({}))).error !== "RATE_LIMIT") return;
    await page.waitForTimeout(61_000);
  }
  await expect(page.getByRole("alert")).not.toContainText("Too many tries from this connection");
}
