// Opportunities (#) and one opportunity (#o/<session>). A profile first, staff's yes on the person once, then one tap per
// opportunity (the owner, 2026-11-09; volunteer_interest answers VOL_PROFILE / VOL_PENDING until then).

import { rpc } from "./api";
import { append, h, uid } from "./dom";
import { dayLabel, sessionName, t, timesLabel, whenLabel, type Key } from "./i18n";
import { icon } from "./icons";
import { briefTick, mapsLink } from "./home";
import { go, load, myShift, render, S, say, setNote, standing, type Mine, type Opp } from "./state";
import { button, chip, dateBlock, link, metaLine, note } from "./ui";

const statusWords: Record<string, Key> = { interested: "stInterested", accepted: "stAccepted", declined: "stDeclined", withdrawn: "stWithdrawn", done: "stThanks", no_show: "stNoShow", ended: "stEnded" };
const statusTone = (st: string) => (st === "accepted" || st === "done" ? "on" : st === "interested" ? "wait" : "");

/** Places left: needed minus accepted, when staff said how many. */
function placesChip(o: Opp): HTMLElement | null {
  if (!o.needed) return null;
  const left = Math.max(0, o.needed - (o.accepted || 0));
  return left ? chip(t("oppLeft", left), "", "people") : chip(t("oppFull"), "", "people");
}

export function viewList(main: HTMLElement): void {
  main.appendChild(h("h1", {}, t("navOpps")));
  if (S.err) { append(main, note(S.err, "alert"), button(t("retry"), () => void load().then(render))); return; }
  if (!S.opps) { main.appendChild(note(t("loading"))); return; }
  if (!S.opps.length) { main.appendChild(note(t("oppNone"))); return; }
  main.appendChild(h("div", { class: "list" }, ...S.opps.map((o) => {
    const sh = myShift(o.id);
    return h("a", { class: "card opp", href: `#o/${encodeURIComponent(o.id)}`, "data-id": o.id },
      dateBlock(o.date),
      h("div", { class: "opp-what" },
        h("h2", {}, sessionName(o)),
        o.time ? metaLine("clock", timesLabel(o.time)) : null,
        o.location ? metaLine("pin", o.location) : null,
        h("div", { class: "chips" },
          sh && statusWords[sh.status] ? chip(t(sh.status === "interested" ? "interestSent" : statusWords[sh.status]), statusTone(sh.status)) : null,
          placesChip(o),
          ...(o.roles ?? []).map((r) => chip(r)),
          !o.signup_open && !sh ? chip(t("oppClosedChip")) : null)),
      icon("go", 18, true));
  })));
}

export function viewOpp(main: HTMLElement, id: string): void {
  main.appendChild(h("a", { class: "backlink", href: "#" }, icon("back", 18, true), h("span", {}, t("navOpps"))));
  if (!S.opps) { main.appendChild(note(S.err || t("loading"), S.err ? "alert" : "status")); return; }
  const o = S.opps.find((x) => x.id === id);
  const sh = myShift(id);
  if (!o) { main.appendChild(note(t("oppGone"))); return; }
  main.appendChild(h("section", { class: "card opp-head" },
    h("div", { class: "next-top" }, dateBlock(o.date, true), h("div", { class: "next-what" }, h("h1", {}, sessionName(o)), h("div", { class: "chips" }, placesChip(o)))),
    h("div", { class: "metas" },
      metaLine("cal", dayLabel(o.date)),
      o.time ? metaLine("clock", timesLabel(o.time)) : null,
      o.location ? h("p", { class: "meta" }, icon("pin", 16), h("a", { href: mapsLink(o.location), target: "_blank", rel: "noopener" }, o.location)) : null,
      o.hours_mode === "fixed" && o.fixed_hours ? metaLine("medal", t("oppHours", o.fixed_hours)) : null,
      o.min_age ? metaLine("person", t("oppMinAge", o.min_age)) : null,
      metaLine("flag", t("oppRegisterBy", whenLabel(o.closes_at)))),
    o.about ? h("p", { class: "about" }, o.about) : null,
    // How many each role needs and how many are on it (rentals 20261107130000).
    o.role_needs?.length
      ? h("div", { class: "roles" }, h("p", { class: "roles-h" }, t("oppRoles")), h("div", { class: "chips" }, ...o.role_needs.map((n) => chip(`${n.name} ${n.filled}/${n.needed}`, n.filled >= n.needed ? "on" : ""))))
      : o.roles?.length ? h("div", { class: "roles" }, h("p", { class: "roles-h" }, t("oppRoles")), h("div", { class: "chips" }, ...o.roles.map((r) => chip(r)))) : null));
  main.appendChild(actionCard(o, sh));
}

