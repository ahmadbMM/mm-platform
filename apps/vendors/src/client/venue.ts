// Venue: the details the venue keeps up to date (its owner only), its plan, the password change and
// the signed-in devices.

import { rpc } from "./api";
import { announce, app, busy, button, errorNote, field, note, t, tn } from "./app";
import { clear, h, uid } from "./dom";
import { icon } from "./icons";
import { canEditVenue, e164, emailOk, errorKey, KIND_KEY, passwordProblem, PW_MAX, tierName, type Me, type Tier } from "./model";
import type { Key } from "./strings";

export function renderVenue(main: HTMLElement, reloadMe: () => Promise<boolean>): void {
  const me = app.me!;
  const v = me.venue;
  clear(main);
  const name = app.lang === "ar" && v.name_ar ? v.name_ar : v.name;
  main.append(
    h("div", { class: "page-head" },
      h("div", {}, h("h1", {}, name), h("p", { class: "lede" }, `${t("planLabel")}: ${tierName(app.lang, me.tier)}`))),
    h("div", { class: "venue-cols" },
      canEditVenue(me.user.role) ? profileForm(main, me, reloadMe) : profileFacts(me),
      h("div", {}, tierCard(me.tier), passwordForm(false), devicesCard())),
  );
}

const ROLE_KEY: Record<string, Key> = { owner: "roleOwner", manager: "roleManager", viewer: "roleViewer" };
export const roleText = (role: string) => t(ROLE_KEY[role] || "roleManager");

/** The venue's details, read only: a manager's or a viewer's login. */
function profileFacts(me: Me): HTMLElement {
  const v = me.venue;
  const id = uid("prof");
  const row = (k: Key, val: string | number | null, dir?: string) => [h("dt", {}, t(k)), h("dd", { dir }, val == null || val === "" ? "-" : String(val))];
  return h("section", { class: "card", "aria-labelledby": id },
    h("h2", { id }, t("profileTitle")),
    note("info", t("profileReadOnly")),
    h("p", { class: "hint" }, t("roleLine", { role: roleText(me.user.role) })),
    h("dl", { class: "facts" },
      ...row("venueName", [v.name, v.name_ar].filter(Boolean).join(" / ")),
      ...row("mapUrl", v.map_url, "ltr"), ...row("seats", v.seats),
      ...row("contactName", v.contact_name), ...row("contactPhone", v.contact_phone, "ltr"), ...row("contactEmail", v.contact_email, "ltr"),
      ...row("offerEn", v.offer_en, "ltr"), ...row("offerAr", v.offer_ar, "rtl")));
}

/** Signs out every other device using this login (vendor_logout_others). */
function devicesCard(): HTMLElement {
  const id = uid("dev");
  const n = Number(app.me!.user.sessions);
  const msg = h("div", { class: "msg" });
  const go = button(t("signOutOthers"), { kind: "secondary", icon: "signout" });
  go.addEventListener("click", async () => {
    clear(msg);
    busy(go, true, t("sending"));
    const r = await rpc<number>("vendor_logout_others");
    busy(go, false, t("signOutOthers"));
    if (!r.ok) { msg.append(errorNote(r.code)); return; }
    const text = t("signedOutOthers", { n: Number(r.data) || 0 });
    msg.append(note("ok", text));
    announce(text);
  });
  return h("section", { class: "card devices", "aria-labelledby": id },
    h("h2", { id }, t("securityTitle")),
    h("p", { class: "hint" }, t("securityIntro")),
    Number.isFinite(n) && n > 0 ? h("p", { class: "b-meta" }, icon("shield"), h("span", {}, t("signedInOn", { n }))) : null,
    msg, h("div", { class: "actions start" }, go));
}

