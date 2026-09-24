import { describe, expect, it } from "vitest";
import { decodeSession, encodeSession, sameOrigin, upcomingBookings } from "../account-core";

describe("the account cookie", () => {
  it("keeps the account id and its session token", () => {
    const v = encodeSession({ id: "c_1~x y", token: "a1b2c3d4e5f6a7b8c9d0" });
    expect(decodeSession(v)).toEqual({ id: "c_1~x y", token: "a1b2c3d4e5f6a7b8c9d0" });
  });
  it("reads nothing from a malformed cookie", () => {
    for (const v of [undefined, "", "abc", "~a1b2c3d4e5f6a7b8c9d0", "c1~short", "c1~has space in token here", "%E0%A4%A~a1b2c3d4e5f6a7b8c9d0"]) expect(decodeSession(v)).toBeNull();
  });
});

describe("upcomingBookings", () => {
  const row = (o: Record<string, unknown>) => ({ session_id: "2026-09-27", session_date: "2026-09-27", status: "waiting", name: "Sara", type_preference: "Road", size: "M", ...o });
  it("groups the riders of each session still ahead, soonest first", () => {
    const got = upcomingBookings([
      row({ session_id: "2026-09-29", session_date: "2026-09-29" }), row({}), row({ name: "Omar", status: "waitlist" }),
      row({ session_id: "2026-09-20", session_date: "2026-09-20" }), row({ status: "cancelled", name: "Gone" }), row({ status: "done", name: "Done" }),
    ], "2026-09-24");
    expect(got.map((b) => [b.sessionId, b.riders.map((r) => `${r.name}:${r.status}`)])).toEqual([
      ["2026-09-27", ["Sara:booked", "Omar:waitlist"]], ["2026-09-29", ["Sara:booked"]],
    ]);
  });
});

describe("sameOrigin", () => {
  it("accepts only this site", () => {
    expect(sameOrigin("https://micromobility.sa", "https://micromobility.sa/api/account")).toBe(true);
    expect(sameOrigin("https://evil.example", "https://micromobility.sa/api/account")).toBe(false);
    expect(sameOrigin(null, "https://micromobility.sa/api/account")).toBe(false);
  });
});
