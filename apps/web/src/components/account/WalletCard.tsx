import { sarText as sar } from "@/components/booking/Sar";
import { fmtDayDate } from "@/lib/tickets";
import { walletKindWord, type Wallet } from "@/lib/wallet";
import { walletWords } from "./Wallet.words";
import WalletTopUp from "@/components/pay/WalletTopUp";
import GiftToWallet from "@/components/store/GiftToWallet";

// The wallet on My Account (the booking app's #cw-mine): the balance and its last ten lines. Nothing here is
// staff's note: customer_wallet does not send it.
// giftCard: a store gift card can be added to the wallet (N20, 2026-11-18; staff switch store.giftCardWallet.on).
export default function WalletCard({ wallet, locale, topup = null, giftCard = false }: { wallet: Wallet; locale: string; topup?: { min: number; max: number } | null; giftCard?: boolean }) {
  const t = walletWords(locale);
  return (
    <section className="ac-sec ac-wal" aria-labelledby="ac-wal-h">
      <div className="ac-wal-top"><h2 id="ac-wal-h">{t.title}</h2><strong className="ac-wal-n"><bdi>{sar(wallet.balance)}</bdi></strong></div>
      <p className="ac-text">{t.note}</p>
      {topup && <WalletTopUp min={topup.min} max={topup.max} locale={locale} />}
      {giftCard && <GiftToWallet />}
      {wallet.rows.length ? (
        <ul className="ac-wal-rows">
          {wallet.rows.slice(0, 10).map((x) => (
            <li key={x.id}>
              <span>{t[walletKindWord(x.kind)]}<small>{fmtDayDate(new Date(new Date(x.at).getTime() + 3 * 3600e3).toISOString().slice(0, 10), locale)}</small></span>
              <strong className={x.amount > 0 ? "in" : ""}><bdi>{x.amount > 0 ? "+" : "\u2212"}{sar(Math.abs(x.amount))}</bdi></strong>
            </li>
          ))}
        </ul>
      ) : <p className="ac-text">{t.empty}</p>}
    </section>
  );
}
