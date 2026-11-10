// A registration form as a page of the website (the user, 2026-11-09: "rebuild the community and Petromin forms as
// proper website pages", all four forms). The website draws the page - its header, footer and languages - and puts
// the form inside it: the form's own markup, its stylesheet kept to the form's box, and its scripts run once the page
// is on screen (apps/web/src/components/forms/SiteForm.tsx). Each form's build calls emitSite() beside the
// self-contained page it already writes (src/page.html), which stays as the fallback at ?classic=1.
//
//   apps/web/src/forms/site/<name>.markup.ts   the form's body (no page header, no scripts), its pictures as /forms/<name>/...
//   apps/web/src/forms/site/<name>.run.js      export default function run(site): the form's scripts, run in order
//   apps/web/src/forms/site/<name>.css         the stylesheet, every rule kept inside .mmf-<name>
//   apps/web/public/forms/<name>/              the pictures the markup names
//
// The scripts read window.MM_SITE_FORM = { lang, db: { url, key }, booking }: the page's language (the site's globe picks
// it), the database the website itself talks to (staging's on staging), and the booking app that reads that database
// ("https://<host>/", staging's copy on staging; "" when none is set: the form's own address, the live app).
import { copyFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, basename } from 'node:path';

const WEB = resolve(import.meta.dirname, '../../apps/web');

/** The stylesheet kept to the form's box: `:root`, `html`, `body` and `*` become the box itself, every other selector is
 *  looked for inside it, html[lang]/html[dir] stay where they are (they name the page's language), keyframes take the
 *  form's name so they can never meet the site's. Strings and url(...) are read whole: a brace inside them is not a block. */
export function scopeCss(css, scope) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const frames = {};
  for (const m of css.matchAll(/@(?:-webkit-)?keyframes\s+([A-Za-z0-9_-]+)/g)) frames[m[1]] = `${scope.slice(1)}-${m[1]}`;
  const blockEnd = (s, open) => {
    let depth = 0, q = null;
    for (let i = open; i < s.length; i++) {
      const c = s[i];
      if (q) { if (c === '\\') { i++; continue; } if (c === q) q = null; continue; }
      if (c === '"' || c === "'") { q = c; continue; }
      if (c === '(' && /url$/i.test(s.slice(Math.max(0, i - 3), i))) { const e = s.indexOf(')', i); if (e > 0) { i = e; continue; } }
      if (c === '{') depth++;
      else if (c === '}') { depth--; if (!depth) return i; }
    }
    throw new Error('unbalanced CSS block');
  };
  const one = (sel) => {
    sel = sel.trim();
    if (!sel) return sel;
    if (/^body\.[\w-]+/.test(sel)) return sel; // a class the scripts put on the page's body (modal-open): the page's own
    let pre = '';
    const m = sel.match(/^(html(?:\[[^\]]+\])+)\s*/);
    if (m) { pre = m[1] + ' '; sel = sel.slice(m[0].length); }
    if (/^(:root|html|body)$/.test(sel) || sel === '') return pre + scope;
    if (sel === '*') return `${pre}${scope}, ${pre}${scope} *`;
    if (/^(:root|html|body)[\s>]/.test(sel)) return pre + scope + sel.replace(/^(:root|html|body)/, '');
    if (/^\*(::?[\w-]+)+$/.test(sel)) return `${pre}${scope}${sel.slice(1)}, ${pre}${scope} ${sel}`;
    return `${pre}${scope} ${sel}`;
  };
  const walk = (s) => {
    let out = '', i = 0;
    while (i < s.length) {
      const open = s.indexOf('{', i);
      if (open < 0) { out += s.slice(i).trim() ? '' : ''; break; }
      const head = s.slice(i, open).trim();
      // a statement at-rule (@import, @charset) before the block: kept as written
      const stmts = head.split(';'), sel = stmts.pop().trim();
      for (const st of stmts) if (st.trim()) out += st.trim() + ';\n';
      const end = blockEnd(s, open);
      const body = s.slice(open + 1, end);
      // The website has one look, the light one: a form's dark look (its phone in dark mode) is left out, or the form
      // turns dark between the site's light header and footer (the user, 2026-11-10, a screenshot of /lockers).
      if (/^@media\b[^{]*prefers-color-scheme\s*:\s*dark/.test(sel)) { i = end + 1; continue; }
      if (/^@(media|supports|container|layer)\b/.test(sel)) out += `${sel} {\n${walk(body)}}\n`;
      else if (/^@(-webkit-)?keyframes\b/.test(sel)) out += `${sel.replace(/([A-Za-z0-9_-]+)\s*$/, (n) => frames[n] || n)} {${body}}\n`;
      else if (/^@/.test(sel)) out += `${sel} {${body}}\n`;
      else out += `${sel.split(',').map(one).join(', ')} {${body.replace(/(animation(?:-name)?\s*:[^;]*)/g, (d) => d.replace(/[A-Za-z0-9_-]+/g, (w) => frames[w] || w))}}\n`;
      i = end + 1;
    }
    return out;
  };
  return walk(css);
}

