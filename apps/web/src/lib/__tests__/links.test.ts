import { describe, expect, it } from "vitest";
import { bookingLink, localHref } from "../links";
import { slugId } from "../slug";

describe("localHref", () => {
  it("puts this site's pages in the visitor's language", () => {
    expect(localHref("/business", "ar")).toBe("/ar/business");
    expect(localHref("/help#warranty", "en")).toBe("/en/help#warranty");
    expect(localHref("/", "ar")).toBe("/ar");
  });
  it("leaves everything else alone", () => {
    for (const h of ["/en/business", "/ar", "/store", "/b/42", "/media/x.jpg", "/site/logo.png", "https://wa.me/966", "mailto:a@b.co", "tel:+966", "#start", "//evil.example"]) {
      expect(localHref(h, "ar")).toBe(h);
    }
  });
});

describe("slugId", () => {
  it("makes an id from an English name", () => {
    expect(slugId("Fleet Programmes", "x")).toBe("fleet-programmes");
    expect(slugId("Events & Activations", "x")).toBe("events-activations");
    expect(slugId("Škoda", "x")).toBe("skoda");
    expect(slugId("", "service-2")).toBe("service-2");
  });
});

describe("bookingLink", () => {
  it("opens the booking app in the visitor's language", () => {
    expect(bookingLink("https://micromobilityrentals.pages.dev/", "ar")).toBe("https://micromobilityrentals.pages.dev/?lang=ar");
    expect(bookingLink("https://micromobility.sa/experiences?ref=site#top", "en")).toBe("https://micromobility.sa/experiences?ref=site&lang=en#top");
  });
  it("keeps a language already chosen, and sends this site's pages through localHref", () => {
    expect(bookingLink("https://micromobilityrentals.pages.dev/?lang=fr", "ar")).toBe("https://micromobilityrentals.pages.dev/?lang=fr");
    expect(bookingLink("/club", "ar")).toBe("/ar/club");
    expect(bookingLink("#dates", "en")).toBe("#dates");
  });
});
