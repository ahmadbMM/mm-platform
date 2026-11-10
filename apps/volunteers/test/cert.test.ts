import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { stripScripts } from "../src/client/cert";

// The certificate's window runs no script, whatever the host adds to the template (src/client/cert.ts).
const template = readFileSync(join(__dirname, "..", "static", "certificate.html"), "utf8");
// What Cloudflare Pages put into the booking site's copy in production (2026-11-08), but the token.
const beacon = `<!-- Cloudflare Pages Analytics --><script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "test"}'></script><!-- Cloudflare Pages Analytics -->`;

describe("the certificate template", () => {
  it("has no script of its own", () => {
    expect(template).not.toMatch(/<script/i);
    expect(stripScripts(template)).toBe(template);
  });

  it("loses Cloudflare's beacon and nothing else", () => {
    const served = template.replace("</body>", `${beacon}</body>`);
    expect(served).toContain("cloudflareinsights");
    const kept = stripScripts(served);
    expect(kept).not.toMatch(/<script/i);
    expect(kept).not.toContain("cloudflareinsights");
    // Only the tag goes; the comments around it are harmless, and every placeholder is still there.
    expect(kept.replace(/<!-- Cloudflare Pages Analytics -->/g, "")).toBe(template);
  });

  it("takes out any script, in any case, with or without a body", () => {
    expect(stripScripts(`a<SCRIPT>x()</SCRIPT >b<script src="y"></script>c`)).toBe("abc");
  });
});

describe("the certificate's new fields (rentals 20261111140000; certificate/SPEC.md, amendment 7)", () => {
  it("the synced template has all seven, each in a section of its own", () => {
    for (const k of ["role", "skills", "skills_ar", "partner", "partner_ar", "issued", "qr"]) {
      expect(template, k).toContain(`{{#${k}}}`);
      expect(template, k).toContain(`{{/${k}}}`);
    }
  });
  it("are filled from what the certificate was issued with, and an empty one leaves no line", async () => {
    const { certView, fillCert } = await import("../src/client/certs");
    const v = certView({ ok: true, kind: "session", serial: "MMV-2026-00002", code: "ZZZZ11112222", name: "Sara", initiative: "MicroMobility Blood Donation",
      event_date: "2026-11-05", hours: 6, issued_at: "2026-11-05T22:30:00+00:00", role: "Guide", skills: "Event check-in", skills_ar: "تسجيل الحضور",
      partner: "Saudi Red Crescent", partner_ar: null }, "data:image/png;base64,AAAA");
    expect(v).toMatchObject({ role: "Guide", skills: "Event check-in", skills_ar: "تسجيل الحضور", partner: "Saudi Red Crescent", partner_ar: "", qr: "data:image/png;base64,AAAA" });
    expect(v.issued).toBe("6 November 2026"); // issued 01:30 in Riyadh on the 6th
    const tpl = "<p>{{#role}}<b>{{role}}</b>{{/role}}{{#partner_ar}}<i>{{partner_ar}}</i>{{/partner_ar}}{{#qr}}<img src=\"{{qr}}\">{{/qr}}</p>";
    expect(fillCert(tpl, v)).toBe('<p><b>Guide</b><img src="data:image/png;base64,AAAA"></p>');
    const older = certView({ ok: true, kind: "period", from: "2026-10-01", to: "2026-10-31", hours: 3 });
    expect([older.role, older.skills, older.partner, older.qr, older.issued]).toEqual(["", "", "", "", ""]);
    // a period's footer date is the day it was issued: the issue date under the QR code would say it twice
    const period = certView({ ok: true, kind: "period", from: "2026-10-01", to: "2026-10-31", hours: 3, issued_at: "2026-11-01T09:00:00Z" });
    expect([period.event_date, period.issued]).toEqual(["1 November 2026", ""]);
  });
});