/** Writes the website's copy of a form. `body` is the page's <body> inner markup with the page header and scripts already
 *  taken out; `images` the files the markup names, relative to the design folder. */
export function emitSite({ name, design, body, css, scripts, images = [] }) {
  const scope = `.mmf-${name}`;
  const pub = resolve(WEB, 'public/forms', name);
  mkdirSync(pub, { recursive: true });
  for (const f of images) copyFileSync(resolve(design, f), resolve(pub, basename(f)));
  // The website's page is one <main> already (PageShell): the form's own becomes a plain box inside it, so the page has
  // one main landmark, at the top level. Nothing in a form's stylesheet or scripts names the element itself.
  if ((body.match(/<main\b/g) || []).length > 1 || (body.match(/<\/main>/g) || []).length > 1) throw new Error(`${name}: more than one <main>`);
  let markup = body.replace(/<main\b/, '<div').replace('</main>', '</div>');
  // The website draws the footer too (its contact lines, Privacy Policy and payment marks): the form's own footer is
  // left out, or the page ends in two of them. The form's Privacy Notice stays beside its "I have read" box.
  if ((markup.match(/<footer\b/g) || []).length > 1) throw new Error(`${name}: more than one <footer>`);
  markup = markup.replace(/<footer\b[\s\S]*?<\/footer>\s*/, '');
  if (/(^|[\s,>+~(])main\b(?![-\w])/m.test(css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{[^{}]*\}/g, '{}'))) throw new Error(`${name}: the stylesheet names the <main> element, which the website's page draws as a <div>`);
  for (const f of images) markup = markup.split(`"${f}"`).join(`"/forms/${name}/${basename(f)}"`);
  if (/(src|href)="(?!https?:|\/|#|data:|mailto:|tel:)[^"]+\.(png|svg|webp|jpe?g)"/.test(markup)) throw new Error(`${name}: a picture the markup names was not given to emitSite`);
  const dir = resolve(WEB, 'src/forms/site');
  mkdirSync(dir, { recursive: true });
  const head = `// GENERATED by forms/${name}'s build (forms/shared/site-form.mjs). Do not edit here: change the form in forms/${name}\n// and run its build.\n`;
  writeFileSync(resolve(dir, `${name}.markup.ts`), head + `export const markup: string = ${JSON.stringify(markup)};\n`);
  writeFileSync(resolve(dir, `${name}.css`), `/* GENERATED by forms/${name}'s build (forms/shared/site-form.mjs). Every rule is kept inside ${scope}. */\n` + scopeCss(css, scope));
  // The scripts are classic scripts: their top-level vars (SHARED, FORM_T, MMAccount) are the page's globals there,
  // and app.js reads window.SHARED / window.FORM_T. Run inside one function here, so they are handed to window too.
  // Each script's globals are handed over right after it, before the next one (app.js) reads them.
  const js = scripts.map((s) => s + '\n;' + [...s.matchAll(/^var ([A-Z][A-Z0-9_]*|MMAccount)\s*=/gm)].map((m) => ` window.${m[1]} = ${m[1]};`).join('')).join('\n');
  writeFileSync(resolve(dir, `${name}.run.js`), head +
    '/* eslint-disable */\n// @ts-nocheck\nexport default function run(site) {\n  window.MM_SITE_FORM = site;\n' + js + '\n}\n');
  return { markupBytes: markup.length, cssBytes: css.length };
}

export const hasSite = () => existsSync(resolve(WEB, 'src/forms/site'));
