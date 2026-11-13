import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/petromin-pass/route";

// The user, 2026-11-13: "change petromin bookings to start with pm and petrolube to start with pl". The pass route takes
// one or two letters before the number: PM- Petromin, PL- Petrolube, D- Dukan, I- a guest, and the older P- bookings.
describe("POST /api/petromin-pass: the booking number", () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  const send = (bookingNo: string) => POST(new Request("https://micromobility.sa/api/petromin-pass", {
    method: "POST",
    headers: { origin: "https://micromobility.sa", "content-type": "application/json" },
    body: JSON.stringify({ bookingNo, phone: "+966512345678", sessionId: "2026-11-16-pw", lang: "en" }),
  }));

  it("passes PM-, PL-, D-, I- and P- numbers on to the booking app, upper case", async () => {
    const asked: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_u: string, o: RequestInit) => {
      asked.push(JSON.parse(String(o.body)));
      return new Response(JSON.stringify({ ok: false, error: "not found" }), { status: 404, headers: { "content-type": "application/json" } });
    }));
    for (const no of ["PM-001", "pl-012", "D-004", "I-003", "P-026"]) expect((await send(no)).status).toBe(404);
    expect(asked.map((b) => (b as { petromin: { bookingNo: string } }).petromin.bookingNo)).toEqual(["PM-001", "PL-012", "D-004", "I-003", "P-026"]);
  });

  it("refuses three letters, no dash or no number before asking anyone", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    for (const no of ["PMX-001", "PM001", "PM-", "PM-1"]) expect((await send(no)).status).toBe(400);
    expect(f).not.toHaveBeenCalled();
  });
});
