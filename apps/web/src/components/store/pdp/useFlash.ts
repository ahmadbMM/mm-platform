import { useEffect, useState } from "react";

/** A state that turns itself off again: the add buttons' "Added" with its drawn tick (D14-E), for a moment after a tap,
 *  then back to Add (no pop-up, nothing fixed to the screen). */
export function useFlash(ms = 2500): [boolean, () => void] {
  const [at, setAt] = useState(0);
  useEffect(() => {
    if (!at) return;
    const id = setTimeout(() => setAt(0), ms);
    return () => clearTimeout(id);
  }, [at, ms]);
  return [at > 0, () => setAt(Date.now())];
}
