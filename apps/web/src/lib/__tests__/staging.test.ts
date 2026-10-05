import { afterEach, describe, expect, it, vi } from "vitest";
import { layoutTitle, prefixTitles, stagingTitle } from "../staging";

// Staging's tabs start with "[Staging]" (lib/staging.ts): the pages carry it themselves, so it stays
// after their script runs, and the Worker adds it only where a page has not - never twice.
afterEach(() => vi.unstubAllEnvs());

// A <title>'s text as Cloudflare's HTMLRewriter hands it over: in pieces, the last one marked.
function rewrite(pieces: string[]): string {
  const h = prefixTitles();
  let out = "";
  pieces.forEach((text, i) => {
    let kept: string | null = text;
    h.text({ text, lastInTextNode: i === pieces.length - 1, remove: () => { kept = null; }, replace: (c) => { kept = c; } });
    if (kept !== null) out += kept;
  });
  return out;
}

describe("the staging title", () => {
  it("is the page's own title everywhere but staging", () => {
    expect(stagingTitle("Club · Micromobility")).toBe("Club · Micromobility");
    expect(layoutTitle()).toEqual({});
  });
  it("starts with [Staging] once on staging, through the layout's template and the titles pages write", () => {
    vi.stubEnv("MM_ENV", "staging");
    expect(stagingTitle("Club · Micromobility")).toBe("[Staging] Club · Micromobility");
    expect(stagingTitle("[Staging] Club · Micromobility")).toBe("[Staging] Club · Micromobility");
    // an empty default draws no <title> of the layout's own, so a page's hand-written one stays the only one
    expect(layoutTitle()).toEqual({ title: { template: "[Staging] %s", default: "" } });
  });
  it("is added by the Worker to a title that has none, however its text is split, and never twice", () => {
    expect(rewrite(["Community Membership Application | Micromobility"])).toBe("[Staging] Community Membership Application | Micromobility");
    expect(rewrite(["Rider ", "registration &amp; ", "waiver", ""])).toBe("[Staging] Rider registration &amp; waiver");
    expect(rewrite(["[Staging] Club · Micromobility"])).toBe("[Staging] Club · Micromobility");
    expect(rewrite(["[Stag", "ing] Club", ""])).toBe("[Staging] Club");
    expect(rewrite([""])).toBe("");
  });
});
