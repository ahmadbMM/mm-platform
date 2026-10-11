import { describe, expect, it } from "vitest";
import { pwWaLink, waLink } from "../src/client/contact";

// Forgotten passwords go to +966579543977, everything else to the business line (the owner, 2026-10-11).
describe("contact links", () => {
  it("a forgotten password goes to its own WhatsApp number", () => {
    expect(pwWaLink("my login: x")).toBe("https://wa.me/966579543977?text=my%20login%3A%20x");
  });
  it("other messages keep the business line", () => {
    expect(waLink("hi")).toBe("https://wa.me/966566668818?text=hi");
  });
});
