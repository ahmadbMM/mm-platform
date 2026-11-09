import { defineConfig, devices } from '@playwright/test';

// The same specs against the website's page for it (app/[locale]/lockers: the site's header, footer and languages around
// this page), after the website is built (`next build` in apps/web). Every Supabase call is stubbed in the specs, as for
// the page on its own. shots.spec.ts draws and measures the page's own header, which the website's page leaves to the
// site. PW_PORT when the default port is taken.
const PORT = Number(process.env.PW_PORT || 3945);
export default defineConfig({
  testDir: './tests',
  testIgnore: /shots\.spec\.ts/,
  reporter: 'list',
  use: { baseURL: `http://localhost:${PORT}`, ...devices['Pixel 7'] },
  webServer: {
    command: `pnpm --dir ../../apps/web exec next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    env: { MM_TEST_SITE_OPEN: '1' },
    reuseExistingServer: false,
    timeout: 120000,
  },
});
