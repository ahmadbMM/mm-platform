import { PREVIEW_COOKIE, isStaffToken, tokenLifetime } from "@/lib/preview";

// Turns staff preview on for this browser (POST {token}) or off (DELETE). See lib/preview.ts.
export async function POST(req: Request) {
  let token = "";
  try {
    token = String(((await req.json()) as { token?: unknown }).token || "");
  } catch {
    token = "";
  }
  const life = tokenLifetime(token);
  if (!life || !(await isStaffToken(token))) {
    return Response.json({ ok: false }, { status: 403 });
  }
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "set-cookie": `${PREVIEW_COOKIE}=${token}; Path=/; Max-Age=${life}; HttpOnly; Secure; SameSite=Lax`,
    },
  });
}

export function DELETE() {
  return new Response(null, {
    status: 204,
    headers: { "set-cookie": `${PREVIEW_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax` },
  });
}
