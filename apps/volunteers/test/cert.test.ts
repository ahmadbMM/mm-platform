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
