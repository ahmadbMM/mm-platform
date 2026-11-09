"use client";

import { useEffect, useRef, useState } from "react";

// The Google map under "Find us in Jeddah", put in only as the visitor scrolls near it: the
// iframe's own loading="lazy" still fetched ~330 KB of Maps script on a phone's first load. The
// box keeps the map's size meanwhile, so nothing moves when it arrives.
export default function LazyMap({ title, src }: { title: string; src: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      const t = setTimeout(() => setOn(true));
      return () => clearTimeout(t);
    }
    const io = new IntersectionObserver(([e]) => { if (e?.isIntersecting) { setOn(true); io.disconnect(); } }, { rootMargin: "400px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={box} className="hm-map">
      {on && <iframe title={title} src={src} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />}
    </div>
  );
}
