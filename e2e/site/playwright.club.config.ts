import { defineConfig, devices } from "@playwright/test";

// /club's members' area signed in, in a real browser (tests-club/): the site in development mode, pointed at
// stub-club-db.mjs instead of a database - one Community member, her membership, the Community tab's read (hub_feed),
// the Mentorship programme and her bookings, in memory - so the area draws from the server and its writes change the
// stub, never anything real. Run: npx playwright test -c playwright.club.config.ts (PW_PORT / STUB_PORT when 3950 /
// 8780 are taken). As with playwright.account.config.ts, the site e2e run (playwright.config.ts) does not run these, and
// development mode's own script rules are bypassed (bypassCSP).
const PORT = Number(process.env.PW_PORT || 3950);
const STUB = Number(process.env.STUB_PORT || 8780);
export default defineConfig({
  testDir: "./tests-club",
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
    { command: "node stub-club-db.mjs", port: STUB, env: { STUB_PORT: String(STUB) }, reuseExistingServer: !!process.env.PW_REUSE },
    {
      command: `pnpm --dir ../../apps/web exec next dev -p ${PORT}`,
      url: `http://localhost:${PORT}/api/health`,
      env: { MM_TEST_SITE_OPEN: "1", NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${STUB}`, NEXT_PUBLIC_SUPABASE_ANON_KEY: "stub-anon" },
      reuseExistingServer: !!process.env.PW_REUSE,
      timeout: 180000,
    },
  ],
});
