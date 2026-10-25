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
    '// GENERATED from forms/shared/account.js by `npm run build` in forms/community or forms/defe. Do not edit here:\n' +
    '// change forms/shared/account.js, then rebuild both forms. Typed for the website in lib/account-step.ts.\n' +
    ACCOUNT_JS + '\nexport default MMAccount;\n');
}
