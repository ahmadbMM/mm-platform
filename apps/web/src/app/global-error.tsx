"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/report-error";

// The last resort: the page's layout itself failed, so there is no header, no language and no
// stylesheet. It replaces the whole document, in English and Arabic, and is logged like any
// other failure (api/log-error).
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => { reportError(error); }, [error]);
  const btn = { font: "inherit", fontWeight: 700, padding: "12px 22px", borderRadius: 999, border: "1px solid #1A1919", cursor: "pointer" } as const;
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#FBF9F4", color: "#1A1919", fontFamily: "system-ui, sans-serif", textAlign: "center", padding: 24 }}>
        <title>Micromobility</title>
        <main>
          <h1 style={{ fontSize: 28, margin: "0 0 8px" }}>Something went wrong</h1>
          <p lang="ar" dir="rtl" style={{ fontSize: 22, fontWeight: 700, margin: "0 0 16px" }}>حدث خطأ ما</p>
          <p style={{ color: "#57605A", margin: "0 0 24px" }}>Please try again in a moment. · <span lang="ar" dir="rtl">يرجى المحاولة مرة أخرى بعد قليل.</span></p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button type="button" onClick={() => retry()} style={{ ...btn, background: "#1A1919", color: "#FFFFFF" }}>Try again · حاول مرة أخرى</button>
            {/* A full page load on purpose: the layout itself failed, so nothing client-side is trusted. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" style={{ ...btn, background: "transparent", color: "#1A1919", textDecoration: "none" }}>Home · الرئيسية</a>
          </div>
        </main>
      </body>
    </html>
  );
}
