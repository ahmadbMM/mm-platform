"use client";

// Shown only to staff previewing the site: what they see is not public yet.
export default function PreviewBar({ locale }: { locale: string }) {
  const ar = locale === "ar";
  return (
    <div className="mm-preview-bar" role="status" dir={ar ? "rtl" : "ltr"}>
      <span><strong>{ar ? "معاينة الموظفين" : "Staff preview"}</strong> · {ar ? "الزوار ما زالوا يرون «قريباً»" : "visitors still see Coming Soon"}</span>
      <button type="button" onClick={() => fetch("/api/preview", { method: "DELETE" }).finally(() => window.location.replace(`/${locale}`))}>
        {ar ? "إنهاء المعاينة" : "Exit preview"}
      </button>
    </div>
  );
}
