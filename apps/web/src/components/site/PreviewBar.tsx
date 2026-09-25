"use client";

import { useL } from "@/i18n/TxProvider";
import { localeInfo } from "@/i18n/locales";

// Shown only to staff previewing a page visitors do not get yet: the whole site while it is
// Coming Soon, or a page staff have not switched on.
export default function PreviewBar({ locale }: { locale: string }) {
  const tx = useL();
  return (
    <div className="mm-preview-bar" role="status" dir={localeInfo(locale).dir}>
      <span><strong>{tx("Staff preview", "معاينة الموظفين")}</strong> · {tx("visitors don't see this page yet", "الزوار لا يرون هذه الصفحة بعد")}</span>
      <button type="button" onClick={() => fetch("/api/preview", { method: "DELETE" }).finally(() => window.location.replace("/"))}>
        {tx("Exit preview", "إنهاء المعاينة")}
      </button>
    </div>
  );
}
