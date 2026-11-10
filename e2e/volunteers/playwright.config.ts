import { defineConfig, devices } from "@playwright/test";

// The volunteer portal (apps/volunteers) in a real browser: built, served by `wrangler dev`, and
// pointed at stub-db.mjs instead of a database, so nothing real is read or written.
// PW_PORT / STUB_PORT when 8790 / 8801 are taken.
const PORT = Number(process.env.PW_PORT || 8790);
const STUB = Number(process.env.STUB_PORT || 8801);
export default defineConfig({
  testDir: "./tests",
  reporter: process.env.CI ? "github" : "list",
  workers: 1, // one stub database, with state
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: `http://localhost:${PORT}`,
    // A camera that is always there and never asks (a moving test picture): the work page's Scan keeps it running.
    launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] },
    // The portal registers a service worker (the app shell, decision 11). Kept out of the way of page.route() everywhere but
    // the offline test, which turns it back on for itself.
    serviceWorkers: "block",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    { command: `node stub-db.mjs`, port: STUB, env: { STUB_PORT: String(STUB) }, reuseExistingServer: false },
    {
      command: `pnpm --dir ../../apps/volunteers build && pnpm --dir ../../apps/volunteers exec wrangler dev --port ${PORT} --ip 127.0.0.1 --var SUPABASE_URL:http://127.0.0.1:${STUB} --var SUPABASE_ANON_KEY:test-anon`,
      url: `http://localhost:${PORT}/robots.txt`,
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
});
