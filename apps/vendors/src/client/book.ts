// The booking dialog: one date, several dates, or a monthly pattern; a preview of every date's
// verdict first, then the request.

import { rpc } from "./api";
import { announce, app, busy, button, dialog, errorNote, note, t, tn } from "./app";
import { invalidateCalendar, loadRange } from "./calendar";
import { addDays, defaultUntil, hijriLabel, longDate, patternArgs, patternValid, shortDate, type Iso, type Ordinal, type Pattern } from "./dates";
import { clear, h, uid } from "./dom";
import { icon } from "./icons";
import { pickable, verdictText, type Checked, type Mode } from "./model";
import type { Key } from "./strings";

const MODES: Mode[] = ["single", "multi", "recurring"];
const MODE_KEY: Record<Mode, Key> = { single: "modeSingle", multi: "modeMulti", recurring: "modeRecurring" };
const MODE_OFF: Record<Mode, Key> = { single: "modeOffSingle", multi: "modeOffMulti", recurring: "modeOffRecurring" };
const NOTE_MAX = 500;

type Draft = {
  mode: Mode;
  single: Iso | null;
  multi: Set<Iso>;
  pattern: Pattern;
  note: string;
};

let onDone: () => void = () => {};
/** What to refresh after a request was sent. */
export function afterBooking(fn: () => void): void {
  onDone = fn;
}

