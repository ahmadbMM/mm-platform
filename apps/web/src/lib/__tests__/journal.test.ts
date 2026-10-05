import { describe, expect, it } from "vitest";
import { articleSlug, isoDay, parseBody, readMinutes, toPosts } from "../journal";

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
  it("drops a day the calendar does not have, rather than failing the page or rolling it over", () => {
    const items = [post({ date: "2026-25-09" }), post({ title: "B", date: "2026-09-31" }), post({ title: "C", date: "2027-02-29" }), post({ title: "D", date: "2028-02-29" })];
    expect(toPosts(items, items).map((p) => [p.slug, p.date])).toEqual([["d", "2028-02-29"], ["chain-care", ""], ["b", ""], ["c", ""]]);
  });
  it("keeps the address staff set, whatever the title becomes; empty, it is made from the English title", () => {
    const en = [post({ title: "Chain care, revised", slug: "Chain Care!" }), post({ title: "Second", slug: "" })];
    const ar = [post({ title: "العناية بالسلسلة", slug: "Chain Care!" }), post({ title: "الثاني", slug: "" })];
    expect(toPosts(ar, en).map((p) => p.slug)).toEqual(["chain-care", "second"]);
    // an address that is only punctuation is no address: the title's is used
    expect(toPosts([post({ slug: "!!!" })], [post({ slug: "!!!" })])[0].slug).toBe("chain-care");
    // an address staff set that another article already has is numbered, like a repeated title
    expect(toPosts([post({}), post({ title: "Other", slug: "chain-care" })], [post({}), post({ title: "Other", slug: "chain-care" })]).map((p) => p.slug)).toEqual(["chain-care", "chain-care-2"]);
  });
});

describe("articleSlug", () => {
  it("cuts a long title between two words, never inside one", () => {
    expect(articleSlug("Chain care on the coast: a five-minute routine", "x")).toBe("chain-care-on-the-coast-a-five-minute-routine");
    const long = "Everything you need to know about riding the Corniche at night safely";
    expect(articleSlug(long, "x")).toBe("everything-you-need-to-know-about-riding-the-corniche-at");
    expect(articleSlug(long, "x").length).toBeLessThanOrEqual(60);
    expect(articleSlug("a".repeat(70), "x")).toBe("a".repeat(60)); // one endless word is cut where it must be
    expect(articleSlug("سلسلة", "article-1")).toBe("article-1");
  });
});

describe("isoDay", () => {
  it("is a real day of the calendar or nothing", () => {
    expect(isoDay("2026-10-05")).toBe("2026-10-05");
    expect(isoDay("٢٠٢٦-١٠-٠٥")).toBe("2026-10-05");
    expect(isoDay("2026-25-09")).toBe("");
    expect(isoDay("2026-09-31")).toBe("");
    expect(isoDay("2026-9-5")).toBe("");
    expect(isoDay("")).toBe("");
  });
});
