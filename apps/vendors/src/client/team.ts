// Team (owners only): who can sign in for the venue (vendor_team), read only. MicroMobility adds and
// removes logins from its staff page; the owner can sign out their own other devices here too.

import { rpc } from "./api";
import { announce, app, busy, button, errorNote, note, t } from "./app";
import { clear, h, uid } from "./dom";
import { roleText } from "./venue";

type Member = { id: number; name: string; login: string; role: string; active: boolean; last_login_at: string | null; me: boolean };

function stamp(iso: string | null): string {
  if (!iso) return t("teamNever");
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return t("teamNever");
  return new Intl.DateTimeFormat(`${app.lang === "ar" ? "ar-SA" : "en-GB"}-u-ca-gregory-nu-latn`, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Riyadh" }).format(d);
}

export async function renderTeam(main: HTMLElement): Promise<void> {
  const me = app.me!;
  clear(main);
  main.append(h("h1", {}, t("teamTitle")), h("p", { class: "loading", role: "status" }, t("loading")));
  const r = await rpc<Member[]>("vendor_team");
  clear(main);
  const venue = app.lang === "ar" && me.venue.name_ar ? me.venue.name_ar : me.venue.name;
  main.append(h("h1", {}, t("teamTitle")), h("p", { class: "lede" }, t("teamIntro", { venue })));
  if (!r.ok) {
    main.append(errorNote(r.code), button(t("retry"), { onclick: () => void renderTeam(main) }));
    return;
  }
  const id = uid("team");
  const rows = Array.isArray(r.data) ? r.data : [];
  main.append(h("section", { class: "card", "aria-labelledby": id },
    h("h2", { id, class: "sr-only" }, t("teamTitle")),
    h("table", { class: "ins-table team" },
      h("thead", {}, h("tr", {}, ...(["teamName", "teamLogin", "teamRole", "teamStatus", "teamLast"] as const).map((k) => h("th", { scope: "col" }, t(k))))),
      h("tbody", {}, ...rows.map((m) => h("tr", { class: m.active ? "" : "is-off" },
        h("th", { scope: "row" }, m.name || "-", m.me ? h("span", { class: "hint" }, ` ${t("teamYou")}`) : null),
        h("td", { dir: "ltr" }, m.login),
        h("td", {}, roleText(m.role)),
        h("td", {}, m.active ? t("teamActive") : t("teamOff")),
        h("td", {}, stamp(m.last_login_at))))))));
  const msg = h("div", { class: "msg" });
  const go = button(t("signOutOthers"), { icon: "signout" });
  go.addEventListener("click", async () => {
    clear(msg);
    busy(go, true, t("sending"));
    const res = await rpc<number>("vendor_logout_others");
    busy(go, false, t("signOutOthers"));
    if (!res.ok) { msg.append(errorNote(res.code)); return; }
    const text = t("signedOutOthers", { n: Number(res.data) || 0 });
    msg.append(note("ok", text));
    announce(text);
  });
  main.append(h("section", { class: "card devices" }, h("p", { class: "hint" }, t("securityIntro")), msg, h("div", { class: "actions start" }, go)));
}
