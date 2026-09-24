import { describe, expect, it } from "vitest";
import { fill, fmtNum } from "../fill";

describe("fill", () => {
  it("puts the numbers staff set into the words", () => {
    expect(fill("{discount}% off for your friend", { discount: 10 })).toBe("10% off for your friend");
    expect(fill("{captainAt} pts, then {eliteAt}", { captainAt: "2,000", eliteAt: "10,000" })).toBe("2,000 pts, then 10,000");
  });
  it("leaves names it does not know as written", () => {
    expect(fill("Use {code} for {discount}%", { discount: 15 })).toBe("Use {code} for 15%");
  });
});

describe("fmtNum", () => {
  it("groups thousands with Latin digits in both languages", () => {
    expect(fmtNum(10000, "en")).toBe("10,000");
    expect(fmtNum(10000, "ar")).toMatch(/^10.000$/);
  });
});
