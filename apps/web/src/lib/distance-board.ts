// The distance leaderboards (the booking app's distance-board.js, rentals migration 20261127180000; the user, 2026-11-27:
// a leaderboard of the longest single ride with badges that move to whoever rides further, shared on social media, then
// lifetime and this year, with distances riders add with a picture or a PDF as proof for staff to approve). Four boards
// (Longest ride, This month, Lifetime, This year), men and women apart; only members are ranked, and a row names a rider
// only by their full name (the user, 2026-11-28: "show all full names on the leaderboard", rentals 20261128150000; "Member"
// only when a name is missing). What the database answers, read safely,
// and what a claim may be, in a plain module the page, its routes and the tests share. Nothing about anyone else but the
// place, the distance and the name; no count of riders.
// A proof is what a badge request takes (lib/badge-request.ts proofKind): a JPEG, PNG or WebP picture or a PDF as a
// data: URL, 3 MB at most.
import { NAME_MAX, proofKind } from "./badge-request";
import { fill } from "@/i18n/tx";
import { ltrNum, type ShareSubject } from "./share-picture";

export const BOARDS = ["longest", "month", "lifetime", "year"] as const;
export type Board = (typeof BOARDS)[number];
/** Men, women, or everyone ranked together ("all", the user, 2026-11-28: "add a all genders leaderboard"; rentals
 *  20261128170000; the podium medals stay per gender). */
export type BoardGender = "male" | "female" | "all";
export const isBoard = (v: unknown): v is Board => typeof v === "string" && (BOARDS as readonly string[]).includes(v);
export const asBoard = (v: unknown): Board => (isBoard(v) ? v : "longest");
export const asGender = (v: unknown): BoardGender => (v === "female" || v === "all" ? v : "male");
/** The board a visitor opens on without ?g=: a signed-in rider their own gender's, anyone else (or an account with none on
 *  file) everyone together (the booking app's _dbdOpen). */
export const startGender = (accountGender: unknown): BoardGender => (accountGender === "female" || accountGender === "male" ? accountGender : "all");

/** The page's own address, and the address a share picture prints at its foot (the website's, as every picture the site
 *  draws prints micromobility.sa where the booking app prints its own). */
export const BOARD_PATH = "/leaderboard";
export const BOARD_LINK = "micromobility.sa/leaderboard";

/** One row of a board: its rank (equal distances share one), the distance, the rider's full name (null: "Member"), the Longest ride medal 1-3, and whether it is the signed-in rider's own. */
export type BoardRow = { r: number; km: number; name: string | null; medal: 1 | 2 | 3 | null; mine: boolean };
/** The signed-in rider on a board: their place and figure when ranked, whether they are a member. */
export type BoardMe = { r: number | null; km: number | null; member: boolean; gender: "male" | "female" | null };
export type BoardAnswer = { board: Board; gender: BoardGender; rows: BoardRow[]; me: BoardMe | null };

export type Claim = {
  id: number; kind: "ride" | "total"; km: number; /** null: entered by staff with no date (2026-11-28) */ d: string | null; from: string | null;
  status: "pending" | "approved" | "declined"; source: "claim" | "staff"; reply: string | null; at: string;
};
/** customer_distances: the rider's best single ride, lifetime and this year's kilometres, the switch, membership, the
 *  medal they hold, and their own distances (waiting, entered by staff, or answered in the last 90 days). */
export type MyDistances = { best: number | null; at: string | null; lifetime: number; year: number; member: boolean; medal: 1 | 2 | 3 | null; claims: Claim[] };

/** The Longest ride medals: [the medal's drawing, its colour] (the booking app's DBD_MEDAL; Medal.tsx RACE lr1-3). */
export const BOARD_MEDAL: Record<1 | 2 | 3, [string, string]> = { 1: ["lr1", "gold"], 2: ["lr2", "silver"], 3: ["lr3", "orange"] };

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : null);
const medalOf = (v: unknown): 1 | 2 | 3 | null => (v === 1 || v === 2 || v === 3 ? v : null);
const day = (v: unknown): string | null => (typeof v === "string" && /^\d{4}-\d\d-\d\d/.test(v) ? v.slice(0, 10) : null);
/** A name as a row shows it: never with dashes or underscores (the owner's rule: names without dashes), 80 letters at most. */
export function boardName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/[-_‐-―]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  return s || null;
}

