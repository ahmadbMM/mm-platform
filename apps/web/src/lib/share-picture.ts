// Share a badge or a title as a picture (the booking app's badge-share.js, new features build F12, 2026-11-13): what the
// picture says and how it is drawn, in a plain module so the tests and the share pop-up (components/account/ShareImage.tsx)
// share it. The picture is 1080 x 1920 in the year recap's look: the MicroMobility mark, the badge as the site draws it
// (or the title on a chip in its colour), its name, its level, the day it was earned when the site knows one, and the
// rider's first name only when they ask for it. Nothing about anyone else, no ticket, no number of anyone's.
// The booking app also prints the club's Saturday rides on a member's title; that total comes from the Community tab's
// read (hub_feed), which the website does not call, so the website's picture never carries it.
import { intlOf } from "@/i18n/locales";
import { fill } from "@/i18n/tx";

/** What one picture shows: label ("Badge earned" / "Title"), name, level ("Level 2 of 8" or ""), date ("" for none),
 *  the medal to draw for a badge or the chip's colour for a title, and the file's name without ".png". */
export type ShareSubject = {
  label: string; name: string; level: string; date: string;
  medal: { icon: string; color: string } | null;
  chip: { color: string } | null;
  file: string;
};

export const SHARE_W = 1080;
export const SHARE_H = 1920;
const MX = SHARE_W / 2;
/** The picture's ink on its dark ground (the app's SHR_INK). */
export const SHARE_INK = { bg: "#0b0e0a", go: "#03ff89", hi: "#ffffff", mid: "#d7ded9", low: "#b8c2bb", foot: "#7f8a83" } as const;
/** The eight badge colours as the site's medals draw them (medal.css); green is the brand green on the dark ground. */
const TINT: Record<string, string> = {
  green: SHARE_INK.go, gold: "#e0a414", blue: "#3d8bfd", red: "#f0525f", purple: "#9d6cff", orange: "#f98a3c", teal: "#17b4ac", silver: "#98a2b3",
};
/** A badge or title colour as a paint: one of the eight, anything else (a special medal) the brand green. */
export const shareTint = (color: string | null | undefined): string => TINT[String(color)] ?? SHARE_INK.go;
/** The site's own mark, in the brand green (192 x 180), drawn 128 x 120 over the name. */
export const SHARE_MARK = "/site/logo-mark.png";
/** The address under every picture: the website, where the booking app prints its own. */
export const SHARE_SITE = "micromobility.sa";

// A number keeps its order inside a right-to-left line: held between the two isolate marks, built from their codes so
// this file carries no invisible character. The picture's alternative text leaves them out.
const LRI = String.fromCharCode(0x2066), PDI = String.fromCharCode(0x2069);
export const ltrNum = (v: string | number) => LRI + String(v) + PDI;
export const plainText = (s: string) => String(s || "").split(LRI).join("").split(PDI).join("");

