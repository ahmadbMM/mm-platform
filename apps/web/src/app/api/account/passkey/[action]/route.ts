import { passkeyPost } from "@/lib/sx-B7-passkey-server";

// POST /api/account/passkey/{signin-start, signin, add-start, add, list, remove}: passkeys (N06, behind the switch
// site_content 'account.passkeys', off by default). What each does: lib/sx-B7-passkey-server.ts.
export async function POST(req: Request, { params }: { params: Promise<{ action: string }> }) {
  return passkeyPost(req, (await params).action);
}
