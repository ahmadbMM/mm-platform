import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { collect } from "../extract";
import { LOCALES, LOCALE_CODES, TRANSLATED } from "../locales";
import { routing } from "../routing";
import { fill, localize, makeL } from "../tx";

// The translations are complete and correct in shape, and the list they are checked against is
// the site's own. After changing a text: I18N_WRITE=1 pnpm vitest run src/i18n - then add the
// new English (source.json) to every src/i18n/tx/<code>.json (rules and terms: ../TRANSLATING.md).
const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const SOURCE = here("../source.json");
const tags = (s: string) => (s.match(/<\/?[a-z][^>]*>/gi) ?? []).map((t) => t.replace(/\s+[a-z-]+="[^"]*"/gi, "")).sort();
const slots = (s: string) => (s.match(/\{[a-z0-9_]+\}/gi) ?? []).sort();

describe("the languages", () => {
  it("are the routing's; English and Arabic have messages files, the rest translate the English", () => {
    expect([...routing.locales]).toEqual([...LOCALE_CODES]);
    expect(LOCALES.length).toBe(16);
    for (const l of ["en", "ar"]) expect(existsSync(here(`../../../messages/${l}.json`)), l).toBe(true);
  });

  it("have a source list that matches the site", async () => {
    const now = await collect();
    if (process.env.I18N_WRITE) writeFileSync(SOURCE, JSON.stringify(now, null, 1) + "\n");
    const saved = JSON.parse(readFileSync(SOURCE, "utf8"));
    expect(saved).toEqual(now);
  });

  for (const code of TRANSLATED) {
    it(`${code}: every text is translated, with its values and markup intact`, () => {
      const source: string[] = JSON.parse(readFileSync(SOURCE, "utf8")).strings;
      const dict: Record<string, string> = JSON.parse(readFileSync(here(`../tx/${code}.json`), "utf8"));
      const missing = source.filter((s) => typeof dict[s] !== "string" || !dict[s].trim());
      expect(missing, `${code} is missing ${missing.length}: ${missing.slice(0, 5).join(" | ")}`).toEqual([]);
      const stale = Object.keys(dict).filter((k) => !source.includes(k));
      expect(stale, `${code} has texts the site no longer shows`).toEqual([]);
      for (const s of source) {
        expect(slots(dict[s]), `${code}: values in "${s}"`).toEqual(slots(s));
        expect(tags(dict[s]), `${code}: markup in "${s}"`).toEqual(tags(s));
        // A list keeps one line per item, and an article its headings, bullets and paragraphs.
        const a = s.split("\n"), b = dict[s].split("\n");
        expect(b.length, `${code}: lines in "${s.slice(0, 50)}"`).toBe(a.length);
        a.forEach((line, i) => {
          for (const mark of ["## ", "- ", "• "]) expect(b[i].startsWith(mark), `${code}: "${mark}" on line ${i + 1} of "${s.slice(0, 50)}"`).toBe(line.startsWith(mark));
          expect(b[i].trim() === "", `${code}: blank line ${i + 1} of "${s.slice(0, 50)}"`).toBe(line.trim() === "");
        });
      }
    });
  }
});

describe("tx", () => {
  const dict = { "Send": "Envoyer", "~{0} min": "~{0} min.", "Code {0}: {1} off": "Code {0} : {1} de remise" };
  it("reads Arabic as written, a translated language through its dictionary, and falls back to English", () => {
    expect(makeL("ar", dict)("Send", "إرسال")).toBe("إرسال");
    expect(makeL("fr", dict)("Send", "إرسال")).toBe("Envoyer");
    expect(makeL("fr", dict)("Cancel", "إلغاء")).toBe("Cancel");
    expect(makeL("en", dict)("Send", "إرسال")).toBe("Send");
  });
  it("translates a component's sentences with values as templates", () => {
    const T = { en: { about: (m: number) => `~${m} min`, code: (c: string, d: string) => `Code ${c}: ${d} off`, send: "Send" }, ar: { about: (m: number) => `~${m} دقيقة`, code: (c: string, d: string) => `الكود ${c}: خصم ${d}`, send: "إرسال" } };
    const fr = localize(T, "fr", dict);
    expect(fr.send).toBe("Envoyer");
    expect(fr.about(20)).toBe("~20 min.");
    expect(fr.code("RIDE", "10%")).toBe("Code RIDE : 10% de remise");
    expect(localize(T, "ar", dict).about(5)).toBe("~5 دقيقة");
    expect(fill("{0} of {1}", 2, 5)).toBe("2 of 5");
  });
});
