import { describe, expect, it } from "vitest";
import {
  aboutArgs, cityFile, cleanChanges, cleanFix, countryOk, dobError, fixClean, fixItems, fullNameError, imageKind, initials, joinName3, nameCharsOk,
  nameError, namePartsOk, nameTyped, normPhone, passwordError, passwordOk, photoBase, photoUrlOk, profileArgs, profileError, purchasesOf,
  socNorm, socRead, socialsChanged, splitName3, splitPhone, tierOf, daysUntil,
} from "../account-profile";

// My Account's details on the website follow the booking app's own rules (renderAccount /
// saveAccount, the owner, 2026-10-03): the same name rule, birth-date window, phone form, handles,
// bike types and refusals, and a save that only ever writes what the rider changed.
const TODAY = "2026-10-03";

describe("names", () => {
  it("allow letters of any script, marks, spaces and periods, every word two letters or more", () => {
    expect(nameCharsOk("Md. Rahman", "محمد", "राम")).toBe(true);
    expect(nameCharsOk("Al-Harbi")).toBe(false);
    expect(nameCharsOk("Sara2")).toBe(false);
    expect(nameCharsOk(".Ali")).toBe(false);
    expect(namePartsOk("Md. Rahman")).toBe(true);
    expect(namePartsOk("A Khan")).toBe(false);
    expect(namePartsOk("J.R. Smith")).toBe(false);
    expect(nameTyped("Al-Harbi 3")).toBe("Al Harbi ");
    expect(nameTyped("..Ali")).toBe("Ali");
  });
  it("split into three boxes and join back in title case", () => {
    expect(splitName3("Malik Anas Alnajjar")).toEqual({ first: "Malik", middle: "Anas", last: "Alnajjar" });
    expect(splitName3("Malik")).toEqual({ first: "Malik", middle: "", last: "" });
    expect(joinName3("malik", "", "alnajjar")).toBe("Malik Alnajjar");
    expect(nameError("Malik", "", "")).toBe("name_missing");
    expect(nameError("Malik", "", "Al-Najjar")).toBe("name_chars");
    expect(nameError("Malik", "A", "Najjar")).toBe("name_short");
    expect(nameError("Malik", "", "Najjar")).toBeNull();
    expect(fullNameError("Sara")).toBe("name_missing");
    expect(initials("malik alnajjar")).toBe("MA");
  });
});

describe("contact, height and birth date", () => {
  it("stores a mobile with its country code", () => {
    expect(normPhone("0551234567", "+966")).toBe("+966551234567");
    expect(normPhone("551234567", "+966")).toBe("+966551234567");
    expect(normPhone("+9660551234567", "+966")).toBe("+966551234567");
    expect(normPhone("00971501234567", "+966")).toBe("+971501234567");
    expect(normPhone("٠٥٥١٢٣٤٥٦٧", "+966")).toBe("+966551234567");
    expect(normPhone("501234567", "+971")).toBe("+971501234567");
    expect(splitPhone("+971501234567")).toEqual({ cc: "+971", num: "501234567" });
    expect(splitPhone("+447700900000")).toEqual({ cc: "+966", num: "+447700900000" });
  });
  it("takes a birth date at least 5 and at most 100 years ago, never in the future", () => {
    expect(dobError("2000-05-01", TODAY)).toBeNull();
    expect(dobError("2021-10-03", TODAY)).toBeNull(); // five today
    expect(dobError("2021-10-04", TODAY)).toBe("birth_young");
    expect(dobError("2027-01-01", TODAY)).toBe("birth_future");
    expect(dobError("1926-10-02", TODAY)).toBe("birth_old");
    expect(dobError("2001-02-30", TODAY)).toBe("birth_future");
  });
  it("knows the app's countries (never Israel) and their city files", () => {
    expect(countryOk("Palestine")).toBe(true);
    expect(countryOk("Israel")).toBe(false);
    expect(cityFile("Saudi Arabia")).toBe("/cities/sa.json");
    expect(cityFile("Israel")).toBeNull();
  });
});

