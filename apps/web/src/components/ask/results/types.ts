import type { AskQuestion } from "@/lib/ask";
import type { AskWords } from "../Ask.text";

/** Upvotes on written answers (open answers and Q&A, when the question takes them): which answers are the viewer's
 *  own (never upvoted by themselves), which they upvoted, and whether they may vote at all (signed in, on a page -
 *  the big screen only shows the counts). */
export type VoteProps = { mine: ReadonlySet<number>; voted: ReadonlySet<number>; can: boolean; busy: number | null; onVote: (answer: number, on: boolean) => void };

/** What every chart is handed: the question, its result as the database sent it (lib/ask.ts shapes it), the reader's
 *  language and words, and whether it is drawn on the big screen. A chart draws with the palette's custom properties
 *  (--ask-c0 ... --ask-c5) and the theme's tokens, never a colour of its own. */
export type ResultProps = { q: AskQuestion; result: unknown; locale: string; t: AskWords; screen: boolean; votes: VoteProps | null };

/** A custom property on an element's style. */
export const cssVars = (vars: Record<string, string | number>) => vars as React.CSSProperties;
