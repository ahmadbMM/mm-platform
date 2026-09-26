"use client";

import { useEffect, useState } from "react";
import { useL } from "@/i18n/TxProvider";

// Opened from the staff page: /preview#t=<access token>, and &to=/<page> to open one page (the
// staff page's Pages list); its old /en/preview and /ar/preview arrive here in that language. The token stays out of the address the server sees (a
// #fragment is never sent), is handed to /api/preview, and the browser is sent to the page -
// Home unless `to` names one of this site's pages: /club, or a page under one, as deep as a
// catalogue model's /bikes/road/carbon/some-model (letters, digits, hyphens and underscores only).
export default function Preview() {
  const tx = useL();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(window.location.hash.slice(1));
    const t = q.get("t") || "";
    const to = /^\/[a-z][a-z0-9_-]{0,40}(?:\/[a-z0-9][a-z0-9_-]{0,79}){0,3}$/.test(q.get("to") || "") ? q.get("to") : "";
    history.replaceState(null, "", window.location.pathname); // do not leave the token in history
    fetch("/api/preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: t }) })
      .then((r) => (r.ok ? window.location.replace(to || "/") : setFailed(true)))
      .catch(() => setFailed(true));
  }, []);
  return (
    <main style={{ minHeight: "100svh", display: "grid", placeItems: "center", background: "#0d100d", color: "#fbf9f4", fontFamily: "var(--cs-font-en), var(--cs-font-ar), sans-serif", padding: 24, textAlign: "center" }}>
      <p style={{ maxWidth: 420, lineHeight: 1.6 }}>
        {failed
          ? tx("This preview link has expired. Open it again from the staff page.", "انتهت صلاحية رابط المعاينة. افتحه مجدداً من صفحة الموظفين.")
          : tx("Opening the preview…", "جارٍ فتح المعاينة…")}
      </p>
    </main>
  );
}
