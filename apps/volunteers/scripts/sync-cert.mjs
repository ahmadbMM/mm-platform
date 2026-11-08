// Copies the volunteer certificate out of the booking site, so the portal prints the very design
// staff print and the two never drift. The design lives in one place only: `certificate/` in the
// booking site's repo (its certificate/README.md), which builds the two files taken here.
//
//   node scripts/sync-cert.mjs [path to the micromobilityrentals checkout]
//   default: $RENTALS_DIR or ~/micromobilityrentals
//
// Writes static/certificate.html and static/certificate.css, byte for byte, both committed so a
// build never needs the other repo. Run it whenever the design changes there, then `npm run build`
// and deploy - until you do, the portal keeps printing the old one.
import { copyFileSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const rentals = resolve(process.argv[2] || process.env.RENTALS_DIR || join(homedir(), "micromobilityrentals"));

const files = [
  ["assets/certificate.html", "certificate.html"],
  ["certificate.css", "certificate.css"],
];
for (const [from, to] of files) {
  const src = join(rentals, from);
  try { statSync(src); } catch {
    throw new Error(`sync-cert: ${src} is not there. Point the script at a micromobilityrentals checkout that has run \`npm run build:cert\`.`);
  }
  const text = readFileSync(src, "utf8");
  if (!text.includes("scripts/build-certificate.mjs")) {
    throw new Error(`sync-cert: ${src} does not look like the built certificate (no build-certificate.mjs banner).`);
  }
  copyFileSync(src, join(root, "static", to));
  console.log(`volunteers: ${to} <- ${src} (${(text.length / 1024).toFixed(1)} KB)`);
}