export function openBooking(preselect?: Iso): void {
  const me = app.me!;
  const tier = me.tier;
  const today = me.today;
  const allowed = (m: Mode) => tier.modes.includes(m);
  const first: Mode = allowed("single") ? "single" : tier.modes[0];
  const d: Draft = {
    mode: first,
    single: preselect || null,
    multi: new Set(preselect ? [preselect] : []),
    pattern: { ordinal: 1, interval: 1, from: addDays(today, tier.min_lead_days), until: defaultUntil(today, tier.horizon_days) },
    note: "",
  };
  if (preselect && !allowed("single") && allowed("multi")) d.mode = "multi";

  const dlg = dialog(t("bookTitle"));
  let available: Iso[] = [];
  /** The date the venue tapped, when it is no longer free by the time the dialog loads: said, not swapped silently. */
  let gone: Iso | null = null;

  const loading = h("p", { class: "loading", role: "status" }, t("loading"));
  dlg.body.append(loading);
  const horizonEnd = addDays(today, tier.horizon_days); // read 400 days a call (loadRange)
  void loadRange(today, horizonEnd).then((r) => {
    loading.remove();
    if (!r.ok) { dlg.body.append(errorNote(r.code)); return; }
    available = r.days.filter((x) => pickable(x, today, tier)).map((x) => x.day);
    if (preselect && !available.includes(preselect)) {
      gone = preselect;
      d.single = null;
      d.multi.delete(preselect);
    }
    if (!d.single && !gone) d.single = available[0] || null;
    editStage();
  });

  function args(): Record<string, unknown> {
    if (d.mode === "recurring") return patternArgs(d.pattern);
    if (d.mode === "single") return { p_mode: "single", p_days: d.single ? [d.single] : [] };
    return { p_mode: "multi", p_days: [...d.multi].sort() };
  }

  function check(): string {
    if (d.mode === "single" && !d.single) return t("errOneDate");
    if (d.mode === "multi" && d.multi.size === 0) return t("errChooseDates");
    if (d.mode === "multi" && d.multi.size > 60) return t("errTooMany");
    if (d.mode === "recurring" && !patternValid(d.pattern)) return t("errPattern");
    return "";
  }

  function editStage(): void {
    clear(dlg.body);
    // Mode
    const modeName = uid("mode");
    const modes = h("fieldset", { class: "modes" }, h("legend", {}, t("modeLabel")));
    for (const m of MODES) {
      const id = uid("m");
      const on = allowed(m);
      const input = h("input", { type: "radio", name: modeName, id, value: m, disabled: !on, checked: d.mode === m });
      input.addEventListener("change", () => { d.mode = m; editStage(); dlg.body.querySelector<HTMLInputElement>(`#${id}`)?.focus(); });
      modes.append(
        h("div", { class: `mode${on ? "" : " is-off"}` },
          input,
          h("label", { for: id }, icon(m === "recurring" ? "repeat" : m === "multi" ? "list" : "calendar"), h("span", {}, t(MODE_KEY[m]))),
          on ? null : h("p", { class: "hint" }, t(MODE_OFF[m]))),
      );
    }
    dlg.body.append(modes);

    const part = h("div", { class: "mode-part" });
    if (gone && d.mode !== "recurring") part.append(note("warn", t("preselectGone", { date: longDate(gone, app.lang) })));
    if (d.mode !== "recurring" && available.length === 0) part.append(note("info", t("noAvailable")));
    else if (d.mode === "single") part.append(singlePicker());
    else if (d.mode === "multi") part.append(multiPicker());
    else part.append(patternSentence());
    dlg.body.append(part);

    // Note
    const noteId = uid("note");
    const left = h("p", { class: "hint", id: `${noteId}-left`, "aria-live": "polite" }, tn("charsLeft", NOTE_MAX - d.note.length));
    const ta = h("textarea", { id: noteId, maxlength: NOTE_MAX, rows: 3, "aria-describedby": `${noteId}-left` });
    ta.value = d.note;
    ta.addEventListener("input", () => { d.note = ta.value.slice(0, NOTE_MAX); left.textContent = tn("charsLeft", NOTE_MAX - d.note.length); });
    dlg.body.append(h("div", { class: "field" }, h("label", { for: noteId }, t("noteLabel")), ta, left));

    const msg = h("div", { class: "msg" });
    const go = button(t("previewButton"), { kind: "primary", icon: "check" });
    go.addEventListener("click", async () => {
      clear(msg);
      const problem = check();
      if (problem) { msg.append(note("error", problem)); return; }
      busy(go, true, t("checking"));
      const r = await rpc<Checked[]>("vendor_preview", args());
      busy(go, false, t("previewButton"));
      if (!r.ok) { msg.append(errorNote(r.code)); return; }
      previewStage(r.data || []);
    });
    dlg.body.append(msg, h("div", { class: "actions" }, button(t("close"), { kind: "ghost", onclick: dlg.close }), go));
  }

  function dateOption(day: Iso): string {
    return `${longDate(day, app.lang)} (${hijriLabel(day, app.lang)})`;
  }

  function singlePicker(): HTMLElement {
    const id = uid("day");
    const sel = h("select", { id });
    // Nothing chosen yet (the tapped date went): the venue picks one, no date is chosen for it.
    if (!d.single) sel.append(h("option", { value: "", selected: true, disabled: true }, t("pickDate")));
    for (const day of available) {
      const o = h("option", { value: day }, dateOption(day));
      if (day === d.single) o.selected = true;
      sel.append(o);
    }
    sel.addEventListener("change", () => { d.single = sel.value; });
    return h("div", { class: "field" }, h("label", { for: id }, t("pickDate")), sel);
  }

  function multiPicker(): HTMLElement {
    const chosen = h("ul", { class: "chips", "aria-live": "polite" });
    const drawChosen = () => {
      clear(chosen);
      const days = [...d.multi].sort();
      if (!days.length) chosen.append(h("li", { class: "hint" }, t("noneChosen")));
      for (const day of days) {
        chosen.append(h("li", { class: "chip chip-pick" },
          h("span", {}, shortDate(day, app.lang)),
          h("button", { type: "button", class: "chip-x", "aria-label": t("removeDate", { date: longDate(day, app.lang) }), onclick: () => toggle(day) }, icon("close"))));
      }
    };
    const picks = h("div", { class: "picks", role: "group", "aria-label": t("pickDates") });
    const toggle = (day: Iso) => {
      if (d.multi.has(day)) d.multi.delete(day); else d.multi.add(day);
      picks.querySelectorAll<HTMLButtonElement>("button[data-day]").forEach((b) => b.setAttribute("aria-pressed", String(d.multi.has(b.dataset.day!))));
      drawChosen();
    };
    for (const day of available) {
      picks.append(h("button", { type: "button", class: "pick", "data-day": day, "aria-pressed": String(d.multi.has(day)), "aria-label": longDate(day, app.lang), onclick: () => toggle(day) },
        icon("check", "icon pick-on"),
        h("span", { class: "pick-date" }, shortDate(day, app.lang)),
        h("span", { class: "hijri" }, hijriLabel(day, app.lang))));
    }
    drawChosen();
    return h("div", {}, h("p", { class: "label" }, t("pickDates")), picks, h("p", { class: "label" }, t("chosenDates")), chosen);
  }

  function patternSentence(): HTMLElement {
    const p = d.pattern;
    const mk = <T extends string | number>(label: string, options: [T, string][], value: T, set: (v: T) => void) => {
      const sel = h("select", { "aria-label": label });
      for (const [v, text] of options) {
        const o = h("option", { value: String(v) }, text);
        if (v === value) o.selected = true;
        sel.append(o);
      }
      sel.addEventListener("change", () => set(options.find(([v]) => String(v) === sel.value)![0]));
      return sel;
    };
    const ord = mk<Ordinal>(t("every"), [[1, t("ord1")], [2, t("ord2")], [3, t("ord3")], [4, t("ord4")], [-1, t("ordLast")]], p.ordinal, (v) => { p.ordinal = v; });
    const every = mk<1 | 2 | 3>(t("everyN"), [[1, "1"], [2, "2"], [3, "3"]], p.interval, (v) => { p.interval = v; });
    const minDay = addDays(today, tier.min_lead_days);
    const maxDay = addDays(today, tier.horizon_days);
    const date = (label: string, value: Iso, set: (v: Iso) => void) => {
      const i = h("input", { type: "date", "aria-label": label, min: minDay, max: maxDay });
      i.value = value;
      i.addEventListener("change", () => set(i.value));
      return i;
    };
    const from = date(t("from"), p.from, (v) => { p.from = v; });
    const until = date(t("until"), p.until, (v) => { p.until = v; });
    return h("p", { class: "sentence" },
      h("span", {}, t("every")), " ", ord, " ", h("span", {}, t("saturdayOf")), " ",
      h("span", {}, t("everyN")), " ", every, " ", h("span", {}, t("monthsUnit")), " ",
      h("span", {}, t("from")), " ", from, " ", h("span", {}, t("until")), " ", until);
  }

  function verdictList(rows: Checked[]): HTMLElement {
    return h("ol", { class: "verdicts" }, ...rows.map((c) =>
      h("li", { class: `v v-${c.verdict}` },
        icon(c.verdict === "ok" ? "check" : c.verdict === "mine" ? "clock" : c.verdict === "closed" ? "closed" : "taken"),
        h("span", { class: "v-date" }, longDate(c.day, app.lang)),
        h("span", { class: "v-text" }, verdictText(app.lang, c, tier)))));
  }

  function previewStage(rows: Checked[]): void {
    clear(dlg.body);
    const ok = rows.filter((r) => r.verdict === "ok").length;
    const summary = !rows.length ? t("previewEmpty") : ok ? tn("previewSummary", rows.length, { ok }) : t("previewNone");
    const msg = h("div", { class: "msg" });
    const send = button(t("sendButton"), { kind: "primary", icon: "check" });
    send.disabled = ok === 0;
    send.addEventListener("click", async () => {
      clear(msg);
      busy(send, true, t("sending"));
      const r = await rpc<{ requested: number; days: Checked[] }>("vendor_request", { ...args(), p_note: d.note });
      busy(send, false, t("sendButton"));
      if (!r.ok) { msg.append(errorNote(r.code)); return; }
      invalidateCalendar();
      resultStage(r.data);
    });
    dlg.body.append(
      h("h3", {}, t("previewTitle")),
      h("p", { class: `summary${ok ? "" : " none"}`, role: "status" }, summary),
      verdictList(rows),
      msg,
      h("div", { class: "actions" }, button(t("editChoice"), { kind: "ghost", onclick: editStage }), send),
    );
    dlg.body.querySelector<HTMLElement>("h3")?.setAttribute("tabindex", "-1");
    dlg.body.querySelector<HTMLElement>("h3")?.focus();
  }

  function resultStage(res: { requested: number; days: Checked[] }): void {
    clear(dlg.body);
    const n = res.requested || 0;
    const text = n === 0 ? t("resultNone") : `${tn("datesRequested", n)} ${t("resultAfter")}`;
    const done = button(t("done"), { kind: "primary", onclick: () => { dlg.close(); } });
    dlg.body.append(h("h3", {}, t("resultTitle")), note(n ? "ok" : "warn", text), verdictList(res.days || []), h("div", { class: "actions" }, done));
    announce(text);
    done.focus();
    dlg.el.addEventListener("close", () => onDone(), { once: true });
  }
}
