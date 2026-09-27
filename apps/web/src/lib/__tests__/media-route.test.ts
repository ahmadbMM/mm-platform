import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../../app/media/[...path]/route";

// /media/<path> (app/media/[...path]/route.ts): what is served from the photo bucket, and how a
// missing smaller copy, a slow bucket and a file that is not a picture are answered.
const call = (path: string) => GET(new Request(`https://micromobility.sa/media/${path}`), { params: Promise.resolve({ path: path.split("?")[0].split("/") }) });
const answer = (body: string, type: string, status = 200) => new Response(body, { status, headers: { "content-type": type } });
const STORE = "https://example.supabase.co/storage/v1/object/public/site/";

beforeEach(() => vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"));
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("/media", () => {
  it("asks for the smaller copy first and falls back to the photo when the storage has none", async () => {
    const f = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async (url) => (url.includes(".w640.webp") ? answer("no such copy", "application/json", 400) : answer("jpeg bytes", "image/jpeg")));
    vi.stubGlobal("fetch", f);
    const res = await call("home/abc.jpg?w=640");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(f.mock.calls.map((c) => String(c[0]))).toEqual([`${STORE}home/abc.w640.webp`, `${STORE}home/abc.jpg`]);
    for (const c of f.mock.calls) expect(c[1]?.signal).toBeInstanceOf(AbortSignal); // eight seconds, then give up
  });

  it("serves pictures and PDFs inline, never an SVG", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => answer("%PDF", "application/pdf")));
    const pdf = await call("sheets/da54.pdf");
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get("content-disposition")).toBe("inline");
    expect(pdf.headers.get("x-content-type-options")).toBe("nosniff");
    vi.stubGlobal("fetch", vi.fn(async () => answer("<svg/>", "image/svg+xml")));
    expect((await call("home/logo.svg")).status).toBe(404);
  });

  it("answers a slow or unreachable bucket with a 504 that nothing keeps", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new DOMException("The operation was aborted", "TimeoutError"); }));
    const res = await call("home/abc.jpg");
    expect(res.status).toBe(504);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("answers a missing file with a 404 kept only for a minute", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => answer("no", "application/json", 404)));
    const res = await call("home/gone.jpg");
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("public, max-age=60");
  });

  it("refuses an address that is not a file in a folder, without asking the bucket", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    for (const p of ["abc.jpg", "home/../x.jpg", "Home/abc.jpg"]) expect((await call(p)).status, p).toBe(404);
    expect(f).not.toHaveBeenCalled();
  });
});
