import { describe, expect, it } from "vitest";
import { askChoices, askTarget, badgeReqs, badgeRequestBody, canAsk, lastReq, proofKind, reqRefusal } from "../badge-request";
import { badgeList, ladderLevel, type BadgeData, type BadgeRow } from "../ride-record";
import { BADGE_REQ_WORDS } from "@/components/account/BadgeRequest.words";
import { LOCALE_CODES } from "@/i18n/locales";

// Badge requests (the owner, 2026-11-08; rentals migration 20261108210000, the booking app's _bdr*).
describe("badge requests", () => {
  const sys = (slug: string, auto = false): BadgeRow => ({ slug, icon: "flag", color: "green", name: slug, system: true, auto });
  const data = (catalog: BadgeRow[], mine: BadgeRow[] = []): BadgeData => ({ catalog, weeks: null, seasons: [], mine });
  const PDF = "data:application/pdf;base64," + Buffer.from("%PDF-1.4\n%%EOF").toString("base64");
  const JPG = "data:image/jpeg;base64,/9j/4AAQ";

  it("offers every badge not held, earned by riding or given by staff, every ladder level not reached, and none without a catalogue", () => {
    const cat = [sys("marshal"), sys("senior_marshal"), sys("first_lap", true), sys("national_day_96", true), sys("t25"), sys("t50"), sys("t100"), { slug: "bd_owl", icon: "moon", color: "purple", name: "Night Owl", system: false, auto: false }];
    const list = badgeList([], new Map(), data(cat, [{ slug: "t25", at: "2026-11-01T10:00:00Z" }]), "2026-11-08", null);
    // the list's order: a ladder begun first, then a ride badge (rentals 20261108230000), then the ones staff give;
    // National Day 96 stays hidden until held, so it is never offered
    expect(askChoices(list).map((x) => x.slug)).toEqual(["t50", "t100", "first_lap", "marshal", "senior_marshal", "bd_owl"]);
    const t = list.find((x) => x.lv?.some((y) => y.slug === "t100"))!;
    expect(askTarget(t)?.slug).toBe("t50"); // the ladder's next level
    expect(askTarget(list.find((x) => x.slug === "first_lap")!)?.slug).toBe("first_lap"); // earned by riding, not yet
    const rode = badgeList([], new Map(), data(cat, [{ slug: "first_lap", at: "2026-11-01T10:00:00Z" }]), "2026-11-08", null);
    expect(canAsk(rode.find((x) => x.slug === "first_lap")!)).toBe(false); // held
    expect(askChoices(badgeList([], new Map(), data([]), "2026-11-08", null))).toEqual([]);
    expect(ladderLevel("senior_marshal")).toEqual([2, 5]);
    expect(ladderLevel("bd_owl")).toBeNull();
  });

  it("reads the account's requests newest first, and nothing from anything but a list", () => {
    const r = badgeReqs([
      { id: 1, slug: "t100", status: "declined", at: "2026-11-01T10:00:00Z", decided_at: "2026-11-02T10:00:00Z", reply: "Send the certificate" },
      { id: 2, slug: "marshal", status: "pending", at: "2026-11-05T10:00:00Z" },
      { id: 3, slug: "Bad Slug", status: "pending", at: "2026-11-05T10:00:00Z" },
      { id: 4, slug: "t50", status: "maybe", at: "2026-11-05T10:00:00Z" },
    ])!;
    expect(r.map((x) => x.id)).toEqual([2, 1]);
    expect(r[1]).toMatchObject({ status: "declined", reply: "Send the certificate", decidedAt: "2026-11-02T10:00:00Z" });
    expect(lastReq(r, ["t25", "t50", "t100"])?.id).toBe(1);
    expect(badgeReqs(null)).toBeNull();
    expect(badgeReqs({ error: "x" })).toBeNull();
  });

  it("takes a picture or a PDF as the proof, under 3 MB, and nothing else", () => {
    expect(proofKind(JPG)).toBe("image");
    expect(proofKind(PDF)).toBe("pdf");
    expect(proofKind("data:application/pdf;base64,aGVsbG8=")).toBeNull(); // not a PDF's bytes
    expect(proofKind("data:text/html;base64,PGI+")).toBeNull();
    expect(proofKind("data:image/jpeg;base64," + "A".repeat(3_000_000))).toBeNull();
    expect(badgeRequestBody({ slug: "t100", comment: "  6h 12m  ", proof: PDF, proofName: "cert\n.pdf" })).toEqual({ slug: "t100", comment: "6h 12m", proof: PDF, proofName: "cert.pdf" });
    expect(badgeRequestBody({ slug: "t100" })).toEqual({ slug: "t100", comment: null, proof: null, proofName: null });
    expect(badgeRequestBody({ slug: "t100", proofName: "x.pdf" })?.proofName).toBeNull(); // a name without a proof
    expect(badgeRequestBody({ slug: "t100", comment: "x".repeat(600) })?.comment).toHaveLength(500);
    expect(badgeRequestBody({ slug: "t100", proof: "data:text/plain;base64,aGk=" })).toBeNull();
    expect(badgeRequestBody({ slug: "drop table" })).toBeNull();
    expect(badgeRequestBody(null)).toBeNull();
  });

  it("says the database's refusals by name", () => {
    expect(reqRefusal({ ok: false, error: "token" })).toBe("signin");
    expect(reqRefusal({ ok: false, error: "held" })).toBe("held");
    expect(reqRefusal({ ok: false, error: "limit" })).toBe("limit");
    expect(reqRefusal({ ok: false, error: "nope" })).toBe("generic");
    expect(reqRefusal(null)).toBe("generic");
  });

  it("has every word in every language the site speaks, with the placeholders", () => {
    const en = BADGE_REQ_WORDS.en;
    expect(Object.keys(BADGE_REQ_WORDS).sort()).toEqual([...LOCALE_CODES].sort());
    for (const [l, w] of Object.entries(BADGE_REQ_WORDS)) {
      expect(Object.keys(w), l).toEqual(Object.keys(en));
      for (const v of Object.values(w)) expect(v.trim(), l).not.toBe("");
      for (const k of ["wait", "pending", "againNote"] as const) expect(w[k], `${l} ${k}`).toContain("{0}");
    }
  });
});
