// forms/shared/account.js for the builds: the text the static forms inline, and the website's copy of it
// (apps/web/src/lib/account-shared.ts) that the Learn to ride form imports. Each form's `npm run build` writes the
// copy, so CI's rebuild-and-diff refuses a commit that changed one without the other.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const here = import.meta.dirname;
export const ACCOUNT_JS = readFileSync(resolve(here, 'account.js'), 'utf8');
new Function(ACCOUNT_JS + ';return MMAccount;')(); // it parses, and names MMAccount

export function writeAccountForWeb() {
  writeFileSync(resolve(here, '../../apps/web/src/lib/account-shared.ts'),
    '/* eslint-disable */\n// @ts-nocheck\n' +
    '// GENERATED from forms/shared/account.js by `npm run build` in forms/community, forms/saturday or forms/lockers. Do not edit here:\n' +
    '// change forms/shared/account.js, then rebuild both forms. Typed for the website in lib/account-step.ts.\n' +
    ACCOUNT_JS + '\nexport default MMAccount;\n');
}

/** The Privacy Notice a form shows and records an account's consent under (its shared/shared.js, which the form's
 *  `npm run sync` copies from the booking app by hand) is the one the website shows (apps/web/src/content/privacy-notice.ts).
 *  A form left on an older copy stamped new accounts with that older version, and they are never asked again (2026-11-10
 *  bug hunt: the community form shipped 2026-10-28 while the site and the other forms were on 2026-11-08). */
export function sameNoticeAsSite(shared, form) {
  const site = /export const PRIVACY_VERSION = "(\d{4}-\d{2}-\d{2})"/.exec(readFileSync(resolve(here, '../../apps/web/src/content/privacy-notice.ts'), 'utf8'));
  if (!site) { console.error('apps/web/src/content/privacy-notice.ts names no PRIVACY_VERSION'); process.exit(1); }
  if (shared.PRIVACY_VERSION !== site[1]) {
    console.error(`forms/${form}/shared/shared.js carries the Privacy Notice of ${shared.PRIVACY_VERSION}, the website the one of ${site[1]}: ` +
      `run \`npm run sync\` in forms/${form} (from the booking app, as the website's notice was), then build again.`);
    process.exit(1);
  }
}
