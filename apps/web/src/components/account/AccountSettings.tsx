"use client";

import { useLocalize } from "@/i18n/TxProvider";
import { LOCALES } from "@/i18n/locales";
import { usePathname, useRouter } from "@/i18n/navigation";
import { T } from "./Account.text";

// The account's settings rows (the booking app's acc-settings): the language - every language the
// site speaks, each in its own name, the same choice the header's globe offers - and Sign out,
// which forgets this site's cookie only (the booking app stays signed in).
export default function AccountSettings({ locale }: { locale: string }) {
  const t = useLocalize(T);
  const router = useRouter();
  const path = usePathname();
  return (
    <section className="ac-panel ac-settings" aria-label={t.language}>
      <label className="ac-set-row">
        <span className="ac-set-k">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14.5 14.5 0 0 1 0 18a14.5 14.5 0 0 1 0-18" /></svg>
          {t.language}
        </span>
        <select value={locale} onChange={(e) => router.replace(path, { locale: e.target.value })}>
          {LOCALES.map((l) => <option key={l.code} value={l.code} lang={l.html}>{l.name}</option>)}
        </select>
      </label>
      <button type="button" className="ac-set-row ac-set-out" onClick={() => fetch("/api/account", { method: "DELETE" }).finally(() => window.location.reload())}>
        <span className="ac-set-k">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" /><path d="M10 16l-4-4 4-4M6 12h10" /></svg>
          {t.signOut}
        </span>
      </button>
    </section>
  );
}
