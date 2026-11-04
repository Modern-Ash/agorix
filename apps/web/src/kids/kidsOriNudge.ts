import { useEffect, useRef, useState } from "react";

/** How long a child is idle on an empty project before Ori shows it has an idea to offer. */
export const ORI_NUDGE_DELAY_MS = 25_000;
/** How long the invitation stays before it puts itself away. It is shown once per scene visit. */
export const ORI_NUDGE_SHOW_MS = 12_000;

/**
 * A quiet invitation (issue #1237). After a pause at the very start, Ori's own button changes its
 * label to "¿Una idea?" and bobs a little. It carries no idea, opens nothing and sends nothing:
 * the child decides whether to tap it. That keeps the rule that Ori never offers a solution on
 * entry (see `ORI_INTERVENTION_LIMITS`): this is an invitation, not an offer.
 *
 * `enabled` must be false whenever it would be rude or pointless: the adult switch is off, the
 * child already has blocks, Ori is already open, the page is hidden. The pause counts only real
 * activity; any tap or key press restarts it. It shows once, then never again for this visit.
 */
export function useOriNudge(enabled: boolean): boolean {
  const [nudging, setNudging] = useState(false);
  const shown = useRef(false);

  useEffect(() => {
    if (!enabled || shown.current) {
      setNudging(false);
      return undefined;
    }
    let wait: number | undefined;
    let hide: number | undefined;
    const start = () => {
      window.clearTimeout(wait);
      wait = window.setTimeout(() => {
        shown.current = true;
        setNudging(true);
        hide = window.setTimeout(() => setNudging(false), ORI_NUDGE_SHOW_MS);
      }, ORI_NUDGE_DELAY_MS);
    };
    start();
    const restart = () => {
      if (!shown.current) start();
    };
    window.addEventListener("pointerdown", restart, { passive: true });
    window.addEventListener("keydown", restart, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", restart);
      window.removeEventListener("keydown", restart);
      window.clearTimeout(wait);
      window.clearTimeout(hide);
      setNudging(false);
    };
  }, [enabled]);

  return nudging;
}
