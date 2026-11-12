import { defineConfig, devices } from '@playwright/test';

// The form is driven in a real browser against serve.mjs (the built page at its address), with
// every Supabase call stubbed in the specs, so the suite never writes a booking to production.
// PW_PORT when the default port is taken.
const PORT = Number(process.env.PW_PORT || 8807);
export default defineConfig({
  testDir: './tests',
  reporter: 'list',
  use: { baseURL: `http://localhost:${PORT}` },
  // Every spec on an Android phone (Chromium); the ones tagged @webkit on an iPhone as well (Safari's engine), where most
  // of the riders are and where the scroll, dialogs and downloads behave their own way.
  projects: [
    { name: 'android', use: { ...devices['Pixel 7'] } },
    { name: 'iphone', grep: /@webkit/, use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    command: `node serve.mjs ${PORT}`,
    url: `http://localhost:${PORT}/petromin-invite`,
    reuseExistingServer: false,
    timeout: 60000,
  },
});
