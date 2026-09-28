import { describe, expect, it } from "vitest";
import { HEARD, ageOn, emailOk, igNorm, learnPayload, liNorm, phoneOk, wholeNumber, type LearnFields, type LearnerFields } from "../learn";
import { learnFrame } from "../learn-page";
import { namePartsOk } from "../rpc-client";

// The Learn to ride sign-up (/experiences/learn): the form refuses what learn_apply() would, with
// the database's own error codes - a learner's with their place in the list - one at a time in the
// form's order (every learner's card, then the person signing up), and sends exactly what the
// database reads: the contact, and 1 to 5 learners (the owner, 2026-09-28). The person signing up
// also gives what the community form asks, for the account (the owner, 2026-09-28), and "Me" takes
// their age, gender and height from it; a learner may be any age up to 99.

const me: LearnerFields = { who: "self", name: "", age: "30", gender: "female", height: "165", level: "never" };
const kid: LearnerFields = { who: "child", name: "Omar", age: "7", gender: "male", height: "120", level: "tried" };
const friend: LearnerFields = { who: "other", name: "Lina Saleh", age: "34", gender: "female", height: "160", level: "refresh" };
const TODAY = "2026-09-28";
const form: LearnFields = {
  learners: [me], name: "Sara Al Harbi", birth: "1996-02-10", gender: "female", nationality: "Saudi Arabia", height: "165",
  phone: "0551234567", email: "Sara@Example.com", instagram: "", linkedin: "", profession: "Designer", heard: "instagram", notes: "", privacy: true, news: false,
};
const send = (x: Partial<LearnFields>) => learnPayload({ ...form, ...x }, "en", "2026-09-25", TODAY);
const error = (x: Partial<LearnFields>) => {
  const r = send(x);
  return "error" in r ? r.error : null;
};
/** The problem with one learner's card, the others as they are. */
const learnerError = (l: Partial<LearnerFields>, base: LearnerFields = me) => {
  const r = send({ learners: [{ ...base, ...l }] });
  return "error" in r ? r : null;
};

