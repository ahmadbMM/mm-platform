"use client";

import { useEffect, useState } from "react";
import { bg } from "@/lib/img";

// The community photo wall: six staggered columns (three on a phone); a photo opens large.
const RATIOS = ["3 / 4", "2 / 3", "4 / 5", "3 / 5", "5 / 6"];

export default function PhotoWall({ photos, label, closeLabel }: { photos: string[]; label: string; closeLabel: string }) {
  const [open, setOpen] = useState("");
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen("");
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open]);
  const cols = Array.from({ length: 6 }, (_, c) => photos.map((p, i) => ({ p, i })).filter(({ i }) => i % 6 === c));
  return (
    <>
      <div className="hm-wall">
        {cols.map((col, c) => (
          <div className="hm-wall-col" key={c}>
            {col.map(({ p, i }) => (
              <button key={i} type="button" className="hm-tile" aria-label={`${label} ${i + 1}`} onClick={() => setOpen(p)}
                style={{ aspectRatio: RATIOS[i % RATIOS.length], backgroundImage: `url('${bg(p, 640)}')` }} />
            ))}
          </div>
        ))}
      </div>
      {open && (
        <div className="hm-lightbox" role="dialog" aria-modal="true" aria-label={label} onClick={() => setOpen("")}>
          <div style={{ backgroundImage: `url('${bg(open)}')` }} />
          <button type="button" aria-label={closeLabel} onClick={() => setOpen("")}>✕</button>
        </div>
      )}
    </>
  );
}