describe("socials", () => {
  it("reduce a pasted link or @handle to the handle, and name the first that cannot be right", () => {
    expect(socNorm("https://www.instagram.com/mm.jeddah/?hl=en")).toBe("mm.jeddah");
    expect(socNorm("@mm_jeddah")).toBe("mm_jeddah");
    expect(socNorm("https://www.linkedin.com/in/malik-n/")).toBe("malik-n");
    expect(socRead({ instagram: "@mm", x: "", tiktok: " ", linkedin: "linkedin.com/in/abc" })).toEqual({ val: { instagram: "mm", linkedin: "abc" } });
    expect(socRead({ instagram: "", x: "" })).toEqual({ val: null });
    expect(socRead({ x: "way_too_long_for_x_handles" })).toEqual({ err: "x" });
    expect(socialsChanged({ instagram: "mm" }, { instagram: "mm" })).toBe(false);
    expect(socialsChanged(null, { instagram: "mm" })).toBe(true);
    expect(socialsChanged(null, null)).toBe(false);
  });
});

describe("the save", () => {
  const cur = { name: "Malik Najjar", email: "m@x.sa", phone: "+966551234567", height: 175, type_preference: "Road", birth_date: "1999-01-01", country: "Saudi Arabia", city: "Jeddah", nationality: "Jordan", socials: null, gender: "male" };
  it("checks only what changed, and refuses as the app does", () => {
    expect(cleanChanges({}, cur, TODAY)).toEqual({ ok: { core: {}, about: {} } });
    expect(cleanChanges({ name: "Malik Al-Najjar" }, cur, TODAY)).toEqual({ error: "name_chars" });
    expect(cleanChanges({ email: "nope" }, cur, TODAY)).toEqual({ error: "email" });
    expect(cleanChanges({ email: "", phone: "" }, cur, TODAY)).toEqual({ error: "contact" });
    expect(cleanChanges({ height: 99 }, cur, TODAY)).toEqual({ error: "height" });
    expect(cleanChanges({ birth_date: "2024-01-01" }, cur, TODAY)).toEqual({ error: "birth_young" });
    expect(cleanChanges({ nationality: "Israel" }, cur, TODAY)).toEqual({ error: "nationality" });
    expect(cleanChanges({ country: "Israel" }, cur, TODAY)).toEqual({ error: "country" });
    expect(cleanChanges({ type_preference: "Any" }, cur, TODAY)).toEqual({ error: "type" });
    expect(cleanChanges({ gender: "" }, cur, TODAY)).toEqual({ error: "gender" });
    expect(cleanChanges({ profession: "x" }, cur, TODAY)).toEqual({ error: "profession" });
    expect(cleanChanges({ workplace: "<b>" }, cur, TODAY)).toEqual({ error: "workplace" });
    expect(cleanChanges({ heard_from: "desk" }, cur, TODAY)).toEqual({ error: "heard" });
    expect(cleanChanges({ socials: { tiktok: "bad handle!" } }, cur, TODAY)).toEqual({ error: "social_tiktok" });
  });
  it("lays the changes over the account as it is now, and a new country drops the old city", () => {
    const c = cleanChanges({ name: "malik anas najjar", country: "Palestine", type_preference: "Own" }, cur, TODAY);
    expect("ok" in c && c.ok.core).toEqual({ name: "Malik Anas Najjar", country: "Palestine", city: null, type_preference: "Own" });
    const args = profileArgs(cur, "ok" in c ? c.ok.core : {});
    expect(args).toEqual({ p_name: "Malik Anas Najjar", p_email: "m@x.sa", p_phone: "+966551234567", p_height: 175, p_type_preference: "Own",
      p_birth_date: "1999-01-01", p_country: "Palestine", p_city: null, p_nationality: "Jordan" });
    expect(profileArgs(cur, { city: "Jeddah" })).toBeNull();
  });
  it("keeps profession and company on file unless changed; heard and gender only change to an answer", () => {
    const ab = { profession: "Engineer", workplace: "Sela", heard_from: "friend" };
    expect(aboutArgs(ab, cur, {})).toBeNull();
    expect(aboutArgs(ab, cur, { workplace: "" })).toEqual({ p_profession: "Engineer", p_workplace: null, p_heard_from: null, p_gender: null });
    expect(aboutArgs(ab, cur, { heard_from: "instagram", gender: "female" })).toEqual({ p_profession: "Engineer", p_workplace: "Sela", p_heard_from: "instagram", p_gender: "female" });
    expect(aboutArgs(ab, cur, { heard_from: "friend", gender: "male" })).toBeNull();
  });
  it("reads the database's refusals", () => {
    expect(profileError("phone_taken")).toBe("phone_taken");
    expect(profileError("RATE_LIMITED")).toBe("rate");
    expect(profileError("new row violates", "name_short")).toBe("name_short");
    expect(profileError("BAD_INPUT", "workplace")).toBe("workplace");
    expect(profileError("BAD_INPUT", "profession")).toBe("profession");
    expect(profileError("whatever")).toBe("generic");
  });
});

