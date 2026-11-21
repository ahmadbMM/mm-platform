import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { HEADER, NAV_LINKS } from "../links";
import { hiddenPages } from "../site";

// The Marketplace's four website parts put together (browse, selling, contact, shops and rules): the seams between
// them, read from the files. Each part's own behaviour is in its own test file (market-w1 ... market-w4); this file
// holds what no single part owns: the fence round the store and payments, the shared look in market.css, the rules
// links, and what the launch switch ('marketplace.on') opens and closes.
const SRC = fileURLToPath(new URL("../../", import.meta.url));
const read = (path: string) => readFileSync(join(SRC, path), "utf8");
const walk = (dir: string): string[] =>
  readdirSync(join(SRC, dir)).flatMap((name) => {
    const path = `${dir}/${name}`;
    return statSync(join(SRC, path)).isDirectory() ? walk(path) : [path];
  });
const ROOTS = ["components/market", "lib/market", "app/[locale]/marketplace", "app/api/market", "app/mkt"];
const FILES = ROOTS.flatMap(walk).filter((p) => /\.(?:tsx?|css)$/.test(p));

describe("the fence", () => {
  it("takes nothing from the store or payments", () => {
    expect(FILES.length).toBeGreaterThan(100);
    for (const p of FILES) {
      for (const m of read(p).matchAll(/(?:from\s+|import\s*\(\s*|import\s+)["']([^"']+)["']/g)) {
        expect(m[1], `${p} imports ${m[1]}`).not.toMatch(/(?:^|\/)(?:components\/store|lib\/store|lib\/pay)(?:[/.-]|$)/);
      }
    }
  });
  it("keeps the rules' text out of every screen drawn in the browser", () => {
    for (const p of FILES.filter((f) => f.endsWith(".tsx") && /^\s*"use client"/.test(read(f)))) {
      expect(read(p), p).not.toMatch(/import\s+\{[^}]*\}\s+from\s+["']@\/lib\/market\/w4-rules["']/);
    }
    // the link every part draws reads only the anchor's type from that file
    expect(read("components/market/w4/RulesLink.tsx")).toMatch(/import type \{ W4Anchor \} from "@\/lib\/market\/w4-rules"/);
  });
});

describe("the rules links", () => {
  it("are on a listing, in a conversation, in the commission pop-up and beside the two forms' ticks", () => {
    expect(read("components/market/w1/ListingView.tsx")).toContain('<RulesLink t={t} anchor="safety" />');
    expect(read("components/market/w3/ThreadView.tsx")).toContain('<RulesLink t={s} anchor="safety" />');
    expect(read("components/market/w2/MyListings.tsx")).toContain('<RulesLink t={t} anchor="commission"');
    expect(read("components/market/w2/SellForm.tsx")).toContain("<RulesLink t={t} newTab />");
    const shop = read("components/market/w4/ShopForm.tsx");
    expect(shop).toContain("<RulesLink t={t} newTab />");
    expect(shop).toContain('<RulesLink t={t} anchor="shops" label={w.agreement} newTab />');
  });
});

describe("one look", () => {
  const market = read("components/market/market.css");
  const parts = ["w1", "w2", "w3", "w4"].map((w) => [w, read(`components/market/${w}.css`)] as const);
  it("a field's box weighs one class and one element, so the picker's arrow and the text area's height show", () => {
    expect(market).toMatch(/\.mk-field :is\(input:where\(:not\(\[type="checkbox"\], \[type="radio"\]\)\), select, textarea\) \{/);
    const base = market.indexOf(".mk-field :is(input:where(");
    expect(market.indexOf(".mk-field select {")).toBeGreaterThan(base);
    expect(market.indexOf(".mk-field textarea {")).toBeGreaterThan(base);
    expect(market).toMatch(/\.mk-field select \{[^}]*padding-inline-end:\s*40px;[^}]*var\(--mk-chev\) no-repeat right 16px center/);
    expect(market).toMatch(/\[dir="rtl"\] \.mk-field select \{\s*background-position:\s*left 16px center/);
  });
  it("draws one focus ring on a field, and a refusal in a pop-up in red", () => {
    // site.css's ring weighs 0,4,0: this weighs 0,4,1
    expect(market).toContain('.mm-site .mk-page :is(input, select, textarea):not(.mk-signin *):focus-visible { outline: none; }');
    expect(market.indexOf(".mk-pop .mk-err {")).toBeGreaterThan(market.indexOf(".mk-pop p {"));
  });
  it("keeps each shared piece in market.css alone", () => {
    for (const cls of ["mk-head", "mk-n", "mk-opts", "mk-opt", "mk-set", "mk-radio", "mk-skel"]) expect(market, cls).toMatch(new RegExp(`\\.${cls} [{>]`));
    // what the parts once drew each for itself
    for (const [w, css] of parts) {
      // (W2's own options with their meaning written inside, and W4's numbered sections, are their own things)
      expect(css, w).not.toMatch(/\.mk-w[1-4]-(?:head|skel|set|pick|pick-row|badge|mine-head|err)\s*[{,]|\.mk-w[12]-n\s*[{,]|\.mk-w[13]-opts?\s*[{,]|\.mk-w2-fs > legend/);
      expect(css, w).not.toMatch(/@keyframes mk-w[1-4]-wait/);
      expect(css, w).not.toMatch(/\[aria-busy="true"\] \{ opacity/);
      // Arabic, Urdu, Hindi, Nepali and Bengali headings take site.css's spacing (it is !important there)
      expect(css, w).not.toMatch(/html:is\(\[lang="ar"\]/);
    }
    expect(market).toMatch(/\.mk-narrow h1 \{ font-size: clamp\(28px, 6\.4vw, 40px\)/);
  });
});

describe("the launch switch", () => {
  const on = { "marketplace.on": true };
  it("leaves the header's link, the search's page, the footer's links and My Account's rows out while off", () => {
    expect(hiddenPages(null)).toContain("marketplace");
    expect(hiddenPages({ "marketplace.on": false })).toContain("marketplace");
    expect(hiddenPages(on)).not.toContain("marketplace");
    expect(HEADER).toContain("marketplace");
    expect(NAV_LINKS.find((l) => l.key === "marketplace")?.href).toBe("/marketplace");
    // the header search offers the site's pages that are not hidden, the Marketplace among them
    expect(read("components/site/SiteSearch.tsx")).toContain("[...NAV_LINKS, ...EXTRA].filter((p) => !hidden.includes(p.key))");
    // the footer adds the rules only while on; a staff link to a hidden page is left out by its own rule
    expect(read("components/site/SiteFooter.tsx")).toContain('hidden.includes("marketplace") ? shown : w4FooterWithRules(');
    const account = read("app/[locale]/account/[[...part]]/page.tsx");
    expect(account).toContain('!hidden.includes("marketplace") ? mkShopMine(');
    expect(account).toContain('...(!hidden.includes("marketplace") ? [');
  });
  it("asks the Marketplace for its sitemap addresses and its search entries only while on", () => {
    expect(read("app/sitemap.ts")).toContain("if (marketplaceOn(content)) paths.push(...(await marketPaths(content)));");
    expect(read("app/[locale]/search-index.ts")).toContain('if (on("marketplace")) items.push(...(await marketSearch(L)));');
  });
  it("marks every Marketplace page noindex while off, and every page that needs an account always", () => {
    const pages = FILES.filter((p) => p.startsWith("app/[locale]/marketplace/") || p === "app/[locale]/marketplace/page.tsx").filter((p) => p.endsWith("page.tsx"));
    expect(pages.length).toBe(11);
    for (const p of pages) {
      const src = read(p);
      if (/<MkGate\b/.test(src)) expect(src, p).toMatch(/noindex:\s*true/);
      else expect(src, p).toMatch(/noindex:[^}]*?(?:!at\.on|marketplaceOn\(content\))/);
      // and every title names the company as the Marketplace writes it
      for (const m of src.matchAll(/· (Micro[Mm]obility)`/g)) expect(m[1], p).toBe("MicroMobility");
    }
  });
});
