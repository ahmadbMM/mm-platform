import type { Metadata } from "next";
import { serverL } from "@/i18n/dicts";
import PreviewOpen from "./PreviewOpen";

// The staff preview's way in (PreviewOpen.tsx, which does the work in the browser). Its tab is
// named - it had an empty title - and it is never indexed.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: `${serverL(locale)("Staff preview", "معاينة الموظفين")} · Micromobility`, robots: { index: false, follow: false } };
}

export default function Preview() {
  return <PreviewOpen />;
}