describe("learnPayload", () => {
  it("sends one learner - the person signing up - as the database reads it, and nothing of the old single-learner form", () => {
    const r = learnPayload({ ...form, notes: "  A little nervous.  " }, "ar", "2026-09-25", TODAY);
    expect(r).toEqual({
      payload: {
        name: "Sara Al Harbi", birth_date: "1996-02-10", gender: "female", nationality: "Saudi Arabia", height: 165,
        email: "sara@example.com", phone: "+966551234567", instagram: "", linkedin: "", profession: "Designer",
        heard_from: "instagram", notes: "A little nervous.", ride_news: false, lang: "ar", privacy_version: "2026-09-25",
        learners: [{ who: "self", name: "", age: 30, gender: "female", height: 165, level: "never" }],
      },
    });
    expect(Object.keys("payload" in r ? r.payload : {})).toEqual(["name", "birth_date", "gender", "nationality", "height", "email", "phone", "instagram", "linkedin", "profession", "heard_from", "notes", "ride_news", "lang", "privacy_version", "learners"]);
  });

  it("sends three learners in their order: the person signing up, their child and another adult", () => {
    const r = send({ learners: [me, { ...kid, name: "  Omar-Ali " }, { ...friend, age: "٣٤" }] });
    expect("payload" in r && r.payload.learners).toEqual([
      { who: "self", name: "", age: 30, gender: "female", height: 165, level: "never" },
      { who: "child", name: "Omar Ali", age: 7, gender: "male", height: 120, level: "tried" },
      { who: "other", name: "Lina Saleh", age: 34, gender: "female", height: 160, level: "refresh" },
    ]);
  });

  it("leaves out a name typed on the person signing up's own card: theirs is the contact's", () => {
    const r = send({ learners: [{ ...me, name: "Someone" }] });
    expect("payload" in r && r.payload.learners[0].name).toBe("");
  });

  it("takes 1 to 5 learners", () => {
    expect(send({ learners: [] })).toEqual({ error: "learners" });
    const five = [me, kid, { ...kid, name: "Lina" }, { ...kid, name: "Huda" }, friend];
    expect(error({ learners: five })).toBeNull();
    expect(send({ learners: [...five, { ...friend, name: "Ali Omar" }] })).toEqual({ error: "learners" });
  });

  it("takes the person signing up once at most, and never the same learner twice", () => {
    expect(send({ learners: [kid, me, { ...me, age: "40" }] })).toEqual({ error: "learners", index: 2 });
    expect(send({ learners: [kid, friend, { ...kid, name: " omar ", age: "9" }] })).toEqual({ error: "learners", index: 2 });
    expect(send({ learners: [friend, { ...friend, name: "LINA  SALEH" }] })).toEqual({ error: "learners", index: 1 });
    // the same name as a child and as another adult is two people
    expect(error({ learners: [{ ...kid, name: "Lina Saleh" }, friend] })).toBeNull();
  });

  it("names the card of the first learner with a problem, and checks the person signing up only after every card", () => {
    const empty: LearnerFields = { who: "", name: "", age: "", gender: "", height: "", level: "" };
    const blank: LearnFields = { learners: [kid, empty, { ...friend, age: "100" }], name: "", birth: "", gender: "", nationality: "", height: "", phone: "", email: "", instagram: "", linkedin: "", profession: "", heard: "", notes: "", privacy: false, news: false };
    const steps: [(f: LearnFields) => LearnFields, { error: string; index?: number } | null][] = [
      [(f) => f, { error: "learner_who", index: 1 }],
      [(f) => ({ ...f, learners: [f.learners[0], { ...empty, who: "child" }, f.learners[2]] }), { error: "learner_name", index: 1 }],
      [(f) => ({ ...f, learners: [f.learners[0], { ...f.learners[1], name: "Lina" }, f.learners[2]] }), { error: "learner_age", index: 1 }],
      [(f) => ({ ...f, learners: [f.learners[0], { ...f.learners[1], age: "6" }, f.learners[2]] }), { error: "learner_gender", index: 1 }],
      [(f) => ({ ...f, learners: [f.learners[0], { ...f.learners[1], gender: "female" }, f.learners[2]] }), { error: "learner_height", index: 1 }],
      [(f) => ({ ...f, learners: [f.learners[0], { ...f.learners[1], height: "115" }, f.learners[2]] }), { error: "level", index: 1 }],
      [(f) => ({ ...f, learners: [f.learners[0], { ...f.learners[1], level: "never" }, f.learners[2]] }), { error: "learner_age", index: 2 }],
      [(f) => ({ ...f, learners: [f.learners[0], f.learners[1], { ...f.learners[2], age: "34" }] }), { error: "name" }],
      [(f) => ({ ...f, name: "Huda Saleh" }), { error: "birth_date" }],
      [(f) => ({ ...f, birth: "1988-11-03" }), { error: "gender" }],
      [(f) => ({ ...f, gender: "female" }), { error: "nationality" }],
      [(f) => ({ ...f, nationality: "Jordan" }), { error: "height" }],
      [(f) => ({ ...f, height: "160" }), { error: "phone" }],
      [(f) => ({ ...f, phone: "+966 50 123 4567" }), { error: "email" }],
      [(f) => ({ ...f, email: "huda@example.sa" }), { error: "profession" }],
      [(f) => ({ ...f, profession: "Teacher" }), { error: "heard_from" }],
      [(f) => ({ ...f, heard: "invited" }), { error: "privacy" }],
      [(f) => ({ ...f, privacy: true }), null],
    ];
    let f = blank;
    for (const [step, next] of steps) {
      f = step(f);
      const r = learnPayload(f, "en", "2026-09-25", TODAY);
      expect("error" in r ? r : null, JSON.stringify(next)).toEqual(next);
    }
  });

  // How they heard of us (the owner, 2026-09-28): required, and one of customers.heard_from's codes
  // - the list learn_apply() checks (20260928230000), 'desk' being the booking desk's own.
  it("sends how they heard of us, any of the booking app's answers, and refuses anything else", () => {
    expect([...HEARD]).toEqual(["instagram", "tiktok", "snapchat", "x", "facebook", "youtube", "whatsapp", "google", "friend", "invited", "passed_by", "event", "hotel", "school", "work", "community", "other"]);
    for (const h of HEARD) {
      const r = send({ heard: h });
      expect("payload" in r && r.payload.heard_from, h).toBe(h);
    }
    expect(error({ heard: "" })).toBe("heard_from");
    expect(error({ heard: "desk" as LearnFields["heard"] })).toBe("heard_from");
    expect(error({ heard: "radio" as LearnFields["heard"] })).toBe("heard_from");
  });

  it("takes a child or another adult of any age up to 99 - no minimum (the owner, 2026-09-28)", () => {
    for (const base of [kid, friend]) {
      for (const a of ["1", "2", "5", "11", "17", "18", "99"]) expect(learnerError({ age: a }, base), a).toBeNull();
      for (const a of ["0", "100", ""]) expect(learnerError({ age: a }, base), a).toEqual({ error: "learner_age", index: 0 });
    }
  });

  it("gives Me the person's own age, gender and height, whatever the card holds", () => {
    const r = send({ learners: [{ ...me, age: "12", gender: "male", height: "90" }], gender: "female", height: "171" });
    expect("payload" in r && r.payload.learners[0]).toEqual({ who: "self", name: "", age: 30, gender: "female", height: 171, level: "never" });
    // a Me card whose person's details are wrong points at the details, not at the card
    expect(send({ birth: "" })).toEqual({ error: "birth_date" });
    expect(send({ height: "" })).toEqual({ error: "height" });
    // the person may be a baby only if nobody is "Me": a child of theirs is fine at any age
    expect(send({ birth: "2026-03-01" })).toEqual({ error: "birth_date" });
    expect(error({ birth: "2026-03-01", learners: [kid] })).toBeNull();
  });

  it("takes a learner's height from 80 to 250 cm", () => {
    for (const h of ["79", "251", "1.65", "", "abc"]) expect(learnerError({ height: h }, friend)?.error, h).toBe("learner_height");
    for (const h of ["80", "250", " 170 "]) expect(learnerError({ height: h }, friend), h).toBeNull();
  });

  it("needs the person's date of birth: a real day, not in the future, at most 99 years ago", () => {
    for (const b of ["", "1996-02-30", "1996-13-01", "2026-09-29", "1926-09-28", "96-02-10"]) expect(error({ birth: b, learners: [kid] }), b).toBe("birth_date");
    for (const b of ["1926-09-29", "2026-09-28", "2000-02-29"]) expect(error({ birth: b, learners: [kid] }), b).toBeNull();
  });

  it("needs the person's gender, a nationality from the booking app's list and a height from 80 to 250 cm", () => {
    expect(error({ gender: "" })).toBe("gender");
    for (const n of ["", "Saudi", "Israel", "saudi arabia"]) expect(error({ nationality: n }), n).toBe("nationality");
    for (const n of ["Palestine", "Côte d'Ivoire", "United States"]) expect(error({ nationality: n }), n).toBeNull();
    for (const h of ["79", "251", ""]) expect(error({ height: h }), h).toBe("height");
  });

  it("takes Instagram and LinkedIn empty, or as a handle or a link, and sends the bare name", () => {
    const r = send({ instagram: "https://www.instagram.com/sara.h/?igsh=abc", linkedin: "https://www.linkedin.com/in/sara-al-harbi/" });
    expect("payload" in r && [r.payload.instagram, r.payload.linkedin]).toEqual(["sara.h", "sara-al-harbi"]);
    expect(error({ instagram: "@sara_h" })).toBeNull();
    expect(error({ instagram: "sara h" })).toBe("instagram");
    expect(error({ linkedin: "linkedin.com/company/micromobility" })).toBe("linkedin");
  });

  it("needs a profession - letters, 2 to 80 characters - and sends the ride news answer", () => {
    for (const x of ["", "A", "123", "<b>Chef</b>", "x".repeat(81)]) expect(error({ profession: x }), x).toBe("profession");
    for (const x of ["Chef", "مهندس", "  Civil   engineer "]) expect(error({ profession: x }), x).toBeNull();
    const r = send({ profession: "  Civil   engineer ", news: true });
    expect("payload" in r && [r.payload.profession, r.payload.ride_news]).toEqual(["Civil engineer", true]);
  });

  it("needs to know who each learner is, their gender and their riding so far, from the lists", () => {
    expect(learnerError({ who: "" })?.error).toBe("learner_who");
    expect(learnerError({ who: "parent" as LearnerFields["who"] })?.error).toBe("learner_who");
    expect(learnerError({ gender: "" }, friend)?.error).toBe("learner_gender");
    expect(learnerError({ gender: "other" as LearnerFields["gender"] }, friend)?.error).toBe("learner_gender");
    expect(learnerError({ level: "" })?.error).toBe("level");
    expect(learnerError({ level: "expert" as LearnerFields["level"] })?.error).toBe("level");
  });

  it("takes a child's or another adult's name with the letters rule, each part two letters or more, up to 60 characters", () => {
    for (const base of [kid, friend]) {
      for (const n of ["", "O", "Omar 2", "Lina_S", "a".repeat(61), "Lina S"]) expect(learnerError({ name: n }, base)?.error, n).toBe("learner_name");
      for (const n of ["عمر", "Md. Rahman", "Lina", "Kerry-Ann"]) expect(learnerError({ name: n }, base), n).toBeNull();
    }
  });

  it("needs a first and last name for the person signing up, letters and periods, each part two letters or more", () => {
    for (const n of ["Sara", "Sara K", "Sara 2nd", "Sara_Harbi X", "S. Harbi", "  "]) expect(error({ name: n }), n).toBe("name");
    for (const n of ["Md. Rahman", "سارة الحربي", "Kerry-Ann Stander", "अमित कुमार"]) expect(error({ name: n }), n).toBeNull();
    expect(error({ name: `Sara ${"a".repeat(116)}` })).toBe("name"); // 121 characters
  });

  it("reads a Saudi mobile typed any usual way, and another country's with its code", () => {
    for (const p of ["0551234567", "551234567", "+966 55 123 4567", "٠٥٥١٢٣٤٥٦٧", "+44 7700 900123"]) expect(error({ phone: p }), p).toBeNull();
    for (const p of ["", "12345", "+966112345678", "+9665512345"]) expect(error({ phone: p }), p).toBe("phone");
  });

  it("needs an email and keeps notes to 600 characters", () => {
    expect(error({ email: "" })).toBe("email");
    expect(error({ email: "sara@example" })).toBe("email");
    expect(error({ notes: "x".repeat(600) })).toBeNull();
    expect(error({ notes: "x".repeat(601) })).toBe("notes");
  });

  it("needs the Privacy Notice box, and sends the notice's version", () => {
    expect(error({ privacy: false })).toBe("privacy");
    expect(learnPayload(form, "en", "", TODAY)).toEqual({ error: "privacy" });
  });

  it("sends the page's language, English when it is not a two-letter code", () => {
    const zh = learnPayload(form, "zh", "2026-09-25", TODAY), odd = learnPayload(form, "zh-Hans", "2026-09-25", TODAY);
    expect("payload" in zh && zh.payload.lang).toBe("zh");
    expect("payload" in odd && odd.payload.lang).toBe("en");
  });
});

