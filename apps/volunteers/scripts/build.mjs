// Builds dist/, the files the Worker serves (wrangler.jsonc "assets"):
//   index.html, 404.html, robots.txt,     copied from static/ (404.html: every address the portal
//   favicon.png                           does not have, wrangler.jsonc not_found_handling)
//   manifest.webmanifest, icon-192.png,   the web app's manifest and icons (Add to Home Screen, which an iPhone needs
//   icon-512.png                          before it takes a push)
//   sw.js                                 the service worker: a push and its tap, and the app's shell for an offline
//                                         screen; its CACHE and SHELL are written here from what was built
//   site/                                 the website's mark (never fetched from it)
//   lang/                                 every language but English, fetched when chosen
//   vendor/                               jsQR, for a phone with no QR reader of its own
//   certificate.html, certificate.css,    the volunteer certificate, synced from the booking site
//                                         (scripts/sync-cert.mjs); the page fills the markup and prints it
//   certificate-fonts.css                 the certificate's two faces, from CERT_FACES below
//   app-<hash>.css                        @mm/design-tokens' tokens.css + static/app.css, named by its content
//   app-<hash>.js, chunks/                src/client/main.ts bundled by esbuild (ES2022, minified), named by its content;
//                                         the certificate's QR encoder in a chunk of its own. index.html names them, and
//                                         the Worker keeps them a year (src/worker/headers.ts cacheFor)
//   fonts/                                self-hosted (the page's CSP allows nothing from elsewhere): Rubik, the rider
//                                         app's face (static/fonts, from the booking site's fonts/), and IBM Plex Sans
//                                         Arabic for Urdu; Noto Sans Devanagari (Hindi, Nepali) and Noto Sans Bengali,
//                                         from the booking site's fonts/ too, each fetched only for its script;
//                                         Space Grotesk 300-700 for the certificate alone
import { build } from "esbuild";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const dist = join(root, "dist");
const require = createRequire(import.meta.url);

rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, "fonts"), { recursive: true });
mkdirSync(join(dist, "site"), { recursive: true });

// certificate.html + certificate.css: the volunteer certificate, synced from the booking site by
// scripts/sync-cert.mjs and served as they are. The page fetches and fills certificate.html.
for (const f of ["404.html", "robots.txt", "favicon.png", "certificate.html", "certificate.css", "manifest.webmanifest", "icon-192.png", "icon-512.png"]) {
  copyFileSync(join(root, "static", f), join(dist, f));
}
// Rubik, variable 300-900 (SIL OFL 1.1), as the booking site serves it: Latin, Latin Extended and Arabic.
for (const f of readdirSync(join(root, "static", "fonts"))) if (f.endsWith(".woff2")) copyFileSync(join(root, "static", "fonts", f), join(dist, "fonts", f));
copyFileSync(join(root, "static", "site", "logo-mark-dark.png"), join(dist, "site", "logo-mark-dark.png"));
// jsQR: read only when a phone without the browser's own QR reader first scans a ticket (src/client/scan.ts).
mkdirSync(join(dist, "vendor"), { recursive: true });
copyFileSync(join(root, "static", "vendor", "jsqr-1.4.0.min.js"), join(dist, "vendor", "jsqr-1.4.0.min.js"));
// The words: English is in the bundle, every other language is fetched when it is chosen.
mkdirSync(join(dist, "lang"), { recursive: true });
for (const f of readdirSync(join(root, "src", "lang"))) if (f !== "en.json") copyFileSync(join(root, "src", "lang", f), join(dist, "lang", f));

const tokens = readFileSync(require.resolve("@mm/design-tokens/tokens.css"), "utf8");
const appCss = readFileSync(join(root, "static", "app.css"), "utf8");
const css = `${tokens}\n${appCss}`;
const hash = (s) => createHash("sha256").update(s).digest("hex").slice(0, 10);
const cssName = `app-${hash(css)}.css`;
writeFileSync(join(dist, cssName), css);

