// Builds dist/, the files the Worker serves (wrangler.jsonc "assets"):
//   index.html, robots.txt, favicon.png   copied from static/
//   site/                                 the website's logos (copied from apps/web/public/site
//                                         and apps/web/src/app/icon.png; never fetched from it)
//   app.css                               @mm/design-tokens' tokens.css + static/app.css
//   app.js                                src/client/main.ts bundled by esbuild (ES2022, minified)
//   fonts/                                Space Grotesk + IBM Plex Sans Arabic, the website's two faces (self-hosted:
//                                         the page's CSP allows nothing from elsewhere)
import { build } from "esbuild";
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const dist = join(root, "dist");
const require = createRequire(import.meta.url);

rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, "fonts"), { recursive: true });
mkdirSync(join(dist, "site"), { recursive: true });

for (const f of ["index.html", "robots.txt", "favicon.png"]) copyFileSync(join(root, "static", f), join(dist, f));
for (const f of ["logo-mark-dark.png", "logo-dark.png", "brand-wordmark.png"]) copyFileSync(join(root, "static", "site", f), join(dist, "site", f));

const tokens = readFileSync(require.resolve("@mm/design-tokens/tokens.css"), "utf8");
writeFileSync(join(dist, "app.css"), `${tokens}\n${readFileSync(join(root, "static", "app.css"), "utf8")}`);

const fonts = [
  ["@fontsource/space-grotesk", "space-grotesk-latin-400-normal.woff2", "space-grotesk-latin-400.woff2"],
  ["@fontsource/space-grotesk", "space-grotesk-latin-500-normal.woff2", "space-grotesk-latin-500.woff2"],
  ["@fontsource/space-grotesk", "space-grotesk-latin-700-normal.woff2", "space-grotesk-latin-700.woff2"],
  ["@fontsource/ibm-plex-sans-arabic", "ibm-plex-sans-arabic-arabic-400-normal.woff2", "ibm-plex-sans-arabic-arabic-400.woff2"],
  ["@fontsource/ibm-plex-sans-arabic", "ibm-plex-sans-arabic-arabic-500-normal.woff2", "ibm-plex-sans-arabic-arabic-500.woff2"],
  ["@fontsource/ibm-plex-sans-arabic", "ibm-plex-sans-arabic-arabic-600-normal.woff2", "ibm-plex-sans-arabic-arabic-600.woff2"],
  ["@fontsource/ibm-plex-sans-arabic", "ibm-plex-sans-arabic-arabic-700-normal.woff2", "ibm-plex-sans-arabic-arabic-700.woff2"],
];
for (const [pkg, file, out] of fonts) {
  const dir = dirname(require.resolve(`${pkg}/package.json`));
  copyFileSync(join(dir, "files", file), join(dist, "fonts", out));
}

await build({
  entryPoints: [join(root, "src/client/main.ts")],
  outfile: join(dist, "app.js"),
  bundle: true,
  format: "esm",
  target: "es2022",
  minify: true,
  sourcemap: false,
  legalComments: "none",
  logLevel: "warning",
});

console.log("vendors: dist/ built");
