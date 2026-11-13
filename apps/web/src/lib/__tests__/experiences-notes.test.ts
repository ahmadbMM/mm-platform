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

// The hand merge of main's bcb648e6 (2026-11-13). Yoga (ride_kind 'yoga', 2026-11-12) is a kind of its own in lib/rides.ts
// now: this booking flow has no step for it (lib/booking.ts NO_BIKE), so it lists none, as it lists no run and no race,
// and never reads one as a Saturday ride. A session's Arabic name (sessions.title_ar, 2026-11-13) names it on the Arabic
// page, as main's page and Events name it.
describe("the Experiences booking flow after main's yoga and Arabic names", () => {
  const comm = (id: string, kind: string, more: Record<string, unknown> = {}) => ({
    id, session_date: id.slice(0, 10), status: "open", event_kind: "community", ride_kind: kind, title: null, open_to_all: false, paid_ride: false,
    needs_approval: false, capacity: 15, bike_slots: '{"_time":"16:00 - 17:30"}', location: null, meet_url: null, ...more,
  });
  const YG = comm("2099-11-21-yg", "yoga", { location: "SILKDEER", meet_url: "https://maps.app.goo.gl/TfCSEPEPxA4C5f7d7" });
  const SAT = comm("2099-11-16", "saturday", { title: "Sunrise Ride", title_ar: " جولة الشروق ", needs_approval: true, capacity: 40, bike_slots: '{"_time":"05:45 - 06:15"}' });
  const flowOf = async (sessions: unknown[], locale: string) => {
    resetRides();
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes("/rpc/list_sessions")) return json(sessions);
      if (init?.method === "HEAD") return new Response(null, { status: 200, headers: { "content-range": "0-0/0" } });
      return json([]);
    }));
    const page = await ExperiencesPage({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({}) });
    return (findAll(page, BookingFlow)[0] as ReactElement<Parameters<typeof BookingFlow>[0]>).props;
  };

  it("lists no yoga date, under any card, and reads none as a Saturday ride", async () => {
    for (const locale of ["en", "ar"]) {
      const { events, routes } = await flowOf([YG, SAT, JCC], locale);
      expect(events.map((e) => e.key), locale).toEqual(["jcc", "community"]); // this flow's own order of cards
      const dates = events.flatMap((e) => e.sessions);
      expect(dates.map((s) => [s.id, s.kind]), locale).toEqual([["2099-11-08", "jcc"], ["2099-11-16", "saturday"]]);
      expect(Object.keys(routes ?? {}), locale).not.toContain("2099-11-21-yg");
      expect(JSON.stringify(events), locale).not.toMatch(/yoga|SILKDEER/i);
    }
    // with nothing but yoga on the books the community card has no date
    expect((await flowOf([YG], "en")).events.find((e) => e.key === "community")!.sessions).toEqual([]);
  });

  it("names a session by its Arabic name on the Arabic page alone", async () => {
    const name = async (locale: string) => (await flowOf([SAT], locale)).events.find((e) => e.key === "community")!.sessions[0].name;
    expect(await name("ar")).toBe("جولة الشروق");
    expect(await name("en")).toBe("Sunrise Ride");
    expect(await name("de")).toBe("Sunrise Ride");
    // no Arabic name given: the typed one, as before
    expect((await flowOf([{ ...SAT, title_ar: null }], "ar")).events.find((e) => e.key === "community")!.sessions[0].name).toBe("Sunrise Ride");
  });
});
