import { TM_PHOTO_MAX, tmSendArgs } from "@/lib/testimonials";
import { tmPost } from "@/lib/testimonials-server";

// POST /api/testimonials/send {body, stars, about, nameMode, consent, photo?, source, entry?, lang}: the signed-in
// rider's testimonial (testimonial_send), from the form on /testimonials/write (source 'web') or from the ask after a
// rating of 9 or 10 (source 'rating', with the booking it rated). The photo, when there is one, is the picture the
// page made small (a JPEG data: URL of 600,000 bytes at most). Answers testimonial_send's own {ok: true, id, status,
// body, display_name} or {ok: false, error: <its code>} (lib/testimonials-server.ts tmPost).
const MAX_BODY = TM_PHOTO_MAX + 20_000;
export const POST = (req: Request) => tmPost(req, { fn: "testimonial_send", max: MAX_BODY, timeout: 20_000, args: tmSendArgs });
