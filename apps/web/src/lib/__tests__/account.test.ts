import { describe, expect, it } from "vitest";
import { decodeSession, encodeSession, sameOrigin } from "../account-core";

describe("the account cookie", () => {
  it("keeps the account id and its session token", () => {
    const v = encodeSession({ id: "c_1~x y", token: "a1b2c3d4e5f6a7b8c9d0" });
    expect(decodeSession(v)).toEqual({ id: "c_1~x y", token: "a1b2c3d4e5f6a7b8c9d0" });
  });
  it("reads nothing from a malformed cookie", () => {
    for (const v of [undefined, "", "abc", "~a1b2c3d4e5f6a7b8c9d0", "c1~short", "c1~has space in token here", "%E0%A4%A~a1b2c3d4e5f6a7b8c9d0"]) expect(decodeSession(v)).toBeNull();
  });
});

describe("sameOrigin", () => {
  it("accepts only this site", () => {
    expect(sameOrigin("https://micromobility.sa", "https://micromobility.sa/api/account")).toBe(true);
    expect(sameOrigin("https://evil.example", "https://micromobility.sa/api/account")).toBe(false);
    expect(sameOrigin(null, "https://micromobility.sa/api/account")).toBe(false);
  });
});