function actionCard(o: Opp, sh: Mine | null): HTMLElement {
  const box = h("section", { class: "card action", id: "opp-action" });
  const st = sh?.status;
  const who = standing();
  if (who === "paused" || who === "ended") { box.appendChild(h("p", {}, t(who === "paused" ? "vdPaused" : "vdExpired"))); return box; }
  if (who === "account") { box.appendChild(h("p", {}, t(S.me?.account === "pwd" ? "vdAccountPwd" : "vdAccountDel"))); return box; }
  if (st === "accepted" || st === "done") {
    append(box, h("div", { class: "chips" }, chip(t("stAccepted"), "on", "tick"), sh?.role ? chip(sh.role) : null, sh?.lead ? chip(t("leadMark"), "lead", "flag") : null));
    if (sh?.briefing) append(box, h("div", { class: "brief" }, h("p", { class: "brief-h" }, t("vdBriefing")), h("p", { class: "brief-t" }, sh.briefing), briefTick(o.id)));
    const acts = h("div", { class: "acts" });
    if (sh?.can_work) acts.appendChild(link(t("startWork"), `#work/${encodeURIComponent(o.id)}`, "primary", "go"));
    if (!sh?.clock_in && st === "accepted") acts.appendChild(button(t("withdrawBtn"), () => void interest(o.id, false), "quiet"));
    if (acts.childElementCount) box.appendChild(acts);
    return box;
  }
  if (st === "interested") { append(box, h("p", { class: "state" }, t("stInterested")), h("div", { class: "acts" }, button(t("withdrawBtn"), () => void interest(o.id, false), "quiet"))); return box; }
  if (st === "declined" || st === "no_show" || st === "ended") { box.appendChild(h("p", { class: "state" }, t(statusWords[st]))); return box; }
  if (who === "profile") { append(box, h("p", { class: "state" }, t("profNeeded")), link(t("profSetUp"), "#profile", "primary", "go")); return box; }
  if (who === "waiting") { box.appendChild(h("p", { class: "state", id: "opp-waiting" }, t("profWaiting"))); return box; }
  if (!o.signup_open) { box.appendChild(h("p", { class: "state" }, t("oppClosedSignup"))); return box; }
  const msgId = uid("msg");
  const msg = h("textarea", { id: msgId, rows: 3, maxlength: 300 });
  let role: string | null = null;
  const roles = o.roles?.length ? h("fieldset", { class: "pick" }, h("legend", {}, t("interestRole")),
    h("div", { class: "chips" }, ...[null, ...o.roles].map((r) => {
      const rid = uid("role");
      return h("span", { class: "pick-one" },
        h("input", { type: "radio", name: "role", id: rid, value: r ?? "", checked: r === null, onchange: (() => { role = r; }) as EventListener }),
        h("label", { for: rid }, r ?? t("interestAny")));
    }))) : null;
  append(box, roles, h("div", { class: "field" }, h("label", { for: msgId }, t("interestMsg")), msg),
    button(t("interestBtn"), () => void interest(o.id, true, role, msg.value), "primary", { id: "opp-help" }, "hand"));
  return box;
}

async function interest(id: string, on: boolean, role: string | null = null, message = ""): Promise<void> {
  const r = await rpc<{ status: string }>("volunteer_interest", { p_session: id, p_on: on, p_role: role, p_message: message.trim() || null });
  if (!r.ok) {
    setNote(say(r));
    if (r.code === "VOL_TOKEN") { S.me = null; go("#signin"); return; }
    if (r.code === "VOL_PROFILE" || r.code === "VOL_PENDING") await load(); // what the server knows wins
    render();
    return;
  }
  setNote(on ? t(r.data.status === "accepted" ? "stAccepted" : "interestSent") : t("withdrawn"));
  await load();
  render();
}
