import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { hoursN, setLang } from "../src/client/i18n";

// The hours with their word (the owner, 2026-11-09: "6 · 5 Nov 2026 · Micromobility Blood Donation" read as anything
// but hours), by the language's plural, as the booking app's _tn('accVolHrs') says them.
const lang = (code: string) => readFileSync(join(__dirname, "..", "src", "lang", `${code}.json`), "utf8");
afterEach(async () => { await setLang("en"); vi.unstubAllGlobals(); });

describe("hours with their word", () => {
  it("in English: one hour, any other number of hours", async () => {
    vi.stubGlobal("document", { documentElement: {} });
    await setLang("en");
    expect([1, 6, 2.5, 2.555, 0].map(hoursN)).toEqual(["1 hour", "6 hours", "2.5 hours", "2.56 hours", "0 hours"]);
  });
  it("in Arabic: ساعة واحدة, ساعتان, 3-10 ساعات, the rest ساعة", async () => {
    vi.stubGlobal("document", { documentElement: {} });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(lang("ar"), { status: 200 })));
    await setLang("ar");
    expect([1, 2, 3, 10, 11, 100, 2.5].map(hoursN)).toEqual(["ساعة واحدة", "ساعتان", "3 ساعات", "10 ساعات", "11 ساعة", "100 ساعة", "2.5 ساعة"]);
  });
});
