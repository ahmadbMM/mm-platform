"use client";

import { useSaved } from "./useLists";
import { useHydrated } from "./useCart";
import ShareButton from "./sx-B2-share";

// N01 on /store/saved (the "do all" build of 2026-11-18): Share beside the heading sends the list as a link
// (/store/saved?list=max,helmet), which opens it for the friend as it is, their own saved list untouched. Shown once the
// page runs in the browser and the list has something in it.
export default function SavedShare({ title }: { title: string }) {
  const slugs = useSaved();
  const ready = useHydrated();
  if (!ready || !slugs.length) return null;
  return <ShareButton title={title} url={() => `${window.location.origin}/store/saved?list=${slugs.map(encodeURIComponent).join(",")}`} />;
}
