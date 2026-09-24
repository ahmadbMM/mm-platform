"use client";

// Shown only to staff previewing a page visitors do not get yet: the whole site while it is
// Coming Soon, or a page staff have not switched on.
export default function PreviewBar({ locale }: { locale: string }) {
  const ar = locale === "ar";
  return (
    <div className="mm-preview-bar" role="status" dir={ar ? "rtl" : "ltr"}>
      <span><strong>{ar ? "معاينة الموظفين" : "Staff preview"}</strong> · {ar ? "الزوار لا يرون هذه الصفحة بعد" : "visitors don't see this page yet"}</span>
      <button type="button" onClick={() => fetch("/api/preview", { method: "DELETE" }).finally(() => window.location.replace("/"))}>
        {ar ? "إنهاء المعاينة" : "Exit preview"}
      </button>
    </div>
  );
}
