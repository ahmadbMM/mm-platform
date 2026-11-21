import { defineConfig, devices } from "@playwright/test";

// The booking steps on /experiences signed in, in a real browser (tests-booking/): the site in development mode, pointed at
// stub-booking-db.mjs instead of a database - the sessions ahead and one rider, in memory - so a signed-in page draws from the
// server and its saves change the stub, never anything real. Run: npx playwright test -c playwright.booking.config.ts
// (PW_PORT / STUB_PORT when 3936 / 8796 are taken). The site e2e run (playwright.config.ts) does not run these: it serves
// the built site, which reads the real database. Development mode's own script rules are bypassed (bypassCSP), as its
// eval would otherwise be refused by the site's Content-Security-Policy.
const PORT = Number(process.env.PW_PORT || 3936);
const STUB = Number(process.env.STUB_PORT || 8796);
export default defineConfig({
  testDir: "./tests-booking",
  reporter: process.env.CI ? "github" : "list",
  workers: 1, // one stub database, with state
  timeout: 90000,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: `http://localhost:${PORT}`, bypassCSP: true },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    { command: "node stub-booking-db.mjs", port: STUB, env: { STUB_PORT: String(STUB) }, reuseExistingServer: !!process.env.PW_REUSE },
    {
      command: `pnpm --dir ../../apps/web exec next dev -p ${PORT}`,
      url: `http://localhost:${PORT}/api/health`,
      env: { MM_TEST_SITE_OPEN: "1", NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${STUB}`, NEXT_PUBLIC_SUPABASE_ANON_KEY: "stub-anon" },
      reuseExistingServer: !!process.env.PW_REUSE,
      timeout: 180000,
    },
  ],
});
