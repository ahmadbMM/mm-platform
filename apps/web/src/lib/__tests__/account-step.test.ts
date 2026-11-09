import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { accountPlan, sameAsHeld, signinIdent } from "../account-step";

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

  // The owner, 2026-11-09: "don't allow a flagged account field to type in the same info in the field again". The
  // booking app's _fixSame, word for word in its rules.
  it("tells a flagged answer that is what the account already holds", () => {
    const held = { name: "Sara  Alharbi", email: "Sara@Gmail.com", phone: "+966552468013", whatsapp_same: true, whatsapp: null,
      birth_date: "1994-03-12", gender: "female", nationality: "Saudi Arabia", country: "Saudi Arabia", city: "Jeddah", height: 165,
      type_preference: "Hybrid", heard_from: "friend", profession: "Architect", workplace: "Saudi Aramco", instagram: "sara.rides", x: "@SaraRides",
      emergency: { name: "Layla Alharbi", phone: "+966551234567", relation: "sibling" }, emergency2: null };
    // words: spaces tidied, the case kept
    expect(sameAsHeld("name", " Sara Alharbi ", held)).toBe(true);
    expect(sameAsHeld("name", "sara alharbi", held)).toBe(false);
    expect(sameAsHeld("profession", "Architect ", held)).toBe(true);
    expect(sameAsHeld("workplace", "Saudi  Aramco", held)).toBe(true);
    // an email in any case; a number by its last nine digits
    expect(sameAsHeld("email", " sara@gmail.com", held)).toBe(true);
    expect(sameAsHeld("phone", "0552468013", held)).toBe(true);
    expect(sameAsHeld("phone", "٠٥٥٢٤٦٨٠١٣", held)).toBe(true);
    expect(sameAsHeld("phone", "0552468014", held)).toBe(false);
    // WhatsApp: "Yes" again, and a "No" with the mobile's own number, are the same as "Yes"
    expect(sameAsHeld("whatsapp", { same: true }, held)).toBe(true);
    expect(sameAsHeld("whatsapp", { same: false, phone: "+966552468013" }, held)).toBe(true);
    expect(sameAsHeld("whatsapp", { same: false, phone: "+201001234567" }, held)).toBe(false);
    const other = { ...held, whatsapp_same: false, whatsapp: "+201001234567" };
    expect(sameAsHeld("whatsapp", { same: false, phone: "01001234567" }, other)).toBe(true);
    expect(sameAsHeld("whatsapp", { same: true }, other)).toBe(false);
    // the rest exactly; country and city as one answer
    expect(sameAsHeld("birth_date", "1994-03-12", held)).toBe(true);
    expect(sameAsHeld("birth_date", "1994-03-13", held)).toBe(false);
    expect(sameAsHeld("height", "165", held)).toBe(true);
    expect(sameAsHeld("residence", { country: "Saudi Arabia", city: "Jeddah" }, held)).toBe(true);
    expect(sameAsHeld("residence", { country: "Saudi Arabia", city: "Riyadh" }, held)).toBe(false);
    // a handle in any case and without its @
    expect(sameAsHeld("instagram", "@Sara.Rides", held)).toBe(true);
    expect(sameAsHeld("x", "sararides", held)).toBe(true);
    // a contact by name, number and relation together
    expect(sameAsHeld("emergency", { name: "Layla  Alharbi", phone: "0551234567", relation: "sibling" }, held)).toBe(true);
    expect(sameAsHeld("emergency", { name: "Layla Alharbi", phone: "0551234567", relation: "friend" }, held)).toBe(false);
    expect(sameAsHeld("emergency2", { name: "Layla Alharbi", phone: "0551234567", relation: "sibling" }, held)).toBe(false);
    // "I don't have one" (nothing) is never the same, nor is a password
    expect(sameAsHeld("linkedin", "", { linkedin: "" })).toBe(false);
    expect(sameAsHeld("password", "Ride2Work", { password: "Ride2Work" })).toBe(false);
  });
});
