import { defineConfig, devices } from "@playwright/test";

// The vendor portal (apps/vendors) in a real browser: built, served by `wrangler dev`, and
// pointed at stub-db.mjs instead of a database, so nothing real is read or written.
// PW_PORT / STUB_PORT when 8788 / 8799 are taken.
const PORT = Number(process.env.PW_PORT || 8788);
const STUB = Number(process.env.STUB_PORT || 8799);
export default defineConfig({
  testDir: "./tests",
  reporter: process.env.CI ? "github" : "list",
  workers: 1, // one stub database, with state
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    { command: `node stub-db.mjs`, port: STUB, env: { STUB_PORT: String(STUB) }, reuseExistingServer: false },
    {
      command: `pnpm --dir ../../apps/vendors build && pnpm --dir ../../apps/vendors exec wrangler dev --port ${PORT} --ip 127.0.0.1 --var SUPABASE_URL:http://127.0.0.1:${STUB} --var SUPABASE_ANON_KEY:test-anon`,
      url: `http://localhost:${PORT}/robots.txt`,
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
});
