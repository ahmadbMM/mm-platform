"use client";

import type { ReactNode } from "react";
import { useParams } from "next/navigation";

// The 404 of /bikes/<segment> (not-found.tsx beside it) is one of two pages, and only the address
// tells which: a sticker's number nobody has linked to a bike gets the tag page's own "we don't
// recognise this tag" (dark, full-screen, no header), anything else the site's own 404. A
// not-found page is given no params, so the choice is made here, where the address is known.
const segment = (p: ReturnType<typeof useParams>) => (typeof p?.category === "string" ? p.category : "");

export default function TagOr404({ tag, site }: { tag: ReactNode; site: ReactNode }) {
  return /^\d{1,6}$/.test(segment(useParams())) ? tag : site;
}

/** The sticker's number, as the address has it. */
export function TagCode() {
  return segment(useParams());
}
