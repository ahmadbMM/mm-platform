import { describe, expect, it } from "vitest";
import { createElement, type ReactElement } from "react";
// The site has no @types/react-dom; this test needs one function of it (as rating.test.ts does).
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import { fmtSar } from "../fill";
import { Sar, riyalNum, sarText } from "@/components/booking/Sar";

const renderToStaticMarkup = renderUntyped as (el: ReactElement) => string;

// One decimal style for prices (the research's row 18, 2026-11-10): a price with a fraction shows two decimals, a whole
// one none; and the riyal sign, which screen readers are not known to say, is drawn for the eye with a word for them.
describe("prices", () => {
  it("shows two decimals for a fraction and none for a whole price", () => {
    expect(fmtSar(57.5, "en")).toBe("SAR 57.50");
    expect(fmtSar(75, "en")).toBe("SAR 75");
    expect(fmtSar(1250, "en")).toBe("SAR 1,250");
    expect(fmtSar(57.5, "ar")).toBe("57.50 ر.س");
    expect(fmtSar(57.5, "de")).toMatch(/57,50/);
    expect(fmtSar(75, "de")).not.toMatch(/,/);
    expect(riyalNum(57.5)).toBe("57.50");
    expect(riyalNum(75)).toBe("75");
    expect(riyalNum(75.004)).toBe("75");
    expect(sarText(57.5)).toBe("⁦⃁ 57.50⁩");
  });
  it("hides the riyal sign from screen readers and gives them the word", () => {
    const html = renderToStaticMarkup(createElement(Sar, { n: 57.5, word: "SAR" }));
    expect(html).toBe('<bdi class="tk-amt" dir="ltr"><span aria-hidden="true">⃁</span><span class="mm-sr">SAR</span> 57.50</bdi>');
  });
});
