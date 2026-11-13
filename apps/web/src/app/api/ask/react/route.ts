import { isReaction } from "@/lib/ask-pace";
import { askId, askPageGet, askPost } from "@/lib/ask-server";

// POST /api/ask/react {question, kind, on}: the signed-in account's reaction to a question - one of like, love, clap,
// wow, think - given (on: true) or taken back (ask_react), with the account cookie's id and token; counted with the
// account's other Ask requests (thirty a minute). Answers {ok: true} or {ok: false, error} (lib/ask-server.ts askPost).
export const POST = (req: Request) =>
  askPost(req, {
    fn: "ask_react",
    args: (s, b) => {
      const question = askId(b.question);
      return question === null || !isReaction(b.kind) || typeof b.on !== "boolean" ? null : { p_question: question, p_id: s.id, p_token: s.token, p_kind: b.kind, p_on: b.on };
    },
  });

// A page whose own link part is "react" is read again here (GET /api/ask/<slug>).
export const GET = (req: Request) => askPageGet(req, "react");
