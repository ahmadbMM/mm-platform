"use client";

import { useEffect, useState } from "react";
import { useL } from "@/i18n/TxProvider";
import { fill } from "@/lib/fill";

// The live "Open now · closes 22:00" sign, worked out in Jeddah time from the hours staff set.
export default function OpenNow({ openHour, closeHour, fridayClosed }: { openHour: number; closeHour: number; fridayClosed: boolean }) {
  const tx = useL();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    // The time is read in the browser (Jeddah's clock, not the server's cache), after the first paint.
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 60_000);
    return () => { clearTimeout(first); clearInterval(id); };
  }, []);
  if (!now) return <div className="hm-open" aria-hidden="true" />;
  const ksa = new Date(now.getTime() + now.getTimezoneOffset() * 60_000 + 3 * 3_600_000);
  const h = ksa.getHours() + ksa.getMinutes() / 60;
  const fri = ksa.getDay() === 5;
  const closedToday = fri && fridayClosed;
  const open = !closedToday && h >= openHour && h < closeHour;
  const hh = (n: number) => `${n}:00`;
  const status = open ? (tx("Open now", "مفتوح الآن")) : (tx("Closed", "مغلق"));
  // After closing on a Thursday, "tomorrow" would be the closed Friday: say Saturday.
  const nextIsFriday = ksa.getDay() === 4 && fridayClosed;
  const later = nextIsFriday ? (tx("opens Saturday", "يفتح السبت")) : (tx("opens tomorrow", "يفتح غداً"));
  const detail = open ? fill(tx("closes {time}", "يغلق {time}"), { time: hh(closeHour) })
    : closedToday ? (tx("opens tomorrow", "يفتح غداً"))
    : h < openHour ? fill(tx("opens {time}", "يفتح {time}"), { time: hh(openHour) }) : later;
  const col = open ? "#077a4b" : "#b3261e";
  return (
    <div className="hm-open" role="status">
      <span className="dot"><span style={{ background: col }} /><span style={{ background: col }} /></span>
      <strong>{status}</strong>
      <em>· {detail}</em>
    </div>
  );
}
