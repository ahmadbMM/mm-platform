import { afterEach, describe, expect, it, vi } from "vitest";
import { isSignedOut, rpc, whenSignedOut } from "../src/client/api";

// The page's "who am I" without a session comes back as {signedIn: false}, a 200 (no console error
// on every signed-out load). To the page that is a session that ended: BAD_TOKEN, and the signed-out
// handler runs, exactly as for a 401.
const answer = (status: number, body: unknown) => vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })));
afterEach(() => vi.unstubAllGlobals());

describe("signed out", () => {
  it("reads {signedIn: false} as an ended session, and calls the signed-out handler", async () => {
    const out = vi.fn();
    whenSignedOut(out);
    answer(200, { signedIn: false });
    expect(await rpc("vendor_me")).toEqual({ ok: false, code: "BAD_TOKEN", status: 200 });
    expect(out).toHaveBeenCalledTimes(1);
    answer(401, { error: "BAD_TOKEN" });
    expect(await rpc("vendor_calendar")).toEqual({ ok: false, code: "BAD_TOKEN", status: 401 });
    expect(out).toHaveBeenCalledTimes(2);
  });

  it("passes everything else through", async () => {
    const out = vi.fn();
    whenSignedOut(out);
    const me = { user: { id: 7 }, venue: {}, tier: {}, today: "2026-10-05" };
    answer(200, me);
    expect(await rpc("vendor_me")).toEqual({ ok: true, data: me });
    answer(200, [{ day: "2026-10-10" }]);
    expect(await rpc("vendor_calendar")).toEqual({ ok: true, data: [{ day: "2026-10-10" }] });
    expect(out).not.toHaveBeenCalled();
    expect([isSignedOut(null), isSignedOut([]), isSignedOut({ signedIn: true }), isSignedOut({ signedIn: false })]).toEqual([false, false, false, true]);
  });
});
