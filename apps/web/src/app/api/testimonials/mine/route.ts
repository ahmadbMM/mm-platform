import { tmMineGet } from "@/lib/testimonials-server";

// GET /api/testimonials/mine: the signed-in rider's testimonials, the two names they can choose between (exactly as
// they would show), their "since" line's numbers and the launch switch (testimonial_mine, with the account cookie's id
// and token). Answers {ok: true, on, names, since, items} or {ok: false, error} (lib/testimonials-server.ts tmMineGet).
export const dynamic = "force-dynamic";
export const GET = (req: Request) => tmMineGet(req);
