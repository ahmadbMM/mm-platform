"use client";

import { useEffect } from "react";

// Photos drawn as CSS backgrounds below the first screen are fetched only as the visitor nears
// them. The page writes such a photo as data-bg (the whole background-image value) and this sets
// it once the element comes within a screen or so; an element that is not drawn at all (the build
// story on a phone) never asks for its photos. It replaced 21 photos - 3.2 MB on a desktop - that
// every visitor downloaded before scrolling. Client components that draw later are picked up too.
export default function LazyBackgrounds() {
  useEffect(() => {
    const pending = () => Array.from(document.querySelectorAll<HTMLElement>("[data-bg]"));
    const show = (el: HTMLElement) => {
      const v = el.dataset.bg;
      if (v) el.style.backgroundImage = v;
      el.removeAttribute("data-bg");
    };
    if (!("IntersectionObserver" in window)) {
      pending().forEach(show);
      return;
    }
    const io = new IntersectionObserver((seen) => {
      for (const e of seen) if (e.isIntersecting) { show(e.target as HTMLElement); io.unobserve(e.target); }
    }, { rootMargin: "900px 0px" });
    const watch = () => pending().forEach((el) => io.observe(el));
    watch();
    const mo = new MutationObserver(watch);
    mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-bg"] });
    return () => { io.disconnect(); mo.disconnect(); };
  }, []);
  return null;
}
