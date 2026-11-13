import { askPageGet } from "@/lib/ask-server";

// GET /api/ask/<slug>[?k=<key>]: the page read again for this viewer (ask_page, with the account cookie's id and
// token; lib/ask-server.ts askPageGet). The pages poll the results straight from the database (ask_live) and come here
// only when the page itself must be read again.
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  return askPageGet(req, (await params).slug);
}
