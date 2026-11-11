// What the page knows, and how it asks for it. The database decides everything (rentals migrations 20261105120000
// onwards; the rework, 20261109120000; the enhancements, 20261111140000); this page only asks and says what it was told.
// Nothing here is kept on the phone: the language, the page to come back to after a sign-in, the plan prompts skipped and
// the one-time Home Screen how-to are the only things in storage.
//
// Every field the enhancements added is optional here: a database without them (old data) draws the page as before.

import { rpc, type Err } from "./api";
import { t, type Key } from "./i18n";

/** What staff wrote for the day (20261111140000): where to meet, what to bring, what is provided, the T-shirt, the demands. */
export type Logistics = { meet_point?: string | null; meet_map?: string | null; bring?: string | null; provided?: string | null; shirt_pickup?: string | null;
  demands?: string | null };
export type Opp = Logistics & { id: string; title: string | null; ride_kind: string | null; event_kind?: string | null; date: string; time: string | null; location: string | null;
  about: string | null; needed: number | null; roles: string[] | null; min_age: number | null; hours_mode: string; fixed_hours: number | null; signup_open: boolean;
  opens_at: string | null; closes_at: string; accepted: number; role_needs?: { name: string; needed: number; filled: number }[];
  partner?: string | null; partner_ar?: string | null; skills?: string | null; skills_ar?: string | null; gender?: string | null; starts_at?: string | null };
export type Reward = { code: string; expires_at: string | null; used: boolean };
// cancelled: the session was called off (sessions.cancelled_at), once volunteer_me says so.
export type Mine = Logistics & { id: string; title: string | null; ride_kind: string | null; event_kind?: string | null; date: string; time: string | null; location: string | null;
  status: string; role: string | null; lead?: boolean; clock_in: string | null; clock_out: string | null; opens_at: string | null; closes_at: string; starts_at?: string | null;
  briefing: string | null; can_work: boolean; cancelled?: boolean; reward?: Reward | null; cert?: { serial: string; hours: number } | null;
  // the enhancements (20261111140000)
  plan_leave?: string | null; coming_at?: string | null; withdraw_reason?: string | null; reason?: string | null;
  feedback?: { rating: number; again: string | null } | null; thanks?: { note: string; at: string } | null;
  impact?: { checked_in: number; donated: number | null } | null; contact_name?: string | null; contact_phone?: string | null; ends_at?: string | null };
export type RecordRow = { id: number; hours: number; on: string; note: string | null; session_id: string | null; title: string | null; ride_kind: string | null };
/** One event's hours, all of them (record holds only the newest 30 rows), once volunteer_me sends them. */
export type EventHours = { session_id: string; hours: number; on: string; title: string | null; ride_kind: string | null };
export type Me = { signedIn?: false; id: string; name: string; hours: number; account: string | null; status: string | null; profile?: boolean; agreed: boolean; unread?: number;
  mine: Mine[]; record: RecordRow[]; events?: EventHours[]; first_on: string | null; last_on: string | null; sessions: number; cert_signer: string | null; cert_title: string | null;
  // this year's hours of every volunteer together (no names, no ranks), and hours staff added with no session
  team?: { hours: number; volunteers: number; events: number } | null; extra_hours?: { id: number; on: string; hours: number }[] | null };
export type Prof = { status: string | null; applied_at: string | null; profile_at?: string | null; skills: string | null; days: number[]; shirt: string | null; whatsapp: string | null;
  briefed: Record<string, string>; name_ar?: string | null; gender?: string | null; auto?: boolean; birth_date?: string | null;
  emergency?: { name: string; phone: string; relation: string | null } | null; motive?: string | null; reason?: string | null };
export type Update = { id: number; kind: string; session_id: string | null; title: string | null; ride_kind: string | null; date: string | null;
  data: Record<string, unknown> | null; at: string; read: boolean };

export const BOOKING = "https://experiences.micromobility.sa";
export const ACCOUNT = `${BOOKING}/account`;
export const SUPPORT = "https://wa.me/966579543997";
export const AFTER_KEY = "mm_vol_after"; // the page to come back to (o/<id> or work/<id>), across a sign-in on the booking app