/** distance_board's answer; null for anything but {ok: true, rows: [...]}. */
export function readBoard(v: unknown): BoardAnswer | null {
  const a = v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  if (!a || a.ok !== true || !Array.isArray(a.rows)) return null;
  const rows: BoardRow[] = [];
  for (const x of a.rows as Record<string, unknown>[]) {
    const r = num(x?.r), km = num(x?.km);
    if (r == null || km == null || r < 1) continue;
    rows.push({ r: Math.round(r), km, name: boardName(x.name), medal: medalOf(x.medal), mine: x.mine === true });
  }
  const m = a.me && typeof a.me === "object" ? (a.me as Record<string, unknown>) : null;
  const me: BoardMe | null = m ? {
    r: num(m.r) != null && (num(m.r) as number) >= 1 ? Math.round(num(m.r) as number) : null, km: num(m.km),
    member: m.member !== false, gender: m.gender === "female" || m.gender === "male" ? m.gender : null,
  } : null;
  return { board: asBoard(a.board), gender: asGender(a.gender), rows, me };
}

const KIND = new Set(["ride", "total"]), STATUS = new Set(["pending", "approved", "declined"]), SOURCE = new Set(["claim", "staff"]);
/** customer_distances' answer; null for a refusal or anything else. */
export function readMine(v: unknown): MyDistances | null {
  const a = v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  if (!a || a.ok !== true) return null;
  const claims: Claim[] = [];
  for (const x of (Array.isArray(a.claims) ? a.claims : []) as Record<string, unknown>[]) {
    const id = num(x?.id), km = num(x?.km), d = day(x?.d);
    if (id == null || km == null || !KIND.has(String(x.kind)) || !STATUS.has(String(x.status)) || !SOURCE.has(String(x.source))) continue;
    claims.push({
      id, kind: x.kind as Claim["kind"], km, d, from: day(x.from), status: x.status as Claim["status"], source: x.source as Claim["source"],
      reply: typeof x.reply === "string" && x.reply.trim() ? x.reply.trim() : null, at: typeof x.at === "string" ? x.at : "",
    });
  }
  return {
    best: num(a.best), at: day(a.at), lifetime: num(a.lifetime) ?? 0, year: num(a.year) ?? 0,
    member: a.member !== false, medal: medalOf(a.medal), claims,
  };
}

/** A distance as the page writes it: a whole number without its point, else one decimal; Latin digits in every language
 *  (the booking app's _dbdNum). */
export function kmNum(v: unknown): string {
  const n = Math.round((Number(v) || 0) * 10) / 10;
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
/** Kilometres to miles (the booking app's DBD_MI). */
export const MI_PER_KM = 0.621371;
/** A distance in kilometres and miles, "90 km · 55.9 mi" (the user, 2026-11-28: "show the mileage in miles and km in the
 *  leaderboard"; the booking app's _dbdKm): each to one decimal, a whole number without its point. `num` wraps each number
 *  (ltrNum on the share picture, to keep its order in a right-to-left line). */
export function kmMi(v: unknown, w: { km: string; mi: string }, num: (s: string) => string = (s) => s): string {
  const k = Number(v) || 0;
  return `${fill(w.km, num(kmNum(k)))} · ${fill(w.mi, num(kmNum(k * MI_PER_KM)))}`;
}
/** A typed number: Arabic and Persian digits and a comma or the Arabic point for the point are read too (_dbdRead). */
export function readKm(v: unknown): number {
  const s = String(v == null ? "" : v)
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0))
    .replace(/[٫,]/g, ".").trim();
  return /^\d+(\.\d+)?$/.test(s) ? parseFloat(s) : NaN;
}

/** The own card's figures on a board (the booking app's _dbdMineHtml): the place when ranked, the distance to show (the
 *  board's own when ranked, else the rider's own figure for that board), the medal on Longest ride, and
 *  whether they are a member (unknown reads as yes, as the app's). */
export function ownCard(b: Board, me: BoardMe | null, mine: MyDistances | null): { r: number | null; km: number | null; medal: 1 | 2 | 3 | null; member: boolean } {
  const member = me ? me.member : mine ? mine.member : true;
  const r = me?.r ?? null;
  const own = b === "lifetime" ? mine?.lifetime : b === "year" ? mine?.year : b === "longest" ? mine?.best : me?.km;
  const km = r != null && me?.km != null ? me.km : own ? own : null;
  return { r, km, medal: b === "longest" ? mine?.medal ?? null : null, member };
}

