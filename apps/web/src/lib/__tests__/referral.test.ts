import { describe, expect, it } from "vitest";
import { REFERRAL_WORDS } from "@/components/account/Referral.words";
import { referralLink, referralOf, referrerBody, referrerReason } from "@/lib/referral";

const ans = (x: Record<string, unknown> = {}) => ({ ok: true, on: true, code: "K7MQ2X", days: 60, cap: 10, joined: 3, rode: 1, earned: 1, referred: false, can_enter: false, rewards: [], ...x });

describe("referrals", () => {
  it("reads customer_referral's answer, and counts only the free rides still to use", () => {
    const r = referralOf(ans({ rewards: [
      { code: "RF-1A2B3C4D", expires_at: "2099-12-05", used: false },
      { code: "RF-USED0001", expires_at: "2099-12-05", used: true },
      { code: "RF-OLD00001", expires_at: "2026-01-01", used: false },
    ] }), "2026-11-08");
    expect(r).toEqual({ code: "K7MQ2X", joined: 3, rode: 1, earned: 1, open: 1, referred: false, canEnter: false });
  });

  it("draws no card when switched off, refused, without a code, or for anything else", () => {
    expect(referralOf(ans({ on: false }), "2026-11-08")).toBeNull();
    expect(referralOf({ ok: false }, "2026-11-08")).toBeNull();
    expect(referralOf(ans({ code: null }), "2026-11-08")).toBeNull();
    expect(referralOf(ans({ code: "<b>" }), "2026-11-08")).toBeNull();
    expect(referralOf([], "2026-11-08")).toBeNull();
    expect(referralOf(null, "2026-11-08")).toBeNull();
  });

  it("shares the booking app's Create account page with the code", () => {
    const u = new URL(referralLink("K7MQ2X", "ar"));
    expect(u.pathname).toBe("/signup");
    expect(u.searchParams.get("ref")).toBe("K7MQ2X");
    expect(u.searchParams.get("lang")).toBe("ar");
  });

  it("takes a typed code and names the database's refusals", () => {
    expect(referrerBody({ code: "  k7mq2x " })).toEqual({ code: "k7mq2x" });
    expect(referrerBody({ code: "" })).toBeNull();
    expect(referrerBody({ code: "x".repeat(61) })).toBeNull();
    expect(referrerBody({ code: 7 })).toBeNull();
    expect(referrerReason({ ok: true })).toBe("ok");
    expect(referrerReason({ ok: false, reason: "not_new" })).toBe("not_new");
    expect(referrerReason({ ok: false, reason: "drop table" })).toBe("invalid");
    expect(referrerReason(null)).toBe("invalid");
  });

  it("has every word in every language, with the placeholders", () => {
    const en = REFERRAL_WORDS.en;
    for (const [l, w] of Object.entries(REFERRAL_WORDS)) {
      expect(Object.keys(w), l).toEqual(Object.keys(en));
      for (const v of Object.values(w)) expect(v.trim(), l).not.toBe("");
      expect(w.hasFree, l).toContain("{0}");
      expect(w.msg, l).toContain("{0}"); expect(w.msg, l).toContain("{1}");
    }
  });
});
