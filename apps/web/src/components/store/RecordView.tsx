"use client";

import { useEffect } from "react";
import { recentAdd } from "./useLists";

// Notes in this browser that its product page was looked at, for the store page's "Recently viewed" row (F08). It
// draws nothing. The product page renders it once: <RecordView slug={p.slug} />.
export default function RecordView({ slug }: { slug: string }) {
  useEffect(() => { recentAdd(slug); }, [slug]);
  return null;
}
