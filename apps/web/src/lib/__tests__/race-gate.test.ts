import { describe, expect, it } from "vitest";
import { pendingRaceRegs, raceRegCandidates } from "../race-reg";

// The DEFE 5KM Run's unskippable "Have you registered for the race?" pop-up (2026-10-18): which place it asks about.
const row = (o: Record<string, unknown> = {}) => ({ id: "q1", session_id: "2099-10-22-df", session_date: "2099-10-22", status: "waiting", customer_id: "c1", race_reg: null, ...o });
const df = new Map([["2099-10-22-df", { kind: "defe5k" as const }], ["2099-10-20-sat", { kind: "saturday" as const }]]);

describe("the race pop-up's place", () => {
  it("asks for a live place with no answer, or No, on a Defe run still ahead", () => {
    expect(pendingRaceRegs([row()], df, "2099-10-18", "c1")).toEqual([{ entryId: "q1", sessionId: "2099-10-22-df", date: "2099-10-22", answer: null }]);
    expect(pendingRaceRegs([row({ race_reg: "no" })], df, "2099-10-18", "c1")[0].answer).toBe("no");
    expect(pendingRaceRegs([row({ status: "waitlist" })], df, "2099-10-22", "c1")).toHaveLength(1);
  });
  it("never asks after Yes, for a passed place, a past day, another account, a cancelled row or another kind", () => {
    expect(pendingRaceRegs([row({ race_reg: "yes" })], df, "2099-10-18", "c1")).toEqual([]);
    expect(pendingRaceRegs([row()], df, "2099-10-18", "c1", ["q1"])).toEqual([]);
    expect(pendingRaceRegs([row()], df, "2099-10-23", "c1")).toEqual([]);
    expect(pendingRaceRegs([row()], df, "2099-10-18", "c2")).toEqual([]);
    expect(pendingRaceRegs([row({ status: "cancelled" })], df, "2099-10-18", "c1")).toEqual([]);
    expect(pendingRaceRegs([row({ session_id: "2099-10-20-sat", session_date: "2099-10-20" })], df, "2099-10-18", "c1")).toEqual([]);
  });
  it("asks nothing from a read without the column", () => {
    const { race_reg: _, ...old } = row();
    expect(raceRegCandidates([old], "2099-10-18", "c1")).toEqual([]);
  });
});
