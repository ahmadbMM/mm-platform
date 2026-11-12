import { defineConfig, devices } from '@playwright/test';

// The same specs against the website's page for the form (app/[locale]/dukan: the site's header, footer and languages
// around this form), after the website is built (`next build` in apps/web). Every Supabase call is stubbed in the specs,
// as for the form's own page. The tab icon is the website's own there (tabicon.spec.ts is about the form's page alone).
// PW_PORT when the default port is taken.
const PORT = Number(process.env.PW_PORT || 3952);
export default defineConfig({
  testDir: './tests',
  testIgnore: /tabicon\.spec\.ts/,
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
