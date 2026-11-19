// How far booking attempts get (the research's row 20, 2026-11-10; rentals 20261111030000 reserve_funnel_add): one small
// event per step a booking attempt reaches, so the steps where riders stop can be counted. No account, no name, nothing
// typed: the step, the event's kind ("jcc", "community") and at most a refusal's code. An attempt is a random id kept in
// this page's memory alone, a new one once a booking is made; each step counts once per attempt. The events go in one
// call a few seconds after the last, and when the page is left; every failure is ignored (a database without the
// function included), and nothing waits for them.

export type FunnelEv = "list" | "pick" | "step2" | "step3" | "waiver" | "confirm" | "booked" | "waitlisted" | "refused" | "place_gone";
type Item = { ev: FunnelEv; k: string; d?: string };

let visit = "";
let seen = new Set<FunnelEv>();
const queue: Item[] = [];
let timer = 0;
let hooked = false;

/** 16 random characters of [A-Za-z0-9_-] (the database takes 12 to 32). */
function newVisit(): string {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function send() {
  window.clearTimeout(timer);
  if (!queue.length || !visit) return;
  const events = queue.splice(0, 20);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return;
  try {
    fetch(`${url}/rest/v1/rpc/reserve_funnel_add`, {
      method: "POST", keepalive: true,
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_src: "site", p_visit: visit, p_events: events }),
    }).catch(() => undefined);
  } catch { /* never in the rider's way */ }
}

/** A step this booking attempt reached; `k` the event's kind, `d` a refusal's code. */
export function funnel(ev: FunnelEv, k: string, d?: string): void {
  if (typeof window === "undefined") return;
  try {
    if (!visit) visit = newVisit();
    if (seen.has(ev)) return;
    seen.add(ev);
    queue.push({ ev, k: k.slice(0, 20), ...(d ? { d: d.slice(0, 40) } : {}) });
    if (!hooked) { hooked = true; window.addEventListener("pagehide", send); }
    window.clearTimeout(timer);
    timer = window.setTimeout(send, 4000);
  } catch { /* never in the rider's way */ }
}

/** A booking was made: what this attempt reached goes now, and the next booking is a new attempt. */
export function funnelDone(): void {
  if (typeof window === "undefined") return;
  send();
  visit = "";
  seen = new Set();
}
