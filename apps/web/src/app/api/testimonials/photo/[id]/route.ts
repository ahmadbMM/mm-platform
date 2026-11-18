import { tmPhotoGet } from "@/lib/testimonials-server";

// GET /api/testimonials/photo/<id>: a published testimonial's photo, served from the site's own address and kept at the
// edge (lib/testimonials-server.ts tmPhotoGet). The cards on /testimonials link it; nothing else does.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return tmPhotoGet((await params).id);
}
