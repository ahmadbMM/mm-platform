import { askId, askPageGet, askPost } from "@/lib/ask-server";

// POST /api/ask/vote {answer, on}: the signed-in account's upvote on an approved written answer, given (on: true) or
// taken back (ask_vote). Answers {ok: true, votes} or {ok: false, error} (lib/ask-server.ts askPost).
export const POST = (req: Request) =>
  askPost(req, {
    fn: "ask_vote",
    args: (s, b) => {
      const answer = askId(b.answer);
      return answer === null || typeof b.on !== "boolean" ? null : { p_answer: answer, p_id: s.id, p_token: s.token, p_on: b.on };
    },
  });

// A page whose own link part is "vote" is read again here (GET /api/ask/<slug>).
export const GET = (req: Request) => askPageGet(req, "vote");
