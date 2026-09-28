import { describe, expect, it } from "vitest";
import { HEARD, emailOk, learnPayload, phoneOk, wholeNumber, type LearnFields } from "../learn";
import { learnFrame } from "../learn-page";
import { namePartsOk } from "../rpc-client";

// The Learn to ride sign-up (/experiences/learn): the form refuses what learn_apply() would, with
// the database's own error codes, one at a time in the form's order, and sends exactly what the
// database reads.

const adult: LearnFields = {
  forWhom: "self", learnerName: "", age: "30", gender: "female", height: "165", level: "never",
  name: "Sara Al Harbi", phone: "0551234567", email: "Sara@Example.com", heard: "instagram", notes: "", privacy: true,
};
const kid: LearnFields = { ...adult, forWhom: "child", learnerName: "Omar", age: "7", gender: "male", height: "120" };
const send = (x: Partial<LearnFields>, base: LearnFields = adult) => learnPayload({ ...base, ...x }, "en", "2026-09-25");
const error = (x: Partial<LearnFields>, base: LearnFields = adult) => {
  const r = send(x, base);
  return "error" in r ? r.error : null;
};

describe("learnPayload", () => {
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

  it("sends a sign-up for oneself as the database reads it", () => {
    expect(learnPayload({ ...adult, notes: "  A little nervous.  " }, "ar", "2026-09-25")).toEqual({
      payload: {
        for_whom: "self", name: "Sara Al Harbi", email: "sara@example.com", phone: "+966551234567", learner_name: "", learner_age: 30,
        learner_gender: "female", learner_height: 165, level: "never", heard_from: "instagram",
        notes: "A little nervous.", lang: "ar", privacy_version: "2026-09-25",
      },
    });
  });

  it("sends a child's first name, and leaves a name typed for oneself out", () => {
    const r = send({ learnerName: "  Omar-Ali ", level: "tried" }, kid);
    expect("payload" in r && r.payload).toMatchObject({ for_whom: "child", learner_name: "Omar Ali", learner_age: 7, learner_gender: "male", learner_height: 120, level: "tried" });
    const own = send({ learnerName: "Someone" });
    expect("payload" in own && own.payload.learner_name).toBe("");
  });

  it("asks who is learning first, then goes down the form one thing at a time", () => {
    const empty: LearnFields = { forWhom: "", learnerName: "", age: "", gender: "", height: "", level: "", name: "", phone: "", email: "", heard: "", notes: "", privacy: false };
    expect(learnPayload(empty, "en", "2026-09-25")).toEqual({ error: "for_whom" });
    const steps: [Partial<LearnFields>, string | null][] = [
      [{ forWhom: "child" }, "learner_name"],
      [{ learnerName: "Lina" }, "learner_age"],
      [{ age: "6" }, "learner_gender"],
      [{ gender: "female" }, "learner_height"],
      [{ height: "115" }, "level"],
      [{ level: "refresh" }, "name"],
      [{ name: "Huda Saleh" }, "phone"],
      [{ phone: "+966 50 123 4567" }, "email"],
      [{ email: "huda@example.sa" }, "heard_from"],
      [{ heard: "invited" }, "privacy"],
      [{ privacy: true }, null],
    ];
    let form = empty;
    for (const [add, next] of steps) {
      form = { ...form, ...add };
      const r = learnPayload(form, "en", "2026-09-25");
      expect("error" in r ? r.error : null, JSON.stringify(add)).toBe(next);
    }
  });

  it("takes 12 to 99 for oneself - younger signs up as a child - and 3 to 17 for a child", () => {
    expect(error({ age: "11" })).toBe("learner_age");
    expect(error({ age: "12" })).toBeNull();
    expect(error({ age: "99" })).toBeNull();
    expect(error({ age: "100" })).toBe("learner_age");
    expect(error({ age: "2" }, kid)).toBe("learner_age");
    expect(error({ age: "3" }, kid)).toBeNull();
    expect(error({ age: "17" }, kid)).toBeNull();
    expect(error({ age: "18" }, kid)).toBe("learner_age");
  });

  it("takes a height from 80 to 250 cm", () => {
    for (const h of ["79", "251", "1.65", "", "abc"]) expect(error({ height: h }), h).toBe("learner_height");
    for (const h of ["80", "250", " 170 "]) expect(error({ height: h }), h).toBeNull();
  });

  it("needs a gender and a riding level from the lists", () => {
    expect(error({ gender: "" })).toBe("learner_gender");
    expect(error({ gender: "other" as LearnFields["gender"] })).toBe("learner_gender");
    expect(error({ level: "" })).toBe("level");
    expect(error({ level: "expert" as LearnFields["level"] })).toBe("level");
  });

  it("needs a first and last name, letters and periods, each part two letters or more", () => {
    for (const n of ["Sara", "Sara K", "Sara 2nd", "Sara_Harbi X", "S. Harbi", "  "]) expect(error({ name: n }), n).toBe("name");
    for (const n of ["Md. Rahman", "سارة الحربي", "Kerry-Ann Stander", "अमित कुमार"]) expect(error({ name: n }), n).toBeNull();
    expect(error({ name: `Sara ${"a".repeat(116)}` })).toBe("name"); // 121 characters
  });

  it("takes a child's first name alone, with the same letters rule, up to 60 characters", () => {
    expect(error({ learnerName: "" }, kid)).toBe("learner_name");
    expect(error({ learnerName: "O" }, kid)).toBe("learner_name");
    expect(error({ learnerName: "Omar 2" }, kid)).toBe("learner_name");
    expect(error({ learnerName: "عمر" }, kid)).toBeNull();
    expect(error({ learnerName: "a".repeat(61) }, kid)).toBe("learner_name");
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
    expect(learnPayload(adult, "en", "")).toEqual({ error: "privacy" });
  });

  it("sends the page's language, English when it is not a two-letter code", () => {
    const zh = learnPayload(adult, "zh", "2026-09-25"), odd = learnPayload(adult, "zh-Hans", "2026-09-25");
    expect("payload" in zh && zh.payload.lang).toBe("zh");
    expect("payload" in odd && odd.payload.lang).toBe("en");
  });
});

describe("the pieces", () => {
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