/** The picture's file name: micromobility-<slug>, anything but letters, digits and _ as a dash. */
export const shareFile = (slug: string) => `micromobility-${String(slug || "").replace(/[^a-z0-9_]+/gi, "-") || "badge"}`;
/** A day as a badge's pop-up says one ("3 Oct 2026"), on Riyadh's calendar; "" for none. */
export function shareDay(iso: string | null | undefined, locale: string): string {
  const d = iso ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00Z` : iso) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  try { return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : intlOf(locale), { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Riyadh" }).format(d); }
  catch { return ""; }
}
/** The first word of the account's name, or "" (then no switch is offered). */
export const firstNameOf = (name: string | null | undefined) => String(name || "").trim().split(/\s+/)[0] || "";

/** An earned badge's picture (the app's _shrSubject for a badge): its name, its level on a ladder ("Level 2 of 8", the
 *  page's `levelOf`, its numbers kept in order in a right-to-left line), the day it was given or reached ("" for none). */
export function badgeSubject(x: { slug: string; name: string; icon: string; color: string; levels: readonly unknown[] | null; lvN: number; day?: string }, label: string, levelOf: string): ShareSubject {
  return {
    label, name: x.name, level: x.levels && x.lvN ? fill(levelOf, ltrNum(x.lvN), ltrNum(x.levels.length)) : "", date: x.day || "",
    medal: { icon: x.icon, color: x.color }, chip: null, file: shareFile(x.slug),
  };
}
/** A member's title as a picture (the app's _shrSubject for a title): its name in the page's language (Arabic's own
 *  where there is one), on a chip in its colour, with the day it was given or reached. */
export function titleSubject(t: { name: string; nameAr: string; color: string; at?: string }, locale: string, label: string): ShareSubject {
  return { label, name: (locale === "ar" && t.nameAr) || t.name, level: "", date: shareDay(t.at, locale), medal: null, chip: { color: t.color }, file: "micromobility-title" };
}

/** What the painting needs besides the subject: the body font, the mark and the medal as pictures (null: left out or
 *  stood in for), and the medal's or the chip's colour. */
export type ShareAssets = { fam: string; mark: CanvasImageSource | null; medal: CanvasImageSource | null; tint: string };
type Ctx = CanvasRenderingContext2D;

function box(x: Ctx, X: number, Y: number, W: number, H: number, R: number) {
  x.beginPath(); x.moveTo(X + R, Y); x.arcTo(X + W, Y, X + W, Y + H, R); x.arcTo(X + W, Y + H, X, Y + H, R); x.arcTo(X, Y + H, X, Y, R); x.arcTo(X, Y, X + W, Y, R); x.closePath();
}
/** The largest size from `size` down to `min`, in steps of 4, at which the words fit `max`; the font is left set to it. */
export function fitFont(x: Pick<Ctx, "font" | "measureText">, text: string, weight: number, size: number, min: number, fam: string, max: number): number {
  let s = size;
  for (;;) { x.font = `${weight} ${s}px ${fam}`; if (s <= min || x.measureText(text).width <= max) return s; s -= 4; }
}
/** Two lines at most, broken at a space, in the font as it is set. */
export function wrapTwo(x: Pick<Ctx, "measureText">, text: string, max: number): string[] {
  if (x.measureText(text).width <= max) return [text];
  const w = text.split(/\s+/); let a = "", i = 0;
  for (; i < w.length; i++) { const nx = a ? `${a} ${w[i]}` : w[i]; if (a && x.measureText(nx).width > max) break; a = nx; }
  const b = w.slice(i).join(" ");
  return b ? [a, b] : [a];
}

/** The picture on a 1080 x 1920 context (the app's _shrDraw). `first`: the rider's first name, or "" to leave it out.
 *  Answers the words drawn, in order, for the picture's alternative text. */
export function paintShare(x: Ctx, sub: ShareSubject, first: string, a: ShareAssets, rtl: boolean): string[] {
  const fam = a.fam, said = ["MicroMobility"];
  const put = (text: string, y: number, max = 980) => x.fillText(text, MX, y, max);
  x.direction = rtl ? "rtl" : "ltr"; x.textAlign = "center"; x.textBaseline = "alphabetic";
  x.fillStyle = SHARE_INK.bg; x.fillRect(0, 0, SHARE_W, SHARE_H);
  const glow = x.createRadialGradient(MX, 720, 40, MX, 720, 620);
  glow.addColorStop(0, "rgba(3,255,137,.13)"); glow.addColorStop(1, "rgba(3,255,137,0)");
  x.fillStyle = glow; x.fillRect(0, 100, SHARE_W, 1240);
  // the mark and the name
  if (a.mark) x.drawImage(a.mark, MX - 64, 140, 128, 120);
  x.fillStyle = a.mark ? SHARE_INK.hi : SHARE_INK.go; x.font = `600 48px ${fam}`; put("MicroMobility", a.mark ? 336 : 260);
  if (sub.medal) {
    if (a.medal) x.drawImage(a.medal, MX - 260, 460, 520, 520);
    else { // the medal could not be made into a picture: its six-sided shape in the badge's colour
      x.save(); x.translate(MX - 260, 460); x.scale(13, 13);
      x.beginPath(); x.moveTo(20, 2.2); x.lineTo(35.4, 11.1); x.lineTo(35.4, 28.9); x.lineTo(20, 37.8); x.lineTo(4.6, 28.9); x.lineTo(4.6, 11.1); x.closePath();
      x.fillStyle = a.tint; x.globalAlpha = 0.16; x.fill(); x.globalAlpha = 1; x.strokeStyle = a.tint; x.lineWidth = 1.8; x.lineJoin = "round"; x.stroke();
      x.restore();
    }
  } else { // a title: what it is, then its chip in its own colour, the bar on the side the line starts from
    x.fillStyle = SHARE_INK.go; x.font = `600 44px ${fam}`; put(sub.label, 580); said.push(sub.label);
    fitFont(x, sub.name, 700, 76, 44, fam, 760);
    const W = Math.max(520, Math.min(900, x.measureText(sub.name).width + 150)), X = MX - W / 2, Y = 640, H = 210;
    box(x, X, Y, W, H, 30); x.fillStyle = a.tint; x.globalAlpha = 0.16; x.fill(); x.globalAlpha = 1;
    x.strokeStyle = a.tint; x.lineWidth = 4; x.stroke();
    x.save(); box(x, X, Y, W, H, 30); x.clip(); x.fillStyle = a.tint; x.fillRect(rtl ? X + W - 20 : X, Y, 20, H); x.restore();
    x.fillStyle = SHARE_INK.hi; put(sub.name, Y + 132, W - 90); said.push(sub.name);
  }
  // the words under it, as one block centred below the medal or the chip
  const rows: { t: string; w: number; s: number; c: string; h: number }[] = [];
  if (first) rows.push({ t: first, w: 600, s: 60, c: SHARE_INK.hi, h: 92 });
  if (sub.medal) {
    rows.push({ t: sub.label, w: 600, s: 44, c: SHARE_INK.go, h: 84 });
    const s = fitFont(x, sub.name, 700, 84, 60, fam, 940);
    for (const t of wrapTwo(x, sub.name, 940)) rows.push({ t, w: 700, s, c: SHARE_INK.hi, h: Math.round(s * 1.22) });
  }
  if (sub.level) rows.push({ t: sub.level, w: 400, s: 44, c: SHARE_INK.low, h: 76 });
  if (sub.date) rows.push({ t: sub.date, w: 400, s: 44, c: SHARE_INK.mid, h: 76 });
  let y = (sub.medal ? 1290 : 1010) - rows.reduce((n, r) => n + r.h, 0) / 2;
  for (const r of rows) { x.fillStyle = r.c; x.font = `${r.w} ${r.s}px ${fam}`; put(r.t, y + r.h * 0.72); y += r.h; }
  if (first) said.push(first);
  if (sub.medal) said.push(sub.label, sub.name);
  if (sub.level) said.push(sub.level);
  if (sub.date) said.push(sub.date);
  x.fillStyle = SHARE_INK.foot; x.font = `400 40px ${fam}`; put(SHARE_SITE, 1790);
  return said;
}
