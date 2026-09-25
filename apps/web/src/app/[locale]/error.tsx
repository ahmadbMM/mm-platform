"use client";

import { useEffect } from "react";
import { useL } from "@/i18n/TxProvider";
import { Link } from "@/i18n/navigation";
import { reportError } from "@/lib/report-error";
import "@/components/pages/pages.css";

// A page that failed while rendering. The visitor gets a way to try again and a way home, in
// their language (the layout above is still standing); the failure is logged on the server
// (api/log-error) with the digest Next gave it, which is how it is found in the Worker's logs.
export default function PageError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const tx = useL();
  useEffect(() => { reportError(error); }, [error]);
  return (
    <main id="mm-main" className="pg pg-missing" style={{ paddingTop: 96 }}>
      <h1>{tx("Something went wrong", "حدث خطأ ما")}</h1>
      <p className="pg-lead">{tx("Please try again in a moment.", "يرجى المحاولة مرة أخرى بعد قليل.")}</p>
      <p className="pg-actions">
        <button type="button" className="pg-btn" onClick={() => retry()}>{tx("Try again", "حاول مرة أخرى")}</button>
        <Link className="pg-btn line" href="/">{tx("Back to home", "العودة إلى الرئيسية")}</Link>
      </p>
    </main>
  );
}
