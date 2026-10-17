import { defineConfig, devices } from '@playwright/test';

// The page is driven in a real browser against serve.mjs (the built page at its address), with every
// Supabase call stubbed in the specs, so the suite never books or makes an account in production.
// PW_PORT when the default port is taken.
const PORT = Number(process.env.PW_PORT || 8789);
export default defineConfig({
  testDir: './tests',
  reporter: 'list',
  use: { baseURL: `http://localhost:${PORT}`, ...devices['Pixel 7'] },
  webServer: {
    command: `node serve.mjs ${PORT}`,
    url: `http://localhost:${PORT}/defe`,
    reuseExistingServer: false,
    timeout: 60000,
  },
});
