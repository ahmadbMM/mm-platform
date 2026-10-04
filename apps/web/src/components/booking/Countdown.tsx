"use client";

import { useEffect, useState } from "react";
import { cdLine, type CdKey, type CountdownText } from "@/lib/tickets";

// The countdown on today's ticket (the booking app's _cdHtml / _cdTick): to bike collection (or the
// gathering), then to the start, rewritten every 30 seconds and gone once the start has passed.
// The server draws it at its own clock; the browser takes over with the rider's. Its line is
// lib/tickets.ts cdLine, which the ticket (on the server) also reads.

const Clock = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
  </svg>
);

export default function Countdown({ moments, now: first, t }: { moments: [number, CdKey][]; now: number; t: CountdownText }) {
  const [now, setNow] = useState(first);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0); // the rider's own clock as soon as the page is theirs
    const id = setInterval(tick, 30000);
    return () => { clearTimeout(first); clearInterval(id); };
  }, []);
  const line = cdLine(moments, now, t);
  if (!line) return null;
  return <p className="tk-cd"><Clock /><span suppressHydrationWarning>{line}</span></p>;
}
