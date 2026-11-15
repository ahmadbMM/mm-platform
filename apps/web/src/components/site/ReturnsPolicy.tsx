import { helpSchema } from "@/content/pages/help";
import { asLocale, resolvePage } from "@/lib/content";
import { returnsAnswers } from "@/lib/policies";
import { POLICY } from "@/lib/store-policy";
import type { SiteContent } from "@/lib/site";
import { serverLocalize } from "@/i18n/dicts";
import { PolicyIcon } from "./PolicyIcons";

// The store's returns policy (CONTRACTS.md section 8): the one sentence first, word for word as everywhere a return is
// promised, then the Help page's Returns answers as staff keep them (Website > Help), read whether or not the Help page is
// switched on. The Returns page (/returns, L12) draws it; a product page's returns pop-up (X07) can draw the same.
export function returnsPolicy(content: SiteContent | null, locale: string): { sentence: string; answers: { q: string; a: string }[] } {
  const h = resolvePage(helpSchema, content, asLocale(locale));
  return { sentence: serverLocalize(POLICY, locale).returnSentence, answers: returnsAnswers(h.topics.returns) };
}

export default function ReturnsPolicy({ sentence, answers, heading = "h2" }: { sentence: string; answers: { q: string; a: string }[]; heading?: "h2" | "h3" }) {
  const H = heading;
  return (
    <>
      <p className="pol-key"><PolicyIcon name="returnBox" />{sentence}</p>
      {answers.length > 0 && (
        <div className="pg-notice">
          {answers.map((x, i) => (
            <section key={i}>
              <H>{x.q}</H>
              {x.a.split(/\n\s*\n/).map((para, j) => <p key={j}>{para.trim()}</p>)}
            </section>
          ))}
        </div>
      )}
    </>
  );
}
