// Opportunities (#opps) and one opportunity (#o/<session>). A profile first, staff's yes on the person once, then one tap
// per opportunity (the owner, 2026-11-09; volunteer_interest answers VOL_PROFILE / VOL_PENDING until then). Chips say
// a state only (fix 9): the roles and the places left are lines. An opportunity that has closed still opens for anyone
// who had a shift on it, from volunteer_me (every update leads to its own opportunity, fix 13), with its close-out.

import { rpc } from "./api";
import { append, h, uid } from "./dom";
import { gathers, hoursN, sessionName, t, timesLabel, whenLabel, type Key } from "./i18n";
import { startOf } from "./ics";
import { icon } from "./icons";
import { maybeHowTo } from "./install";
import { load, myShift, noteErr, render, S, setQuiet, standing, type Mine, type Opp } from "./state";
import { briefBox, calButton, closeoutParts, comingYes, contactFact, isAhead, isDone, logistics, mapsLink, needsComing, planForm, reasonWord, withdrawAsk } from "./shift";
import { button, chip, dateBlock, link, metaLine, note, skeleton } from "./ui";

const statusWords: Record<string, Key> = { interested: "chipInterest", accepted: "stAccepted", declined: "stDeclined", withdrawn: "stWithdrawn", done: "stThanks",
  no_show: "stNoShow", ended: "stEnded" };
const statusTone = (st: string) => (st === "accepted" || st === "done" ? "on" : st === "interested" ? "wait" : "");

/** Places left: needed minus accepted, when staff said how many. */
function placesLine(o: Opp): HTMLElement | null {
  if (!o.needed) return null;
  const left = Math.max(0, o.needed - (o.accepted || 0));
  return metaLine("people", left ? t("oppLeft", left) : t("oppFull"));
}
/** Women only or men only (the owner's decision 12, a pilot): a state, so a chip. */
const genderChip = (g: string | null | undefined) => (g === "female" ? chip(t("oppWomenOnly"), "lead", "person") : g === "male" ? chip(t("oppMenOnly"), "lead", "person") : null);
const rolesLine = (roles: string[] | null | undefined) => (roles?.length ? metaLine("person", t("oppRolesLine", roles.join(", "))) : null);

export function viewList(main: HTMLElement): void {
  main.appendChild(h("h1", {}, t("navOpps")));
  if (S.err) { append(main, note(S.err, "alert"), button(t("retry"), () => load().then(render))); return; }
  if (!S.opps) { main.appendChild(skeleton(2, t("loading"))); return; }
  if (!S.opps.length) { main.appendChild(note(t("oppNone"))); return; }
  main.appendChild(h("div", { class: "list" }, ...S.opps.map((o) => {
    const sh = myShift(o.id);
    return h("a", { class: "card opp", href: `#o/${encodeURIComponent(o.id)}`, "data-id": o.id },
      dateBlock(o.date),
      h("div", { class: "opp-what" },
        h("h2", {}, sessionName(o)),
        o.time ? metaLine("clock", timesLabel(o.time, gathers(o))) : null,
        o.location ? metaLine("pin", o.location) : null,
        rolesLine(o.roles),
        placesLine(o),
        h("div", { class: "chips" },
          sh && statusWords[sh.status] ? chip(t(statusWords[sh.status]), statusTone(sh.status)) : null,
          genderChip(o.gender),
          !o.signup_open && !sh ? chip(t("oppClosedChip")) : null)),
      icon("go", 18, true));
  })));
}

export function viewOpp(main: HTMLElement, id: string): void {
  main.appendChild(h("a", { class: "backlink", href: "#opps" }, icon("back", 18, true), h("span", {}, t("navOpps"))));
  const o = S.opps?.find((x) => x.id === id) ?? null;
  const sh = myShift(id);
  if (!o && !sh) {
    if (!S.opps) { main.appendChild(S.err ? note(S.err, "alert") : skeleton(1, t("loading"))); return; }
    main.appendChild(note(t("oppGone")));
    return;
  }
  // what staff wrote for the day: the opportunity's, else the shift's (an accepted shift sees the meeting point early)
  const lg = { meet_point: o?.meet_point ?? sh?.meet_point, meet_map: o?.meet_map ?? sh?.meet_map, bring: o?.bring ?? sh?.bring, provided: o?.provided ?? sh?.provided,
    shirt_pickup: o?.shirt_pickup ?? sh?.shirt_pickup, demands: o?.demands ?? sh?.demands, partner: o?.partner, partner_ar: o?.partner_ar, skills: o?.skills, skills_ar: o?.skills_ar };
  const base = o ?? sh!;
  const where = base.location;
  // "Register before" only when sign-up closes before the event starts (fix 4): the same moment is also the work page's
  // cut-off, after the event, where a deadline read as a mistake.
  const regBy = o && o.closes_at && Date.parse(o.closes_at) < startOf({ date: o.date, time: o.time, starts_at: o.starts_at ?? sh?.starts_at }) ? o.closes_at : null;
  main.appendChild(h("section", { class: "card opp-head" },
    h("div", { class: "next-top" }, dateBlock(base.date, true), h("div", { class: "next-what" }, h("h1", {}, sessionName(base)), h("div", { class: "chips" }, genderChip(o?.gender)))),
    h("div", { class: "metas" },
      base.time ? metaLine("clock", timesLabel(base.time, gathers(base))) : null,
      where ? h("p", { class: "meta" }, icon("pin", 16), h("a", { href: mapsLink(where), target: "_blank", rel: "noopener" }, where)) : null,
      o?.hours_mode === "fixed" && o.fixed_hours ? metaLine("medal", hoursN(o.fixed_hours)) : null,
      o?.min_age ? metaLine("person", t("oppMinAge", o.min_age)) : null,
      o ? placesLine(o) : null,
      regBy ? metaLine("flag", t("oppRegisterBy", whenLabel(regBy))) : null),
    o?.about ? h("p", { class: "about" }, o.about) : null,
    logistics(lg),
    // How many each role needs and how many are on it (rentals 20261107130000), as lines, not chips.
    o?.role_needs?.length
      ? h("div", { class: "roles" }, h("p", { class: "roles-h" }, t("oppRoles")), h("ul", { class: "role-list" }, ...o.role_needs.map((n) =>
          h("li", { class: n.filled >= n.needed ? "is-full" : "" }, h("span", {}, n.name), h("span", { class: "role-n" }, `${n.filled} / ${n.needed}`)))))
      : rolesLine(o?.roles)));
  main.appendChild(actionCard(o, sh));
}

