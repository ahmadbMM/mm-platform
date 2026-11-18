import { tmId } from "@/lib/testimonials";
import { tmPost } from "@/lib/testimonials-server";

// POST /api/testimonials/delete {id}: the signed-in rider takes one of theirs down, whatever its state
// (testimonial_delete). Answers {ok: true} or {ok: false, error}: "gone" when it is not theirs or not there any more,
// or the site's own (lib/testimonials-server.ts tmPost).
export const POST = (req: Request) =>
  tmPost(req, {
    fn: "testimonial_delete",
    max: 1000,
    args: (b) => {
      const id = b && typeof b === "object" ? tmId((b as { id?: unknown }).id) : null;
      return id === null ? null : { p_tid: id };
    },
  });
