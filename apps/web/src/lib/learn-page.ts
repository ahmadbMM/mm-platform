import { HOME_BUILT, isComingSoon, type SiteContent } from "./site";

// Which frame the Learn to ride sign-up (/experiences/learn) is drawn in. The page opens whatever
// the site's state (proxy.ts, LEARN_PAGE; owner, 2026-09-28: usable now, the way the registration
// forms are), so while the site is Coming Soon it must not lead into the closed site:
//   - "alone": the site is Coming Soon (the Experiences switch does not matter) - a page of its
//     own, with the logo, the language and the Privacy Notice, and no header or footer;
//   - "site": the site is open - the header and footer every page has. Staff previewing the
//     closed site see it this way too, as the site will look once it opens.
export type LearnFrame = "alone" | "site";

export function learnFrame(content: SiteContent | null, previewing: boolean, homeBuilt: boolean = HOME_BUILT): LearnFrame {
  return isComingSoon(content, homeBuilt) && !previewing ? "alone" : "site";
}
