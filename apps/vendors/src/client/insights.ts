// Insights: the venue's year with the Saturday riders, from what the portal already reads (the
// calendar a year back and a year ahead, and the riders' ratings MicroMobility shared): breakfasts
// hosted, what is coming, riders booked against the turnout the venue reported, the riders' average
// breakfast score over the last six shared, and the venue's own ratings.

import { rpc } from "./api";
import { app, button, errorNote, t } from "./app";
import { aheadDays, calendarRange } from "./calendar";
import { addDays, longDate, num } from "./dates";
import { clear, h, uid } from "./dom";
import { icon, type IconName } from "./icons";
import { insights, scoreText, type CalDay, type SharedRatings } from "./model";

export async function renderInsights(main: HTMLElement): Promise<void> {
  const today = app.me!.today;
  clear(main);
  main.append(h("h1", {}, t("insightsTitle")), h("p", { class: "loading", role: "status" }, t("loading")));
  const [past, up, said] = await Promise.all([
    rpc<CalDay[]>("vendor_calendar", { p_from: addDays(today, -365), p_to: addDays(today, -1) }),
    calendarRange(today, addDays(today, aheadDays(app.me!.tier.horizon_days))),
    rpc<SharedRatings[]>("vendor_shared_ratings_mine"),
  ]);
  clear(main);
  main.append(h("h1", {}, t("insightsTitle")), h("p", { class: "lede" }, t("insIntro")));
  if (!past.ok || !up.ok) {
    main.append(errorNote(!past.ok ? past.code : (up as { code: string }).code), button(t("retry"), { onclick: () => void renderInsights(main) }));
    return;
  }
  const s = insights([...(past.data || []), ...(up.data || [])], said.ok && Array.isArray(said.data) ? said.data : [], today);
  const L = app.lang;
  const tile = (ic: IconName, label: string, value: string, sub: string) =>
    h("li", { class: "stat" }, icon(ic), h("p", { class: "stat-label" }, label), h("p", { class: "stat-value" }, value), sub ? h("p", { class: "hint" }, sub) : null);
  main.append(h("ul", { class: "stats", "aria-label": t("insightsTitle") },
    tile("check", t("insHosted"), num(s.hosted, L), ""),
    tile("calendar", t("insUpcoming"), num(s.upcoming, L), ""),
    tile("star", t("insShared"), s.sharedAvg != null ? t("insOutOf10", { score: scoreText(L, s.sharedAvg) }) : "-",
      s.sharedAvg != null ? t("insSharedSub", { n: num(s.sharedCount, L) }) : t("insSharedNone")),
    tile("star", t("insOwn"), s.ownAvg != null ? t("insOutOf5", { score: scoreText(L, s.ownAvg) }) : "-",
      s.ownAvg != null ? t("insOwnSub", { n: num(s.ownCount, L) }) : t("insOwnNone"))));
  const id = uid("recent");
  const sec = h("section", { class: "card", "aria-labelledby": id }, h("h2", { id }, t("insRecentTitle")));
  if (!s.recent.length) sec.append(h("p", { class: "hint" }, t("insRecentNone")));
  else {
    sec.append(h("table", { class: "ins-table" },
      h("thead", {}, h("tr", {}, h("th", { scope: "col" }, t("insDate")), h("th", { scope: "col" }, t("insBooked")), h("th", { scope: "col" }, t("insCame")))),
      h("tbody", {}, ...s.recent.map((r) => h("tr", {},
        h("th", { scope: "row" }, longDate(r.day, L)),
        h("td", {}, r.riders != null ? num(r.riders, L) : "-"),
        h("td", {}, r.turnout != null ? num(r.turnout, L) : t("insNotSaid")))))));
  }
  main.append(sec);
}
