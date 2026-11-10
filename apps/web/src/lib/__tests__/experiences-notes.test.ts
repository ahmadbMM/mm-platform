import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement } from "react";
import BookingFlow from "@/components/experiences/BookingFlow";
import { resetRides } from "../rides";
import { resetSiteContent } from "../site";
import ExperiencesPage from "../../app/[locale]/experiences/page";

// The Experiences booking flow's event cards say the caps the database enforces through {riders} and {seats} (jccNote,
// evNote), filled as main's Experiences fills them: left as written they reached the rider as "{riders}" (bug hunt
// 2026-11-10, web13-1). No account cookie here: cookies() holds none.
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
const JCC = { id: "2099-11-08", session_date: "2099-11-08", day: "Sunday", status: "open", event_kind: null, ride_kind: null, title: null, capacity: 40, bike_slots: '{"_time":"21:00 - 23:00"}', location: "JCC", meet_url: null };
const EV = { id: "2099-11-09-ev", session_date: "2099-11-09", day: "Monday", status: "open", event_kind: "community", ride_kind: "event", title: "Talk", open_to_all: true, paid_ride: true, price: 40, capacity: 30, bike_slots: '{"_time":"19:00 - 21:00"}' };

function findAll(n: unknown, type: unknown, out: ReactElement[] = []): ReactElement[] {
  if (Array.isArray(n)) { for (const x of n) findAll(x, type, out); return out; }
  if (!isValidElement(n)) return out;
  if (n.type === type) out.push(n);
  findAll((n.props as { children?: unknown }).children, type, out);
  return out;
}

beforeEach(() => {
  resetRides(); resetSiteContent();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (String(url).includes("/rpc/list_sessions")) return json([JCC, EV]);
    if (init?.method === "HEAD") return new Response(null, { status: 200, headers: { "content-range": "0-0/0" } });
    return json([]);
  }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("the Experiences booking flow's event cards", () => {
  for (const locale of ["en", "ar", "de"]) {
    it(`say the caps, never the placeholders (${locale})`, async () => {
      const page = await ExperiencesPage({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({}) });
      const flow = findAll(page, BookingFlow)[0] as ReactElement<Parameters<typeof BookingFlow>[0]>;
      const events = flow.props.events;
      expect(events.map((e) => e.key)).toEqual(expect.arrayContaining(["jcc", "event"]));
      for (const e of events) expect(e.note).not.toMatch(/\{(riders|seats)\}/);
      if (locale === "en") {
        expect(events.find((e) => e.key === "jcc")!.note).toMatch(/^Up to 3 riders per account/);
        expect(events.find((e) => e.key === "event")!.note).toContain("Up to 5 seats per booking");
      }
    });
  }
});
