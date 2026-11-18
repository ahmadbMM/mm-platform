import { cookies } from "next/headers";
import { PREVIEW_COOKIE, isStaffToken } from "@/lib/preview";
import { hiddenPages, isComingSoon, loadSiteContent, pageOn, siteCanOpen, type SiteContent, type SwitchedPage } from "@/lib/site";

// What every page needs to know first: the staff content, whether the page is closed to
// visitors (the site is Coming Soon, or staff have not switched this page on), and whether this
// visitor is staff previewing it. The proxy already sends visitors of a closed page away; pages
// use `previewing` for the preview bar (on a page visitors do not get yet) and `hidden` to leave
// switched-off pages out of the menus (staff previewing see every page, on an open page too: bug hunt
// 2026-11-18). A request with the preview cookie is never kept at the edge (lib/page-cache.ts).
export async function pageState(page?: SwitchedPage): Promise<{ content: SiteContent | null; closed: boolean; previewing: boolean; hidden: string[] }> {
  const content = await loadSiteContent();
  const closed = (siteCanOpen() ? isComingSoon(content) : true) || (page ? !pageOn(content, page) : false);
  const off = hiddenPages(content);
  const staff = closed || off.length ? await isStaffToken((await cookies()).get(PREVIEW_COOKIE)?.value) : false;
  return { content, closed, previewing: closed && staff, hidden: staff ? [] : off };
}
