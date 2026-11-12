import { describe, expect, it } from "vitest";
import { jsonCapped, readCapped, TOO_BIG } from "../capped-body";

// A body is read no further than its cap, Content-Length or not (bug hunt 2026-11-11: a chunked body passed the
// badge request's header check and was read and parsed whole).
const enc = new TextEncoder();
/** A POST whose body comes in `chunks` with no Content-Length, as a chunked request does; `pulled` counts the reads. */
function chunked(chunks: string[]) {
  const seen = { pulled: 0 };
  let i = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(c) {
      seen.pulled++;
      if (i < chunks.length) c.enqueue(enc.encode(chunks[i++]));
      else c.close();
    },
  });
  const req = new Request("https://example.test/api", { method: "POST", body, duplex: "half" } as RequestInit);
  return { req, seen };
}

describe("a capped body", () => {
  it("is read whole when it fits", async () => {
    const { req } = chunked(['{"slug":', '"front-row"}']);
    expect(await jsonCapped(req, 100)).toEqual({ slug: "front-row" });
  });
  it("stops at the cap with no Content-Length, without reading the rest", async () => {
    const { req, seen } = chunked(["x".repeat(60), "x".repeat(60), "x".repeat(60), "x".repeat(60)]);
    expect(req.headers.get("content-length")).toBeNull();
    expect(await readCapped(req, 100)).toBeNull();
    expect(seen.pulled).toBeLessThan(4);
  });
  it("answers TOO_BIG for JSON over the cap, null for an empty or broken body", async () => {
    expect(await jsonCapped(chunked([`{"a":"${"x".repeat(200)}"}`]).req, 100)).toBe(TOO_BIG);
    expect(await jsonCapped(new Request("https://example.test/api", { method: "POST" }), 100)).toBeNull();
    expect(await jsonCapped(new Request("https://example.test/api", { method: "POST", body: "{not json" }), 100)).toBeNull();
  });
  it("counts bytes, not characters", async () => {
    const ar = "ا".repeat(30); // two bytes each in UTF-8
    expect(await readCapped(new Request("https://example.test/api", { method: "POST", body: ar }), 59)).toBeNull();
    expect((await readCapped(new Request("https://example.test/api", { method: "POST", body: ar }), 60))?.byteLength).toBe(60);
  });
});
