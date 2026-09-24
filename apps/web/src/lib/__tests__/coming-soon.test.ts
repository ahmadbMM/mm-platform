import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { comingSoonTarget } from "../coming-soon-route";

describe("while the site is Coming Soon", () => {
  it("keeps the Coming Soon page itself, in both languages", () => {
    for (const p of ["/", "/en", "/ar", "/en/", "/ar/"]) expect(comingSoonTarget(p), p).toBeNull();
  });
  it("sends every other page back to it, keeping the language", () => {
    expect(comingSoonTarget("/en/login")).toBe("/en");
    expect(comingSoonTarget("/ar/login")).toBe("/ar");
    expect(comingSoonTarget("/ar/experiences/jcc")).toBe("/ar");
  });
  it("sends an address with no language to /", () => {
    for (const p of ["/about", "/login", "/fr", "/english"]) expect(comingSoonTarget(p), p).toBe("/");
  });
});

describe("the Coming Soon text", () => {
  const load = (l: string) => JSON.parse(readFileSync(resolve(__dirname, `../../../messages/${l}.json`), "utf8"));
  it("has every line in English and Arabic", () => {
    const en = load("en").comingSoon, ar = load("ar").comingSoon;
    expect(Object.keys(ar).sort()).toEqual(Object.keys(en).sort());
    for (const k of Object.keys(en)) { expect(en[k], k).toBeTruthy(); expect(ar[k], k).toBeTruthy(); }
  });
});