/** A note's button: where the missing thing is filled (the owner, 2026-11-10: an error about owed details carries one). */
export type NoteAct = { label: string; href: string };
export const S: {
  opps: Opp[] | null; me: Me | null; prof: Prof | null; err: string; note: string; noteAt: number; noteAct: NoteAct | null; quiet: string; quietAt: number;
  /** The first read failed with nobody known yet: "offline" (no connection) or "server" (a fault on our side). */
  boot: "" | "offline" | "server";
  /** When the Updates page marked everything read: a "who am I" asked before then still counts them unread. */
  seenAt: number;
  updates: { items: Update[]; fresh: Set<number>; err?: string } | null; // err: the list could not be read
} = { opps: null, me: null, prof: null, err: "", note: "", noteAt: 0, noteAct: null, quiet: "", quietAt: 0, boot: "", seenAt: 0, updates: null };

let painter: () => void = () => undefined;
/** The page's one way to draw itself again (main.ts registers it). */
export const render = () => painter();
export const onRender = (fn: () => void) => { painter = fn; };

/** A line at the top of the next page drawn, for as long as it takes to read: what went wrong, never what went right. */
export const setNote = (text: string, act: NoteAct | null = null) => { S.note = text; S.noteAt = Date.now(); S.noteAct = act; };
/** What went right, said to a screen reader only: the button or the row shows it in place (the owner: no bar after an action). */
export const setQuiet = (text: string) => { S.quiet = text; S.quietAt = Date.now(); S.note = ""; S.noteAct = null; }; // what went right ends a refusal said before it

