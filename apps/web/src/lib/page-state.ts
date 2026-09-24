import { cookies } from "next/headers";
import { PREVIEW_COOKIE, isStaffToken } from "@/lib/preview";
import { HOME_BUILT, hiddenPages, isComingSoon, loadSiteContent, pageOn, type SiteContent, type SwitchedPage } from "@/lib/site";

// What every page needs to know first: the staff content, whether the page is closed to
// visitors (the site is Coming Soon, or staff have not switched this page on), and whether this
// visitor is staff previewing it. The proxy already sends visitors of a closed page away; pages
// use `previewing` for the preview bar and `hidden` to leave switched-off pages out of the menus
// (staff previewing see every page).
export async function pageState(page?: SwitchedPage): Promise<{ content: SiteContent | null; closed: boolean; previewing: boolean; hidden: string[] }> {
  const content = await loadSiteContent();
  const closed = (HOME_BUILT ? isComingSoon(content) : true) || (page ? !pageOn(content, page) : false);
  const previewing = closed ? await isStaffToken((await cookies()).get(PREVIEW_COOKIE)?.value) : false;
  return { content, closed, previewing, hidden: previewing ? [] : hiddenPages(content) };
}
