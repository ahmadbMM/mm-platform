import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { Link } from "@/i18n/navigation";

// Links never prefetch (src/i18n/navigation.ts): each prefetch is a page the Worker renders, and a
// desktop visit to Home sent thirteen, more CPU than the Workers Free plan allows (DEPLOY.md,
// "Limits"). Every link goes through the site's Link, which says so unless a link asks otherwise.
const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
function files(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "__tests__" || e.name === "node_modules") continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...files(p));
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

describe("links", () => {
  it("do not prefetch unless they ask to", () => {
    expect(Link({ href: "/club" }).props.prefetch).toBe(false);
    expect(Link({ href: "/club", prefetch: true }).props.prefetch).toBe(true);
    expect(Link({ href: "/club" }).props.href).toBe("/club");
  });
  it("all go through the site's Link, never next/link's own", () => {
    const direct = files(SRC).filter((f) => /from\s+["']next\/link["']/.test(readFileSync(f, "utf8")));
    expect(direct.map((f) => f.slice(SRC.length + 1))).toEqual([]);
  });
});