/** No maximum for a ride or a total (the user, 2026-11-28: "dont put a maximum limit for kms per one ride"): 99,999 km is
 *  only the column's own room. */
export const CLAIM_MAX = 99_999;
export const NOTE_MAX = 300;
const YMD = /^\d{4}-\d\d-\d\d$/;
export type ClaimForm = { kind: "ride" | "total"; km: string; d: string; from: string; proof: string | null };
/** What the claim's form says before it sends (the booking app's _dbdClaimSend): the distance, the dates (none after today;
 *  a total's start not after its end), then the proof. Null when it may go. */
export function claimProblem(f: ClaimForm, today: string): "eKm" | "eDate" | "eProof" | null {
  const km = readKm(f.km);
  if (!(km >= 1 && km <= CLAIM_MAX)) return "eKm";
  if (!YMD.test(f.d) || f.d > today || (f.kind === "total" && (!YMD.test(f.from) || f.from > f.d))) return "eDate";
  if (!f.proof) return "eProof";
  return null;
}

export type ClaimArgs = { p_kind: "ride" | "total"; p_km: number; p_date: string; p_from: string | null; p_note: string | null; p_proof: string; p_proof_name: string | null };
/** The claim a page posts, read safely ({kind, km, date, from?, note?, proof, proofName?}); null when it cannot be one.
 *  The database checks the rest again (customer_distance_claim). */
export function claimBody(body: unknown): ClaimArgs | null {
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  if (!b || (b.kind !== "ride" && b.kind !== "total")) return null;
  const km = typeof b.km === "number" ? b.km : readKm(b.km);
  if (!Number.isFinite(km) || km <= 0 || km > CLAIM_MAX) return null;
  if (typeof b.date !== "string" || !YMD.test(b.date)) return null;
  const from = b.kind === "total" ? (typeof b.from === "string" && YMD.test(b.from) ? b.from : null) : null;
  if (b.kind === "total" && !from) return null;
  if (!proofKind(b.proof)) return null;
  const note = typeof b.note === "string" ? b.note.trim().slice(0, NOTE_MAX) || null : null;
  const name = typeof b.proofName === "string" ? b.proofName.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(-NAME_MAX) : "";
  return { p_kind: b.kind, p_km: Math.round(km * 10) / 10, p_date: b.date, p_from: from, p_note: note, p_proof: b.proof as string, p_proof_name: name || null };
}

/** customer_distance_claim's refusal, as the route says it; "generic" for anything it does not name. */
export function claimRefusal(v: unknown): "signin" | "km" | "date" | "proof" | "limit" | "generic" {
  const e = v && typeof v === "object" ? (v as Record<string, unknown>).error : null;
  return e === "token" ? "signin" : e === "km" || e === "date" || e === "proof" || e === "limit" ? e : "generic";
}
/** The claim's refusal as the form words it (the booking app's: the same four, else Something went wrong). */
export const refusalWord = (e: unknown): "eKm" | "eDate" | "eProof" | "eLimit" | "eNet" =>
  e === "km" ? "eKm" : e === "date" ? "eDate" : e === "proof" || e === "invalid" ? "eProof" : e === "limit" ? "eLimit" : "eNet";

/** The share picture of the rider's place (the booking app's _dbdShare, drawn as its badge-share.js kind 'dist'): the
 *  board's name, the distance, the place with the board's men or women, the Longest ride medal held (else the road),
 *  and the leaderboard's address at its foot. Its numbers keep their order inside a right-to-left line. */
export function boardSubject(b: Board, g: BoardGender, r: number, km: number, medal: 1 | 2 | 3 | null, w: Record<"longest" | "monthP" | "lifetimeP" | "yearP" | "km" | "mi" | "men" | "women", string>): ShareSubject {
  const m = b === "longest" && medal ? BOARD_MEDAL[medal] : null;
  return {
    label: b === "month" ? w.monthP : b === "lifetime" ? w.lifetimeP : b === "year" ? w.yearP : w.longest,
    name: kmMi(km, w, ltrNum), level: g === "all" ? ltrNum(`#${r}`) : `${ltrNum(`#${r}`)} · ${g === "female" ? w.women : w.men}`, date: "",
    medal: m ? { icon: m[0], color: m[1] } : { icon: "road", color: "green" }, chip: null, file: `micromobility-${b}`, foot: BOARD_LINK,
  };
}
