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
export function walletKindWord(kind: string): "topup" | "adjust" | "takeout" | "refund" | "spend" | "back" | "moved" {
  if (kind === "topup" || kind === "takeout" || kind === "refund" || kind === "spend") return kind;
  if (kind === "return") return "back";
  return kind === "merge_in" || kind === "merge_out" || kind === "unmerge" ? "moved" : "adjust";
}

type DueRow = { id: string; paid: boolean; status: string; price: number };

/** What a ticket can pay from the wallet (the booking app's _cwPaySlot): its seated, unpaid rows, not on a ride staff
 *  approve, a race or a company's night. extras: the add-ons' cost, null when the inventory could not be read
 *  (then no sum is offered: never a wrong one). A card part paid with add-ons cannot say whose they are: no sum either. */
export function walletDue(rows: DueRow[], kind: string | undefined, approval: boolean, extras: number | null): { ids: string[]; amount: number } | null {
  if (approval || kind === "vlap" || kind === "arena" || kind === "petromin" || extras === null) return null;
  const due = rows.filter((r) => !r.paid && (r.status === "waiting" || r.status === "active"));
  if (!due.length || (extras > 0 && due.length !== rows.length)) return null;
  const amount = Math.round((due.reduce((n, r) => n + r.price, 0) + extras) * 100) / 100;
  return amount > 0 ? { ids: due.map((r) => r.id), amount } : null;
}

const ID = /^[A-Za-z0-9_.:-]{1,64}$/;
/** The body of POST /api/account/wallet-pay. */
export function walletPayBody(b: unknown): string[] | null {
  const ids = b && typeof b === "object" ? (b as { ids?: unknown }).ids : null;
  if (!Array.isArray(ids) || !ids.length || ids.length > 20 || !ids.every((x) => typeof x === "string" && ID.test(x))) return null;
  return ids as string[];
}
