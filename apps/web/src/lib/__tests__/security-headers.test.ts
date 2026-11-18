import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import config from "../../../next.config";
import { MOYASAR_FORM_CSS, MOYASAR_FORM_JS } from "../pay/config";

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
      for (const s of src.filter((x) => x.includes("jsdelivr"))) expect([`${base}.js`, `${base}.css`, MOYASAR_FORM_JS, MOYASAR_FORM_CSS], `${name} ${s}`).toContain(s);
    }
  });
  it("allows Moyasar's payment form at the version the payment page loads, and its API (2026-11-10)", async () => {
    const c = await csp();
    expect(c["script-src"]).toContain(MOYASAR_FORM_JS);
    expect(c["style-src"]).toContain(MOYASAR_FORM_CSS);
    expect(c["connect-src"]).toContain("https://api.moyasar.com");
    expect(c["frame-src"]).not.toContain("https://api.moyasar.com"); // 3-D Secure is a full-page visit
  });
  it("still lets Next's own inline scripts run (pages kept at the edge cannot carry a nonce)", async () => {
    expect((await csp())["script-src"]).toContain("'unsafe-inline'");
  });
});

describe("the site's Permissions-Policy", () => {
  async function policy(): Promise<string> {
    const rules = (await config.headers?.()) ?? [];
    return rules.flatMap((r) => r.headers).find((h) => h.key === "Permissions-Policy")?.value ?? "";
  }
  it("lets the site itself ask for a location: the ticket's Need help? adds it to the WhatsApp message (bug hunt 2026-11-18)", async () => {
    const p = await policy();
    expect(p).toContain("geolocation=(self)");
    expect(p).not.toContain("geolocation=()");
  });
  // staging: payments stay with the site's own pages (payment=(self): Apple Pay on its payment page), never off
  it("keeps the camera and the microphone off, and payments to the site itself", async () => {
    const p = await policy();
    for (const f of ["camera=()", "microphone=()", "payment=(self)"]) expect(p).toContain(f);
    expect(p).not.toContain("payment=()");
  });
});
