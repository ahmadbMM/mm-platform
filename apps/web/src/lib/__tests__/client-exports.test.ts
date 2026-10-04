import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// A function exported from a "use client" module is, to a server component, only a stand-in that
// throws when called ("Attempted to call cdLine() from the server"): My Account broke that way on
// a ride's day (the ticket asked Countdown.tsx for its line). A server file may render a client
// module's components, but take nothing else from it - shared logic belongs in a plain module.
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

const isClient = (src: string) => /^\s*["']use client["']/.test(src);
const target = (from: string, spec: string) => {
  const base = spec.startsWith("@/") ? join(SRC, spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(from), spec) : null;
  if (!base) return null;
  for (const ext of [".tsx", ".ts", "/index.tsx", "/index.ts", ""]) {
    try { readFileSync(base + ext); return base + ext; } catch { /* next */ }
  }
  return null;
};

describe("client modules", () => {
  it("are never asked for anything but their components by a server file", () => {
    const all = files(SRC);
    const client = new Set(all.filter((f) => isClient(readFileSync(f, "utf8"))));
    const bad: string[] = [];
    for (const f of all) {
      const src = readFileSync(f, "utf8");
      if (isClient(src)) continue;
      for (const m of src.matchAll(/^import\s+(?!type\b)([^;]*?)\s+from\s+["']([^"']+)["']/gm)) {
        const to = target(f, m[2]);
        if (!to || !client.has(to)) continue;
        const named = /\{([^}]*)\}/.exec(m[1]);
        // A component (TxProvider) is fine to render; a type is erased; anything else is a stand-in.
        const values = (named ? named[1].split(",") : []).map((x) => x.trim()).filter((x) => x && !x.startsWith("type ") && !/^[A-Z][a-z]/.test(x));
        if (values.length) bad.push(`${f.slice(SRC.length + 1)}: ${values.join(", ")} from ${m[2]}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
