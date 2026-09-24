import { cookies } from "next/headers";
import { PREVIEW_COOKIE, isStaffToken } from "@/lib/preview";
import { HOME_BUILT, isComingSoon, loadSiteContent, type SiteContent } from "@/lib/site";

// What every page needs to know first: the staff content, whether the site is closed, and
// whether this visitor is staff previewing it. The proxy already sends visitors of a closed
// site to Coming Soon; pages use `previewing` for the preview bar.
export async function pageState(): Promise<{ content: SiteContent | null; closed: boolean; previewing: boolean }> {
  const content = await loadSiteContent();
  const closed = HOME_BUILT ? isComingSoon(content) : true;
  const previewing = closed ? await isStaffToken((await cookies()).get(PREVIEW_COOKIE)?.value) : false;
  return { content, closed, previewing };
}
