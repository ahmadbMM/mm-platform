// Points the two registration forms the website serves at another Supabase project, for a
// staging build only (CI runs it on the `staging` branch, after the check that the committed pages
// are what their sources build). The forms carry their project's URL and anon key inside the built
// pages (apps/web/src/forms/*-page.ts); this swaps production's for staging's in place, so a
// staging form never writes into the real database. Nothing is committed.
//
//   FROM_URL=… FROM_KEY=… TO_URL=… TO_KEY=… node scripts/point-forms.mjs
import { readFileSync, writeFileSync } from "node:fs";

const { FROM_URL, FROM_KEY, TO_URL, TO_KEY } = process.env;
for (const [k, v] of Object.entries({ FROM_URL, FROM_KEY, TO_URL, TO_KEY })) {
  if (!v) throw new Error(k + " is not set");
}
if (FROM_URL === TO_URL) throw new Error("FROM_URL and TO_URL are the same project");

const files = ["apps/web/src/forms/petromin-page.ts", "apps/web/src/forms/community-page.ts"];
for (const f of files) {
  const src = readFileSync(f, "utf8");
  const n = src.split(FROM_URL).length - 1;
  if (!n) throw new Error(f + " does not name " + FROM_URL + "; was it built for another project?");
  const out = src.split(FROM_URL).join(TO_URL).split(FROM_KEY).join(TO_KEY);
  if (out.includes(FROM_URL) || out.includes(FROM_KEY)) throw new Error(f + " still names production");
  writeFileSync(f, out);
  console.log(f + ": " + n + " address(es) now " + TO_URL);
}
