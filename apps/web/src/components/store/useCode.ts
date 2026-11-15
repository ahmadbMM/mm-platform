"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { CartItem } from "@/lib/cart";
import { CODE_KEY, giftCodeOf, giftCodeOk, promoCodeOf, promoCodeOk } from "@/lib/store-checkout";

// The cart and checkout's codes: a promo code (F67, only beside the discount licence) and a gift card to pay with (F57),
// each asked of the server before the order is placed (/api/store/promo, /api/store/gift-card) so the summary can say
// what they take; checkout's order is priced again by the database with them. And whether this device can pay with
// Apple Pay (F83). A promo code typed in the cart is carried to checkout for this visit (sessionStorage).

const readCode = (): string | null => { try { return window.sessionStorage.getItem(CODE_KEY); } catch { return null; } };
const keepCode = (c: string | null) => { try { if (c) window.sessionStorage.setItem(CODE_KEY, c); else window.sessionStorage.removeItem(CODE_KEY); } catch { /* not kept */ } };

type Answer = { ok?: boolean; error?: string; code?: string; discount?: number; balance?: number; expires?: string | null };
async function post(url: string, body: unknown, signal?: AbortSignal): Promise<Answer> {
  try {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal });
    return (await r.json().catch(() => ({ ok: false, error: "generic" }))) as Answer;
  } catch (e) {
    return { ok: false, error: e instanceof DOMException && e.name === "AbortError" ? "aborted" : "network" };
  }
}
/** A refusal that no change to the cart can turn round: the code is dropped. */
const FINAL = new Set(["promo", "promo_used", "licence"]);

export type Promo = {
  /** The code the database took for these lines, and what it takes off. */
  hit: { code: string; discount: number } | null;
  /** The code asked for (sent with the order even while it is being checked). */
  want: string | null;
  err: string; busy: boolean;
  apply: (raw: string) => void;
  remove: () => void;
};

// The code asked for, kept for the visit and shared by the cart and checkout (one copy, every user of it re-drawn)
const codeSubs = new Set<() => void>();
let codeCache: string | null | undefined;
const wantNow = () => (codeCache === undefined ? (codeCache = readCode()) : codeCache);
const wantSet = (c: string | null) => { codeCache = c; keepCode(c); codeSubs.forEach((l) => l()); };
const wantSub = (l: () => void) => { codeSubs.add(l); return () => { codeSubs.delete(l); }; };

/** A promo code for these lines (F67): checked when it is applied and again a moment after the lines change. Off (always
 *  empty) without the licence, and for gift cards alone (a code takes nothing off them: the database refuses it, and a
 *  code kept from the cart would refuse the order). */
export function usePromo(items: CartItem[], on: boolean): Promo {
  const key = JSON.stringify(items.map((i) => [i.variant, i.qty]));
  const stored = useSyncExternalStore(wantSub, wantNow, () => null);
  const want = on ? stored : null;
  const [hit, setHit] = useState<{ code: string; discount: number; for: string } | null>(null);
  const [fail, setFail] = useState<{ error: string; for: string; code: string } | null>(null);
  // one more each time Apply is pressed: the same code applied again after a refusal is asked again (the code asked for
  // and the lines are unchanged then, so nothing else starts the check, and it stayed "being checked" for good)
  const [round, setRound] = useState(0);
  useEffect(() => {
    if (!want) return;
    const ac = new AbortController();
    const lines = (JSON.parse(key) as [string, number][]).map(([variant, qty]) => ({ variant, qty }));
    const h = window.setTimeout(() => {
      void post("/api/store/promo", { code: want, items: lines }, ac.signal).then((b) => {
        if (b.error === "aborted") return;
        if (b.ok && typeof b.discount === "number") { setHit({ code: b.code ?? want, discount: b.discount, for: key }); setFail(null); return; }
        setHit(null);
        setFail({ error: b.error ?? "generic", for: key, code: want });
        if (FINAL.has(b.error ?? "")) wantSet(null);
      });
    }, 350);
    return () => { ac.abort(); window.clearTimeout(h); };
  }, [want, key, round]);
  const err = on && fail && (fail.for === key || FINAL.has(fail.error)) ? fail.error : "";
  const taken = on && hit && hit.code === want ? hit : null;
  return {
    hit: taken ? { code: taken.code, discount: taken.discount } : null,
    want,
    err,
    busy: !!want && !err && (!hit || hit.for !== key || hit.code !== want),
    apply: (raw) => {
      const c = promoCodeOf(raw);
      if (!promoCodeOk(c)) { setFail({ error: "promo", for: key, code: c }); return; }
      setFail(null); setHit(null); wantSet(c); setRound((r) => r + 1);
    },
    remove: () => { wantSet(null); setHit(null); setFail(null); },
  };
}

export type GiftCardPay = {
  card: { code: string; balance: number; expires: string | null } | null;
  err: string; busy: boolean;
  use: (raw: string) => Promise<void>;
  remove: () => void;
};

/** A gift card to pay with (F57): what it holds and until when, asked once when it is entered. */
export function useGiftCard(): GiftCardPay {
  const [card, setCard] = useState<GiftCardPay["card"]>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  return {
    card, err, busy,
    use: async (raw) => {
      const c = giftCodeOf(raw);
      if (!giftCodeOk(c)) { setErr("gift"); return; }
      setBusy(true); setErr("");
      const b = await post("/api/store/gift-card", { code: c });
      setBusy(false);
      if (b.ok && typeof b.balance === "number" && b.balance > 0) setCard({ code: b.code ?? c, balance: b.balance, expires: b.expires ?? null });
      else setErr(b.error ?? "gift");
    },
    remove: () => { setCard(null); setErr(""); },
  };
}

type ApplePayWindow = { ApplePaySession?: { canMakePayments?: () => boolean } };
const never = () => () => {};
/** Whether to offer Apple Pay here (F83): the site can take it (`on`: payments ready, the domain file in place) and this
 *  device has it (Safari with a card in Wallet). False on the server's drawing. */
export function useApplePay(on: boolean): boolean {
  return useSyncExternalStore(never, () => {
    if (!on) return false;
    try { return (window as unknown as ApplePayWindow).ApplePaySession?.canMakePayments?.() === true; } catch { return false; }
  }, () => false);
}
