"use client";

import { useEffect, useRef, useState } from "react";

// The store's Google map on About. The map brings about a megabyte of Google's scripts, which held
// the page up, so a quiet placeholder of the same size stands in until the visitor asks for the map
// (nothing goes to Google before then). The map then takes the focus, the button having gone.
export default function MapEmbed({ src, title, label }: { src: string; title: string; label: string }) {
  const [on, setOn] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => { if (on) frame.current?.focus(); }, [on]);
  if (on) return <iframe ref={frame} className="ab-map" title={title} src={src} referrerPolicy="no-referrer-when-downgrade" />;
  return (
    <div className="ab-map ab-map-off">
      <button type="button" onClick={() => setOn(true)}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 21s-7-6.1-7-11.5a7 7 0 0 1 14 0C19 14.9 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" />
        </svg>
        {label}
      </button>
    </div>
  );
}
