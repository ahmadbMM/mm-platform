import { createElement, type ComponentProps } from "react";
import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

const nav = createNavigation(routing);
export const { redirect, usePathname, useRouter } = nav;

// The site's links never prefetch (2026-10-05). Next prefetches every link that comes into view,
// and each prefetch is a request the Worker renders: Home in a desktop window sent 13 of them, every
// one a render costing more CPU than a Workers Free plan request is allowed (10 ms; DEPLOY.md,
// "Limits"), so a single visit used the CPU of fourteen pages and pushed the real page into error
// 1102. A click still opens the page inside the site; only the guess ahead of it is gone. A link
// that must prefetch can still ask: <Link prefetch>.
export function Link(props: ComponentProps<typeof nav.Link>) {
  return createElement(nav.Link, { prefetch: false, ...props });
}
