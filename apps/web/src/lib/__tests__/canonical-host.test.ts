import { describe, expect, it } from "vitest";
import { apexTarget, movedStatus } from "../canonical-host";

// One address for the site (lib/canonical-host.ts): worker.js asks before anything else, the edge's
// page copies included, and the proxy asks again.
describe("the canonical host", () => {
  it("sends www to micromobility.sa with the path and query, and leaves every other host alone", () => {
    expect(apexTarget("https://www.micromobility.sa/")).toBe("https://micromobility.sa/");
    expect(apexTarget("https://WWW.micromobility.sa/club?lang=ar&utm_source=x")).toBe("https://micromobility.sa/club?lang=ar&utm_source=x");
    expect(apexTarget("http://www.micromobility.sa/petromin")).toBe("https://micromobility.sa/petromin");
    for (const u of ["https://micromobility.sa/club", "https://staging.micromobility.sa/", "https://micromobility-web-preview.example.workers.dev/", "not a url"]) expect(apexTarget(u), u).toBeNull();
  });
  it("is a 301 for GET and HEAD and a 308 for anything else", () => {
    expect(["GET", "HEAD", "POST", "DELETE"].map(movedStatus)).toEqual([301, 301, 308, 308]);
  });
});
