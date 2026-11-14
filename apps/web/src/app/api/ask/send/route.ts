import { askLang } from "@/lib/ask";
import { askId, askPageGet, askPost } from "@/lib/ask-server";

// POST /api/ask/send {question, value, lang}: the signed-in account's answer to a question (ask_send), with the
// account cookie's id and token - the session never reaches the browser. `value` is the answer in its kind's shape
// (lib/ask.ts shapes it on the page; the database checks it again and has the last word). Answers ask_send's own
// {ok: true, status, repeat?, mine} or {ok: false, error: <code>} (lib/ask-server.ts askPost).
export const POST = (req: Request) =>
  askPost(req, {
    fn: "ask_send",
    args: (s, b) => {
      const question = askId(b.question);
      const value = b.value && typeof b.value === "object" && !Array.isArray(b.value) ? b.value : null;
      // an answer is a few numbers or some words: 16,000 holds the longest written one (ASK_TEXT_MAX, 2,000 characters
      // in any script) written out, where a character takes up to 6 (a control character escaped, as a lone surrogate
      // is; a quote or a backslash takes 2, as one outside the basic plane does)
      if (question === null || !value || JSON.stringify(value).length > 16000) return null;
      return { p_question: question, p_id: s.id, p_token: s.token, p_value: value, p_lang: askLang(b.lang) };
    },
  });

// A page whose own link part is "send" is read again here (GET /api/ask/<slug>).
export const GET = (req: Request) => askPageGet(req, "send");
