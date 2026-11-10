// "Add to Home Screen", once (the report's Tier 2, 2026-11-11): after a volunteer's first "I want to help", a centred
// how-to, never again. Since iOS 26 any site added to the Home Screen opens as a web app, but an iPhone still has no
// install prompt, so it shows the two taps; Android Chrome hands the page a real Install (beforeinstallprompt), which
// the how-to carries as its button. Storage may be refused (private windows): then it is shown at most once a visit.

import { h } from "./dom";
import { t } from "./i18n";
import { icon } from "./icons";
import { ios, standalone } from "./push";
import { button, dialog } from "./ui";

type InstallPrompt = Event & { prompt(): Promise<void>; userChoice?: Promise<{ outcome: string }> };
const SEEN_KEY = "mm_vol_a2hs";
let deferred: InstallPrompt | null = null;
let seenNow = false;

/** Keeps Chrome's install offer for the how-to's button instead of letting it show a banner of its own. */
export function watchInstall(): void {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as InstallPrompt; });
  window.addEventListener("appinstalled", () => { deferred = null; });
}

function seen(): boolean {
  if (seenNow) return true;
  try { return localStorage.getItem(SEEN_KEY) === "1"; } catch { return false; }
}
function markSeen(): void {
  seenNow = true;
  try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* blocked storage: this visit only */ }
}

/** The how-to, the first time only, and never inside the installed app. */
export function maybeHowTo(): void {
  if (standalone() || seen()) return;
  markSeen();
  const step = (ic: string, text: string) => h("li", { class: "howto-step" }, h("span", { class: "howto-ic", "aria-hidden": "true" }, icon(ic, 20)), h("span", {}, text));
  const body = ios()
    ? [h("ol", { class: "howto" }, step("share", t("a2hsIos1")), step("addHome", t("a2hsIos2")))]
    : deferred ? [] : [h("ol", { class: "howto" }, step("more", t("a2hsOther1")), step("addHome", t("a2hsOther2")))];
  const acts: HTMLElement[] = [];
  const box: HTMLDialogElement = dialog(t("a2hsTitle"), body, acts, "ask-a2hs");
  const actsBox = box.querySelector(".ask-acts")!;
  if (deferred && !ios()) {
    const offer = deferred;
    actsBox.append(button(t("a2hsInstall"), async () => {
      try { await offer.prompt(); await offer.userChoice; } catch { /* the browser said no */ }
      deferred = null;
      box.close();
    }, "primary", { id: "a2hs-install" }, "addHome"));
  }
  actsBox.append(button(t("notNow"), () => box.close(), "quiet", { id: "a2hs-close" }));
}
