import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import PageShell from "@/components/site/PageShell";
import Leaderboard from "@/components/leaderboard/Leaderboard";
import { boardWords } from "@/components/leaderboard/Leaderboard.words";
import "@/components/account/account.css";
import { siteSchema } from "@/content/pages/site";
import { getAccount } from "@/lib/account";
import { asLocale, resolvePage } from "@/lib/content";
import { asBoard, BOARD_PATH, startGender } from "@/lib/distance-board";
import { readDistanceBoard, readMyDistances } from "@/lib/distance-board-server";
import { pageState } from "@/lib/page-state";
import { firstNameOf } from "@/lib/share-picture";

// micromobility.sa/leaderboard - the distance leaderboards, as the booking app's /leaderboard (distance-board.js; rentals
// migration 20261127180000): anyone may open it, signed in or not. ?b= opens a board (longest, month, lifetime, year: the
// Club's Leaderboard part links each) and ?g= all, male or female; without one a signed-in rider sees their own gender's,
// anyone else everyone together (All).
// The first board is read here (distance_board), with the account's own figures (customer_distances) when signed in;
// the page itself is components/leaderboard/Leaderboard.tsx.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const { closed } = await pageState();
  const w = boardWords(locale);
  return pageMeta({ path: BOARD_PATH, locale, title: `${w.title} · Micromobility`, description: `${w.longest} · ${w.month} · ${w.lifetime} · ${w.year}`, closed });
}

export default async function LeaderboardPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale } = await params;
  const q = await searchParams;
  const L = asLocale(locale);
  const [{ content, previewing, hidden }, acct] = await Promise.all([pageState(), getAccount()]);
  const site = resolvePage(siteSchema, content, L);
  const w = boardWords(locale);
  const b = asBoard(q.b), g = q.g === "female" || q.g === "male" || q.g === "all" ? q.g : startGender(acct?.profile?.gender);
  const [board, mine] = await Promise.all([readDistanceBoard(b, g, acct), acct ? readMyDistances(acct) : Promise.resolve(null)]);
  return (
    <PageShell locale={locale} site={site} preview={previewing} hidden={hidden}>
      <div className="ac ac-in">
        <div className="lb-page">
          <h1>{w.title}</h1>
          <Leaderboard locale={locale} b={b} g={g} board={board} signedIn={!!acct} mine={mine} first={firstNameOf(acct?.name)} />
        </div>
      </div>
    </PageShell>
  );
}