function profileForm(main: HTMLElement, me: Me, reloadMe: () => Promise<boolean>): HTMLElement {
  const v = me.venue;
  const id = uid("prof");
  const f = {
    map_url: field({ label: t("mapUrl"), name: "map_url", type: "url", value: v.map_url, hint: t("mapUrlHint"), dir: "ltr", inputmode: "url" }),
    seats: field({ label: t("seats"), name: "seats", type: "number", value: v.seats == null ? "" : String(v.seats), inputmode: "numeric", min: "1", max: "2000" }),
    contact_name: field({ label: t("contactName"), name: "contact_name", value: v.contact_name, autocomplete: "name", maxlength: 120 }),
    contact_phone: field({ label: t("contactPhone"), name: "contact_phone", type: "tel", value: v.contact_phone, autocomplete: "tel", dir: "ltr", maxlength: 40 }),
    contact_email: field({ label: t("contactEmail"), name: "contact_email", type: "email", value: v.contact_email, autocomplete: "email", dir: "ltr", maxlength: 200 }),
    offer_en: field({ label: t("offerEn"), name: "offer_en", value: v.offer_en, hint: t("offerHint"), multiline: true, maxlength: 1000, dir: "ltr" }),
    offer_ar: field({ label: t("offerAr"), name: "offer_ar", value: v.offer_ar, multiline: true, maxlength: 1000, dir: "rtl" }),
  };
  const msg = h("div", { class: "msg" });
  const save = button(t("save"), { kind: "primary", type: "submit" });
  const form = h("form", { class: "card", "aria-labelledby": id, novalidate: true },
    h("h2", { id }, t("profileTitle")),
    h("dl", { class: "facts" }, h("dt", {}, t("venueName")), h("dd", {}, [v.name, v.name_ar].filter(Boolean).join(" / "))),
    ...Object.values(f).map((x) => x.wrap), msg, h("div", { class: "actions" }, save));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clear(msg);
    Object.values(f).forEach((x) => x.setError(""));
    const map = f.map_url.input.value.trim();
    const seats = f.seats.input.value.trim();
    let bad = false;
    if (map && !/^https:\/\/\S+$/i.test(map)) { f.map_url.setError(t("errMapUrl")); bad = true; }
    // A number box holding something that is not a number reads as "" with badInput set: never a cleared count.
    const seatsBad = (f.seats.input as HTMLInputElement).validity?.badInput;
    if (seatsBad || (seats && !(/^\d+$/.test(seats) && +seats >= 1 && +seats <= 2000))) { f.seats.setError(t("errSeats")); bad = true; }
    // The database checks the same (vendor_profile_save): the name's length, a phone it can write as
    // +<country><number>, an email's shape.
    const phone = e164(f.contact_phone.input.value);
    if (f.contact_name.input.value.trim().length > 120) { f.contact_name.setError(t("errContactName")); bad = true; }
    if (phone === null || (phone && phone.length > 20)) { f.contact_phone.setError(t("errPhone")); bad = true; }
    if (!emailOk(f.contact_email.input.value)) { f.contact_email.setError(t("errEmail")); bad = true; }
    if (bad) { form.querySelector<HTMLElement>("[aria-invalid=true]")?.focus(); return; }
    busy(save, true, t("sending"));
    const r = await rpc<null>("vendor_profile_save", {
      p_data: {
        map_url: map,
        seats,
        contact_name: f.contact_name.input.value.trim(),
        contact_phone: phone,
        contact_email: f.contact_email.input.value.trim(),
        offer_en: f.offer_en.input.value.trim(),
        offer_ar: f.offer_ar.input.value.trim(),
      },
    });
    busy(save, false, t("save"));
    if (!r.ok) {
      const at = r.code === "BAD_PHONE" ? f.contact_phone : r.code === "BAD_EMAIL" ? f.contact_email : null;
      if (at) { at.setError(t(errorKey(r.code))); at.input.focus(); return; }
      msg.append(errorNote(r.code));
      return;
    }
    await reloadMe();
    renderVenue(main, reloadMe);
    announce(t("saved"));
    main.querySelector(".venue-cols form .msg")?.append(note("ok", t("saved")));
  });
  return form;
}

function tierCard(tier: Tier): HTMLElement {
  const id = uid("tier");
  const L = app.lang;
  const rules = [
    t("ruleModes", { list: tier.modes.map((m) => t(KIND_KEY[m])).join(t("listSep")) }),
    tier.max_per_month ? tn("datesMonth", tier.max_per_month) : t("ruleMonthlyNone"),
    t("ruleHorizon", { days: tn("days", tier.horizon_days) }),
    t("ruleLead", { days: tn("days", tier.min_lead_days) }),
    t("ruleCutoff", { days: tn("days", tier.cancel_cutoff_days) }),
  ];
  const benefits = (tier.benefits || []).map((b) => (L === "ar" ? b.ar || b.en : b.en || b.ar) || "").filter(Boolean);
  return h("section", { class: "card tier", "aria-labelledby": id },
    h("p", { class: "eyebrow" }, t("tierTitle")),
    h("h2", { id }, tierName(L, tier)),
    h("h3", {}, t("tierRules")),
    h("ul", { class: "rules" }, ...rules.map((r) => h("li", {}, icon("check"), h("span", {}, r)))),
    h("h3", {}, t("benefitsTitle")),
    benefits.length
      ? h("ul", { class: "rules" }, ...benefits.map((b) => h("li", {}, icon("star"), h("span", {}, b))))
      : h("p", { class: "hint" }, t("benefitsSoon")));
}

