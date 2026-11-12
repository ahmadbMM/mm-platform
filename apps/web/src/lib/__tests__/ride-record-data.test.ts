import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadRecordSessions } from "../ride-record-data";

// The sessions My Account's record reads (bug hunt 2026-11-11): a community ride as the booking app's _isCommunity
// reads it, so the National Day ride (snd96, made with event_kind 'community') is neither a free ride nor one staff
// approve - as _isFreeRide and _isApprovalRide have it - and counts on both account pages alike.
const json = (v: unknown) => new Response(JSON.stringify(v), { status: 200, headers: { "content-type": "application/json" } });

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
});
afterEach(() => vi.unstubAllEnvs());

describe("the record's sessions", () => {
  it("read the National Day ride as neither free nor approved, a Saturday ride as both", async () => {
    const rows = [
      { id: "2026-09-23-nd", ride_kind: "snd96", event_kind: "community", paid_ride: false, needs_approval: true, bike_slots: null },
      { id: "2026-10-24", ride_kind: "saturday", event_kind: "community", paid_ride: false, needs_approval: true, bike_slots: null },
    ];
    const f = vi.fn(async () => json(rows));
    const m = await loadRecordSessions(rows.map((r) => r.id), null, f as unknown as typeof fetch);
    expect(m.get("2026-09-23-nd")).toMatchObject({ kind: "snd96", freeRide: false, approval: false });
    expect(m.get("2026-10-24")).toMatchObject({ kind: "saturday", freeRide: true, approval: true });
  });
});
