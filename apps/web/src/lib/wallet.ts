// The wallet on My Account (the booking app, 2026-11-02, rentals migration 20261102210000): the rider's balance
// and lines from customer_wallet, and what a ticket may pay from it. The server decides in the end
// (customer_wallet_pay); this only keeps a button off a card where it would be refused.
export type WalletLine = { id: number; amount: number; kind: string; at: string };
export type Wallet = { balance: number; rows: WalletLine[] };

/** customer_wallet's answer, or null for anything else (signed out, or a database without it): no card is drawn. */
export function walletOf(data: unknown): Wallet | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const balance = Number(d.balance);
  if (!Number.isFinite(balance)) return null;
  const rows = (Array.isArray(d.rows) ? d.rows : []).flatMap((r): WalletLine[] => {
    const x = (r ?? {}) as Record<string, unknown>;
    const amount = Number(x.amount);
    return Number.isFinite(amount) && typeof x.kind === "string" ? [{ id: Number(x.id) || 0, amount, kind: x.kind, at: String(x.created_at ?? "") }] : [];
  });
  return { balance, rows };
}

/** The line's name among the words, as the booking app's CW_RIDER_KIND. */
export function walletKindWord(kind: string): "topup" | "adjust" | "takeout" | "refund" | "spend" | "back" | "moved" | "sale" | "saleBack" {
  if (kind === "topup" || kind === "takeout" || kind === "refund" || kind === "spend" || kind === "sale") return kind;
  if (kind === "sale_back") return "saleBack";
  if (kind === "return") return "back";
  return kind === "merge_in" || kind === "merge_out" || kind === "unmerge" ? "moved" : "adjust";
}

type DueRow = { id: string; paid: boolean; status: string; price: number; payMethod?: string | null; walletPaid?: number };

/** What the Wallet switch on a ticket works on (the booking app's _cwPaySlot): its seated rows the desk has not been
 *  paid for, not on a ride staff approve, a race or a company's night. left: what is still to pay; used: what the
 *  wallet holds now. extras: the add-ons' cost, null when the inventory could not be read (no sum is offered: never a
 *  wrong one). A card part paid with add-ons cannot say whose they are: no sum either. */
export function walletDue(rows: DueRow[], kind: string | undefined, approval: boolean, extras: number | null): { ids: string[]; left: number; used: number } | null {
  if (approval || kind === "vlap" || kind === "arena" || kind === "petromin" || extras === null) return null;
  const open = rows.filter((r) => (r.status === "waiting" || r.status === "active") && (!r.paid || r.payMethod === "wallet"));
  if (!open.length || (extras > 0 && open.length !== rows.length)) return null;
  const cost = open.reduce((n, r) => n + r.price, 0) + extras;
  // a row the wallet paid whole may carry add-ons in its price's total: what it holds is on the row
  const used = open.reduce((n, r) => n + (r.walletPaid ?? 0), 0);
  const round = (n: number) => Math.round(n * 100) / 100;
  if (cost <= 0) return null;
  return { ids: open.map((r) => r.id), left: Math.max(0, round(cost - used)), used: round(used) };
}

const ID = /^[A-Za-z0-9_.:-]{1,64}$/;
/** The body of POST /api/account/wallet-pay: the switch's new state, and the bookings. */
export function walletPayBody(b: unknown): { ids: string[]; on: boolean } | null {
  const o = b && typeof b === "object" ? (b as { ids?: unknown; on?: unknown }) : null;
  const ids = o?.ids;
  if (!Array.isArray(ids) || !ids.length || ids.length > 20 || !ids.every((x) => typeof x === "string" && ID.test(x))) return null;
  if (typeof o?.on !== "boolean") return null;
  return { ids: ids as string[], on: o.on };
}
