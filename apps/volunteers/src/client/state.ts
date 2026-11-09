// What the page knows, and how it asks for it. The database decides everything (rentals migrations 20261105120000
// onwards; the rework, 20261109120000); this page only asks and says what it was told. Nothing here is kept on the
// phone: the language and the opportunity to come back to after a sign-in are the only things in storage.

import { rpc, type Err } from "./api";
import { t, type Key } from "./i18n";

export type Opp = { id: string; title: string | null; ride_kind: string | null; date: string; time: string | null; location: string | null; about: string | null;
  needed: number | null; roles: string[] | null; min_age: number | null; hours_mode: string; fixed_hours: number | null; signup_open: boolean;
  opens_at: string | null; closes_at: string; accepted: number; role_needs?: { name: string; needed: number; filled: number }[] };
export type Reward = { code: string; expires_at: string | null; used: boolean };
export type Mine = { id: string; title: string | null; ride_kind: string | null; date: string; time: string | null; location: string | null; status: string; role: string | null;
  lead?: boolean; clock_in: string | null; clock_out: string | null; opens_at: string | null; closes_at: string; starts_at?: string | null; briefing: string | null;
  can_work: boolean; reward?: Reward | null; cert?: { serial: string; hours: number } | null };
export type RecordRow = { id: number; hours: number; on: string; note: string | null; session_id: string | null; title: string | null; ride_kind: string | null };
export type Me = { signedIn?: false; id: string; name: string; hours: number; account: string | null; status: string | null; profile?: boolean; agreed: boolean; unread?: number;
  mine: Mine[]; record: RecordRow[]; first_on: string | null; last_on: string | null; sessions: number; cert_signer: string | null; cert_title: string | null };
export type Prof = { status: string | null; applied_at: string | null; profile_at?: string | null; skills: string | null; days: number[]; shirt: string | null; whatsapp: string | null;
  briefed: Record<string, string>; name_ar?: string | null; gender?: string | null; auto?: boolean; birth_date?: string | null;
  emergency?: { name: string; phone: string; relation: string | null } | null };
export type Update = { id: number; kind: string; session_id: string | null; title: string | null; ride_kind: string | null; date: string | null;
  data: Record<string, unknown> | null; at: string; read: boolean };

export const BOOKING = "https://micromobilityrentals.pages.dev";
export const SUPPORT = "https://wa.me/966579543997";
export const AFTER_KEY = "mm_vol_after"; // the opportunity to come back to, across a sign-in on the booking app

export const S: {
  opps: Opp[] | null; me: Me | null; prof: Prof | null; err: string; note: string; noteAt: number;
  updates: { items: Update[]; fresh: Set<number> } | null;
} = { opps: null, me: null, prof: null, err: "", note: "", noteAt: 0, updates: null };

let painter: () => void = () => undefined;
/** The page's one way to draw itself again (main.ts registers it). */
export const render = () => painter();
export const onRender = (fn: () => void) => { painter = fn; };

/** A line at the top of the next page drawn, for as long as it takes to read. */
export const setNote = (text: string) => { S.note = text; S.noteAt = Date.now(); };

