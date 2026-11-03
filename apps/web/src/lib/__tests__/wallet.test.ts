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
    expect(["topup", "takeout", "refund", "spend", "return", "merge_in", "merge_out", "unmerge", "adjust", "sale", "sale_back"].map(walletKindWord))
      .toEqual(["topup", "takeout", "refund", "spend", "back", "moved", "moved", "moved", "adjust", "sale", "saleBack"]);
  });
  it("works on the seated rows the desk has not been paid for, and says what is left", () => {
    expect(walletDue([row("a"), row("b", { paid: true, payMethod: "card" } as never), row("c", { status: "waitlist" })], "jcc", false, 0)).toEqual({ ids: ["a"], left: 50, used: 0 });
    expect(walletDue([row("a"), row("b")], "jcc", false, 20)).toEqual({ ids: ["a", "b"], left: 120, used: 0 });
    expect(walletDue([row("a", { price: 80, walletPaid: 50 } as never)], "jcc", false, 0)).toEqual({ ids: ["a"], left: 30, used: 50 });
    expect(walletDue([row("a", { price: 80, paid: true, payMethod: "wallet", walletPaid: 80 } as never)], "jcc", false, 0)).toEqual({ ids: ["a"], left: 0, used: 80 });
  });
  it("offers nothing where it would be refused or the sum is not known", () => {
    for (const k of ["vlap", "arena", "petromin"]) expect(walletDue([row("a")], k, false, 0)).toBeNull();
    expect(walletDue([row("a")], "saturday", true, 0)).toBeNull();
    expect(walletDue([row("a")], "jcc", false, null)).toBeNull();
    expect(walletDue([row("a"), row("b", { paid: true, payMethod: "card" } as never)], "jcc", false, 20)).toBeNull();
    expect(walletDue([row("a", { price: 0 })], "jcc", false, 0)).toBeNull();
  });
  it("takes the switch's state and a list of booking ids, and nothing else", () => {
    expect(walletPayBody({ ids: ["q1", "q-2"], on: true })).toEqual({ ids: ["q1", "q-2"], on: true });
    expect(walletPayBody({ ids: ["q1"], on: false })).toEqual({ ids: ["q1"], on: false });
    for (const b of [null, {}, { ids: [] , on: true }, { ids: "q1", on: true }, { ids: ["q1"] }, { ids: ["a b"], on: true }, { ids: Array(21).fill("q"), on: true }]) expect(walletPayBody(b)).toBeNull();
  });
  it("has every word in every language, and the placeholders kept", () => {
    const en = WALLET_WORDS.en;
    for (const w of Object.values(WALLET_WORDS)) {
      expect(Object.keys(w)).toEqual(Object.keys(en));
      for (const v of Object.values(w)) expect(v.trim()).not.toBe("");
      expect(w.have).toContain("{0}"); expect(w.usingAll).toContain("{0}");
      expect(w.usingLeft).toContain("{0}"); expect(w.usingLeft).toContain("{1}");
    }
  });
});
