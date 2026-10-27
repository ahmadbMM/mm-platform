import { describe, expect, it } from "vitest";
import { makeL } from "@/i18n/tx";
import { dictOf } from "@/i18n/dicts";
import { genderChip, genderErrorOf, genderOk, genderRefusal, genderShown, genderText, sessionGender, sessionsFor, type SessionGender } from "../session-gender";

// Men only, women only or mixed (the owner, 2026-10-27: "i want the triathlon pool sessions to be for male only or
// female only or mixed and to be mentioned on the card and event everywhere and only allow the gender selected to
// book it and make it visible only for the gender it is for"), as the booking app's _sessGender, _sgTxt, _sgOk,
// _sgErr and _sgErrOf have it.
const en = genderText(makeL("en", null));
const s = (id: string, gender: SessionGender | null, kind = "swim") => ({ id, kind, gender });

describe("sessions.gender_only", () => {
  it("is men only or women only, and anything else mixed", () => {
    expect(sessionGender("male")).toBe("male");
    expect(sessionGender("female")).toBe("female");
    for (const v of [null, undefined, "", "Male", "mixed", "both", 0, {}]) expect(sessionGender(v)).toBeNull();
  });
});

describe("the chip", () => {
  it("names the gender on a session for one gender, of any kind, and Mixed on a pool session open to both", () => {
    expect(genderChip(s("a", "female"), en)).toEqual({ cls: "female", label: "Women only" });
    expect(genderChip(s("a", "male"), en)).toEqual({ cls: "male", label: "Men only" });
    expect(genderChip(s("a", null), en)).toEqual({ cls: "mixed", label: "Mixed" });
    expect(genderChip(s("a", "female", "workshop"), en)).toEqual({ cls: "female", label: "Women only" });
  });
  it("is not worn by any other session open to both, nor by one read from before the column", () => {
    for (const kind of ["jcc", "saturday", "workshop", "event", "runher", "vlap", "defe5k", "petromin", "snd96"]) expect(genderChip(s("a", null, kind), en)).toBeNull();
    expect(genderChip({ kind: "saturday" }, en)).toBeNull();
    expect(genderChip({ kind: "swim" }, en)).toEqual({ cls: "mixed", label: "Mixed" }); // a copy kept from before: mixed
  });
  it("speaks the page's language: the booking app's Arabic, and the dictionaries' for the rest", () => {
    const ar = genderText(makeL("ar", null));
    expect([ar.male, ar.female, ar.mixed, ar.noMale, ar.noFemale]).toEqual(["للرجال فقط", "للنساء فقط", "مختلط", "هذه الفعالية للرجال فقط.", "هذه الفعالية للنساء فقط."]);
    const fr = genderText(makeL("fr", dictOf("fr")));
    expect([fr.male, fr.female, fr.mixed, fr.noMale, fr.noFemale]).toEqual(["Hommes uniquement", "Femmes uniquement", "Mixte", "Cette séance est réservée aux hommes.", "Cette séance est réservée aux femmes."]);
    expect(genderText(makeL("ur", dictOf("ur"))).female).toBe("صرف خواتین کے لیے");
    expect(genderText(makeL("bn", dictOf("bn"))).noMale).toBe("এই সেশনটি শুধু পুরুষদের জন্য।");
  });
  it("never says ride, rider or bike about the pool (the owner, 2026-10-18)", () => {
    for (const code of ["en", "ar", "id", "ms", "de", "es", "fr", "pt", "tl", "ru", "ur", "hi", "ne", "bn", "zh", "ja"]) {
      const w = genderText(makeL(code, dictOf(code)));
      for (const x of Object.values(w)) expect(x, `${code}: ${x}`).not.toMatch(/ride|bike|cycl|vélo|fahrrad|bici|sepeda|basikal|bisikleta|велосип|自行车|自転車|バイク|साइकिल|سائیکل|সাইকেল|دراج|جول/i);
    }
  });
});

describe("who books it", () => {
  it("is anyone on a mixed session, and on one for a single gender that gender alone", () => {
    expect(genderOk(s("a", null), null)).toBe(true);
    expect(genderOk(s("a", null), "male")).toBe(true);
    expect(genderOk(s("a", "female"), "female")).toBe(true);
    expect(genderOk(s("a", "female"), "male")).toBe(false);
    expect(genderOk(s("a", "male"), "female")).toBe(false);
    expect(genderOk(s("a", "female"), null)).toBe(false); // no gender on file: the database refuses it too
  });
  it("tells anyone else why", () => {
    expect(genderRefusal("female", en)).toBe("This session is for women only.");
    expect(genderRefusal("male", en)).toBe("This session is for men only.");
  });
  it("reads the database's GENDER_ONLY refusal as the same words, and nothing else as it", () => {
    expect(genderErrorOf({ code: "P0001", message: "GENDER_ONLY", details: "female" }, en)).toBe("This session is for women only.");
    expect(genderErrorOf({ code: "P0001", message: "GENDER_ONLY", details: "male" }, en)).toBe("This session is for men only.");
    expect(genderErrorOf({ message: "GENDER_ONLY", detail: "male" }, en)).toBe("This session is for men only."); // the site's own shape
    expect(genderErrorOf({ code: "P0001", message: "GENDER_ONLY" }, en)).toBe("This session is for women only.");
    for (const e of [{ code: "P0001", message: "SESSION_CLOSED" }, { message: "WAIVER_OUTDATED", details: "male" }, null, undefined, "GENDER", {}]) expect(genderErrorOf(e, en)).toBe("");
  });
});

describe("who sees it", () => {
  const pub = [s("mixed", null), s("leak", "female")]; // the public read never holds one for a single gender: a second layer all the same
  it("shows a visitor who is not signed in no session for one gender", () => {
    expect(genderShown(s("a", null), null)).toBe(true);
    expect(genderShown(s("a", "female"), null)).toBe(false);
    expect(genderShown(s("a", "male"), null)).toBe(false);
    expect(sessionsFor(pub, null).map((x) => x.id)).toEqual(["mixed"]);
  });
  it("shows a signed-in account its own gender's and the mixed ones, never the other gender's", () => {
    expect(genderShown(s("a", "female"), { gender: "female" })).toBe(true);
    expect(genderShown(s("a", "male"), { gender: "female" })).toBe(false);
    expect(genderShown(s("a", "female"), { gender: "male" })).toBe(false);
    expect(genderShown(s("a", "female"), { gender: null })).toBe(false);
    const women = [s("w1", "female"), s("w2", "female")];
    expect(sessionsFor(pub, { gender: "female", mine: women }).map((x) => x.id)).toEqual(["mixed", "leak", "w1", "w2"]);
    expect(sessionsFor(pub, { gender: "male", mine: [] }).map((x) => x.id)).toEqual(["mixed"]);
  });
  it("keeps a session the database gave the account for the other gender: one it holds a booking on", () => {
    expect(genderShown(s("held", "female"), { gender: "male", mine: new Set(["held"]) })).toBe(true);
    expect(sessionsFor([s("mixed", null)], { gender: "male", mine: [s("held", "female")] }).map((x) => x.id)).toEqual(["mixed", "held"]);
  });
  it("lists a session once, the account's copy in place of the public one", () => {
    const mine = { ...s("w1", "female"), from: "account" };
    const out = sessionsFor([{ ...s("w1", null), from: "public" }, { ...s("m", null), from: "public" }], { gender: "female", mine: [mine] });
    expect(out.map((x) => [x.id, x.from])).toEqual([["m", "public"], ["w1", "account"]]);
  });
});
