import { describe, expect, it } from "vitest";
import { WALLET_WORDS } from "@/components/account/Wallet.words";
import { walletDue, walletKindWord, walletOf, walletPayBody } from "@/lib/wallet";

const row = (id: string, x: Partial<{ paid: boolean; status: string; price: number }> = {}) => ({ id, paid: false, status: "waiting", price: 50, ...x });

describe("the wallet", () => {
  it("reads the function's answer, and nothing else draws a card", () => {
    expect(walletOf({ balance: "120.00", rows: [{ id: 1, amount: "120.00", kind: "refund", created_at: "2026-11-02T10:00:00Z" }] }))
      .toEqual({ balance: 120, rows: [{ id: 1, amount: 120, kind: "refund", at: "2026-11-02T10:00:00Z" }] });
    expect(walletOf(null)).toBeNull();
    expect(walletOf({ code: "PGRST202" })).toBeNull();
  });
  it("names every line the database writes", () => {
    expect(["topup", "takeout", "refund", "spend", "return", "merge_in", "merge_out", "unmerge", "adjust"].map(walletKindWord))
      .toEqual(["topup", "takeout", "refund", "spend", "back", "moved", "moved", "moved", "adjust"]);
  });
  it("offers what the rider owes, on seated unpaid rows only", () => {
    expect(walletDue([row("a"), row("b", { paid: true }), row("c", { status: "waitlist" })], "jcc", false, 0)).toEqual({ ids: ["a"], amount: 50 });
    expect(walletDue([row("a"), row("b")], "jcc", false, 20)).toEqual({ ids: ["a", "b"], amount: 120 });
  });
  it("offers nothing where it would be refused or the sum is not known", () => {
    for (const k of ["vlap", "arena", "petromin"]) expect(walletDue([row("a")], k, false, 0)).toBeNull();
    expect(walletDue([row("a")], "saturday", true, 0)).toBeNull();
    expect(walletDue([row("a")], "jcc", false, null)).toBeNull();
    expect(walletDue([row("a"), row("b", { paid: true })], "jcc", false, 20)).toBeNull();
    expect(walletDue([row("a", { price: 0 })], "jcc", false, 0)).toBeNull();
  });
  it("takes a list of booking ids and nothing else", () => {
    expect(walletPayBody({ ids: ["q1", "q-2"] })).toEqual(["q1", "q-2"]);
    for (const b of [null, {}, { ids: [] }, { ids: "q1" }, { ids: ["a b"] }, { ids: Array(21).fill("q") }]) expect(walletPayBody(b)).toBeNull();
  });
  it("has every word in every language, and the placeholders kept", () => {
    const en = WALLET_WORDS.en;
    for (const w of Object.values(WALLET_WORDS)) {
      expect(Object.keys(w)).toEqual(Object.keys(en));
      for (const v of Object.values(w)) expect(v.trim()).not.toBe("");
      expect(w.pay).toContain("{0}"); expect(w.short).toContain("{0}");
      expect(w.ask).toContain("{0}"); expect(w.ask).toContain("{1}");
    }
  });
});
