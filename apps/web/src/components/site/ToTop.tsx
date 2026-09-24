"use client";

// The footer's back-to-top button (SiteFooter.dc.html).
export default function ToTop({ label }: { label: string }) {
  return (
    <button type="button" className="mm-foot-totop" aria-label={label} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
    </button>
  );
}