/**
 * The password form. forced: the first sign-in's change (no current password asked).
 * onDone runs after a successful change.
 */
export function passwordForm(forced: boolean, onDone?: () => void): HTMLElement {
  const id = uid("pw");
  const cur = forced ? null : field({ label: t("currentPassword"), name: "current", type: "password", autocomplete: "current-password", required: true, maxlength: 200 });
  const nw = field({ label: t("newPassword"), name: "new", type: "password", autocomplete: "new-password", required: true, maxlength: 200 });
  const cf = field({ label: t("confirmPassword"), name: "confirm", type: "password", autocomplete: "new-password", required: true, maxlength: 200 });
  // NIST SP 800-63B: length, not a common password, nothing personal. No composition rules.
  const me = app.me;
  const ctx = { login: me?.user.login, venueNames: [me?.venue.name || "", me?.venue.name_ar || ""].filter(Boolean) };
  nw.input.setAttribute("maxlength", String(PW_MAX));
  const ruleItem = (key: "pwRuleLength" | "pwRuleCommon" | "pwRulePersonal") => h("li", { "data-rule": key }, icon("dash"), h("span", {}, t(key)));
  const rules = h("ul", { class: "pw-rules", "aria-label": t("pwRules") }, ruleItem("pwRuleLength"), ruleItem("pwRuleCommon"), ruleItem("pwRulePersonal"));
  const paint = () => {
    const v = nw.input.value;
    const why = passwordProblem(v, ctx);
    const map = { pwRuleLength: why !== "WEAK_PASSWORD" && !!v, pwRuleCommon: !!v && why !== "WEAK_PASSWORD" && why !== "COMMON_PASSWORD", pwRulePersonal: !!v && why === "" } as const;
    rules.querySelectorAll<HTMLLIElement>("li").forEach((li) => {
      const ok = map[li.dataset.rule as keyof typeof map];
      li.classList.toggle("ok", ok);
      li.querySelector("svg")?.replaceWith(icon(ok ? "check" : "dash"));
    });
  };
  nw.input.addEventListener("input", paint);
  const msg = h("div", { class: "msg" });
  const save = button(t("pwSaveButton"), { kind: "primary", type: "submit" });
  const form = h("form", { class: "card", "aria-labelledby": id, novalidate: true },
    h("h2", { id }, forced ? t("forceTitle") : t("changePasswordTitle")),
    forced ? h("p", { class: "lede" }, t("forceIntro")) : null,
    cur?.wrap, nw.wrap, rules, cf.wrap, msg, h("div", { class: "actions" }, save));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clear(msg);
    [cur, nw, cf].forEach((x) => x?.setError(""));
    const p = nw.input.value;
    const why = passwordProblem(p, ctx);
    if (why) { nw.setError(t(errorKey(why))); nw.input.focus(); return; }
    if (p !== cf.input.value) { cf.setError(t("pwMismatch")); cf.input.focus(); return; }
    if (cur && !cur.input.value) { cur.setError(t("errBadPassword")); cur.input.focus(); return; }
    busy(save, true, t("sending"));
    const res = await rpc<{ ok: true }>("vendor_set_password", cur ? { p_new: p, p_old: cur.input.value } : { p_new: p });
    busy(save, false, t("pwSaveButton"));
    if (!res.ok) {
      if (res.code === "BAD_PASSWORD" && cur) { cur.setError(t("errBadPassword")); cur.input.focus(); return; }
      if (["WEAK_PASSWORD", "SAME_PASSWORD", "COMMON_PASSWORD", "PERSONAL_PASSWORD"].includes(res.code)) { nw.setError(t(errorKey(res.code))); nw.input.focus(); return; }
      msg.append(errorNote(res.code));
      return;
    }
    form.reset();
    paint();
    msg.append(note("ok", t("pwChanged")));
    announce(t("pwChanged"));
    onDone?.();
  });
  return form;
}
