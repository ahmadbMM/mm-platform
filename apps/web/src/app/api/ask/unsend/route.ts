import { askId, askPageGet, askPost } from "@/lib/ask-server";

// POST /api/ask/unsend {answer}: takes back the signed-in account's own answer while it still waits for approval
// (ask_unsend). Answers {ok: true} or {ok: false, error} (lib/ask-server.ts askPost).
export const POST = (req: Request) =>
  askPost(req, {
    fn: "ask_unsend",
    args: (s, b) => {
      const answer = askId(b.answer);
      return answer === null ? null : { p_answer: answer, p_id: s.id, p_token: s.token };
    },
  });

// A page whose own link part is "unsend" is read again here (GET /api/ask/<slug>).
export const GET = (req: Request) => askPageGet(req, "unsend");
