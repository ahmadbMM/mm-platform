"use client";

import { useState } from "react";
import RatingForm from "./RatingForm";
import type { RatingForm as Form } from "@/lib/rating";

// A finished ride not rated yet, as a card on My Account: the booking app's post-ride rating
// (RatingForm), for the rides from before the rating became a page a rider cannot skip
// (RatingGate). A rating that lands turns the card into a thank-you. `restaurant`: where the ride's
// breakfast was, which the form's breakfast box names (RatingForm).
type Props = { entryId: string; name: string; when: string; form: Form; noBike: boolean; restaurant?: string | null; rgLow?: number };

export default function RateRide({ entryId, name, when, form, noBike, restaurant, rgLow }: Props) {
  const [thanks, setThanks] = useState("");
  return (
    <article className="rr-card">
      <header className="rr-head"><strong>{name}</strong><span>{when}</span></header>
      {thanks ? <p className="rr-thanks" role="status">{thanks}</p> : <RatingForm entryId={entryId} form={form} noBike={noBike} restaurant={restaurant} rgLow={rgLow} onRated={(t) => setThanks(t.thanks)} />}
    </article>
  );
}
