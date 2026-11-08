import type { BadgeItem } from "./ride-record";

// Badge requests (the owner, 2026-11-08: "add a button on badges for customers to request a badge and adding a proof
// either a pdf or an image as optional and a comment too optional"; rentals migration 20261108210000, the booking
// app's _bdr*). A rider asks for any badge they do not hold, earned by riding or given by staff (the owner's second round
// the same day, rentals 20261108230000: "each badge when clicking on it to have its details and request button if the
// customer didnt have it"), every ladder level not reached yet, with an optional comment and an optional proof: a picture
// the page makes small (a JPEG) or a PDF of 2 MB at most, sent as a data: URL through customer_badge_request
// (app/api/account/badge-request). One request waits per badge; sending again replaces it. Staff answer in the booking
// app's Badge requests section, and the answer deletes the proof; customer_my_badge_requests tells the rider: waiting, or
// answered in the last 60 days with staff's note.

export type BadgeReq = { id: number; slug: string; status: "pending" | "given" | "declined"; at: string; decidedAt: string | null; reply: string | null };
/** A badge the dialog offers: its slug, its words, its medal and its level on a ladder ("Level 2 of 5" filled by the page). */
export type AskChoice = { slug: string; name: string; how: string; icon: string; color: string; level: [number, number] | null };

export const COMMENT_MAX = 500;
/** The proof as the database takes it (badge_requests_proof_chk). */
export const PROOF_MAX = 3_000_000;
/** A PDF's own size, before it is a data: URL. */
export const PDF_MAX = 2_000_000;
export const NAME_MAX = 120;
const SLUG = /^[a-z][a-z0-9_]{1,39}$/;
const STATUS = new Set(["pending", "given", "declined"]);

/** customer_my_badge_requests' answer, newest first; null for anything but a list. */
export function badgeReqs(v: unknown): BadgeReq[] | null {
  if (!Array.isArray(v)) return null;
  const s = (x: unknown) => (typeof x === "string" && x ? x : null);
  return (v as Record<string, unknown>[])
    .filter((r) => r && typeof r.slug === "string" && SLUG.test(r.slug) && typeof r.status === "string" && STATUS.has(r.status) && typeof r.at === "string")
    .map((r) => ({ id: Number(r.id) || 0, slug: r.slug as string, status: r.status as BadgeReq["status"], at: r.at as string, decidedAt: s(r.decided_at), reply: s(r.reply) }))
    .sort((a, b) => b.at.localeCompare(a.at));
}

/** Whether a rider may ask for a badge: it is in the catalogue and not reached. Without the catalogue (a row from it),
 *  never: it is what the database checks a request against. A badge hidden until held is not in the list at all. */
export const canAsk = (x: BadgeItem): boolean => !x.on && !!x.row; // the catalogue lists no retired badge
/** Every badge the dialog offers, ladder levels each on their own, in the list's order. */
export const askChoices = (items: BadgeItem[]): BadgeItem[] => items.flatMap((x) => (x.lv ?? [x]).filter(canAsk));
/** What a tile's popup offers to ask for: its ladder's next level, or the badge itself. */
export function askTarget(x: BadgeItem): BadgeItem | null {
  const y = x.lv ? x.lv.find((z) => !z.on) ?? null : x;
  return y && canAsk(y) ? y : null;
}
/** The latest request for any of these slugs (a tile's levels not reached yet). */
export const lastReq = (reqs: BadgeReq[], slugs: string[]): BadgeReq | null => reqs.find((r) => slugs.includes(r.slug)) ?? null;

/** A proof's kind, as the database takes one: a JPEG, PNG or WebP picture, or a PDF; null for anything else. */
export function proofKind(v: unknown): "image" | "pdf" | null {
  if (typeof v !== "string" || v.length > PROOF_MAX) return null;
  if (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v)) return "image";
  if (/^data:application\/pdf;base64,JVBER[A-Za-z0-9+/=]*$/.test(v)) return "pdf";
  return null;
}

/** The request a page posts, read safely: {slug, comment?, proof?, proofName?}; null when it cannot be one. */
export function badgeRequestBody(body: unknown): { slug: string; comment: string | null; proof: string | null; proofName: string | null } | null {
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  if (!b || typeof b.slug !== "string" || !SLUG.test(b.slug)) return null;
  const comment = typeof b.comment === "string" ? b.comment.trim().slice(0, COMMENT_MAX) || null : null;
  if (b.proof != null && !proofKind(b.proof)) return null;
  const proof = (b.proof as string | null | undefined) ?? null;
  const name = typeof b.proofName === "string" ? b.proofName.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(-NAME_MAX) : "";
  return { slug: b.slug, comment, proof, proofName: proof ? name || null : null };
}

/** customer_badge_request's refusal, as the route says it; "generic" for anything it does not name. */
export function reqRefusal(v: unknown): "signin" | "held" | "limit" | "badge" | "proof" | "generic" {
  const e = v && typeof v === "object" ? (v as Record<string, unknown>).error : null;
  return e === "token" ? "signin" : e === "held" || e === "limit" || e === "badge" || e === "proof" ? e : "generic";
}
