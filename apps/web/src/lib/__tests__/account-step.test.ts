import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { accountPlan, signinIdent } from "../account-step";

// The account step every account form shares (forms/shared/account.js; the owner, 2026-10-25): the community form
// and the Defe page inline it, the Learn to ride form reads it through lib/account-step.ts. One rule for what a
// typed email or mobile becomes, and for which questions a signed-in account is asked again.

describe("the shared account step", () => {
  it("is the file the forms inline, word for word", () => {
    const src = readFileSync(new URL("../../../../../forms/shared/account.js", import.meta.url), "utf8");
    const copy = readFileSync(new URL("../account-shared.ts", import.meta.url), "utf8");
    expect(copy).toContain(src);
  });

  it("writes what was typed as customer_login takes it", () => {
    expect(signinIdent("  Sara@Example.com ")).toBe("sara@example.com");
    expect(signinIdent("055 123 4567")).toBe("+966551234567");
    expect(signinIdent("551234567")).toBe("+966551234567");
    expect(signinIdent("966551234567")).toBe("+966551234567");
    expect(signinIdent("+966 0551234567")).toBe("+966551234567");
    expect(signinIdent("00966551234567")).toBe("+966551234567");
    expect(signinIdent("+44 7700 900123")).toBe("+447700900123");
    expect(signinIdent("٠٥٥١٢٣٤٥٦٧")).toBe("+966551234567"); // Arabic-Indic digits
    expect(signinIdent("")).toBe("");
  });

  it("skips what the account holds, asks what it lacks, and asks again what staff flagged", () => {
    const me = { birth_date: "1994-03-12", nationality: "Egypt", instagram: "karim.rides", linkedin: null, profession: "Architect",
      workplace: "", whatsapp_same: true, heard_from: "friend", flags: ["instagram"] };
    const p = accountPlan(me, ["whatsapp", "birth_date", "nationality", "instagram", "linkedin", "profession", "workplace", "heard_from"]);
    expect(p.skip).toEqual(["whatsapp", "birth_date", "nationality", "profession", "heard_from"]);
    expect(p.ask).toEqual(["instagram", "linkedin", "workplace"]);
    expect(p.flagged).toEqual(["instagram"]);
  });

  it("asks everything of an account it knows nothing about, and a WhatsApp 'no' without its number", () => {
    expect(accountPlan(null, ["birth_date", "whatsapp"]).ask).toEqual(["birth_date", "whatsapp"]);
    expect(accountPlan({ whatsapp_same: false, whatsapp: "" }, ["whatsapp"]).ask).toEqual(["whatsapp"]);
    expect(accountPlan({ whatsapp_same: false, whatsapp: "+201001234567" }, ["whatsapp"]).skip).toEqual(["whatsapp"]);
    expect(accountPlan({ birth_date: "12/03/1994" }, ["birth_date"]).ask).toEqual(["birth_date"]); // not a date the form takes
  });
});
