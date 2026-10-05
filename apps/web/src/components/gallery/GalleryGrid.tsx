"use client";

import { useEffect, useRef, useState } from "react";
import { sized, srcSet } from "@/lib/img";
import { useDialogFocus } from "@/components/site/use-dialog-focus";

// The gallery grid: tag filters (once there are two tags), photos in columns, and a photo opens
// large with its caption. Escape or a tap closes it.
type Photo = { src: string; caption: string; tag: string };

export default function GalleryGrid({ photos, allLabel, closeLabel }: { photos: Photo[]; allLabel: string; closeLabel: string }) {
  const tags = [...new Set(photos.map((p) => p.tag).filter(Boolean))];
  const [tag, setTag] = useState("");
  const [open, setOpen] = useState<Photo | null>(null);
  // The photo opened takes the focus to its close button, keeps it inside, and gives it back to the
  // photo the visitor opened when it closes.
  const box = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  useDialogFocus(box, !!open, { first: closeBtn, back: opener });
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
            <button type="button" onClick={(e) => { opener.current = e.currentTarget; setOpen(p); }} aria-label={p.caption || `${i + 1}`}>
              <img src={sized(p.src, 640)} srcSet={srcSet(p.src)} sizes="(max-width: 700px) 50vw, 33vw" alt={p.caption} loading="lazy" />
            </button>
            {(p.caption || p.tag) && <figcaption>{p.tag && <span>{p.tag}</span>}{p.caption}</figcaption>}
          </figure>
        ))}
      </div>
      {open && (
        <div ref={box} className="pg-lightbox" role="dialog" aria-modal="true" aria-label={open.caption || allLabel} onClick={() => setOpen(null)}>
          <button ref={closeBtn} type="button" className="pg-close" aria-label={closeLabel} onClick={() => setOpen(null)}>×</button>
          <img src={sized(open.src, 1280)} alt={open.caption} />
          {open.caption && <p>{open.caption}</p>}
        </div>
      )}
    </>
  );
}
