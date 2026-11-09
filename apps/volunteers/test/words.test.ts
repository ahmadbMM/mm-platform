import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Every language has every word, its placeholders intact, and Latin digits (the booking app's rule).
const dir = join(__dirname, "..", "src", "lang");
const read = (f: string) => JSON.parse(readFileSync(join(dir, f), "utf8")) as Record<string, string>;
const en = read("en.json");
const others = readdirSync(dir).filter((f) => f !== "en.json");
const holes = (s: string) => (s.match(/\{\d+\}/g) ?? []).sort();

describe("the words", () => {
  it("are in the booking app's ten languages", () => {
    expect(others.map((f) => f.replace(".json", "")).sort()).toEqual(["ar", "bn", "es", "fr", "hi", "ne", "pt", "tl", "ur"]);
  });
  for (const f of others) {
    it(`${f} has every key, its placeholders and no other digits`, () => {
      const L = read(f);
      expect(Object.keys(L).sort()).toEqual(Object.keys(en).sort());
      for (const k of Object.keys(en)) {
        expect(L[k], k).toBeTruthy();
        // a plural's one or two may say its number in words (Arabic ساعة واحدة, ساعتان)
        if (!(/_(one|two)$/.test(k) && holes(L[k]).length === 0)) expect(holes(L[k]), k).toEqual(holes(en[k]));
        expect(/[٠-٩۰-۹०-९০-৯]/.test(L[k]), `${k} digits`).toBe(false);
      }
    });
  }

  it("say the hours with their word in every plural the languages have", () => {
    for (const f of ["en.json", ...others]) {
      const L = read(f);
      for (const c of ["zero", "one", "two", "few", "many", "other"]) expect(L[`hours_${c}`], `${f} hours_${c}`).toBeTruthy();
    }
  });
});
