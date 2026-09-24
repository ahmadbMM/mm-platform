"use client";

import { useEffect, useState } from "react";

// The gallery grid: tag filters (once there are two tags), photos in columns, and a photo opens
// large with its caption. Escape or a tap closes it.
type Photo = { src: string; caption: string; tag: string };

export default function GalleryGrid({ photos, allLabel, closeLabel }: { photos: Photo[]; allLabel: string; closeLabel: string }) {
  const tags = [...new Set(photos.map((p) => p.tag).filter(Boolean))];
  const [tag, setTag] = useState("");
  const [open, setOpen] = useState<Photo | null>(null);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open]);
  const shown = tag ? photos.filter((p) => p.tag === tag) : photos;
  return (
    <>
      {tags.length > 1 && (
        <div className="pg-chips" role="group" aria-label={allLabel}>
          {["", ...tags].map((t) => (
            <button key={t || "all"} type="button" aria-pressed={tag === t} onClick={() => setTag(t)}>{t || allLabel}</button>
          ))}
        </div>
      )}
      <div className="pg-grid">
        {shown.map((p, i) => (
          <figure key={p.src + i}>
            <button type="button" onClick={() => setOpen(p)} aria-label={p.caption || `${i + 1}`}>
              <img src={p.src} alt={p.caption} loading="lazy" />
            </button>
            {(p.caption || p.tag) && <figcaption>{p.tag && <span>{p.tag}</span>}{p.caption}</figcaption>}
          </figure>
        ))}
      </div>
      {open && (
        <div className="pg-lightbox" role="dialog" aria-modal="true" aria-label={open.caption || allLabel} onClick={() => setOpen(null)}>
          <button type="button" className="pg-close" aria-label={closeLabel} onClick={() => setOpen(null)}>×</button>
          <img src={open.src} alt={open.caption} />
          {open.caption && <p>{open.caption}</p>}
        </div>
      )}
    </>
  );
}
