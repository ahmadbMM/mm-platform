import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import config from "../../../next.config";

// The site's own headers (next.config.ts headers()). Of jsDelivr, the Content-Security-Policy allows
// only the MapLibre files the live ride map loads (components/live/LiveMap.tsx), never the whole host,
// which serves any npm package or GitHub file.
async function csp(): Promise<Record<string, string[]>> {
  const rules = (await config.headers?.()) ?? [];
  const value = rules.flatMap((r) => r.headers).find((h) => h.key === "Content-Security-Policy")?.value ?? "";
  return Object.fromEntries(value.split(";").map((d) => d.trim().split(/\s+/)).map(([name, ...src]) => [name, src]));
}

describe("the site's Content-Security-Policy", () => {
  it("allows MapLibre's own two files at the version the live map loads, and nothing else from jsDelivr", async () => {
    const live = readFileSync(resolve(__dirname, "../../components/live/LiveMap.tsx"), "utf8");
    const base = live.match(/const MAPLIBRE = "([^"]+)"/)?.[1];
    expect(base).toMatch(/^https:\/\/cdn\.jsdelivr\.net\/npm\/maplibre-gl@[\d.]+\/dist\/maplibre-gl$/);
    const c = await csp();
    expect(c["script-src"]).toContain(`${base}.js`);
    expect(c["style-src"]).toContain(`${base}.css`);
    for (const [name, src] of Object.entries(c)) {
      for (const s of src.filter((x) => x.includes("jsdelivr"))) expect([`${base}.js`, `${base}.css`], `${name} ${s}`).toContain(s);
    }
  });
  it("still lets Next's own inline scripts run (pages kept at the edge cannot carry a nonce)", async () => {
    expect((await csp())["script-src"]).toContain("'unsafe-inline'");
  });
});
