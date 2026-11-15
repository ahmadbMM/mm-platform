import { localeInfo } from "@/i18n/locales";
import { latinRuns } from "@/lib/store-listing";

// A product's name on a right-to-left page (O11-B): its Latin model names ("DA54 MAX") each in a <bdi>, so they keep their
// own order inside Arabic or Urdu. A left-to-right page gets the text as it is.
export default function BidiText({ text, locale }: { text: string; locale: string }) {
  if (localeInfo(locale).dir !== "rtl") return <>{text}</>;
  return <>{latinRuns(text).map((r, i) => (r.latin ? <bdi key={i}>{r.text}</bdi> : r.text))}</>;
}
