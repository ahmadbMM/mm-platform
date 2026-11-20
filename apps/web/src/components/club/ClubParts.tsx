"use client";
// The members' area in three parts behind a switch, as the booking app's Community tab (member-hub.js _feedHtml; the user,
// 2026-11-20: "divide the community section in the booking app into sections becuz it looks so cluttered now"): Sessions,
// Challenges and Club. The parts come drawn from the server (MembersArea.tsx); all of them are in the page and only the one
// picked shows, so a switch reads nothing and keeps what is typed. A part with nothing in it is not passed: it has no
// button, and with one part only there is no switch. Sessions shows first; /club#challenges opens Challenges (a badge's
// pop-up and the rating's last screen link there, as the app's ways in from them open its Challenges).
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

export type ClubPart = "sess" | "goals" | "club";
const KEYS: ClubPart[] = ["sess", "goals", "club"];

// The address's #hash, read in the browser only (the server draws the first part).
const onHash = (cb: () => void) => { window.addEventListener("hashchange", cb); return () => window.removeEventListener("hashchange", cb); };
const hashNow = () => window.location.hash;
const noHash = () => "";

export default function ClubParts({ parts, labels, label }: { parts: Partial<Record<ClubPart, ReactNode>>; labels: Record<ClubPart, string>; label: string }) {
  const keys = KEYS.filter((k) => parts[k]);
  const [picked, setPicked] = useState<ClubPart | null>(null);
  const bar = useRef<HTMLDivElement>(null);
  const toGoals = useSyncExternalStore(onHash, hashNow, noHash) === "#challenges" && keys.includes("goals");
  useEffect(() => { if (toGoals) bar.current?.scrollIntoView({ block: "start" }); }, [toGoals]);
  const on: ClubPart = picked && keys.includes(picked) ? picked : toGoals ? "goals" : (keys[0] ?? "sess");
  const pick = (k: ClubPart) => {
    setPicked(k);
    const b = bar.current;
    if (b && b.getBoundingClientRect().top < 0) b.scrollIntoView({ block: "start" }); // scrolled past the switch: the part starts at its top
  };
  return (
    <>
      {keys.length > 1 && (
        <div className="club-parts" role="group" aria-label={label} ref={bar}>
          {keys.map((k) => (
            <button key={k} type="button" className={`club-part${k === on ? " active" : ""}`} aria-pressed={k === on} aria-controls={`club-pane-${k}`} data-part={k} onClick={() => pick(k)}>{labels[k]}</button>
          ))}
        </div>
      )}
      {keys.map((k) => <div key={k} className="club-pane" id={`club-pane-${k}`} data-part={k} hidden={k !== on}>{parts[k]}</div>)}
    </>
  );
}