function actionCard(o: Opp | null, sh: Mine | null): HTMLElement {
  const box = h("section", { class: "card action", id: "opp-action" });
  const st = sh?.status;
  const who = standing();
  if (sh && isDone(sh)) {
    append(box, h("div", { class: "chips" }, chip(t("stThanks"), "on", "heart")), ...closeoutParts(sh, false));
    return box;
  }
  if (who === "paused" || who === "ended") { box.appendChild(h("p", {}, t(who === "paused" ? "vdPaused" : "vdExpired"))); return box; }
  if (who === "account") { box.appendChild(h("p", {}, t(S.me?.account === "pwd" ? "vdAccountPwd" : "vdAccountDel"))); return box; }
  if (sh && st === "accepted" && !sh.cancelled) {
    append(box, h("div", { class: "chips" }, chip(t("stAccepted"), "on", "tick"), sh.coming_at ? chip(t("comingChip"), "on") : null, sh.lead ? chip(t("leadMark"), "lead", "flag") : null),
      sh.role ? metaLine("person", t("roleIs", sh.role)) : null,
      contactFact(sh), briefBox(sh));
    if (sh.can_work) box.appendChild(h("div", { class: "acts" }, link(t("startWork"), `#work/${encodeURIComponent(sh.id)}`, "primary", "go")));
    if (!isAhead(sh)) return box; // over, never arrived: nothing left to plan, confirm or give back
    if (needsComing(sh)) {
      box.appendChild(h("div", { class: "coming" }, h("p", { class: "state" }, t("comingQShort")),
        h("div", { class: "acts acts-pair" },
          button(t("comingYesBtn"), () => comingYes(sh), sh.can_work ? "secondary" : "primary", { id: "opp-coming-yes" }, "tick"),
          button(t("comingNoBtn"), () => withdrawAsk(sh), "secondary"))));
    }
    if ("plan_leave" in sh) box.appendChild(planForm(sh));
    const side = h("div", { class: "acts acts-pair" }, calButton(sh, { id: "opp-cal" }));
    if (!sh.clock_in) side.appendChild(button(t("withdrawBtn"), () => withdrawAsk(sh), "quiet", { id: "opp-withdraw" }));
    box.appendChild(side);
    return box;
  }
  if (sh?.cancelled) { box.appendChild(h("p", { class: "state" }, t("stCancelled"))); return box; }
  if (st === "interested") {
    append(box, h("p", { class: "state" }, t("stInterested")),
      h("div", { class: "acts" }, button(t("withdrawBtn"), () => interest(sh!.id, false), "quiet", { id: "opp-withdraw" })));
    return box;
  }
  if (st === "declined" || st === "no_show" || st === "ended") {
    append(box, h("p", { class: "state" }, t(statusWords[st])), sh?.reason ? h("p", { class: "reason", id: "opp-reason" }, reasonWord(sh.reason)) : null);
    return box;
  }
  if (!o) { box.appendChild(h("p", { class: "state" }, t(st === "withdrawn" ? "stWithdrawn" : "oppGone"))); return box; }
  if (who === "profile") { append(box, h("p", { class: "state" }, t("profNeeded")), link(t("profSetUp"), "#profile", "primary", "go")); return box; }
  if (who === "waiting") { box.appendChild(h("p", { class: "state", id: "opp-waiting" }, t("profWaiting"))); return box; }
  if (!o.signup_open) { box.appendChild(h("p", { class: "state" }, t("oppClosedSignup"))); return box; }
  // women only or men only, and the account says otherwise: no button to press for a refusal
  const g = S.prof?.gender;
  if (o.gender && g && g !== o.gender) { box.appendChild(h("p", { class: "state", id: "opp-gender" }, t(o.gender === "female" ? "oppWomenOnlyState" : "oppMenOnlyState"))); return box; }
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
  append(box, st === "withdrawn" ? h("p", { class: "state" }, t("stWithdrawn")) : null, roles, h("div", { class: "field" }, h("label", { for: msgId }, t("interestMsg")), msg),
    button(t("interestBtn"), () => interest(o.id, true, role, msg.value), "primary", { id: "opp-help" }, "hand"));
  return box;
}

async function interest(id: string, on: boolean, role: string | null = null, message = ""): Promise<void> {
  const r = await rpc<{ status: string }>("volunteer_interest", { p_session: id, p_on: on, p_role: role, p_message: message.trim() || null });
  if (!r.ok) {
    noteErr(r);
    if (r.code === "VOL_TOKEN") { S.me = null; render(); return; }
    if (r.code === "VOL_PROFILE" || r.code === "VOL_PENDING") await load(); // what the server knows wins
    render();
    return;
  }
  setQuiet(on ? t(r.data.status === "accepted" ? "stAccepted" : "interestSent") : t("withdrawn"));
  await load();
  render();
  if (on) maybeHowTo(); // the one-time Add to Home Screen how-to, after the first offer of help
}
