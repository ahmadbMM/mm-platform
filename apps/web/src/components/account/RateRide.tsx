"use client";

import { useState } from "react";
import RatingForm from "./RatingForm";
import RatingTestimonial, { askTestimonial } from "@/components/testimonials/RatingTestimonial";
import "@/components/testimonials/testimonials.css";
import type { RatingForm as Form } from "@/lib/rating";
import { isAbout, type TmMine } from "@/lib/testimonials";

// A finished ride not rated yet, as a card on My Account: the booking app's post-ride rating
// (RatingForm), for the rides from before the rating became a page a rider cannot skip
// (RatingGate). A rating that lands turns the card into a thank-you. `restaurant`: where the ride's
// breakfast was, which the form's breakfast box names (RatingForm).
// A rating of 9 or 10, while the testimonials' launch switch is on, then offers in the card to share it as a
// testimonial (components/testimonials/RatingTestimonial.tsx; `about`: what the booking was), until it is sent or
// skipped.
type Props = { entryId: string; name: string; when: string; form: Form; noBike: boolean; restaurant?: string | null; rgLow?: number; run?: boolean; session?: boolean; about?: string };

export default function RateRide({ entryId, name, when, form, noBike, restaurant, rgLow, run, session, about }: Props) {
  const [thanks, setThanks] = useState("");
  const [tm, setTm] = useState<{ mine: TmMine; score: number; note: string } | null>(null);
  const rated = (thx: string, sent: { score: number; note: string }) => {
    setThanks(thx);
    void askTestimonial(sent.score).then((mine) => { if (mine) setTm({ mine, ...sent }); });
  };
  return (
    <article className="rr-card">
      <header className="rr-head"><strong>{name}</strong><span>{when}</span></header>
      {thanks ? <p className="rr-thanks" role="status">{thanks}</p> : <RatingForm entryId={entryId} form={form} noBike={noBike} restaurant={restaurant} rgLow={rgLow} run={run} session={session} onRated={(t, sent) => rated(t.thanks, sent)} />}
      {tm && <RatingTestimonial entryId={entryId} about={isAbout(about) ? about : "other"} score={tm.score} note={tm.note} mine={tm.mine} headId={`rr-tm-${entryId}`} onDone={() => setTm(null)} />}
    </article>
  );
}
