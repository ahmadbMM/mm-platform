import { describe, expect, it } from "vitest";
import { REFERRAL_WORDS } from "@/components/account/Referral.words";
import { referralLink, referralOf, referralRodeOf, referrerBody, referrerReason } from "@/lib/referral";
import { badgeList } from "@/lib/ride-record";

const ans = (x: Record<string, unknown> = {}) => ({ ok: true, on: true, code: "K7MQ2X", days: 60, cap: 10, joined: 3, rode: 1, earned: 1, referred: false, can_enter: false, rewards: [], ...x });

describe("referrals", () => {
  it("reads customer_referral's answer, and counts only the free rides still to use", () => {
    const r = referralOf(ans({ rewards: [
      { code: "RF-1A2B3C4D", expires_at: "2099-12-05", used: false },
      { code: "RF-USED0001", expires_at: "2099-12-05", used: true },
      { code: "RF-OLD00001", expires_at: "2026-01-01", used: false },
    ] }), "2026-11-08");
    expect(r).toEqual({ code: "K7MQ2X", joined: 3, rode: 1, earned: 1, open: 1, referred: false, canEnter: false, pct: 50, welcome: null });
  });

  it("reads the friend's own code (rentals 20261108200000) while it can be used, and the percent", () => {
    const w = { code: "RW-K7MQ2X-4FZ", expires_at: "2099-12-05", used: false, pct: 40 };
    expect(referralOf(ans({ pct: 40, referred: true, welcome: w }), "2026-11-08")).toMatchObject({ pct: 40, welcome: { code: "RW-K7MQ2X-4FZ", expiresAt: "2099-12-05", pct: 40 } });
    expect(referralOf(ans({ welcome: { ...w, used: true } }), "2026-11-08")!.welcome).toBeNull();
    expect(referralOf(ans({ welcome: { ...w, expires_at: "2026-11-07" } }), "2026-11-08")!.welcome).toBeNull();
    expect(referralOf(ans({ welcome: { ...w, code: "<b>" } }), "2026-11-08")!.welcome).toBeNull();
    expect(referralOf(ans({ pct: 900 }), "2026-11-08")!.pct).toBe(50); // a figure the database never gives reads as its default
  });

  it("says the percent, the friend's code and the share message in every language", () => {
    for (const [l, w] of Object.entries(REFERRAL_WORDS)) {
      expect(w.how, l).toContain("{0}");
      expect(w.enterOk, l).toContain("{0}");
      for (const ph of ["{0}", "{1}", "{2}"]) { expect(w.msg, l).toContain(ph); expect(w.welcome, l).toContain(ph); }
    }
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

  it("counts the friends who rode for the Recruiter badge, switched on or not", () => {
    expect(referralRodeOf(ans({ rode: 3 }))).toBe(3);
    expect(referralRodeOf(ans({ on: false, rode: 2 }))).toBe(2);
    expect(referralRodeOf({ ok: false })).toBeNull();
    expect(referralRodeOf(null)).toBeNull();
  });

  it("puts Recruiter on the badge list as one ladder, levels at 1, 3, 5 and 10", () => {
    const data = { catalog: [], weeks: null, seasons: [], mine: [], referralRode: 3 };
    const r = badgeList([], new Map(), data, "2026-11-08", null).find((x) => x.lv?.some((y) => y.slug === "recruiter"));
    expect(r?.lv?.map((y) => y.slug)).toEqual(["recruiter", "recruiter_3", "recruiter_5", "recruiter_10"]);
    expect(r?.lvN).toBe(2);
    const none = badgeList([], new Map(), { ...data, referralRode: null }, "2026-11-08", null);
    expect(none.some((x) => x.slug === "recruiter" || x.lv?.some((y) => y.slug === "recruiter"))).toBe(false);
  });
});
