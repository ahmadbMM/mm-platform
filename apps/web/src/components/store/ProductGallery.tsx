"use client";

import { useState } from "react";
import { useLocalize } from "@/i18n/TxProvider";
import { sized, srcSet } from "@/lib/img";
import { T } from "./Store.text";
import { NoPhoto } from "./bits";

// A product's photos: the large one in a fixed square (the page never moves while it loads; the whole
// product is shown, never cropped) and a thumbnail button for each, so it all works from the keyboard.
export default function ProductGallery({ images, alt }: { images: string[]; alt: string }) {
  const t = useLocalize(T);
  const [at, setAt] = useState(0);
  const main = images[Math.min(at, images.length - 1)];
  return (
    <div className="st-gallery">
      <figure className="st-gallery-main">
        {main ? <img key={main} src={sized(main, 1280)} srcSet={srcSet(main)} sizes="(max-width: 900px) 100vw, 50vw" alt={alt} fetchPriority={at === 0 ? "high" : undefined} /> : <NoPhoto />}
      </figure>
      {images.length > 1 && (
        <div className="st-thumbs">
          {images.map((u, i) => (
            <button key={u + i} type="button" aria-current={i === at ? "true" : undefined} aria-label={t.photo(i + 1, images.length)} onClick={() => setAt(i)}>
              <img src={sized(u, 640)} alt="" loading="lazy" decoding="async" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
