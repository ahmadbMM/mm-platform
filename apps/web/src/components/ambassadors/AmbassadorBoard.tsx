"use client";

import { useEffect, useState } from "react";
import { rpc } from "@/lib/rpc-client";
import { fmtNum } from "@/lib/fill";

// This quarter's top five (ambassador_board), read in the visitor's browser: first names and
// codes only. Nothing is shown until there is someone on it.
type Row = { first_name: string; code: string; uses: number; season: number };
type Props = { locale: string; title: string; text: string };
const MEDAL = ["#c49411", "#8a938c", "#b0764a"];

export default function AmbassadorBoard(p: Props) {
  const ar = p.locale === "ar";
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    let live = true;
    rpc<Row[]>("ambassador_board", {}).then((r) => { if (live && Array.isArray(r)) setRows(r); }).catch(() => {});
    return () => { live = false; };
  }, []);
  if (!rows.length) return null;
  const N = (n: number) => fmtNum(n, p.locale);
  return (
    <section className="amb-sec">
      <h2>{p.title}</h2>
      <p className="amb-muted">{p.text}</p>
      <ol className="amb-board">
        {rows.map((r, i) => (
          <li key={r.code}>
            <strong style={{ color: MEDAL[i] || "#8a938c" }}>{N(i + 1)}</strong>
            <span>{r.first_name} <small className="mm-lat">· {r.code}</small></span>
            <small>{N(r.uses)} {ar ? "استخدام" : "uses"}</small>
            <b>{N(r.season)} {ar ? "نقطة" : "pts"}</b>
          </li>
        ))}
      </ol>
    </section>
  );
}