describe("passwords, corrections, photos, purchases, the season", () => {
  it("passwords follow the app's rule and its refusals", () => {
    expect(passwordOk("Abcdefg1")).toBe(true);
    expect(passwordOk("abcdefg1")).toBe(false);
    expect(passwordOk("Abcdefgh")).toBe(false);
    expect(passwordOk("Ab1")).toBe(false);
    for (const [m, e] of [["BAD_PASSWORD", "bad"], ["WEAK_PASSWORD", "weak"], ["SAME_PASSWORD", "same"], ["LOCKED", "locked"], ["NO_CHANGE_DUE", "notdue"], ["BAD_TOKEN", "signin"], ["?", "generic"]]) expect(passwordError(m)).toBe(e);
  });
  it("asks corrections in the app's order, country and city as one answer", () => {
    expect(fixClean(["photo", "city", "name", "nope", "country"])).toEqual(["name", "country", "city", "photo"]);
    expect(fixItems(["name", "country", "city", "photo"])).toEqual(["name", "residence", "photo"]);
    const base = photoBase("https://x.supabase.co");
    expect(cleanFix(["name", "email", "height"], { name: "Ali K", email: "a@privaterelay.appleid.com", height: "99" }, base, TODAY))
      .toEqual({ errors: { name: "name_short", email: "relay", height: "height" } });
    expect(cleanFix(["name", "country", "city", "photo", "password"], { name: "ali khan", country: "Palestine", city: "Jerusalem", photo: `${base}p/abc123.jpg`, password: "Secret12" }, base, TODAY))
      .toEqual({ values: { name: "Ali Khan", country: "Palestine", city: "Jerusalem", photo: `${base}p/abc123.jpg`, password: "Secret12" } });
    expect(cleanFix(["photo"], { photo: "https://evil.example/p/a.jpg" }, base, TODAY)).toEqual({ errors: { photo: "photo" } });
  });
  it("takes only this site's own photo addresses and real images", () => {
    const base = photoBase("https://x.supabase.co/");
    expect(base).toBe("https://x.supabase.co/storage/v1/object/public/photos/");
    expect(photoUrlOk(`${base}p/AbC_1-2.jpg`, base)).toBe(true);
    expect(photoUrlOk(`${base}p/../x.jpg`, base)).toBe(false);
    expect(photoUrlOk(`${base}q/a.jpg`, base)).toBe(false);
    expect(imageKind(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0]))).toBe("jpg");
    expect(imageKind(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe("png");
    expect(imageKind(new TextEncoder().encode("RIFF1234WEBPVP8 "))).toBe("webp");
    expect(imageKind(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
  });
  it("totals the purchases that stand, leaving voided and refunded ones out", () => {
    const p = purchasesOf([
      { id: "1", at: "2026-10-01T18:00:00Z", name: "Water", qty: 2, price: 5, pay: "cash", voided: false, refunded: false },
      { id: "2", name: "Gel", qty: 1, price: 12.5, pay: "card", voided: true, refunded: false },
      { id: "3", name: "Tube", qty: 1, price: 30, pay: "refunded", voided: false, refunded: false },
      { id: "4", name: "meta", category: "__cardmeta__", qty: 1, price: 99 },
    ]);
    expect(p.rows.map((r) => r.id)).toEqual(["1", "2", "3"]);
    expect(p.rows[2].refunded).toBe(true);
    expect(p.total).toBe(10);
    expect(purchasesOf(null)).toEqual({ rows: [], total: 0 });
  });
  it("names the tier as the app does", () => {
    expect(tierOf(0)).toEqual({ key: "newcomer", next: { key: "regular", need: 3 }, pct: 4 });
    expect(tierOf(5)).toEqual({ key: "regular", next: { key: "pro", need: 5 }, pct: 29 });
    expect(tierOf(10).key).toBe("pro");
    expect(tierOf(60)).toEqual({ key: "legend", next: null, pct: 100 });
    expect(daysUntil("2026-10-05", TODAY)).toBe(2);
    expect(daysUntil("2026-10-01", TODAY)).toBe(0);
  });
});
