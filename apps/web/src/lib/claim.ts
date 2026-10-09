import { intlOf } from "../i18n/locales";

// A freed waitlist place, claimed: micromobility.sa/?claim=<token> (the booking app's /?claim=, its
// renderClaim / _wlcOpen / _wlcGo, 2026-10-09). Staff offer the place on WhatsApp with this link
// (waitlist_offers, rentals migration 20261009225000); the page shows the ride, how long the offer
// holds and one button. The database decides everything - customer_claim_spot checks the window and
// the room - so the countdown here is only what the rider reads. No sign-in: the token is the key.
// The plain logic, so it can be tested; app/api/claim reads the database, components/claim draws it.

/** A claim token: 32 lower-case hex characters, as the database makes and checks them. */
export const CLAIM_TOKEN = /^[0-9a-f]{32}$/;
export const claimToken = (v: unknown): string | null => {
  const t = typeof v === "string" ? v.trim().toLowerCase() : "";
  return CLAIM_TOKEN.test(t) ? t : null;
};

/**
 * What the card shows (the booking app's S._wlc.st):
 *   load  reading the offer;           ask   open: the countdown and the two buttons;
 *   done  the place is the rider's;    late  the time ran out (or the countdown reached 0);
 *   full  the place went before the rider claimed it;  no  the rider said they cannot come;
 *   gone  anything else: no such offer, withdrawn, closed, the ride over;
 *   net   the offer could not be read: Try again.
 */
export type ClaimState = "load" | "ask" | "done" | "late" | "full" | "no" | "gone" | "net";

export type ClaimSession = { id?: string; date?: string; time?: string; title?: string | null; ride_kind?: string | null; event_kind?: string | null; location?: string | null };
export type ClaimGet = { ok: boolean; reason?: string; status?: string; expires_at?: string; now?: string; session?: ClaimSession | null };

/** The card's state from customer_claim_get's answer (_wlcOpen); null is a read that did not come back. */
export function stateOfGet(r: ClaimGet | null): ClaimState {
  if (!r) return "net";
  if (!r.ok) return "gone";
  return r.status === "open" ? "ask" : r.status === "claimed" ? "done" : r.status === "expired" ? "late" : "gone";
}

export type ClaimSpot = { ok: boolean; reason?: string; declined?: boolean; already?: boolean; queue_num?: number };

/** The card's state after customer_claim_spot (_wlcGo): null is an answer that did not come back,
 *  or the database's CHANGED (someone else's claim landed at the same moment) - the card stays on
 *  its question with "Try again" under it. */
export function stateOfSpot(r: ClaimSpot | null): ClaimState | null {
  if (!r) return null;
  if (r.ok) return r.declined ? "no" : "done";
  return r.reason === "EXPIRED" ? "late" : r.reason === "FULL" ? "full" : "gone";
}

/** How far the device's clock is behind the server's, in ms (server now - device now): the
 *  countdown runs on the device but ends when the server says. */
export function clockSkew(serverNow: string | undefined, deviceNow: number): number {
  const n = Date.parse(serverNow ?? "");
  return Number.isFinite(n) ? n - deviceNow : 0;
}

/** The time left as m:ss (_wlcClock), or "" once it has run out. */
export function clockText(expiresAt: string | undefined, skew: number, deviceNow: number): string {
  const end = Date.parse(expiresAt ?? "");
  if (!Number.isFinite(end)) return "";
  const ms = Math.max(0, end - (deviceNow + skew));
  if (!ms) return "";
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** The ride's day and start, as the rider reads it: "Saturday 11 October · 6:30 AM" (the booking
 *  app's toLocaleDateString weekday/day/month and fmt12h of the first time in "HH:MM - HH:MM"). */
export function claimWhen(session: ClaimSession | null | undefined, locale: string): string {
  const date = String(session?.date ?? "").slice(0, 10);
  const start = String(session?.time ?? "").split("-")[0].trim();
  let day = "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    try {
      day = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : intlOf(locale), { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
    } catch { day = date; }
  }
  const m = /^(\d{1,2}):(\d{2})$/.exec(start);
  let time = "";
  if (m) {
    const d = new Date(Date.UTC(2000, 0, 1, Number(m[1]), Number(m[2])));
    try {
      time = new Intl.DateTimeFormat(locale === "en" ? "en-US" : intlOf(locale), { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "UTC" }).format(d);
    } catch { time = start; }
  }
  return [day, time].filter(Boolean).join(" · ");
}

/** What the page is given about the offer: never the raw answer (no first name, no queue number). */
export type ClaimView = { state: ClaimState; title: string | null; when: string; expiresAt: string | null; now: string | null };

export function claimView(r: ClaimGet | null, locale: string): ClaimView {
  const state = stateOfGet(r);
  const s = r && r.ok ? r.session ?? null : null;
  const title = s && typeof s.title === "string" && s.title.trim() ? s.title.trim().slice(0, 120) : null;
  return { state, title, when: s ? claimWhen(s, locale) : "", expiresAt: r?.ok && r.expires_at ? r.expires_at : null, now: r?.ok && r.now ? r.now : null };
}
