import { describe, expect, it } from "vitest";
import { parseBody, readMinutes, toPosts } from "../journal";

describe("parseBody", () => {
  it("reads paragraphs, headings and lists from plain text", () => {
    expect(parseBody("First line\nsame paragraph.\n\n## How\n- one\n- two\nAfter the list.")).toEqual([
      { p: "First line same paragraph." }, { h: "How" }, { ul: ["one", "two"] }, { p: "After the list." },
    ]);
  });
  it("never reads markup", () => {
    expect(parseBody("<script>x</script>")).toEqual([{ p: "<script>x</script>" }]);
  });
});

describe("readMinutes", () => {
  it("counts about 200 words a minute, at least one", () => {
    expect(readMinutes("a b c")).toBe(1);
    expect(readMinutes(Array(1000).fill("w").join(" "))).toBe(5);
  });
});

describe("toPosts", () => {
  const post = (o: Record<string, unknown>) => ({ title: "Chain care", body: "Text.", date: "2026-09-01", ...o });
  it("names each article by its English title, newest first, and leaves hidden ones out", () => {
    const items = [post({ title: "العناية بالسلسلة" }), post({ title: "Second", date: "2026-09-20" }), post({ title: "Draft", show: false })];
    const en = [post({}), post({ title: "Second", date: "2026-09-20" }), post({ title: "Draft" })];
    expect(toPosts(items, en).map((p) => [p.slug, p.title])).toEqual([["second", "Second"], ["chain-care", "العناية بالسلسلة"]]);
  });
  it("numbers a second article with the same title, and drops a malformed date", () => {
    const items = [post({}), post({ date: "soon" })];
    expect(toPosts(items, items).map((p) => [p.slug, p.date])).toEqual([["chain-care", "2026-09-01"], ["chain-care-2", ""]]);
  });
});