export const route = (): { name: string; id: string } => {
  const [name, id] = location.hash.replace(/^#/, "").split("/");
  // The bare address is Home for someone signed in (Opportunities is #opps); signed out it is the sign-in anyway.
  return { name: name || (S.me ? "me" : "list"), id: id ? decodeURIComponent(id) : "" };
};
export const go = (hash: string) => { if (location.hash === hash || (hash === "#" && !location.hash)) render(); else location.hash = hash; };

/** The codes that mean the account owes a detail, filled in the booking app. */
const OWED = new Set(["VOL_DOB", "VOL_EMERGENCY", "VOL_AGE"]); // an age under the limit may be a birth date to correct
/** The button a refusal carries, if it is about something the account owes. */
export const owedAct = (code: string): NoteAct | null => (OWED.has(code) || (code === "VOL_GENDER" && !S.prof?.gender) ? { label: t("addDetails"), href: ACCOUNT } : null);
/** A refusal, said at the top of the next page, with its button. */
export const noteErr = (e: Pick<Err, "code" | "detail"> & { status?: number }) => setNote(say(e), owedAct(e.code));

/** What the database said, in words. A lost connection and a fault on our side are said apart. */
export function say(e: Pick<Err, "code" | "detail"> & { status?: number }): string {
  const map: Record<string, Key> = {
    VOL_CLOSED: "volClosed", VOL_SIGNUP_CLOSED: "vdSignupClosed", VOL_DOB: "errDob", VOL_EMERGENCY: "errEmergency", VOL_AGE: "errAge", VOL_DECLINED: "errDeclined",
    VOL_NOT_VOLUNTEER: "vdNotVolunteer", VOL_NOT_ACCEPTED: "vdNotAccepted", VOL_ACCOUNT: "vdAccountPwd", VOL_ALREADY_IN: "vdAlreadyIn", VOL_CAP: "vdNotAllowed",
    VOL_OWN_BOOKING: "vdOwn", VOL_NOT_YOURS: "volNotYours", VOL_PROFILE: "profNeeded", VOL_PENDING: "profWaiting", VOL_NOT_LEAD: "teamNotLead",
    VOL_CHECKED_OUT: "teamStaffOut", NOT_FOUND: "teamGone",
    BLOOD_VISITOR: "errVisitor", BLOOD_DONATED: "errDonatedFirst", VOL_DONATED_FIRST: "volDonatedFirst", VOL_SLOW: "volSlow", VOL_BAD_SEARCH: "volSearchHint",
    // _blood_donated_apply's own refusals, in the booking app's words: trying again never helps, so never "connection"
    BLOOD_NOT_CHECKED_IN: "bldErrIn", BLOOD_CODE_USED: "bldErrUsed", BLOOD_NO_ACCOUNT: "bldErrAcct",
    BOOKING_NOT_FOUND: "volNotFound", BAD_BOOKING_STATE: "volNotFound", VOL_AGREE: "vdAgreeTitle", VOL_CERT_EMPTY: "certEmpty", BAD_DATE: "errBadDates",
    BAD_INPUT: "errBadInput", BAD_LOGIN: "errBadLogin", LOCKED: "errLocked", RATE_LIMIT: "errRate", VOL_TOKEN: "vdSessionEnded",
  };
  if (e.code === "VOL_ASK_DESK") {
    const desk: Record<string, Key> = { bike: "vdDeskBike", approval: "vdDeskApproval", share: "vdDeskShare", waiver: "vdDeskWaiver", waitlist: "vdDeskWaitlist" };
    return t(desk[e.detail ?? ""] ?? "vdDeskAsk");
  }
  if (e.code === "VOL_GENDER") return t(S.prof?.gender ? "errGender" : "errGenderUnknown");
  if (Object.prototype.hasOwnProperty.call(map, e.code)) return t(map[e.code]);
  return t(e.code === "NETWORK" || e.status === 0 ? "errConnection" : "errServer");
}
/** The answers that mean the work page is no longer theirs. */
export const lost = (code: string) => /^VOL_(CLOSED|NOT_VOLUNTEER|NOT_ACCEPTED|ACCOUNT|AGREE|TOKEN)$/.test(code);
/** A call that never reached the database, or a fault on the way: worth sending again. */
export const unsent = (e: Err) => e.code === "NETWORK" || e.code === "UNREACHABLE" || e.status === 0 || e.status >= 500;

const asProf = (d: unknown): Prof | null => (d && typeof d === "object" ? d as Prof : null);
/** A "who am I" asked before the Updates page marked everything read is out of date on that one count. */
const unreadSince = (asked: number) => { if (S.me && S.seenAt > asked) S.me.unread = 0; };
export async function reloadMe(): Promise<boolean> {
  const asked = Date.now();
  const [m, p] = await Promise.all([rpc<Me>("volunteer_me"), rpc<Prof | null>("volunteer_profile")]);
  if (m.ok) { S.me = m.data && m.data.signedIn !== false ? m.data : null; unreadSince(asked); }
  if (!S.me) S.prof = null; else if (p.ok) S.prof = asProf(p.data);
  return m.ok;
}
/** Who they are, their profile and the opportunities, all three at once (the first paint waited on three round trips to
 *  Frankfurt one after the other). Signed out, the Worker refuses the other two without asking the database. */
export async function load(): Promise<void> {
  const asked = Date.now();
  const [m, p, o] = await Promise.all([rpc<Me>("volunteer_me"), rpc<Prof | null>("volunteer_profile"), rpc<Opp[]>("volunteer_opportunities")]);
  if (m.ok) { S.me = m.data && m.data.signedIn !== false ? m.data : null; unreadSince(asked); }
  S.boot = m.ok || S.me ? "" : m.code === "NETWORK" || m.status === 0 ? "offline" : "server";
  if (!S.me) { S.prof = null; S.opps = null; S.err = ""; return; }
  if (p.ok) S.prof = asProf(p.data);
  S.err = o.ok ? "" : say(o);
  if (o.ok) S.opps = Array.isArray(o.data) ? o.data : [];
}

// ── reading again: on every tab change and when the app comes back to the front (fix 1). With push off, what the page
// shows when it is opened is the only news a volunteer gets, so it has to be current. ──
let inFlight: Promise<boolean> | null = null;
let lastRead = 0;
// the error too: a background read that failed, then one that worked, has to take the error off the page
const snap = () => JSON.stringify([S.me, S.prof, S.opps, S.err]);
/** Reads everything again behind the page; true when something changed. One read at a time, and none within a few
 *  seconds of the last when the app comes back to the front; a tab change (now) always reads. */
export function refresh(now = false): Promise<boolean> {
  if (!S.me) return Promise.resolve(false);
  if (inFlight) return inFlight;
  if (!now && Date.now() - lastRead < 4000) return Promise.resolve(false);
  const before = snap();
  inFlight = load().then(() => { lastRead = Date.now(); inFlight = null; return snap() !== before; }, () => { inFlight = null; return false; });
  return inFlight;
}
/** The page was just read (the first load, a sign-in): the next tab change need not read it again at once. */
export const markRead = () => { lastRead = Date.now(); };

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

/** The details the account still owes the programme, kept in the booking app: its birth date and emergency contact. */
export function owed(): ("dob" | "emergency")[] {
  const p = S.prof;
  if (!p) return [];
  const out: ("dob" | "emergency")[] = [];
  if ("birth_date" in p && !p.birth_date) out.push("dob");
  if ("emergency" in p && !p.emergency) out.push("emergency");
  return out;
}