// certificate-fonts.css: the certificate's two families and nothing else, for its own window. It may NOT be handed
// app.css: that sheet has a .page of its own (the portal's own pages), which would fight the certificate's 1123x794 one,
// and the portal's own face is Rubik, which the certificate does not use (certificate/SPEC.md: Space Grotesk and IBM
// Plex Sans Arabic). One list, here, beside the files it names.
const CERT_FACES = [
  ["Space Grotesk", 300, "space-grotesk-latin-300.woff2"],
  ["Space Grotesk", 400, "space-grotesk-latin-400.woff2"],
  ["Space Grotesk", 500, "space-grotesk-latin-500.woff2"],
  ["Space Grotesk", 700, "space-grotesk-latin-700.woff2"],
  ["IBM Plex Sans Arabic", 400, "ibm-plex-sans-arabic-arabic-400.woff2"],
  ["IBM Plex Sans Arabic", 500, "ibm-plex-sans-arabic-arabic-500.woff2"],
  ["IBM Plex Sans Arabic", 600, "ibm-plex-sans-arabic-arabic-600.woff2"],
  ["IBM Plex Sans Arabic", 700, "ibm-plex-sans-arabic-arabic-700.woff2"],
];
writeFileSync(join(dist, "certificate-fonts.css"),
  `/* Generated by scripts/build.mjs (CERT_FACES): what the volunteer certificate's window needs, and nothing that\n   could style it (certificate/README.md). */\n${CERT_FACES.map(([family, weight, file]) =>
    `@font-face { font-family: "${family}"; font-weight: ${weight}; font-display: swap; src: url("/fonts/${file}") format("woff2"); }`).join("\n")}\n`);

const fonts = [
  // Space Grotesk is the certificate's alone (300 is its lead and recognition lines, certificate/SPEC.md); IBM Plex Sans
  // Arabic is the certificate's Arabic and the portal's Urdu.
  ["@fontsource/space-grotesk", "space-grotesk-latin-300-normal.woff2", "space-grotesk-latin-300.woff2"],
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

const built = await build({
  entryPoints: { app: join(root, "src/client/main.ts") },
  outdir: dist,
  entryNames: "[name]-[hash]",
  chunkNames: "chunks/[name]-[hash]",
  splitting: true, // the certificate's QR encoder (qrcode-generator) loads only when a certificate is made
  metafile: true,
  bundle: true,
  format: "esm",
  target: "es2022",
  minify: true,
  sourcemap: false,
  legalComments: "none",
  logLevel: "warning",
});
// metafile paths are relative to the working directory
const outs = Object.keys(built.metafile.outputs).map((f) => relative(dist, resolve(f)).split("\\").join("/")).filter((f) => f.endsWith(".js"));
const jsName = outs.find((f) => /^app-[A-Za-z0-9]+\.js$/.test(f));
if (!jsName) throw new Error("volunteers: no app-<hash>.js came out of esbuild");

// The page names its script and styles by their content.
const html = readFileSync(join(root, "static", "index.html"), "utf8");
if (!html.includes('href="/app.css"') || !html.includes('src="/app.js"')) throw new Error("volunteers: index.html no longer names /app.css and /app.js");
writeFileSync(join(dist, "index.html"), html.replace('href="/app.css"', `href="/${cssName}"`).replace('src="/app.js"', `src="/${jsName}"`));

// The service worker's cache is named by what it keeps, so each release starts its own and the last one is dropped.
const shell = ["/", ...outs.map((f) => `/${f}`), `/${cssName}`, "/site/logo-mark-dark.png", "/manifest.webmanifest", "/icon-192.png", "/fonts/Rubik-var-latin.woff2"];
const sw = readFileSync(join(root, "static", "sw.js"), "utf8");
if (!sw.includes('const CACHE = "mmv-dev";') || !sw.includes('const SHELL = ["/"];')) throw new Error("volunteers: sw.js no longer has its CACHE and SHELL lines");
writeFileSync(join(dist, "sw.js"), sw
  .replace('const CACHE = "mmv-dev";', `const CACHE = "mmv-${hash(jsName + cssName + sw + html)}";`)
  .replace('const SHELL = ["/"];', `const SHELL = ${JSON.stringify(shell)};`));

console.log(`volunteers: dist/ built (${jsName}, ${cssName})`);