describe("the pieces", () => {
  it("ageOn counts whole years, the birthday itself included, and refuses a day that does not exist", () => {
    expect(ageOn("1996-02-10", "2026-02-09")).toBe(29);
    expect(ageOn("1996-02-10", "2026-02-10")).toBe(30);
    expect(ageOn("2000-02-29", "2026-02-28")).toBe(25);
    expect(ageOn("1996-02-30", "2026-09-28")).toBeNull();
  });

  it("igNorm and liNorm leave the bare handle, as the community form does", () => {
    expect(igNorm(" @sara.h ")).toBe("sara.h");
    expect(igNorm("instagram.com/sara.h/")).toBe("sara.h");
    expect(liNorm("https://sa.linkedin.com/in/sara-al-harbi?trk=x")).toBe("sara-al-harbi");
    expect(liNorm("in/sara")).toBe("sara");
  });

  it("wholeNumber reads Arabic-Indic and Persian digits and nothing else in the box", () => {
    expect(wholeNumber("١٢٠")).toBe(120);
    expect(wholeNumber("۱۶۵")).toBe(165);
    expect(wholeNumber(" 7 ")).toBe(7);
    for (const x of ["", "7 years", "-5", "1e2", "1000"]) expect(wholeNumber(x), x).toBeNull();
  });

  it("emailOk is the database's pattern, on the lower-cased address", () => {
    for (const e of ["a.b+c@example.co", "o'neil@mail.example.sa", "x_y%z@a-b.io"]) expect(emailOk(e), e).toBe(true);
    for (const e of ["a@b", "a b@example.com", "a@example.c", "Sara@Example.com", "a@@example.com"]) expect(emailOk(e), e).toBe(false);
  });

  it("phoneOk: +9665 and eight digits for Saudi Arabia, 8 to 15 digits elsewhere", () => {
    expect(phoneOk("+966551234567")).toBe(true);
    expect(phoneOk("+4915112345678")).toBe(true);
    expect(phoneOk("+966112345678")).toBe(false);
    expect(phoneOk("+1234567")).toBe(false);
    expect(phoneOk("0551234567")).toBe(false);
  });

  it("namePartsOk splits at spaces and periods, as _name_parts_ok does", () => {
    expect(namePartsOk("Md. Rahman")).toBe(true);
    expect(namePartsOk("Mohd.Ali")).toBe(true);
    expect(namePartsOk("Ali K")).toBe(false);
    expect(namePartsOk("A.Rahman")).toBe(false);
    expect(namePartsOk("कि")).toBe(true); // a letter and its vowel sign: two characters, as Postgres counts them
  });
});

describe("the page's frame", () => {
  // The page opens whatever the site's state (proxy.ts); while the site is Coming Soon it must not
  // lead into it. The site's browser checks run it open only (MM_TEST_SITE_OPEN), so the choice is
  // checked here.
  const open = { "site.coming_soon": false };
  it("stands alone while the site is Coming Soon, whatever the Experiences switch says", () => {
    expect(learnFrame(null, false)).toBe("alone"); // nothing read: Coming Soon
    expect(learnFrame({ "site.coming_soon": true }, false)).toBe("alone");
    expect(learnFrame({ "site.coming_soon": true, "page.experiences.visible": true }, false)).toBe("alone");
    expect(learnFrame(open, false, false)).toBe("alone"); // Home not released: closed whatever staff set
  });
  it("has the site's header and footer once the site is open, the Experiences page on or off", () => {
    expect(learnFrame(open, false)).toBe("site");
    expect(learnFrame({ ...open, "page.experiences.visible": true }, false)).toBe("site");
  });
  it("shows staff previewing the closed site the page as it will be", () => {
    expect(learnFrame({ "site.coming_soon": true }, true)).toBe("site");
  });
});
