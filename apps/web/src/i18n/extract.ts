// Every English text the site shows, for the translations to be checked against
// (src/i18n/__tests__/i18n.test.ts) and for the translators (src/i18n/source.json):
//   - tx("...") in a component or page, and phrase("...", "...") in data;
//   - the { en, ar } dictionaries in *.text.ts files (a sentence with values as its template);
//   - the defaults of every page staff can edit (content/pages), which is what visitors read
//     until staff change a text - a changed English has no translation until one is added;
//   - next-intl's messages (messages/en.json);
//   - the NFC bike pages' English (lib/bike-i18n.ts), which the other languages translate too.
// `client` is the part the browser's components use, which is all the browser is sent.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Field, ItemField } from "@/content/types";
import { PAGES } from "@/content";
import { englishOf } from "./tx";
import { BIKE_EN } from "@/lib/bike-i18n";
import messages from "../../messages/en.json";

const SRC = fileURLToPath(new URL("..", import.meta.url));
// tx("..."), phrase("...") and serverL(locale)("...") - a translator called straight away.
const CALL = /\b(?:tx|phrase|serverL\(\w+\))\(\s*"((?:[^"\\]|\\.)*)"/g;

function files(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "__tests__" || e.name === "tx" || e.name === "node_modules") continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...files(p));
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

function fieldTexts(f: Field | ItemField, out: Set<string>) {
  if (f.type === "text" || f.type === "longtext") {
    if (!f.mono && f.def.en.trim()) out.add(f.def.en.trim());
  } else if (f.type === "list") {
    for (const item of f.def) {
      for (const sub of f.item) {
        if ((sub.type === "text" || sub.type === "longtext") && !sub.mono) {
          const v = item[sub.id] as { en?: unknown } | undefined;
          if (v && typeof v.en === "string" && v.en.trim()) out.add(v.en.trim());
        }
      }
    }
  }
}

function flatten(v: unknown, out: Set<string>) {
  if (typeof v === "string") { if (v.trim()) out.add(v); }
  else if (v && typeof v === "object") for (const x of Object.values(v)) flatten(x, out);
}

export async function collect(): Promise<{ strings: string[]; client: string[] }> {
  const all = new Set<string>();
  const client = new Set<string>();
  for (const f of files(SRC)) {
    const src = readFileSync(f, "utf8");
    const inBrowser = /^\s*["']use client["']/.test(src) || f.endsWith(".text.ts") || /\bphrase\(/.test(src);
    // Comment lines are not texts the site shows, however they quote one.
    const code = src.split("\n").map((l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? "" : l)).join("\n");
    for (const m of code.matchAll(CALL)) {
      const s = JSON.parse(`"${m[1]}"`) as string;
      if (!s.trim()) continue;
      all.add(s);
      if (inBrowser) client.add(s);
    }
    if (f.endsWith(".text.ts")) {
      const mod = (await import(/* @vite-ignore */ f)) as Record<string, unknown>;
      for (const v of Object.values(mod)) {
        if (v && typeof v === "object" && "en" in v && "ar" in v) {
          for (const s of englishOf((v as { en: unknown }).en)) if (s.trim()) { all.add(s); client.add(s); }
        }
      }
    }
  }
  for (const page of PAGES) for (const sec of page.sections) for (const f of sec.fields) fieldTexts(f, all);
  flatten(messages, all);
  for (const s of Object.values(BIKE_EN)) if (s.trim()) all.add(s);
  return { strings: [...all].sort(), client: [...client].sort() };
}
