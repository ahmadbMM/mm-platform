import { describe, expect, it } from "vitest";
import { buildGroups } from "../bike-fields";
import { bikeTitle } from "../bike-i18n";
import { filled } from "../filled";
import { bikeState, ridePrice, type BikeRow } from "../bikes";

/**
 * The rule these tests exist to defend, in the owner's words:
 *
 *   "make sure all the fields that are shown in the page are only the ones added in the bike
 *    in rentals website, if fields were empty hide them from bike page"
 *
 * Everything below is a way of failing if that stops being true. The cases are not invented:
 * each one is a defect that actually shipped and was caught during the build, so a regression
 * reintroducing any of them turns this file red.
 */

/** A bike that exists and has a number. Nothing else has been filled in. */
const BARE: BikeRow = {
  name: null, size: null, type: null, status: "available", brand: null, model: null,
  groupset: null, speeds: null, colors: null, color_names: null, frame_type: null,
  bike_number: 1, in_service_date: null, retired_date: null, photo: null,
  last_serviced_at: null, wheel_size: null, brake_type: null, weight_kg: null,
  rental_price: null,
};
const bike = (over: Partial<BikeRow> = {}): BikeRow => ({ ...BARE, ...over });
const labels = (row: BikeRow, brandModelUsed = false) =>
  buildGroups(row, "en", brandModelUsed).flatMap((g) => g.fields.map((f) => f.label));

describe("only what staff filled in reaches the page", () => {
  it("renders nothing at all for a bike with only a number", () => {
    expect(buildGroups(BARE, "en", false)).toEqual([]);
  });

  it("drops a group entirely rather than showing an empty heading", () => {
    // model + size are Specification; nothing is Service, so Service must not exist
    const groups = buildGroups(bike({ model: "Rockhopper", size: "L" }), "en", false);
    expect(groups).toHaveLength(1);
    expect(groups[0].fields.map((f) => f.label)).toEqual(["Model", "Size"]);
  });

  it.each(["", "   ", "-", "—", "–", "n/a", "N/A", "null", "undefined"])(
    "treats %o as empty rather than printing it",
    (junk) => {
      expect(labels(bike({ groupset: junk, wheel_size: junk, brake_type: junk }))).toEqual([]);
    },
  );

  it("keeps the real colour names and drops the blanks beside them", () => {
    const g = buildGroups(bike({ color_names: ["", "Matte black", "  "] }), "en", false);
    expect(g[0].fields[0].value).toBe("Matte black");
  });

  it("shows no colour row when every name is blank", () => {
    expect(labels(bike({ color_names: ["", "  "] }))).toEqual([]);
  });

  it("hides a zero count instead of printing '0 speeds' or '0 kg'", () => {
    expect(labels(bike({ speeds: 0, weight_kg: 0 }))).toEqual([]);
  });

  it("does not repeat brand and model as spec rows when they are the headline", () => {
    const row = bike({ brand: "Trek", model: "Marlin 7" });
    expect(labels(row, false)).toEqual(["Brand", "Model"]);
    expect(labels(row, true)).toEqual([]);
  });
});

describe("the headline obeys the same emptiness rule as the fields", () => {
  const t = (k: string) => ({ tRoad: "Road bike", tMountain: "Mountain bike" }[k] ?? k);

  it("never lets a placeholder become the title", () => {
    // shipped bug: bikeTitle tested bare truthiness, so "-" became the h1
    expect(bikeTitle(bike({ name: "-", type: "Road" }), t).title).toBe("Road bike");
    expect(bikeTitle(bike({ name: "N/A", type: "Road" }), t).title).toBe("Road bike");
  });

  it("keeps a placeholder brand out of the headline and off the page entirely", () => {
    // shipped bug: brand "-" was accepted, so the h1 read "- FX 2" AND the dash set
    // fromBrandModel, which then pulled the genuine Model row out of the grid below it.
    const row = bike({ name: "R-AL-0001-M", brand: "-", model: "FX 2" });
    const r = bikeTitle(row, t);

    expect(r.title).toBe("FX 2");                     // not "- FX 2"

    // The model is the headline now, so it is correctly not repeated as a spec row — but the
    // dash must not have survived anywhere on the page, in either position.
    const values = buildGroups(row, "en", r.fromBrandModel).flatMap((g) =>
      g.fields.map((f) => f.value),
    );
    expect([r.title, ...values].join(" ")).not.toContain("-");
  });

  it("prefers a real name, then brand and model, then the kind of bike, then the number", () => {
    expect(bikeTitle(bike({ name: "Malik's Commuter" }), t).title).toBe("Malik's Commuter");
    expect(bikeTitle(bike({ name: "R-AL-0001-M", brand: "Trek", model: "FX 2" }), t).title).toBe("Trek FX 2");
    expect(bikeTitle(bike({ name: "R-AL-0001-M", type: "Mountain" }), t).title).toBe("Mountain bike");
    expect(bikeTitle(bike({ name: "R-AL-0001-M" }), t).title).toBe("#1");
  });
});

describe("the price is the one the rider is actually charged", () => {
  it("ignores rental_price for the types the rentals app rates by type", () => {
    // the whole fleet is Road/Mountain/Hybrid; priceForBike() ignores the column for these
    expect(ridePrice(bike({ type: "Road", rental_price: 95 }))).toBe(75);
    expect(ridePrice(bike({ type: "Mountain", rental_price: 95 }))).toBe(57.5);
    expect(ridePrice(bike({ type: "Hybrid", rental_price: 95 }))).toBe(57.5);
  });

  it("uses rental_price for the types that are priced per bike", () => {
    expect(ridePrice(bike({ type: "Kids", rental_price: 120 }))).toBe(120);
    expect(ridePrice(bike({ type: "Kids" }))).toBe(57.5);
  });

  it("states no price rather than inventing one", () => {
    // shipped bug: an unknown type fell through to a DEFAULT_PRICE constant
    expect(ridePrice(bike({ type: null }))).toBeNull();
    expect(ridePrice(bike({ type: "Unicycle" }))).toBeNull();
    expect(ridePrice(bike({ type: "Own" }))).toBeNull();
  });
});

describe("filled() is the single shared rule", () => {
  it.each([null, undefined, "", "  ", "-", "—", "n/a", "N/A"])("rejects %o", (v) => {
    expect(filled(v)).toBe(false);
  });
  it.each(["Trek", "0", 0, 8.7, "29\""])("accepts %o", (v) => {
    expect(filled(v)).toBe(true);
  });
});

describe("an unreadable status never offers the bike for hire", () => {
  it("maps the statuses the rentals app actually writes", () => {
    expect(bikeState(bike({ status: "available" }))).toBe("available");
    expect(bikeState(bike({ status: "in-use" }))).toBe("out");
    expect(bikeState(bike({ status: "maintenance" }))).toBe("hold");
    expect(bikeState(bike({ status: "retired" }))).toBe("hold");
  });

  it("rests a bike whose status it cannot read", () => {
    // shipped bug: the default branch was "available", so a typo put a Book button under a
    // bike that might be in the workshop.
    expect(bikeState(bike({ status: "avaliable" }))).toBe("hold");
    expect(bikeState(bike({ status: null }))).toBe("hold");
    expect(bikeState(bike({ status: "something new" }))).toBe("hold");
  });

  it("rests anything with a retired date, whatever the status says", () => {
    expect(bikeState(bike({ status: "available", retired_date: "2026-09-15" }))).toBe("hold");
  });
});