export const route = (): { name: string; id: string } => {
  const [name, id] = location.hash.replace(/^#/, "").split("/");
  return { name: name || "list", id: id ? decodeURIComponent(id) : "" };
};
export const go = (hash: string) => { if (location.hash === hash || (hash === "#" && !location.hash)) render(); else location.hash = hash; };

/** What the database said, in words. */
export function say(e: Pick<Err, "code" | "detail">): string {
  const map: Record<string, Key> = {
    VOL_CLOSED: "volClosed", VOL_SIGNUP_CLOSED: "vdSignupClosed", VOL_DOB: "errDob", VOL_EMERGENCY: "errEmergency", VOL_AGE: "vdTooYoung", VOL_DECLINED: "errDeclined",
    VOL_NOT_VOLUNTEER: "vdNotVolunteer", VOL_NOT_ACCEPTED: "vdNotAccepted", VOL_ACCOUNT: "vdAccountPwd", VOL_ALREADY_IN: "vdAlreadyIn", VOL_CAP: "vdNotAllowed",
    VOL_OWN_BOOKING: "vdOwn", VOL_NOT_YOURS: "volNotYours", VOL_PROFILE: "profNeeded", VOL_PENDING: "profWaiting", VOL_NOT_LEAD: "teamNotLead",
    VOL_CHECKED_OUT: "teamStaffOut", NOT_FOUND: "teamGone",
    BLOOD_VISITOR: "errVisitor", BLOOD_DONATED: "errDonatedFirst", VOL_DONATED_FIRST: "volDonatedFirst", VOL_SLOW: "volSlow", VOL_BAD_SEARCH: "volSearchHint",
    BOOKING_NOT_FOUND: "volNotFound", BAD_BOOKING_STATE: "volNotFound", VOL_AGREE: "vdAgreeTitle", VOL_CERT_EMPTY: "certEmpty", BAD_DATE: "errBadDates",
    BAD_INPUT: "errBadInput", BAD_LOGIN: "errBadLogin", LOCKED: "errLocked", RATE_LIMIT: "errRate", VOL_TOKEN: "vdSessionEnded",
  };
  if (e.code === "VOL_ASK_DESK") {
    const desk: Record<string, Key> = { bike: "vdDeskBike", approval: "vdDeskApproval", share: "vdDeskShare", waiver: "vdDeskWaiver", waitlist: "vdDeskWaitlist" };
    return t(desk[e.detail ?? ""] ?? "vdDeskAsk");
  }
  return t(Object.prototype.hasOwnProperty.call(map, e.code) ? map[e.code] : "errConnection");
}
/** The answers that mean the work page is no longer theirs. */
export const lost = (code: string) => /^VOL_(CLOSED|NOT_VOLUNTEER|NOT_ACCEPTED|ACCOUNT|AGREE|TOKEN)$/.test(code);
/** A call that never reached the database, or a fault on the way: worth sending again. */
export const unsent = (e: Err) => e.code === "NETWORK" || e.code === "UNREACHABLE" || e.status === 0 || e.status >= 500;

// The application's fields, the account's birth date and emergency contact, and the briefings read; null on a database
// without them.
export const loadProf = async () => {
  const p = await rpc<Prof | null>("volunteer_profile");
  if (p.ok) S.prof = p.data && typeof p.data === "object" ? p.data : null;
};
export async function reloadMe(): Promise<boolean> {
  const was = !!S.me;
  // Signed in already: both at once. Otherwise who they are first, so a signed-out page asks nothing it would be refused.
  const [m] = await Promise.all([rpc<Me>("volunteer_me"), was ? loadProf() : Promise.resolve()]);
  if (m.ok) S.me = m.data && m.data.signedIn !== false ? m.data : null;
  if (!was && S.me) await loadProf();
  if (!S.me) S.prof = null;
  return m.ok;
}
export async function load(): Promise<void> {
  const ok = await reloadMe();
  // Signed out there is nothing to read: the server refuses the list too.
  if (!S.me) { S.opps = null; S.err = ok ? "" : t("errConnection"); return; }
  const o = await rpc<Opp[]>("volunteer_opportunities");
  S.err = o.ok ? "" : t("errConnection");
  if (o.ok) S.opps = Array.isArray(o.data) ? o.data : [];
}

export const myShift = (id: string) => S.me?.mine.find((x) => x.id === id) ?? null;

/** Where the volunteer stands with staff: needs a profile, waits for staff, may help, or may not. */
export function standing(): "profile" | "waiting" | "active" | "paused" | "ended" | "account" {
  const m = S.me;
  if (!m) return "profile";
  if (m.account) return "account";
  if (m.status === "active") return "active";
  if (m.status === "paused") return "paused";
  if (m.status === "removed" || m.status === "expired") return "ended";
  return m.profile ? "waiting" : "profile";
}
