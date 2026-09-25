import { describe, expect, it } from "vitest";
import { cleanName, nameOk } from "../rpc-client";

// The site-wide name rule, as the booking app and the database (_name_chars_ok) keep it:
// letters with their marks, spaces and periods (user rule 2026-09-25: "Md. Rahman").

describe("cleanName", () => {
  it("keeps a period after a letter and drops one that starts the name or a word, or doubles one", () => {
    expect(cleanName("Md. Rahman")).toBe("Md. Rahman");
    expect(cleanName("Mohd.Ali")).toBe("Mohd.Ali");
    expect(cleanName(".Ali Omar")).toBe("Ali Omar");
    expect(cleanName("Ali .Omar")).toBe("Ali Omar");
    expect(cleanName("Md.. Ali")).toBe("Md. Ali");
    expect(cleanName("Sara Khan Jr.")).toBe("Sara Khan Jr.");
  });
  it("still turns a dash into a space", () => {
    expect(cleanName("Al-Harbi")).toBe("Al Harbi");
    expect(cleanName("Kerry–Ann  Stander")).toBe("Kerry Ann Stander");
  });
});

describe("nameOk", () => {
  it("takes letters of any script with their marks, spaces and periods", () => {
    for (const n of ["Md. Rahman", "Mohd.Ali", "محمد عبد الرحمن", "مُحَمَّد", "अमित कुमार", "রবীন্দ্রনাথ ঠাকুর", "José Müller"]) expect(nameOk(cleanName(n))).toBe(true);
  });
  it("refuses digits, symbols and emoji, and a name with no letter", () => {
    for (const n of ["Malik 2", "ali@x", "O'Brien", "Malik 😀", "a_b", "علي، محمد", "."]) expect(nameOk(cleanName(n))).toBe(false);
  });
});
