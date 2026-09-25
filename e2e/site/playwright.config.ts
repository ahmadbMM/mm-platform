import { defineConfig, devices } from "@playwright/test";

// The website's pages in a real browser, after `next build` (CI runs it after the Cloudflare
// build, which leaves apps/web/.next). The site runs with MM_TEST_SITE_OPEN=1 - open, every page
// switched on - whatever the real site's Coming Soon switch says; it reads the database's public
// content (NEXT_PUBLIC_SUPABASE_*) as the live site does, and the browser's own calls to the
// database are blocked in the specs, so nothing is written anywhere. PW_PORT when 3930 is taken.
const PORT = Number(process.env.PW_PORT || 3930);
export default defineConfig({
  testDir: "./tests",
  reporter: process.env.CI ? "github" : "list",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `pnpm --dir ../../apps/web exec next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    env: { MM_TEST_SITE_OPEN: "1" },
    reuseExistingServer: false,
    timeout: 120000,
  },
});
