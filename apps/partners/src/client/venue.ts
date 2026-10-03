// Venue: the details the venue keeps up to date, its plan, and the password change.

import { rpc } from "./api";
import { announce, app, busy, button, errorNote, field, note, t } from "./app";
import { num } from "./dates";
import { clear, h, uid } from "./dom";
import { icon } from "./icons";
import { KIND_KEY, passwordRules, tierName, type Me, type Tier } from "./model";

export function renderVenue(main: HTMLElement, reloadMe: () => Promise<boolean>): void {
  const me = app.me!;
  const v = me.venue;
  clear(main);
  const name = app.lang === "ar" && v.name_ar ? v.name_ar : v.name;
  main.append(
    h("div", { class: "page-head" },
      h("div", {}, h("h1", {}, name), h("p", { class: "lede" }, `${t("planLabel")}: ${tierName(app.lang, me.tier)}`))),
    h("div", { class: "venue-cols" }, profileForm(main, me, reloadMe), h("div", {}, tierCard(me.tier), passwordForm(false))),
  );
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
    if (seats && !(/^\d+$/.test(seats) && +seats >= 1 && +seats <= 2000)) { f.seats.setError(t("errSeats")); bad = true; }
    if (bad) { form.querySelector<HTMLElement>("[aria-invalid=true]")?.focus(); return; }
    busy(save, true, t("sending"));
    const r = await rpc<null>("fnb_profile_save", {
      p_data: {
        map_url: map,
        seats,
        contact_name: f.contact_name.input.value.trim(),
        contact_phone: f.contact_phone.input.value.trim(),
        contact_email: f.contact_email.input.value.trim(),
        offer_en: f.offer_en.input.value.trim(),
        offer_ar: f.offer_ar.input.value.trim(),
      },
    });
    busy(save, false, t("save"));
    if (!r.ok) { msg.append(errorNote(r.code)); return; }
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
    tier.max_per_month ? t("ruleMonthly", { n: num(tier.max_per_month, L) }) : t("ruleMonthlyNone"),
    t("ruleHorizon", { n: num(tier.horizon_days, L) }),
    t("ruleLead", { n: num(tier.min_lead_days, L) }),
    t("ruleCutoff", { n: num(tier.cancel_cutoff_days, L) }),
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
  const ruleItem = (key: "pwRuleLength" | "pwRuleCapital" | "pwRuleNumber") => h("li", { "data-rule": key }, icon("dash"), h("span", {}, t(key)));
  const rules = h("ul", { class: "pw-rules", "aria-label": t("pwRules") }, ruleItem("pwRuleLength"), ruleItem("pwRuleCapital"), ruleItem("pwRuleNumber"));
  const paint = () => {
    const r = passwordRules(nw.input.value);
    const map = { pwRuleLength: r.length, pwRuleCapital: r.capital, pwRuleNumber: r.number } as const;
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
    const r = passwordRules(p);
    if (!r.length || !r.capital || !r.number) { nw.setError(t("errWeak")); nw.input.focus(); return; }
    if (p !== cf.input.value) { cf.setError(t("pwMismatch")); cf.input.focus(); return; }
    if (cur && !cur.input.value) { cur.setError(t("errBadPassword")); cur.input.focus(); return; }
    busy(save, true, t("sending"));
    const res = await rpc<{ ok: true }>("fnb_set_password", cur ? { p_new: p, p_old: cur.input.value } : { p_new: p });
    busy(save, false, t("pwSaveButton"));
    if (!res.ok) {
      if (res.code === "BAD_PASSWORD" && cur) { cur.setError(t("errBadPassword")); cur.input.focus(); return; }
      if (res.code === "WEAK_PASSWORD" || res.code === "SAME_PASSWORD") { nw.setError(t(res.code === "WEAK_PASSWORD" ? "errWeak" : "errSame")); nw.input.focus(); return; }
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
