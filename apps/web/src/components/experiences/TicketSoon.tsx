"use client";

import { useLocalize } from "@/i18n/TxProvider";
import { soonDays } from "@/lib/sx-b6";
import { T } from "./sx-B6.text";

// "In 3 days" beside the absolute date on a ticket (EF34; the user, 2026-11-18: "do all"), from two days ahead (Today and
// Tomorrow are said already) to sixty; never alone, always before the date itself.
export default function TicketSoon({ date, today }: { date: string; today: string }) {
  const t = useLocalize(T);
  const n = soonDays(date, today);
  return n == null ? null : <><strong className="tk-dw sx6-soon">{t.inDays(n)}</strong><span className="tk-sep" aria-hidden="true">·</span></>;
}
