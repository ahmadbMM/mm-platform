"use client";

import type { ReactNode } from "react";

// A link to the Privacy Notice that opens it in the page's own dialog (NoticeDialog.tsx, by its
// id), so a visitor halfway through a form reads it without leaving the page. Its address stays
// /privacy, in a new tab, for a browser without script or a page without the dialog. While the
// dialog is open the page under it holds still, a tap outside it closes it, and on closing - by
// the button, Escape or that tap - the keyboard is back on this link.
export default function NoticeLink({ dialog, className, children }: { dialog: string; className?: string; children: ReactNode }) {
  function open(e: React.MouseEvent<HTMLAnchorElement>) {
    const d = document.getElementById(dialog);
    if (!(d instanceof HTMLDialogElement) || typeof d.showModal !== "function") return;
    e.preventDefault();
    if (d.open) return;
    const back = e.currentTarget;
    const root = document.documentElement;
    const overflow = root.style.overflow;
    // The dialog's box fills it edge to edge, so a click on the dialog itself is on its backdrop.
    const outside = (ev: MouseEvent) => { if (ev.target === d) d.close(); };
    d.addEventListener("click", outside);
    d.addEventListener("close", () => {
      d.removeEventListener("click", outside);
      root.style.overflow = overflow;
      back.focus();
    }, { once: true });
    root.style.overflow = "hidden";
    d.showModal();
  }
  return <a href="/privacy" target="_blank" rel="noopener" className={className} onClick={open}>{children}</a>;
}
